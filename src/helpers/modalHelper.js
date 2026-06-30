import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';

export function createModal(customId, title, fields) {
  const modal = new ModalBuilder()
    .setCustomId(customId)
    .setTitle(title);

  for (const field of fields) {
    const input = new TextInputBuilder()
      .setCustomId(field.customId)
      .setLabel(field.label)
      .setStyle(field.style || TextInputStyle.Short)
      .setRequired(field.required ?? true)
      .setPlaceholder(field.placeholder || '')
      .setMinLength(field.minLength || 1)
      .setMaxLength(field.maxLength || 4000);

    if (field.value) input.setValue(field.value);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
  }

  return modal;
}

export function showModal(interaction, modal) {
  return interaction.showModal(modal);
}
