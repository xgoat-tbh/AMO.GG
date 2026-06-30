import { ChannelType } from 'discord.js';
import { createV2Container, v2Payload, notification } from '../../helpers/v2Helper.js';
import { config } from '../../config/bot.config.js';
import { emojis } from '../../config/emojis.config.js';
import { handleCommandError, sendUsageError } from '../../helpers/errorHandler.js';
import { getDb } from '../../database/connection.js';
import { VcBanRepo } from '../../database/repositories/vcban.repo.js';

function parseUser(text) { return text?.replace(/[<@!>]/g, ''); }

export default {
  name: 'vcban',
  aliases: ['voiceban'],
  description: 'Ban users from joining voice channels.',
  usage: '?vcban <add|remove|list|check> [@user] [#channel] [reason]',
  permission: 'admin',

  async execute(message, args, client) {
    try {
      if (!args.length) return sendUsageError(message, this.usage);
      const sub = args[0].toLowerCase();
      const rest = args.slice(1);

      switch (sub) {
        case 'add': {
          if (rest.length < 1) return sendUsageError(message, '?vcban add @user [#channel] [reason]');
          const targetId = parseUser(rest[0]);
          const target = await message.guild.members.fetch(targetId).catch(() => null);
          if (!target) {
            const card = notification('error', `${emojis.error} User not found.`, client);
            const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
            setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
            return;
          }

          let channelId = null;
          let channelName = 'all voice channels';
          let restIdx = 1;

          if (rest[1] && (rest[1].startsWith('<#') || /^\d{17,19}$/.test(rest[1]))) {
            const mentionId = parseUser(rest[1]);
            const ch = message.guild.channels.cache.get(mentionId);
            if (ch && ch.type === ChannelType.GuildVoice) {
              channelId = ch.id;
              channelName = ch.name;
              restIdx = 2;
            }
          }

          const reason = rest.slice(restIdx).join(' ') || null;

          // Apply permission overwrite
          const voiceChannels = channelId
            ? [message.guild.channels.cache.get(channelId)].filter(Boolean)
            : [...message.guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).values()];

          let applied = 0;
          for (const vc of voiceChannels) {
            try {
              await vc.permissionOverwrites.edit(targetId, { Connect: false });
              applied++;
            } catch {}
          }

          const db = getDb();
          VcBanRepo.add(db, message.guild.id, targetId, channelId, message.author.id, reason);

          const lines = [
            `### \uD83D\uDEAB VC Ban Applied`,
            `**User:** ${target.user.tag}`,
            `**Scope:** ${channelName}`,
            `**Channels:** ${applied}`,
            reason ? `**Reason:** ${reason}` : '',
          ];

          const card = notification('success', lines.filter(Boolean).join('\n'), client);
          const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
          try { await message.delete(); } catch {}
          setTimeout(async () => { try { await reply.delete(); } catch {}; }, 8000);
          return;
        }

        case 'remove':
        case 'unban': {
          if (rest.length < 1) return sendUsageError(message, '?vcban remove @user [#channel]');
          const targetId = parseUser(rest[0]);
          let channelId = null;

          if (rest[1] && (rest[1].startsWith('<#') || /^\d{17,19}$/.test(rest[1]))) {
            channelId = parseUser(rest[1]);
          }

          const db = getDb();
          VcBanRepo.remove(db, message.guild.id, targetId, channelId);

          // Restore permissions
          const voiceChannels = channelId
            ? [message.guild.channels.cache.get(channelId)].filter(Boolean)
            : [...message.guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).values()];

          let restored = 0;
          for (const vc of voiceChannels) {
            try {
              await vc.permissionOverwrites.delete(targetId);
              restored++;
            } catch {}
          }

          const card = notification('success', `\u2705 VC ban removed for <@${targetId}>. Permissions restored on **${restored}** channel${restored !== 1 ? 's' : ''}.`, client);
          const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
          try { await message.delete(); } catch {}
          setTimeout(async () => { try { await reply.delete(); } catch {}; }, 8000);
          return;
        }

        case 'list': {
          const db = getDb();
          const bans = VcBanRepo.getAll(db, message.guild.id);
          if (bans.length === 0) {
            const card = notification('info', '\u2139\uFE0F No VC bans configured.', client);
            const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
            setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
            return;
          }

          const userBans = new Map();
          for (const b of bans) {
            if (!userBans.has(b.user_id)) userBans.set(b.user_id, []);
            userBans.get(b.user_id).push(b);
          }

          const lines = [
            '### \uD83D\uDEAB VC Bans',
            '',
            ...[...userBans.entries()].map(([userId, userBans]) => {
              const scope = userBans.map(b => b.channel_id ? `<#${b.channel_id}>` : '**All VCs**').join(', ');
              return `\u2022 <@${userId}> \u2014 ${scope}`;
            }),
          ];

          const container = createV2Container({ description: lines.join('\n'), client });
          const reply = await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
          setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 15000);
          return;
        }

        case 'check': {
          if (rest.length < 1) return sendUsageError(message, '?vcban check @user [#channel]');
          const targetId = parseUser(rest[0]);
          const vc = message.member?.voice?.channel;
          const channelId = vc?.id || (rest[1] ? parseUser(rest[1]) : null);

          if (!channelId) {
            const card = notification('error', `${emojis.error} Specify a voice channel or join one.`, client);
            const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
            setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
            return;
          }

          const db = getDb();
          const banned = VcBanRepo.isBanned(db, message.guild.id, targetId, channelId);
          const bans = VcBanRepo.getByUser(db, message.guild.id, targetId);

          const lines = [
            `### \uD83D\uDD0D VC Ban Check`,
            `**User:** <@${targetId}>`,
            `**Channel:** <#${channelId}>`,
            `**Banned:** ${banned ? '\u2705 Yes' : '\u274C No'}`,
            bans.length > 0 ? `**Total bans on record:** ${bans.length}` : '',
          ];

          const container = createV2Container({ description: lines.filter(Boolean).join('\n'), client });
          const reply = await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
          setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 10000);
          return;
        }

        default:
          return sendUsageError(message, this.usage);
      }
    } catch (error) {
      await handleCommandError(message, error);
    }
  },
};
