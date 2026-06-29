import { createV2Container, createV2Error, v2Payload, codeStat } from '../../helpers/v2Helper.js';
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
        const reply = await message.reply({
          ...v2Payload(createV2Error('❌ You must be in a voice channel.', client)),
          allowedMentions: { repliedUser: false },
        });
        setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
        return;
      }

      const members = voiceManager.getVoiceMembers(vc);
      const sorted = [...members.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
      const memberList = sorted.map(m => `• ${m.user.displayName}`).join('\n');

      const container = createV2Container({
        title: `🔊 ${vc.name}`,
        description: [
          codeStat('Members', members.length),
          '',
          memberList || '*No members*',
        ].join('\n'),
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
