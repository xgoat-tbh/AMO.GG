import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder, MessageFlags } from 'discord.js';
import { createV2Container, v2Payload, codeStat, field, commandPills, permissionBadge, relativeTime, helpNavRow, categoryDropdown, searchDropdown, notification, CATEGORY_ORDER, CATEGORY_NAMES, CATEGORY_DESCRIPTIONS, getCategoryMeta } from '../../helpers/v2Helper.js';
import { config } from '../../config/bot.config.js';
import { emojis } from '../../config/emojis.config.js';
import { assets } from '../../config/assets.config.js';
import { handleCommandError } from '../../helpers/errorHandler.js';
import { checkPermission } from '../../helpers/permissions.js';

// ── Metadata ─────────────────────────────────────────────────────

const CATEGORY_THUMBNAILS = {
  utility: assets.help,
  voice: assets.voice,
  roles: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f3ad.png',
  suggestions: assets.suggestion,
  confessions: assets.confession,
  gameping: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f3ae.png',
  admin: assets.moderation,
  creator: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f3ac.png',
};

// ── View Renderers ───────────────────────────────────────────────

function renderHome(client, member) {
  const totalServers = client.guilds.cache.size;
  const totalMembers = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);
  const totalCmds = client.commands.size;
  const totalCats = CATEGORY_ORDER.length;

  const executorId = member.id;

  const lines = [
    `## Hey, I'm ${config.branding.name}`,
    '',
    `I'm that one bot who does a little bit of everything — voice stuff, roles, suggestions, confessions, game pings, and keeping the place from burning down. Probably.`,
    '',
    `**Prefix** \`${config.prefix}\``,
    `**Commands** \`${totalCmds}\` **Categories** \`${totalCats}\``,
    `**Serving** \`${totalServers}\` **servers** — \`${totalMembers.toLocaleString()}\` **members**`,
    '',
    `*Powered by ${config.branding.name} Devs*`,
  ].join('\n');

  const container = createV2Container({
    description: lines,
    color: config.colors.primary,
    thumbnail: client.user.displayAvatarURL(),
    client,
  });

  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`help:nav:${executorId}:home`)
      .setEmoji('🏠')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`help:support:${executorId}`)
      .setLabel('Support')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🆘'),
  );

  return {
    container,
    extraComponents: [
      categoryDropdown(executorId),
      navRow,
    ],
  };
}

