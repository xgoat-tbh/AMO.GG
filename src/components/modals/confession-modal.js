import { MessageFlags } from 'discord.js';
import { create } from '../../systems/confessions/confessionManager.js';
import { botConfig as config } from '../../helpers/configHelper.js';
import { emojis } from '../../config/emojis.config.js';
import { sanitizeContent } from '../../helpers/sanitizer.js';

export default {
  customId: 'confession:submit',

  async execute(interaction, client) {
    const parts = interaction.customId.split(':');
    const type = parts[2];

    if (!type || !['known', 'anonymous'].includes(type)) {
      await interaction.reply({ content: `${emojis.error} Invalid confession type.`, flags: MessageFlags.Ephemeral });
      return;
    }

    const content = interaction.fields.getTextInputValue('confession-content');

    // Validate and sanitize
    const { sanitized, valid, reason } = sanitizeContent(content, 2000, 'Confession');
    if (!valid) {
      await interaction.reply({ content: `${emojis.error} ${reason}`, flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const channelId = config.channels.confession;
    if (!channelId) {
      await interaction.editReply({ content: `${emojis.error} Confession channel is not configured.` });
      return;
    }

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) {
      await interaction.editReply({ content: `${emojis.error} Could not find the confession channel.` });
      return;
    }

    const author = interaction.user;
    await create(author, sanitized, type, channel, client);

    await interaction.editReply({
      content: `${emojis.success} Your ${type === 'anonymous' ? 'anonymous ' : ''}confession has been posted!`,
    });
  },
};
