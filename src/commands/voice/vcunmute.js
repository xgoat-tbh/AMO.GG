import { createV2Container, createV2Success, createV2Error, v2Payload } from '../../helpers/v2Helper.js';
import { emojis } from '../../config/emojis.config.js';
import { handleCommandError, sendUsageError } from '../../helpers/errorHandler.js';
import { voiceManager } from '../../systems/voice/voiceManager.js';
import { isImmune } from '../../helpers/permissions.js';
import { logVoice } from '../../services/loggingService.js';

export default {
  name: 'vcunmute',
  aliases: ['vum'],
  description: 'Server unmute a user or everyone in your VC.',
  usage: '?vcunmute <@user | all>',
  permission: 'moderator',

  async execute(message, args, client) {
    try {
      if (!args.length) {
        return sendUsageError(message, this.usage);
      }

      let targets;

      if (args[0].toLowerCase() === 'all') {
        const vc = message.member.voice.channel;
        if (!vc) {
          return message.reply({
            ...v2Payload(createV2Error('❌ You must be in a voice channel.', client)),
            allowedMentions: { repliedUser: false },
          });
        }

        targets = voiceManager.getVoiceMembers(vc).filter(
          m => m.id !== message.author.id,
        );
      } else {
        const mentioned = message.mentions.members;
        if (!mentioned.size) {
          return sendUsageError(message, this.usage);
        }
        targets = [...mentioned.filter(m => m.voice.channel).values()];
      }

      if (!targets.length) {
        return message.reply({
          ...v2Payload(createV2Error('❌ No valid targets to unmute.', client)),
          allowedMentions: { repliedUser: false },
        });
      }

      await voiceManager.muteMembers(targets, false);

      await logVoice(client, {
        action: 'unmute',
        moderator: message.member,
        count: targets.length,
      });

      await message.reply({
        ...v2Payload(createV2Success(`✅ Server unmuted **${targets.length}** member${targets.length !== 1 ? 's' : ''}.`, client)),
        allowedMentions: { repliedUser: false },
      });
    } catch (error) {
      await handleCommandError(message, error);
    }
  },
};
