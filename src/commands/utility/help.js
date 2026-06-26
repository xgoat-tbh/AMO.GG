import { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder, MessageFlags } from 'discord.js';
import { createV2Error, v2Payload } from '../../helpers/v2Helper.js';
import { config } from '../../config/bot.config.js';
import { emojis } from '../../config/emojis.config.js';
import { handleCommandError } from '../../helpers/errorHandler.js';
import { checkPermission } from '../../helpers/permissions.js';
import { assets } from '../../config/assets.config.js';
import { existsSync } from 'node:fs';

const categoryNames = {
  utility: 'General',
  voice: 'Voice',
  roles: 'Roles',
  suggestions: 'Suggestions',
  confessions: 'Confessions',
  gameping: 'GamePing',
  admin: 'Administration',
};

const categoryDescriptions = {
  utility: 'General and utility tools for everyone.',
  voice: 'Voice channel management and configuration.',
  roles: 'Configure and assign roles in the guild.',
  suggestions: 'Submit and vote on community suggestions.',
  confessions: 'Send anonymous or known confessions.',
  gameping: 'Configure and ping game roles easily.',
  admin: 'Manage bot settings and server configuration.',
};

export function renderHelp(client, member, category = 'home', page = 1, sortOrder = 'asc', selectedCommandName = null) {
  const executorId = member.id;
  let files = [];

  const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`;
  const supportUrl = 'https://discord.gg/amo';
  const websiteUrl = 'https://amo.gg';

  const container = new ContainerBuilder();

  if (category === 'home') {
    // ── Home View ──
    const totalServers = client.guilds.cache.size;
    const totalMembers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);

    const homeText = [
      `### Hey, I'm ${config.branding.name}`,
      `• **My prefix is** \`${config.prefix}\``,
      `• **Type** \`${config.prefix}help\` **for more**`,
      `• **Serving** \`${totalMembers.toLocaleString()}\` **users in Amo India`,
      '',
      `${emojis.voice} » **Voice**`,
      `${emojis.roles} » **Roles**`,
      `${emojis.suggestion} » **Suggestions**`,
      `${emojis.confession} » **Confessions**`,
      `${emojis.game} » **GamePing**`,
      `${emojis.admin} » **Administration**`,
      `${emojis.general} » **General**`,
      '',
      '__**Links**__',
      `[Invite me](${inviteUrl}) • [Support](${supportUrl}) • [Website](${websiteUrl})`,
      '',
      `*Powered By ${config.branding.name} Devs*`
    ].join('\n');

    // Logo thumbnail accessory (local check)
    const logoPath = 'D:/Amo.gg/assets/logo.png';
    let thumbnailURL = client.user.displayAvatarURL();
    if (existsSync(logoPath)) {
      thumbnailURL = 'attachment://logo.png';
      files.push({
        attachment: logoPath,
        name: 'logo.png'
      });
    }

    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(homeText)
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder().setURL(thumbnailURL)
        )
    );

    // Dropdown 1: Switch category...
    const switchMenu = new StringSelectMenuBuilder()
      .setCustomId(`help:category:primary:${executorId}`)
      .setPlaceholder('Switch category...');
    switchMenu.addOptions([
      { label: 'Voice', value: 'voice' },
      { label: 'Roles', value: 'roles' },
      { label: 'Suggestions', value: 'suggestions' },
      { label: 'Confessions', value: 'confessions' },
    ]);
    container.addActionRowComponents(new ActionRowBuilder().addComponents(switchMenu));

    // Dropdown 2: More categories...
    const moreMenu = new StringSelectMenuBuilder()
      .setCustomId(`help:category:secondary:${executorId}`)
      .setPlaceholder('More categories...');
    moreMenu.addOptions([
      { label: 'GamePing', value: 'gameping' },
      { label: 'General', value: 'utility' },
      { label: 'Administration', value: 'admin' },
    ]);
    container.addActionRowComponents(new ActionRowBuilder().addComponents(moreMenu));

    // Buttons Row
    const buttonRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`help:page:prev:home:1:asc:${executorId}`)
        .setLabel('◀')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`help:indicator:${executorId}`)
        .setLabel('1/1')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`help:page:next:home:1:asc:${executorId}`)
        .setLabel('▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`help:sort:home:1:asc:${executorId}`)
        .setLabel('⇅')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );
    container.addActionRowComponents(buttonRow);

  } else {
    // ── Category View ──
    const commands = client.commands.filter(cmd => cmd.category === category && checkPermission(member, cmd.permission));
    const categoryName = categoryNames[category] || category.charAt(0).toUpperCase() + category.slice(1);
    const categoryDesc = categoryDescriptions[category] || '';

    // Sort commands
    const sortedCmds = [...commands.values()].sort((a, b) => {
      return sortOrder === 'desc' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name);
    });

    // Paginate commands
    const pageSize = 6;
    const totalPages = Math.ceil(sortedCmds.length / pageSize) || 1;
    const currentPage = Math.min(Math.max(1, page), totalPages);
    const startIndex = (currentPage - 1) * pageSize;
    const pageCmds = sortedCmds.slice(startIndex, startIndex + pageSize);

    // Build the combined description content
    const contentLines = [];

    if (selectedCommandName) {
      contentLines.push(`### Command Details`);
      const cmd = client.commands.get(selectedCommandName);
      if (cmd) {
        const aliases = cmd.aliases?.length ? cmd.aliases.map(a => `\`${a}\``).join(', ') : 'None';
        contentLines.push(
          `> **Command**: \`${cmd.name}\``,
          `> **Description**: ${cmd.description || 'No description'}`,
          `> **Usage**: \`${cmd.usage || `?${cmd.name}`}\``,
          `> **Aliases**: ${aliases}`,
          `> **Permission**: \`${cmd.permission || 'everyone'}\``
        );
      } else {
        contentLines.push(`*Command \`${selectedCommandName}\` not found.*`);
      }
    } else {
      contentLines.push(`### ${categoryName}`, categoryDesc, '');
      if (pageCmds.length === 0) {
        contentLines.push(`*No commands found in this category.*`);
      } else {
        const listLines = pageCmds.map(cmd => `• **${cmd.name}** - ${cmd.description || 'No description'}`);
        contentLines.push(listLines.join('\n'), ``, `Page ${currentPage} of ${totalPages}`);
      }
    }

    const sectionContent = contentLines.join('\n');

    const categoryIcons = {
      utility: assets.help || 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f6e0.png',
      voice: assets.voice || 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f3a7.png',
      roles: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f3ad.png',
      suggestions: assets.suggestion || 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f4a1.png',
      confessions: assets.confession || 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f4ad.png',
      gameping: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f3ae.png',
      admin: assets.moderation || 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f6e1.png',
    };

    const catThumbnailURL = categoryIcons[category] || 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f4d6.png';

    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(sectionContent)
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder().setURL(catThumbnailURL)
        )
    );
    // Dropdown 1: Switch category...
    const switchMenu = new StringSelectMenuBuilder()
      .setCustomId(`help:category:primary:${executorId}`)
      .setPlaceholder('Switch category...');
    const primaryOptions = [
      { label: 'Voice', value: 'voice' },
      { label: 'Roles', value: 'roles' },
      { label: 'Suggestions', value: 'suggestions' },
      { label: 'Confessions', value: 'confessions' },
    ].map(opt => ({ ...opt, default: opt.value === category }));
    switchMenu.addOptions(primaryOptions);
    container.addActionRowComponents(new ActionRowBuilder().addComponents(switchMenu));

    // Dropdown 2: More categories...
    const moreMenu = new StringSelectMenuBuilder()
      .setCustomId(`help:category:secondary:${executorId}`)
      .setPlaceholder('More categories...');
    const secondaryOptions = [
      { label: 'GamePing', value: 'gameping' },
      { label: 'General', value: 'utility' },
      { label: 'Administration', value: 'admin' },
    ].map(opt => ({ ...opt, default: opt.value === category }));
    moreMenu.addOptions(secondaryOptions);
    container.addActionRowComponents(new ActionRowBuilder().addComponents(moreMenu));

    // Select 3: Select a command for details... (only in command list view)
    if (!selectedCommandName && sortedCmds.length > 0) {
      const detailMenu = new StringSelectMenuBuilder()
        .setCustomId(`help:command:${category}:${currentPage}:${sortOrder}:${executorId}`)
        .setPlaceholder('Select a command for details...');
      const detailOptions = sortedCmds.map(cmd => ({
        label: cmd.name,
        value: cmd.name,
        description: cmd.description ? (cmd.description.length > 50 ? cmd.description.slice(0, 47) + '...' : cmd.description) : undefined
      }));
      detailMenu.addOptions(detailOptions);
      container.addActionRowComponents(new ActionRowBuilder().addComponents(detailMenu));
    }

    // Pagination / Back Buttons
    const buttonRow = new ActionRowBuilder();
    if (selectedCommandName) {
      const backBtn = new ButtonBuilder()
        .setCustomId(`help:back:${category}:${currentPage}:${sortOrder}:${executorId}`)
        .setLabel('Back to Category')
        .setStyle(ButtonStyle.Secondary);
      buttonRow.addComponents(backBtn);
    } else {
      const prevBtn = new ButtonBuilder()
        .setCustomId(`help:page:prev:${category}:${currentPage}:${sortOrder}:${executorId}`)
        .setLabel('◀')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage === 1);

      const pageIndicator = new ButtonBuilder()
        .setCustomId(`help:indicator:${executorId}`)
        .setLabel(`${currentPage}/${totalPages}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true);

      const nextBtn = new ButtonBuilder()
        .setCustomId(`help:page:next:${category}:${currentPage}:${sortOrder}:${executorId}`)
        .setLabel('▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage === totalPages);

      const sortBtn = new ButtonBuilder()
        .setCustomId(`help:sort:${category}:${currentPage}:${sortOrder}:${executorId}`)
        .setLabel('⇅')
        .setStyle(ButtonStyle.Secondary);

      buttonRow.addComponents(prevBtn, pageIndicator, nextBtn, sortBtn);
    }
    container.addActionRowComponents(buttonRow);
  }

  container.setAccentColor(config.colors.primary);

  return {
    components: [container],
    flags: [MessageFlags.IsComponentsV2],
    files,
  };
}

export default {
  name: 'help',
  aliases: ['h'],
  description: 'View bot help and command categories.',
  usage: '?help [command]',
  permission: 'everyone',

  async execute(message, args, client) {
    try {
      // ── Specific command help ──
      if (args.length) {
        const query = args[0].toLowerCase();
        const cmd =
          client.commands.get(query) ||
          client.commands.get(client.aliases.get(query));

        if (!cmd) {
          return message.reply({
            ...v2Payload(createV2Error(`${emojis.error} Command \`${query}\` not found.`, client)),
            allowedMentions: { repliedUser: false },
          });
        }

        const payload = renderHelp(client, message.member, cmd.category, 1, 'asc', cmd.name);
        return message.reply({
          ...payload,
          allowedMentions: { repliedUser: false },
        });
      }

      // ── Default help panel ──
      const payload = renderHelp(client, message.member, 'home', 1, 'asc', null);
      await message.reply({
        ...payload,
        allowedMentions: { repliedUser: false },
      });
    } catch (error) {
      await handleCommandError(message, error);
    }
  },
};
