import { createV2Container, createV2Success, createV2Error, v2Payload } from '../../helpers/v2Helper.js';
import { emojis } from '../../config/emojis.config.js';
import { handleCommandError, sendUsageError } from '../../helpers/errorHandler.js';
import { voiceManager } from '../../systems/voice/voiceManager.js';
import { logVoice } from '../../services/loggingService.js';

export default {
  name: 'move',
  aliases: ['mv'],
  description: 'Move a user to a voice channel.',
  usage: '?move <@user> <#channel>',
  permission: 'moderator',

  async execute(message, args, client) {
    try {
      const member = message.mentions.members.first();
      const channel = message.mentions.channels.first();

      if (!member || !channel) {
        return sendUsageError(message, this.usage);
      }

      if (!channel.isVoiceBased()) {
        return message.reply({
          ...v2Payload(createV2Error(`${emojis.error} ${channel} is not a voice channel.`, client)),
          allowedMentions: { repliedUser: false },
        });
      }

      if (!member.voice.channel) {
        return message.reply({
          ...v2Payload(createV2Error(`${emojis.error} ${member} is not in a voice channel.`, client)),
          allowedMentions: { repliedUser: false },
        });
      }

      await voiceManager.moveMembers([member], channel);

      await logVoice(client, {
        action: 'move',
        target: member,
        moderator: message.member,
        from: member.voice.channel,
        to: channel,
      });

      await message.reply({
        ...v2Payload(createV2Success(`${emojis.success} Moved ${member} to **${channel.name}**.`, client)),
        allowedMentions: { repliedUser: false },
      });
    } catch (error) {
      await handleCommandError(message, error);
    }
  },
};
