import { createV2Container, v2Payload, v2EditPayload } from '../../helpers/v2Helper.js';
import { config } from '../../config/bot.config.js';
import { handleCommandError } from '../../helpers/errorHandler.js';

export default {
  name: 'ping',
  aliases: ['pong', 'latency'],
  description: 'Check bot latency.',
  usage: '?ping',
  permission: 'everyone',

  async execute(message, args, client) {
    try {
      const sent = await message.reply({
        ...v2Payload(createV2Container({ description: '🏓 Pinging...', color: config.colors.primary, client })),
        allowedMentions: { repliedUser: false },
      });

      const roundTrip = sent.createdTimestamp - message.createdTimestamp;
      const apiLatency = Math.round(client.ws.ping);

      const container = createV2Container({
        description: `🏓 **Pong!**\nLatency: \`${roundTrip}ms\`\nAPI: \`${apiLatency}ms\``,
        color: config.colors.primary,
        client,
      });

      await sent.edit(v2EditPayload(container));
    } catch (error) {
      await handleCommandError(message, error);
    }
  },
};
