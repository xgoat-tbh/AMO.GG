import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, MessageFlags } from 'discord.js';
import { createV2Container, v2Payload } from '../../helpers/v2Helper.js';
import { config } from '../../config/bot.config.js';
import { handleCommandError } from '../../helpers/errorHandler.js';
import { emojis } from '../../config/emojis.config.js';

// In-memory cache to track user pending VC setup configurations
export const pendingVcs = new Map();

export const GAMES = [
  { label: 'Monopoly', value: 'Monopoly', get emoji() { return emojis.games?.['Monopoly'] || '🎲'; } },
  { label: 'Among Us', value: 'Among Us', get emoji() { return emojis.games?.['Among Us'] || '🚀'; } },
  { label: 'VALORANT', value: 'VALORANT', get emoji() { return emojis.games?.['VALORANT'] || '🔫'; } },
  { label: 'Brawlhalla', value: 'Brawlhalla', get emoji() { return emojis.games?.['Brawlhalla'] || '⚔️'; } },
  { label: 'Minecraft', value: 'Minecraft', get emoji() { return emojis.games?.['Minecraft'] || '⛏️'; } },
  { label: 'BGMI', value: 'BGMI', get emoji() { return emojis.games?.['BGMI'] || '🪂'; } },
  { label: 'Custom / Other', value: 'Custom', get emoji() { return emojis.games?.['Custom'] || '🎮'; } },
];

export default {
  name: 'gpvc',
  aliases: ['tempvc', 'gamingvc'],
  description: 'Create a temporary gaming voice channel.',
  usage: '?gpvc [game_alias]',
  permission: 'everyone',

  async execute(message, args, client) {
    try {
      const authorId = message.author.id;
      let selectedGame = null;

      // Improvement #12: Autocomplete game selection from command arguments
      if (args.length) {
        const inputGame = args.join(' ').toLowerCase();
        const matched = GAMES.find(g => g.value.toLowerCase() === inputGame || g.label.toLowerCase().includes(inputGame));
        if (matched) {
          selectedGame = matched.value;
        }
      }

      // Initialize pending state
      pendingVcs.set(authorId, {
        name: '',
        limit: 0,
        game: selectedGame,
      });

      const payload = buildSetupPayload(authorId, client);

      await message.reply({
        ...payload,
        allowedMentions: { repliedUser: false },
      });
    } catch (error) {
      await handleCommandError(message, error);
    }
  },
};

/**
 * Builds the setup payload for the ephemeral gpvc configuration.
 */
export function buildSetupPayload(userId, client, ephemeral = false) {
  const data = pendingVcs.get(userId) || { name: 'Lounge', limit: 0, game: null };

  const description = [
    'Configure your custom voice channel settings using the options below.',
    '',
    `• **Selected Game**: ${data.game ? `\`${data.game}\`` : '*None selected*'}`,
    `• **VC Status**: \`${data.name || 'Not set'}\``,
    `• **User Limit**: \`${data.limit > 0 ? `${data.limit} members` : 'No limit'}\``,
  ].join('\n');

  const container = createV2Container({
    title: '🎮 Create Temporary Gaming Voice Channel',
    description,
    color: config.colors.primary,
    client,
  });

  const select = new StringSelectMenuBuilder()
    .setCustomId(`gpvc:select_game:${userId}`)
    .setPlaceholder('Choose a Game')
    .addOptions(
      GAMES.map(g => ({
        label: g.label,
        value: g.value,
        emoji: g.emoji,
        default: data.game === g.value,
      }))
    );

  const configBtn = new ButtonBuilder()
    .setCustomId(`gpvc:btn_config:${userId}`)
    .setLabel('📝 Set Status & Limit')
    .setStyle(ButtonStyle.Secondary);

  const createBtn = new ButtonBuilder()
    .setCustomId(`gpvc:btn_create:${userId}`)
    .setLabel('🚀 Create Channel')
    .setStyle(ButtonStyle.Success);

  const selectRow = new ActionRowBuilder().addComponents(select);
  const buttonRow = new ActionRowBuilder().addComponents(configBtn, createBtn);

  const flags = [MessageFlags.IsComponentsV2];
  if (ephemeral) flags.push(MessageFlags.Ephemeral);

  return v2Payload(container, [selectRow, buttonRow], ephemeral);
}
