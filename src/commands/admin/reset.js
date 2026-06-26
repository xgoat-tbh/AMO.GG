import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createV2Container, v2Payload } from '../../helpers/v2Helper.js';
import { config } from '../../config/bot.config.js';
import { handleCommandError } from '../../helpers/errorHandler.js';

export default {
  name: 'reset',
  aliases: ['clearall', 'dbreset'],
  description: 'Reset all database states and clean logs (Admin only).',
  usage: '?reset',
  permission: 'admin',

  async execute(message, args, client) {
    try {
      const container = createV2Container({
        title: '⚠️ Database Reset Warning',
        description: 'Are you absolutely sure you want to reset everything? This will clear all suggestions, confessions, reports, voice states, and delete all logs. This action is irreversible!',
        color: config.colors.error,
        client,
      });

      const confirmBtn = new ButtonBuilder()
        .setCustomId(`admin:reset_confirm:${message.author.id}`)
        .setLabel('Wipe Database')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('⚠️');

      const cancelBtn = new ButtonBuilder()
        .setCustomId(`admin:reset_cancel:${message.author.id}`)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder().addComponents(confirmBtn, cancelBtn);

      await message.reply({
        ...v2Payload(container, [row]),
        allowedMentions: { repliedUser: false },
      });
    } catch (error) {
      await handleCommandError(message, error);
    }
  },
};
