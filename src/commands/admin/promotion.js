import { createV2Container, v2Payload, notification, codeStat } from '../../helpers/v2Helper.js';
import { config } from '../../config/bot.config.js';
import { emojis } from '../../config/emojis.config.js';
import { handleCommandError, sendUsageError } from '../../helpers/errorHandler.js';
import { getDb } from '../../database/connection.js';
import { PromotionRepo } from '../../database/repositories/promotion.repo.js';

export default {
  name: 'promotion',
  aliases: ['antipromo', 'promo'],
  description: 'Manage anti-promotion filters.',
  usage: '?promotion <enable|disable|whitelist|blacklist|settings> [args]',
  permission: 'admin',

  async execute(message, args, client) {
    try {
      if (!args.length) return this.showStatus(message, client);
      const sub = args[0].toLowerCase();
      const rest = args.slice(1);

      switch (sub) {
        case 'enable':
        case 'on': {
          const db = getDb();
          PromotionRepo.updateConfig(db, message.guild.id, { enabled: 1 });
          const card = notification('success', `✅ Anti-promotion **enabled**.`, client);
          const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
          setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
          return;
        }

        case 'disable':
        case 'off': {
          const db = getDb();
          PromotionRepo.updateConfig(db, message.guild.id, { enabled: 0 });
          const card = notification('success', `✅ Anti-promotion **disabled**.`, client);
          const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
          setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
          return;
        }

        case 'strict': {
          const db = getDb();
          const val = rest[0]?.toLowerCase();
          if (val === 'on' || val === 'true' || val === '1') {
            PromotionRepo.updateConfig(db, message.guild.id, { strict_mode: 1 });
            const card = notification('success', `✅ Strict mode **enabled**.`, client);
            const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
            setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
            return;
          }
          PromotionRepo.updateConfig(db, message.guild.id, { strict_mode: 0 });
          const card = notification('success', `✅ Strict mode **disabled**.`, client);
          const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
          setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
          return;
        }

        case 'whitelist': {
          const db = getDb();
          const action = rest[0]?.toLowerCase();
          const domain = rest[1]?.toLowerCase();
          if (action === 'add' && domain) {
            PromotionRepo.addWhitelist(db, message.guild.id, domain, message.author.id);
            const card = notification('success', `✅ \`${domain}\` added to whitelist.`, client);
            const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
            setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
            return;
          }
          if (action === 'remove' && domain) {
            PromotionRepo.removeWhitelist(db, message.guild.id, domain);
            const card = notification('success', `✅ \`${domain}\` removed from whitelist.`, client);
            const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
            setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
            return;
          }
          // List whitelist
          const whitelist = PromotionRepo.getWhitelist(db, message.guild.id);
          const wlLines = [
            `### 📋 Domain Whitelist`,
            whitelist.length ? whitelist.map(d => `• \`${d}\``).join('\n') : '*No domains whitelisted.*',
          ].join('\n');
          const container = createV2Container({ description: wlLines, color: config.colors.primary, client });
          return message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
        }

        case 'blacklist': {
          const db = getDb();
          const action = rest[0]?.toLowerCase();
          const domain = rest[1]?.toLowerCase();
          if (action === 'add' && domain) {
            PromotionRepo.addBlacklist(db, message.guild.id, domain, message.author.id);
            const card = notification('success', `✅ \`${domain}\` added to blacklist.`, client);
            const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
            setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
            return;
          }
          if (action === 'remove' && domain) {
            PromotionRepo.removeBlacklist(db, message.guild.id, domain);
            const card = notification('success', `✅ \`${domain}\` removed from blacklist.`, client);
            const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
            setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
            return;
          }
          const blacklist = PromotionRepo.getBlacklist(db, message.guild.id);
          const blLines = [
            `### 📋 Domain Blacklist`,
            blacklist.length ? blacklist.map(d => `• \`${d}\``).join('\n') : '*No domains blacklisted.*',
          ].join('\n');
          const container = createV2Container({ description: blLines, color: config.colors.primary, client });
          return message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
        }

        case 'log':
        case 'logs': {
          const db = getDb();
          const channel = message.mentions.channels.first();
          if (!channel) {
            const card = notification('error', `❌ Mention a channel for logs.`, client);
            const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
            setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
            return;
          }
          PromotionRepo.updateConfig(db, message.guild.id, { log_channel: channel.id });
          const card = notification('success', `✅ Promotion logs set to ${channel}.`, client);
          const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
          setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
          return;
        }

        case 'settings':
        default:
          return this.showStatus(message, client);
      }
    } catch (error) {
      await handleCommandError(message, error);
    }
  },

  async showStatus(message, client) {
    const db = getDb();
    const promoConfig = PromotionRepo.getConfig(db, message.guild.id);
    const whitelist = PromotionRepo.getWhitelist(db, message.guild.id);
    const blacklist = PromotionRepo.getBlacklist(db, message.guild.id);

    const lines = [
      `### 🚫 Anti-Promotion`,
      '',
      codeStat('Status', promoConfig.enabled ? `✅ Enabled` : `❌ Disabled`),
      codeStat('Strict Mode', promoConfig.strict_mode ? `✅ On` : `❌ Off`),
      codeStat('Auto-Delete', promoConfig.auto_delete ? `✅ On` : `❌ Off`),
      codeStat('Notify User', promoConfig.notify_user ? `✅ On` : `❌ Off`),
      promoConfig.log_channel ? codeStat('Log Channel', `<#${promoConfig.log_channel}>`) : '',
      '',
      `**Whitelisted Domains:** ${whitelist.length}`,
      `**Blacklisted Domains:** ${blacklist.length}`,
      '',
      `**Usage:** \`${config.prefix}promotion <enable|disable|whitelist|blacklist|settings>\``,
    ].filter(Boolean).join('\n');

    const container = createV2Container({ description: lines, color: config.colors.primary, client });
    await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
  },
};
