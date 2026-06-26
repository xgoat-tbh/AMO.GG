import { MessageFlags } from 'discord.js';
import { getDraft, saveDraft, buildBuilderPayload } from '../../systems/embeds/embedBuilderManager.js';
import { logger } from '../../helpers/logger.js';

export default {
  // Matches customId starting with embed:submit
  customId: 'embed:submit',

  async execute(interaction, client) {
    const parts = interaction.customId.split(':');
    const field = parts[2]; // 'title', 'description', 'color', 'thumbnail', 'channel'
    const userId = interaction.user.id;

    // Check ownership
    const draft = getDraft(userId);
    if (!draft || (draft.messageId && draft.messageId !== interaction.message.id)) {
      await interaction.reply({
        content: '❌ **You do not own this builder session.**',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferUpdate();

    let value = interaction.fields.getTextInputValue('value');

    // Perform validation and parsing
    if (field === 'color') {
      let clean = value.trim();
      if (!clean.startsWith('#')) {
        clean = '#' + clean;
      }
      // Simple hex color validator
      const hexMatch = clean.match(/^#[0-9a-fA-F]{6}$/);
      if (hexMatch) {
        saveDraft(userId, { color: clean });
      }
    } else if (field === 'thumbnail') {
      let clean = value.trim();
      if (clean === '') {
        saveDraft(userId, { thumbnail: null });
      } else if (clean.startsWith('http://') || clean.startsWith('https://')) {
        saveDraft(userId, { thumbnail: clean });
      }
    } else if (field === 'channel') {
      let clean = value.trim();
      // Extract channel ID if mention is passed: <#1234567890>
      const match = clean.match(/^<#(\d+)>$/);
      const channelId = match ? match[1] : clean;

      // Verify channel exists in current guild
      const targetChannel = interaction.guild.channels.cache.get(channelId);
      if (targetChannel) {
        saveDraft(userId, { channelId });
      }
    } else if (field === 'title') {
      saveDraft(userId, { title: value.trim() });
    } else if (field === 'description') {
      saveDraft(userId, { description: value });
    }

    // Rebuild preview card and edit the wizard message
    const payload = buildBuilderPayload(client, userId);
    await interaction.editReply(payload).catch(err => {
      logger.error('EMBED_MODAL', `Failed to edit preview message: ${err.message}`, err);
    });
  },
};
