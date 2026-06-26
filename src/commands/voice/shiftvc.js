import { createV2Container, createV2Success, createV2Error, v2Payload } from '../../helpers/v2Helper.js';
import { emojis } from '../../config/emojis.config.js';
import { handleCommandError, sendUsageError } from '../../helpers/errorHandler.js';
import { voiceManager } from '../../systems/voice/voiceManager.js';
import { logVoice } from '../../services/loggingService.js';

export default {
  name: 'shiftvc',
  aliases: ['svc'],
  description: 'Move everyone in your VC to another channel.',
  usage: '?shiftvc <#channel>',
  permission: 'moderator',

  async execute(message, args, client) {
    try {
      const targetChannel = message.mentions.channels.first();

      if (!targetChannel) {
        return sendUsageError(message, this.usage);
      }

      if (!targetChannel.isVoiceBased()) {
        return message.reply({
          ...v2Payload(createV2Error(`${emojis.error} ${targetChannel} is not a voice channel.`, client)),
          allowedMentions: { repliedUser: false },
        });
      }

      const vc = message.member.voice.channel;
      if (!vc) {
        return message.reply({
          ...v2Payload(createV2Error(`${emojis.error} You must be in a voice channel.`, client)),
          allowedMentions: { repliedUser: false },
        });
      }

      const members = voiceManager.getVoiceMembers(vc);
      if (!members.length) {
        return message.reply({
          ...v2Payload(createV2Error(`${emojis.error} No members in your voice channel.`, client)),
          allowedMentions: { repliedUser: false },
        });
      }

      await voiceManager.moveMembers(members, targetChannel);

      await logVoice(client, {
        action: 'shiftvc',
        moderator: message.member,
        from: vc,
        to: targetChannel,
        count: members.length,
      });

      await message.reply({
        ...v2Payload(createV2Success(`${emojis.success} Moved **${members.length}** member${members.length !== 1 ? 's' : ''} from **${vc.name}** to **${targetChannel.name}**.`, client)),
        allowedMentions: { repliedUser: false },
      });
    } catch (error) {
      await handleCommandError(message, error);
    }
  },
};
