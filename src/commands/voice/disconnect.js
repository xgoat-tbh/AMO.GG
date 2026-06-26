import { createV2Container, createV2Success, createV2Error, v2Payload } from '../../helpers/v2Helper.js';
import { emojis } from '../../config/emojis.config.js';
import { handleCommandError, sendUsageError } from '../../helpers/errorHandler.js';
import { voiceManager } from '../../systems/voice/voiceManager.js';
import { logVoice } from '../../services/loggingService.js';

export default {
  name: 'disconnect',
  aliases: ['dc'],
  description: 'Disconnect users from voice.',
  usage: '?disconnect <@user> [@user2]',
  permission: 'moderator',

  async execute(message, args, client) {
    try {
      const members = message.mentions.members;

      if (!members.size) {
        return sendUsageError(message, this.usage);
      }

      const inVoice = members.filter(m => m.voice.channel);
      if (!inVoice.size) {
        return message.reply({
          ...v2Payload(createV2Error(`${emojis.error} None of the mentioned users are in a voice channel.`, client)),
          allowedMentions: { repliedUser: false },
        });
      }

      await voiceManager.disconnectMembers([...inVoice.values()]);

      for (const [, member] of inVoice) {
        await logVoice(client, {
          action: 'disconnect',
          target: member,
          moderator: message.member,
        });
      }

      const names = inVoice.map(m => m.user.tag).join(', ');
      await message.reply({
        ...v2Payload(createV2Success(`${emojis.success} Disconnected **${names}** from voice.`, client)),
        allowedMentions: { repliedUser: false },
      });
    } catch (error) {
      await handleCommandError(message, error);
    }
  },
};
