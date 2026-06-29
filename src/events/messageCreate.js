import { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { config } from '../config/bot.config.js';
import { checkPermission, isBotOwner } from '../helpers/permissions.js';
import { handleCommandError, sendPermissionDenied } from '../helpers/errorHandler.js';
import { createV2Container, v2Payload, codeStat } from '../helpers/v2Helper.js';
import { metricsManager } from '../helpers/metricsManager.js';
import { checkCommandRateLimit, getCommandRateLimitInfo } from '../helpers/rateLimiter.js';
import { xpManager } from '../systems/levels/xpManager.js';
import { emojis } from '../config/emojis.config.js';
import { getDb } from '../database/connection.js';
import { PromotionRepo } from '../database/repositories/promotion.repo.js';
import { scanForPromotion, isLikelyPromotion } from '../systems/moderation/promotionScanner.js';

export default {
  name: 'messageCreate',

  async execute(message, client) {
    if (message.author.bot) return;
    if (!message.guild) return;

    // Blacklist check
    if (client.blacklist && client.blacklist.has(message.author.id)) {
      return;
    }

    // ── Bot mention response ──
    const mentionMatch = message.content.match(new RegExp(`^<@!?${client.user.id}>`));
    if (mentionMatch) {
      const lines = [
        `### 🤖 Amo.GG`,
        `Your all-in-one server management bot.`,
        '',
        codeStat('Prefix', config.prefix),
        codeStat('Commands', client.commands.size),
        `• **Help** \`${config.prefix}help\``,
      ];

      const container = createV2Container({
        description: lines.join('\n'),
        color: config.colors.primary,
        thumbnail: client.user.displayAvatarURL(),
        client,
      });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`help:support:${message.author.id}`)
          .setLabel('Support')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🆘'),
        new ButtonBuilder()
          .setCustomId(`help:nav:${message.author.id}:home`)
          .setLabel('Help')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📖'),
      );

      await message.reply({
        ...v2Payload(container, [row]),
        allowedMentions: { repliedUser: false },
      });
      return;
    }

    // ── Non-command message handling ──
    if (!message.content.startsWith(config.prefix)) {
      // Award XP (async, non-blocking)
      xpManager.handleMessage(message.author.id, message.guild.id).catch(() => null);

      // Anti-promotion scanning for non-mod users
      const isMod = checkPermission(message.member, 'moderator');
      if (!isMod && isLikelyPromotion(message.content)) {
        const db = getDb();
        const config = PromotionRepo.getConfig(db, message.guild.id);
        if (config.enabled) {
          const result = scanForPromotion(message.content, message.guild.id, db, PromotionRepo);
          if (result.detected && config.auto_delete) {
            try {
              await message.delete();
              if (config.log_channel) {
                const logCh = client.channels.cache.get(config.log_channel);
                if (logCh) {
                  const logLines = [
                    `### 🚫 Promotion Blocked`,
                    `**User:** ${message.author.tag} (<@${message.author.id}>)`,
                    `**Channel:** <#${message.channel.id}>`,
                    `**Reason:** ${result.reasons.join(', ')}`,
                    `**Content:** \`\`\`${message.content.slice(0, 200)}\`\`\``,
                  ];
                  const { createV2Container } = await import('../helpers/v2Helper.js');
                  const container = createV2Container({ description: logLines.join('\n'), color: config.colors.error, client });
                  logCh.send({ components: [container], flags: [MessageFlags.IsComponentsV2] }).catch(() => null);
                }
              }
              if (config.notify_user) {
                await message.author.send(`${emojis.warning} Your message was removed due to: ${result.reasons.join(', ')}`).catch(() => null);
              }
            } catch {}
          }
        }
      }
      return;
    }

    // ── Command handling ──
    const args = message.content.slice(config.prefix.length).trim().split(/\s+/);
    const commandName = args.shift().toLowerCase();
    if (!commandName) return;

    const command =
      client.commands.get(commandName) ||
      client.commands.get(client.aliases.get(commandName));

    if (!command) return;

    // Maintenance check
    if (client.maintenanceMode && !isBotOwner(message.author)) {
      try {
        const container = createV2Container({
          title: '⚙️ Maintenance Mode',
          description: 'Amo.GG is currently undergoing maintenance. Please try again later.',
          color: config.colors.warning,
          client,
        });
        const reply = await message.reply({
          ...v2Payload(container),
          allowedMentions: { repliedUser: false },
        });
        try { await message.delete(); } catch {}
        setTimeout(async () => {
          try { await reply.delete(); } catch {}
        }, 6000);
      } catch {}
      return;
    }

    // Permission check
    if (command.category === 'dev' || command.permission === 'dev') {
      if (!isBotOwner(message.author)) {
        return sendPermissionDenied(message);
      }
    } else if (command.permission && command.permission !== 'everyone') {
      if (!checkPermission(message.member, command.permission)) {
        return sendPermissionDenied(message);
      }
    }

    // Rate limiting
    if (!checkCommandRateLimit(message.author.id, command.name)) {
      const info = getCommandRateLimitInfo(message.author.id, command.name);
      const retryAfter = Math.ceil(info.resetIn / 1000);
      const container = createV2Container({
        title: '⏱️ Rate Limited',
        description: `You're using this command too fast. Please wait **${retryAfter}s** before trying again.`,
        color: config.colors.warning,
        client,
      });
      const reply = await message.reply({
        ...v2Payload(container),
        allowedMentions: { repliedUser: false },
      });
      try { await message.delete(); } catch {}
      setTimeout(async () => { try { await reply.delete(); } catch {} }, 6000);
      return;
    }

    // Execute
    const start = performance.now();
    try {
      await command.execute(message, args, client);
      const duration = performance.now() - start;
      metricsManager.recordCommand(command.name, duration, false);
    } catch (error) {
      const duration = performance.now() - start;
      metricsManager.recordCommand(command.name, duration, true);
      await handleCommandError(message, error);
    }
  },
};