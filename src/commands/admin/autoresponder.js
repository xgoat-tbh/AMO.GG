import { createV2Container, v2Payload, notification } from '../../helpers/v2Helper.js';
import { config } from '../../config/bot.config.js';
import { emojis } from '../../config/emojis.config.js';
import { handleCommandError, sendUsageError } from '../../helpers/errorHandler.js';
import { getDb } from '../../database/connection.js';
import { AutoResponderRepo } from '../../database/repositories/autoresponder.repo.js';

export default {
  name: 'autoresponder',
  aliases: ['vanity'],
  description: 'Manage automatic responses to specific triggers.',
  usage: '?autoresponder <add|remove|list|toggle> [args]',
  permission: 'admin',

  async execute(message, args, client) {
    try {
      if (!args.length) return sendUsageError(message, this.usage);
      const sub = args[0].toLowerCase();
      const rest = args.slice(1);

      switch (sub) {
        case 'add': {
          if (rest.length < 2) return sendUsageError(message, '?autoresponder add <trigger> <response> [-match=exact|contains|starts_with]');

          let matchType = 'exact';
          let triggerParts = rest;

          if (rest.length > 2 && rest[rest.length - 1].startsWith('-match=')) {
            const matchOpt = rest.pop().slice(7);
            if (['exact', 'contains', 'starts_with'].includes(matchOpt)) matchType = matchOpt;
          }

          const trigger = rest[0];
          const response = rest.slice(1).join(' ');

          if (trigger.length > 100) {
            const card = notification('error', `${emojis.error} Trigger must be 100 characters or less.`, client);
            const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
            setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
            return;
          }

          if (response.length > 1000) {
            const card = notification('error', `${emojis.error} Response must be 1000 characters or less.`, client);
            const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
            setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
            return;
          }

          const db = getDb();
          AutoResponderRepo.add(db, message.guild.id, trigger, response, matchType, message.author.id);

          const lines = [
            `### \u2705 Auto-Responder Added`,
            `**Trigger:** \`${trigger}\``,
            `**Match:** ${matchType}`,
            `**Response:** ${response.length > 100 ? response.slice(0, 100) + '...' : response}`,
          ];

          const card = notification('success', lines.join('\n'), client);
          const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
          try { await message.delete(); } catch {}
          setTimeout(async () => { try { await reply.delete(); } catch {}; }, 8000);
          return;
        }

        case 'remove':
        case 'delete': {
          if (rest.length < 1) return sendUsageError(message, '?autoresponder remove <id>');
          const id = parseInt(rest[0]);
          if (isNaN(id)) return sendUsageError(message, '?autoresponder remove <id>');

          const db = getDb();
          const existing = AutoResponderRepo.get(db, id);
          if (!existing) {
            const card = notification('error', `${emojis.error} Auto-responder \`${id}\` not found.`, client);
            const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
            setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
            return;
          }

          AutoResponderRepo.remove(db, id);
          const card = notification('success', `\u2705 Auto-responder \`${id}\` removed (\`${existing.trigger}\`).`, client);
          const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
          try { await message.delete(); } catch {}
          setTimeout(async () => { try { await reply.delete(); } catch {}; }, 8000);
          return;
        }

        case 'toggle': {
          if (rest.length < 1) return sendUsageError(message, '?autoresponder toggle <id>');
          const id = parseInt(rest[0]);
          if (isNaN(id)) return sendUsageError(message, '?autoresponder toggle <id>');

          const db = getDb();
          const newState = AutoResponderRepo.toggle(db, id);
          if (newState === null) {
            const card = notification('error', `${emojis.error} Auto-responder \`${id}\` not found.`, client);
            const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
            setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
            return;
          }

          const card = notification('success', `\u2705 Auto-responder \`${id}\` ${newState ? 'enabled' : 'disabled'}.`, client);
          const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
          try { await message.delete(); } catch {}
          setTimeout(async () => { try { await reply.delete(); } catch {}; }, 8000);
          return;
        }

        case 'list': {
          const db = getDb();
          const responders = AutoResponderRepo.getAll(db, message.guild.id);

          if (responders.length === 0) {
            const card = notification('info', '\u2139\uFE0F No auto-responders configured.', client);
            const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
            setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
            return;
          }

          const lines = [
            '### \uD83E\uDD16 Auto-Responders',
            '',
            ...responders.map(r => {
              const status = r.enabled ? '\u2705' : '\u274C';
              const trigger = r.trigger.length > 40 ? r.trigger.slice(0, 40) + '...' : r.trigger;
              const resp = r.response.length > 60 ? r.response.slice(0, 60) + '...' : r.response;
              return `${status} \`#${r.id}\` **\`${trigger}\`** [${r.match_type}] \u2192 ${resp}`;
            }),
            '',
            `**Total:** ${responders.length}`,
          ];

          const container = createV2Container({ description: lines.join('\n'), client });
          const reply = await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
          setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 15000);
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
