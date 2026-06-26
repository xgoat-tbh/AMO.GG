import { createV2Container, v2Payload } from '../../helpers/v2Helper.js';
import { config } from '../../config/bot.config.js';
import { handleCommandError } from '../../helpers/errorHandler.js';

export default {
  name: 'serverinfo',
  aliases: ['si'],
  description: 'View server information.',
  usage: '?serverinfo',
  permission: 'everyone',

  async execute(message, args, client) {
    try {
      const { guild } = message;

      const createdAt = `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`;

      const container = createV2Container({
        title: guild.name,
        thumbnail: guild.iconURL({ dynamic: true, size: 256 }),
        color: config.colors.primary,
        fields: [
          { name: 'Members', value: `${guild.memberCount}` },
          { name: 'Created', value: createdAt },
          { name: 'Boost Level', value: `Tier ${guild.premiumTier}` },
          { name: 'Boosts', value: `${guild.premiumSubscriptionCount ?? 0}` },
        ],
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
