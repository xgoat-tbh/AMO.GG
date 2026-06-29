import { createV2Container, createV2Success, createV2Error, v2Payload } from '../../helpers/v2Helper.js';
import { emojis } from '../../config/emojis.config.js';
import { handleCommandError, sendUsageError } from '../../helpers/errorHandler.js';
import { voiceManager } from '../../systems/voice/voiceManager.js';
import { logVoice } from '../../services/loggingService.js';

export default {
  name: 'forcemove',
  aliases: ['fm'],
  description: 'Force move a user to your voice channel.',
  usage: '?forcemove <@user>',
  permission: 'moderator',

  async execute(message, args, client) {
    try {
      const member = message.mentions.members.first();

      if (!member) {
        return sendUsageError(message, this.usage);
      }

      const vc = message.member.voice.channel;
      if (!vc) {
        return message.reply({
          ...v2Payload(createV2Error('❌ You must be in a voice channel.', client)),
          allowedMentions: { repliedUser: false },
        });
      }

      if (!member.voice.channel) {
        return message.reply({
          ...v2Payload(createV2Error(`❌ ${member} is not in a voice channel.`, client)),
          allowedMentions: { repliedUser: false },
        });
      }

      const fromChannel = member.voice.channel;
      await voiceManager.moveMembers([member], vc);

      await logVoice(client, {
        action: 'forcemove',
        target: member,
        moderator: message.member,
        from: fromChannel,
        to: vc,
      });

      await message.reply({
        ...v2Payload(createV2Success(`✅ Force moved ${member} to **${vc.name}**.`, client)),
        allowedMentions: { repliedUser: false },
      });
    } catch (error) {
      await handleCommandError(message, error);
    }
  },
};
