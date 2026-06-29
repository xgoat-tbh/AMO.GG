import { createV2Container, createV2Success, createV2Error, v2Payload } from '../../helpers/v2Helper.js';
import { emojis } from '../../config/emojis.config.js';
import { handleCommandError } from '../../helpers/errorHandler.js';
import { voiceManager } from '../../systems/voice/voiceManager.js';
import { logVoice } from '../../services/loggingService.js';

export default {
  name: 'vclockdown',
  aliases: ['vcld'],
  description: 'Lockdown your voice channel.',
  usage: '?vclockdown',
  permission: 'moderator',

  async execute(message, args, client) {
    try {
      const vc = message.member.voice.channel;
      if (!vc) {
        return message.reply({
          ...v2Payload(createV2Error('❌ You must be in a voice channel.', client)),
          allowedMentions: { repliedUser: false },
        });
      }

      const result = await voiceManager.lockdown(vc, message.member, client);

      await logVoice(client, {
        action: 'lockdown',
        moderator: message.member,
        channel: vc,
        count: result?.affected ?? 0,
      });

      const cleanName = vc.name.replace(/^🔒\s*/, '');
      const reply = await message.reply({
        ...v2Payload(createV2Success(`**${cleanName}** has been locked down.`, client)),
        allowedMentions: { repliedUser: false },
      });

      try { await message.delete(); } catch {}
      setTimeout(async () => {
        try { await reply.delete(); } catch {}
      }, 6000);
    } catch (error) {
      await handleCommandError(message, error);
    }
  },
};
