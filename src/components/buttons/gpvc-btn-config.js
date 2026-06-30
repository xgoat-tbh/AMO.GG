import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } from 'discord.js';
import { pendingVcs } from '../../commands/voice/gpvc.js';
import { emojis } from '../../config/emojis.config.js';

export default {
  customId: 'gpvc:btn_config',

  async execute(interaction, client) {
    const parts = interaction.customId.split(':');
    const userId = parts[2];

    if (interaction.user.id !== userId) {
      await interaction.reply({
        content: `${emojis.error} This configuration menu does not belong to you.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const state = pendingVcs.get(userId) || { name: `${interaction.member.displayName}'s VC`, limit: 0, game: null };

    const modal = new ModalBuilder()
      .setCustomId(`gpvc:modal_config:${userId}`)
      .setTitle('🎮 VC Channel Settings');

    const nameInput = new TextInputBuilder()
      .setCustomId('vc_name')
      .setLabel('Voice Channel Status')
      .setPlaceholder("Grinding Start HH!")
      .setValue(state.name || '')
      .setStyle(TextInputStyle.Short)
      .setMaxLength(50)
      .setRequired(true);

    const limitInput = new TextInputBuilder()
      .setCustomId('vc_limit')
      .setLabel('User Limit (0 for no limit, max 99)')
      .setPlaceholder('5')
      .setValue(state.limit !== undefined && state.limit !== null ? String(state.limit) : '0')
      .setStyle(TextInputStyle.Short)
      .setMaxLength(2)
      .setRequired(false);

    const row1 = new ActionRowBuilder().addComponents(nameInput);
    const row2 = new ActionRowBuilder().addComponents(limitInput);

    modal.addComponents(row1, row2);

    await interaction.showModal(modal);
  },
};
