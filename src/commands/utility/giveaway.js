import { getDb } from '../../database/connection.js';
import { GiveawaysRepo } from '../../database/repositories/giveaways.repo.js';
import { buildGiveawayPayload, updateGiveawayCard, rollGiveaway, rerollGiveaway } from '../../systems/giveaways/giveawayManager.js';
import { createV2Container, createV2Success, createV2Error, v2Payload } from '../../helpers/v2Helper.js';
import { checkPermission } from '../../helpers/permissions.js';
import { handleCommandError, sendUsageError } from '../../helpers/errorHandler.js';
import { config } from '../../config/bot.config.js';
import { assets } from '../../config/assets.config.js';
import { emojis } from '../../config/emojis.config.js';

export default {
  name: 'giveaway',
  aliases: ['gw', 'gstart'],
  description: 'Manage giveaways.',
  usage: '?giveaway <start | end | reroll> [args]',
  permission: 'moderator', // Moderators and Admins can manage giveaways

  async execute(message, args, client) {
    try {
      if (!args.length) {
        return this.sendHelp(message, client);
      }

      const subcommand = args[0].toLowerCase();

      switch (subcommand) {
        case 'start':
          return await this.handleStart(message, args.slice(1), client);
        case 'end':
          return await this.handleEnd(message, args.slice(1), client);
        case 'reroll':
          return await this.handleReroll(message, args.slice(1), client);
        default:
          return this.sendHelp(message, client);
      }
    } catch (error) {
      await handleCommandError(message, error);
    }
  },

  async sendHelp(message, client) {
    const lines = [
      '### 🎁 Giveaway Commands',
      `• \`?giveaway start <duration> <winners> <prize>\` — Starts a new giveaway.`,
      `  *Example: ?giveaway start 10m 2 Steam Key*`,
      `• \`?giveaway end <message_id>\` — Force-ends an active giveaway early.`,
      `• \`?giveaway reroll <message_id>\` — Selects new winners for an ended giveaway.`,
      `\n*Durations can be specified in seconds (s), minutes (m), hours (h), or days (d).*`
    ];

    const container = createV2Container({
      description: lines.join('\n'),
      color: config.colors.primary,
      thumbnail: assets.giveaway,
      client,
    });

    await message.reply({
      ...v2Payload(container),
      allowedMentions: { repliedUser: false },
    });
  },

  async handleStart(message, args, client) {
    if (args.length < 3) {
      return sendUsageError(message, '?giveaway start <duration> <winners> <prize>');
    }

    const durationStr = args[0];
    const winnersStr = args[1];
    const prize = args.slice(2).join(' ');

    const durationMs = parseDuration(durationStr);
    if (!durationMs) {
      const container = createV2Error('❌ Invalid duration format. Use e.g. `30s`, `10m`, `2h`, `1d`.', client);
      await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
      return;
    }

    const winnerCount = parseInt(winnersStr, 10);
    if (isNaN(winnerCount) || winnerCount <= 0) {
      const container = createV2Error('❌ Winner count must be a valid positive number.', client);
      await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
      return;
    }

    const endTime = Math.floor((Date.now() + durationMs) / 1000);

    const db = getDb();
    
    const giveawayData = GiveawaysRepo.create(db, {
      prize,
      hostId: message.author.id,
      channelId: message.channelId,
      endTime,
      winnerCount,
    });

    const payload = buildGiveawayPayload(client, giveawayData);
    const cardMessage = await message.channel.send(payload).catch(async err => {
      GiveawaysRepo.updateStatus(db, giveawayData.id, 'ended');
      throw err;
    });

    GiveawaysRepo.update(db, giveawayData.id, {
      message_id: cardMessage.id,
    });

    await updateGiveawayCard(client, giveawayData.id);

    try { await message.delete(); } catch {}
  },

  async handleEnd(message, args, client) {
    if (!args.length) {
      return sendUsageError(message, '?giveaway end <message_id>');
    }

    const messageId = args[0];
    const db = getDb();
    const giveaway = GiveawaysRepo.getByMessageId(db, messageId);

    if (!giveaway) {
      const container = createV2Error('❌ Giveaway message not found in database.', client);
      await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
      return;
    }

    if (giveaway.status !== 'active') {
      const container = createV2Error('❌ This giveaway has already ended.', client);
      await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
      return;
    }

    await rollGiveaway(client, giveaway);

    const container = createV2Success('✅ Giveaway rolled early successfully.', client);
    const reply = await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
    
    try { await message.delete(); } catch {}
    setTimeout(async () => {
      try { await reply.delete(); } catch {}
    }, 5000);
  },

  async handleReroll(message, args, client) {
    if (!args.length) {
      return sendUsageError(message, '?giveaway reroll <message_id>');
    }

    const messageId = args[0];

    try {
      const winners = await rerollGiveaway(client, messageId);
      const container = createV2Success(`✅ Rerolled giveaway successfully. New winners: ${winners.map(w => `<@${w}>`).join(', ')}`, client);
      await message.reply({ 
        ...v2Payload(container), 
        allowedMentions: { repliedUser: false } 
      });
    } catch (err) {
      const container = createV2Error(`❌ ${err.message}`, client);
      await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
    }
  },
};

function parseDuration(str) {
  const match = str.match(/^(\d+)(s|m|h|d)$/i);
  if (!match) return null;
  const num = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case 's': return num * 1000;
    case 'm': return num * 60000;
    case 'h': return num * 3600000;
    case 'd': return num * 86400000;
    default: return null;
  }
}
