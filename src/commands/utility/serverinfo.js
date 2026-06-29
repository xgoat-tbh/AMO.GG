import { createV2Container, v2Payload, codeStat, relativeTime } from '../../helpers/v2Helper.js';
import { config } from '../../config/bot.config.js';
import { checkPermission } from '../../helpers/permissions.js';
import { handleCommandError } from '../../helpers/errorHandler.js';

export default {
  name: 'serverinfo',
  aliases: ['si', 'server', 'guildinfo'],
  description: 'View server information.',
  usage: '?serverinfo',
  permission: 'everyone',

  async execute(message, args, client) {
    try {
      const { guild } = message;
      const isAdmin = checkPermission(message.member, 'admin');

      const channels = guild.channels.cache;
      const totalText = channels.filter(c => c.isTextBased?.()).size;
      const totalVoice = channels.filter(c => c.isVoiceBased?.()).size;
      const totalCats = channels.filter(c => c.type === 4).size;

      const lines = [
        `### ${guild.name}`,
        guild.description ? `*${guild.description}*` : '',
        '',
        codeStat('Members', guild.memberCount.toLocaleString()),
        codeStat('Channels', `📝 ${totalText} Text / 🔊 ${totalVoice} Voice / 📁 ${totalCats} Categories`),
        codeStat('Boosts', `Tier ${guild.premiumTier} — ${guild.premiumSubscriptionCount ?? 0}`),
        codeStat('Created', relativeTime(Math.floor(guild.createdTimestamp / 1000))),
        '',
        guild.features?.length ? `**Features:** ${guild.features.map(f => `\`${f}\``).join(', ')}` : '',
      ];

      if (isAdmin) {
        const owner = await guild.fetchOwner().catch(() => null);
        lines.push(
          '',
          `### ⚙️ Administration`,
          codeStat('Owner', owner ? owner.user.tag : 'Unknown'),
          codeStat('ID', guild.id),
          codeStat('Roles', guild.roles.cache.size),
          guild.vanityURLCode ? codeStat('Vanity', `discord.gg/${guild.vanityURLCode}`) : '',
          guild.systemChannel ? codeStat('System Channel', guild.systemChannel.name) : '',
          guild.afkChannel ? codeStat('AFK Channel', guild.afkChannel.name) : '',
          guild.publicUpdatesChannel ? codeStat('Updates Channel', guild.publicUpdatesChannel.name) : '',
          codeStat('Emojis', guild.emojis.cache.size),
          codeStat('Stickers', guild.stickers.cache.size),
        );
      }

      const container = createV2Container({
        description: lines.filter(Boolean).join('\n'),
        color: config.colors.primary,
        thumbnail: guild.iconURL({ dynamic: true, size: 256 }),
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