function renderCategory(client, member, categoryKey, page = 1) {
  const executorId = member.id;
  const commands = [...client.commands.filter(cmd => cmd.category === categoryKey && checkPermission(member, cmd.permission)).values()]
    .sort((a, b) => a.name.localeCompare(b.name));

  const meta = getCategoryMeta(categoryKey);
  const cmdCount = commands.length;

  const cmdsPerPage = 14;
  const totalPages = Math.ceil(cmdCount / cmdsPerPage) || 1;
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * cmdsPerPage;
  const pageCmds = commands.slice(start, start + cmdsPerPage);

  const cmdList = pageCmds.map(c => `\`${c.name}\``).join(' ');

  const lines = [
    `### ${meta.emoji} ${meta.name}`,
    CATEGORY_DESCRIPTIONS[categoryKey] || '',
    `${cmdCount} command${cmdCount !== 1 ? 's' : ''}`,
    '',
    cmdList || '*No commands available*',
  ].join('\n');

  const catIdx = CATEGORY_ORDER.indexOf(categoryKey);
  const hasPrev = catIdx > 0;
  const hasNext = catIdx < CATEGORY_ORDER.length - 1;

  const container = createV2Container({
    description: lines,
    color: config.colors.primary,
    thumbnail: CATEGORY_THUMBNAILS[categoryKey] || assets.help,
    client,
  });

  const components = [categoryDropdown(executorId, categoryKey)];

  // Category pagination (cmd list pages within a category)
  if (totalPages > 1) {
    const catPageRow = new ActionRowBuilder();
    const prevBtn = new ButtonBuilder()
      .setCustomId(`help:cat_page:${categoryKey}:${safePage}:prev:${executorId}`)
      .setLabel('◀')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(safePage <= 1);
    const pageInd = new ButtonBuilder()
      .setCustomId(`help:cat_page_ind:${executorId}`)
      .setLabel(`${safePage}/${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true);
    const nextBtn = new ButtonBuilder()
      .setCustomId(`help:cat_page:${categoryKey}:${safePage}:next:${executorId}`)
      .setLabel('▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(safePage >= totalPages);
    catPageRow.addComponents(prevBtn, pageInd, nextBtn);
    components.push(catPageRow);
  }

  components.push(
    helpNavRow('category', executorId, {
      currentCategory: categoryKey,
      currentPage: safePage,
      cmdCount,
      hasPrevCategory: hasPrev,
      hasNextCategory: hasNext,
    })
  );

  return { container, extraComponents: components };
}

function renderCommandDetail(client, member, cmd) {
  const executorId = member.id;
  const meta = getCategoryMeta(cmd.category);

  const lines = [
    `### ${meta.emoji} ${cmd.name}`,
    '',
    cmd.description ? `*${cmd.description}*` : '',
    '',
    field('Category', `${meta.emoji} ${meta.name}`),
  ];

  if (cmd.aliases?.length) {
    lines.push(field('Aliases', cmd.aliases.map(a => `\`${a}\``).join(', ')));
  }

  lines.push(field('Usage', `\`${cmd.usage || `${config.prefix}${cmd.name}`}\``));

  if (cmd.examples?.length) {
    lines.push(field('Examples', cmd.examples.map(e => `\`${e}\``).join('\n')));
  }

  if (cmd.subcommands?.length) {
    lines.push(field('Subcommands', cmd.subcommands.map(s => `\`${s}\``).join(', ')));
  }

  lines.push(field('Permission', permissionBadge(cmd.permission || 'everyone')));

  if (cmd.cooldown) {
    lines.push(field('Cooldown', `${cmd.cooldown}s`));
  }

  if (cmd.notes) {
    lines.push(field('Notes', cmd.notes));
  }

  const container = createV2Container({
    description: lines.join('\n'),
    color: config.colors.primary,
    thumbnail: CATEGORY_THUMBNAILS[cmd.category] || assets.help,
    client,
  });

  const backBtn = new ButtonBuilder()
    .setCustomId(`help:back:${executorId}:${cmd.category}:1`)
    .setLabel('← Back')
    .setStyle(ButtonStyle.Secondary);

  return {
    container,
    extraComponents: [
      categoryDropdown(executorId, cmd.category),
      new ActionRowBuilder().addComponents(backBtn),
    ],
  };
}

function renderAllCommands(client, member, page = 1) {
  const executorId = member.id;
  const catsPerPage = 3;
  const totalPages = Math.ceil(CATEGORY_ORDER.length / catsPerPage) || 1;
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * catsPerPage;
  const pageCats = CATEGORY_ORDER.slice(start, start + catsPerPage);

  const sections = [];
  for (const catKey of pageCats) {
    const meta = getCategoryMeta(catKey);
    const cmds = [...client.commands.filter(c => c.category === catKey && checkPermission(member, c.permission)).values()]
      .sort((a, b) => a.name.localeCompare(b.name));
    const names = cmds.map(c => c.name);
    sections.push(`### ${meta.emoji} ${meta.name} (${names.length})`);
    sections.push(names.length ? names.map(n => `\`${n}\``).join(' ') : '*No commands*');
    sections.push('');
  }

  const lines = [
    `### 📋 All Commands`,
    '',
    ...sections,
    `Page ${safePage} of ${totalPages}`,
  ].join('\n');

  const container = createV2Container({
    description: lines,
    color: config.colors.primary,
    thumbnail: assets.help,
    client,
  });

  return {
    container,
    extraComponents: [
      categoryDropdown(executorId),
      helpNavRow('all', executorId, { currentPage: safePage, totalPages }),
    ],
  };
}

// ── Main Render Function ─────────────────────────────────────────

export function renderHelp(client, member, view = 'home', opts = {}) {
  const { category, page, command, query } = opts;
  let result;

  switch (view) {
    case 'category':
      result = renderCategory(client, member, category || 'utility', page || 1);
      break;
    case 'command':
      result = renderCommandDetail(client, member, command);
      break;
    case 'all':
      result = renderAllCommands(client, member, page || 1);
      break;
    default:
      result = renderHome(client, member);
  }

  const payload = v2Payload(result.container, result.extraComponents);
  payload.allowedMentions = { repliedUser: false };
  return payload;
}

// ── Command Definition ───────────────────────────────────────────

export default {
  name: 'help',
  aliases: ['h', 'commands', 'cmds'],
  description: 'View bot help and command categories.',
  usage: '?help [command]',
  permission: 'everyone',

  async execute(message, args, client) {
    try {
      if (args.length) {
        const query = args[0].toLowerCase();
        const cmd = client.commands.get(query) || client.commands.get(client.aliases.get(query));

        if (!cmd) {
          // Search for matching commands
          const matches = client.commands.filter(c =>
            c.name.includes(query) ||
            (c.aliases && c.aliases.some(a => a.includes(query)))
          ).sort((a, b) => a.name.localeCompare(b.name));

          if (matches.size === 0) {
            const reply = await message.reply({
              ...v2Payload(notification('error', ['❌ Command \`${query}\` not found.'], client)),
              allowedMentions: { repliedUser: false },
            });
            setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
            return;
          }

          if (matches.size === 1) {
            const cmd = matches.first();
            return message.reply({
              ...renderHelp(client, message.member, 'command', { command: cmd }),
              allowedMentions: { repliedUser: false },
            });
          }

          // Show search results
          const executorId = message.member.id;
          const matchNames = [...matches.values()].slice(0, 25);
          const lines = [
            `### 🔍 Search: \`${query}\``,
            `${matches.size} result${matches.size !== 1 ? 's' : ''}`,
            '',
            matchNames.map(c => `\`${c.name}\` — ${c.description || ''}`).join('\n'),
          ].join('\n');

          const container = createV2Container({
            description: lines,
            color: config.colors.primary,
            thumbnail: assets.help,
            client,
          });

          const searchRow = searchDropdown(executorId, query, matchNames);
          const components = [categoryDropdown(executorId)];
          if (searchRow) components.push(searchRow);

          return message.reply({
            ...v2Payload(container, components),
            allowedMentions: { repliedUser: false },
          });
        }

        return message.reply({
          ...renderHelp(client, message.member, 'command', { command: cmd }),
          allowedMentions: { repliedUser: false },
        });
      }

      return message.reply({
        ...renderHelp(client, message.member, 'home'),
        allowedMentions: { repliedUser: false },
      });
    } catch (error) {
      await handleCommandError(message, error);
    }
  },
};