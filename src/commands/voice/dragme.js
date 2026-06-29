import { createV2Container, createV2Success, createV2Error, v2Payload } from '../../helpers/v2Helper.js';
import { emojis } from '../../config/emojis.config.js';
import { handleCommandError, sendUsageError } from '../../helpers/errorHandler.js';
import { voiceManager } from '../../systems/voice/voiceManager.js';

export default {
  name: 'dragme',
  aliases: ['dm'],
  description: 'Move yourself to a voice channel.',
  usage: '?dragme <#channel>',
  permission: 'moderator',

  async execute(message, args, client) {
    try {
      const targetChannel = message.mentions.channels.first();

      if (!targetChannel) {
        return sendUsageError(message, this.usage);
      }

      if (!targetChannel.isVoiceBased()) {
        return message.reply({
          ...v2Payload(createV2Error(`❌ ${targetChannel} is not a voice channel.`, client)),
          allowedMentions: { repliedUser: false },
        });
      }

      if (!message.member.voice.channel) {
        return message.reply({
          ...v2Payload(createV2Error('❌ You must be in a voice channel.', client)),
          allowedMentions: { repliedUser: false },
        });
      }

      await voiceManager.moveMembers([message.member], targetChannel);

      await message.reply({
        ...v2Payload(createV2Success(`✅ Moved you to **${targetChannel.name}**.`, client)),
        allowedMentions: { repliedUser: false },
      });
    } catch (error) {
      await handleCommandError(message, error);
    }
  },
};
