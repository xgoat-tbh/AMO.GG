import { ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } from 'discord.js';
import { getChannelSnipes } from '../../systems/snipe/snipeManager.js';
import { createV2Container, v2EditPayload } from '../../helpers/v2Helper.js';
import { config } from '../../config/bot.config.js';
import { emojis } from '../../config/emojis.config.js';

export default {
  customId: 'snipe:back',

  async execute(interaction, client) {
    const parts = interaction.customId.split(':');
    const executorId = parts[2];

    if (executorId && interaction.user.id !== executorId) {
      await interaction.reply({
        content: `${emojis.error} Only the person who ran the snipe command can use this menu.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const snipes = getChannelSnipes(interaction.channel.id);
    if (!snipes.length) {
      await interaction.reply({
        content: `${emojis.error} No deleted messages found in this channel.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const authorMap = new Map();
    for (const msg of snipes) {
      const id = msg.author.id;
      if (!authorMap.has(id)) {
        authorMap.set(id, { ...msg.author, count: 0 });
      }
      authorMap.get(id).count++;
    }

    const users = [...authorMap.values()];

    const menu = new StringSelectMenuBuilder()
      .setCustomId(`snipe:user:${executorId}`)
      .setPlaceholder('Select a user to view their deleted messages...');

    for (const user of users) {
      const label = `${user.displayName} (${user.count})`.slice(0, 100);
      menu.addOptions({
        label,
        value: user.id,
      });
    }

    const row = new ActionRowBuilder().addComponents(menu);

    const container = createV2Container({
      description: `### 🎯 Snipe — User Selection\nSelect a user to view their deleted messages from this channel.`,
      color: config.colors.primary,
      client,
    });

    await interaction.deferUpdate();

    const payload = v2EditPayload(container, [row]);
    await interaction.editReply(payload);
  },
};
