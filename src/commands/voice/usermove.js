import { createV2Container, createV2Success, createV2Error, v2Payload } from '../../helpers/v2Helper.js';
import { emojis } from '../../config/emojis.config.js';
import { handleCommandError, sendUsageError } from '../../helpers/errorHandler.js';
import { voiceManager } from '../../systems/voice/voiceManager.js';
import { logVoice } from '../../services/loggingService.js';

export default {
  name: 'usermove',
  aliases: ['um'],
  description: 'Move specific users to a voice channel.',
  usage: '?usermove <@user1> [@user2] <#channel>',
  permission: 'moderator',

  async execute(message, args, client) {
    try {
      const channel = message.mentions.channels.first();
      const members = message.mentions.members;

      if (!channel || !members.size) {
        return sendUsageError(message, this.usage);
      }

      if (!channel.isVoiceBased()) {
        return message.reply({
          ...v2Payload(createV2Error(`❌ ${channel} is not a voice channel.`, client)),
          allowedMentions: { repliedUser: false },
        });
      }

      // Filter to only members currently in a voice channel
      const inVoice = members.filter(m => m.voice.channel);
      if (!inVoice.size) {
        return message.reply({
          ...v2Payload(createV2Error('❌ None of the mentioned users are in a voice channel.', client)),
          allowedMentions: { repliedUser: false },
        });
      }

      await voiceManager.moveMembers([...inVoice.values()], channel);

      await logVoice(client, {
        action: 'usermove',
        moderator: message.member,
        to: channel,
        count: inVoice.size,
      });

      await message.reply({
        ...v2Payload(createV2Success(`✅ Moved **${inVoice.size}** user${inVoice.size !== 1 ? 's' : ''} to **${channel.name}**.`, client)),
        allowedMentions: { repliedUser: false },
      });
    } catch (error) {
      await handleCommandError(message, error);
    }
  },
};
