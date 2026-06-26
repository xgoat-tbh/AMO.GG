import { createV2Container, createV2Error, v2Payload } from '../../helpers/v2Helper.js';
import { config } from '../../config/bot.config.js';
import { emojis } from '../../config/emojis.config.js';
import { handleCommandError } from '../../helpers/errorHandler.js';
import { voiceManager } from '../../systems/voice/voiceManager.js';

export default {
  name: 'wv',
  aliases: ['whosvc', 'whovc'],
  description: "See who's in your voice channel.",
  usage: '?wv',
  permission: 'everyone',

  async execute(message, args, client) {
    try {
      const vc = message.member.voice.channel;

      if (!vc) {
        return message.reply({
          ...v2Payload(createV2Error(`${emojis.error} You must be in a voice channel.`, client)),
          allowedMentions: { repliedUser: false },
        });
      }

      const members = voiceManager.getVoiceMembers(vc);
      const list = members.map(m => `• ${m.user.tag}`).join('\n') || 'No members';

      const container = createV2Container({
        title: `${emojis.voice} ${vc.name}`,
        description: `**${members.length} member${members.length !== 1 ? 's' : ''}**\n\n${list}`,
        color: config.colors.voice,
        client,
      });

      await message.reply({
        ...v2Payload(container),
        allowedMentions: { repliedUser: false },
      });
    } catch (error) {
      await handleCommandError(message, error);
    }
  },
};
