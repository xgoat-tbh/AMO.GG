import { PermissionFlagsBits } from 'discord.js';
import { createV2Container, v2Payload, notification } from '../../helpers/v2Helper.js';
import { config } from '../../config/bot.config.js';
import { emojis } from '../../config/emojis.config.js';
import { handleCommandError } from '../../helpers/errorHandler.js';
import { voiceManager } from '../../systems/voice/voiceManager.js';
import { logVoice } from '../../services/loggingService.js';

export default {
  name: 'shiftvc',
  aliases: ['svc'],
  description: 'Move everyone in your VC to another channel.',
  usage: '?svc <#channel>',
  permission: 'moderator',

  async execute(message, args, client) {
    try {
      const vc = message.member.voice.channel;
      if (!vc) {
        const card = notification('error', `${emojis.error} You must be in a voice channel.`, client);
        const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
        setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
        return;
      }

      const targetChannel = message.mentions.channels.first() || message.guild.channels.cache.get(args[0]);

      if (!targetChannel) {
        const card = notification('error', `${emojis.error} Channel not found. Use a channel mention or ID.`, client);
        const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
        setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
        return;
      }

      if (!targetChannel.isVoiceBased()) {
        const card = notification('error', `${emojis.error} ${targetChannel} is not a voice channel.`, client);
        const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
        setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
        return;
      }

      if (!message.member.permissions.has(PermissionFlagsBits.MoveMembers) && !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        const card = notification('error', `${emojis.error} You need the **Move Members** permission to use this command.`, client);
        const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
        setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
        return;
      }

      const members = voiceManager.getVoiceMembers(vc);

      if (members.length > 0) {
        await voiceManager.moveMembers(members, targetChannel);
      }

      await logVoice(client, {
        action: 'shiftvc',
        moderator: message.member,
        from: vc,
        to: targetChannel,
        count: members.length,
      });

      const card = notification('success', `${emojis.success} Moved **${members.length}** member${members.length !== 1 ? 's' : ''} from **${vc.name}** to **${targetChannel.name}**.`, client);
      await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
    } catch (error) {
      await handleCommandError(message, error);
    }
  },
};
