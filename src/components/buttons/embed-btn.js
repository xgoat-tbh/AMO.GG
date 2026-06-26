import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } from 'discord.js';
import { getDraft, deleteDraft, buildPublishedContainer } from '../../systems/embeds/embedBuilderManager.js';
import { createV2Success, v2Payload } from '../../helpers/v2Helper.js';
import { checkPermission } from '../../helpers/permissions.js';

export default {
  // Matches customId starting with embed:edit, embed:publish, embed:cancel
  customId: 'embed',

  async execute(interaction, client) {
    const parts = interaction.customId.split(':');
    const action = parts[1]; // 'edit', 'publish', 'cancel'
    const userId = interaction.user.id;

    // Only the user who started the builder session can click the buttons
    // We can verify this since the draft is keyed by userId. If they try to click other people's, we can deny access.
    // Wait, let's check: the interaction message contains the builder panel.
    // If the clicker doesn't match the session owner, they shouldn't edit it.
    // Let's check how we know who owns the session.
    // Wait, since drafts are keyed by userId, if another user clicks, we can check if they are the owner, or if there is no draft for them, etc.
    // But since the wizard is started by a specific user, we can enforce:
    // If they aren't the one who started it, deny. How to do that?
    // In our `?embed` command, we reply to the author.
    // Let's add a simple check: if the clicker doesn't have an active draft OR the draft message ID doesn't match?
    // Wait, actually, the clicker must be the creator. In `?embed`, we can save the message_id in the draft.
    // If `draft.messageId !== interaction.message.id`, we say "❌ You do not own this builder session."
    // This is incredibly robust! Let's implement this!

    const draft = getDraft(userId);
    if (!draft || (draft.messageId && draft.messageId !== interaction.message.id)) {
      await interaction.reply({
        content: '❌ **You do not own this builder session.** Run `?embed` to start your own builder.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (action === 'cancel') {
      deleteDraft(userId);
      const container = createV2Success('❌ **Embed building cancelled.**', client);
      await interaction.update({
        components: [container],
      });
      return;
    }

    if (action === 'publish') {
      // Validate
      if (!draft.title && !draft.description) {
        await interaction.reply({
          content: '❌ **Please specify at least a title or a description.**',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const targetChannelId = draft.channelId || interaction.channelId;
      const targetChannel = await client.channels.fetch(targetChannelId).catch(() => null);

      if (!targetChannel) {
        await interaction.reply({
          content: '❌ **Could not find the target channel.** Please update the target channel.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await interaction.deferUpdate();

      // Send the clean V2 container to target channel
      const container = buildPublishedContainer(client, draft);
      await targetChannel.send({
        components: [container],
      });

      // Delete draft
      deleteDraft(userId);

      // Edit wizard message to success state
      const successContainer = createV2Success(`🚀 **Embed published successfully in <#${targetChannelId}>!**`, client);
      await interaction.editReply({
        components: [successContainer],
      });
      return;
    }

    if (action === 'edit') {
      const field = parts[2]; // 'title', 'description', 'color', 'thumbnail', 'channel'

      const modal = new ModalBuilder()
        .setCustomId(`embed:submit:${field}`)
        .setTitle(`✏️ Edit Embed ${field.toUpperCase()}`);

      const input = new TextInputBuilder()
        .setCustomId('value')
        .setLabel(`Enter ${field}`)
        .setRequired(field === 'title' || field === 'description' || field === 'color');

      // Style and length constraints
      if (field === 'description') {
        input.setStyle(TextInputStyle.Paragraph);
        input.setMaxLength(2000);
        input.setPlaceholder('Embed description content...');
        if (draft.description && draft.description !== 'Draft Description') {
          input.setValue(draft.description);
        }
      } else {
        input.setStyle(TextInputStyle.Short);
        input.setMaxLength(100);
        
        if (field === 'title') {
          input.setPlaceholder('Embed title...');
          if (draft.title && draft.title !== 'Draft Title') {
            input.setValue(draft.title);
          }
        } else if (field === 'color') {
          input.setPlaceholder('e.g. #5865F2, #FF0000 or 5865F2');
          input.setValue(draft.color);
        } else if (field === 'thumbnail') {
          input.setPlaceholder('Image URL starting with http/https...');
          if (draft.thumbnail) {
            input.setValue(draft.thumbnail);
          }
        } else if (field === 'channel') {
          input.setPlaceholder('Channel ID or channel mention...');
          if (draft.channelId) {
            input.setValue(draft.channelId);
          }
        }
      }

      const row = new ActionRowBuilder().addComponents(input);
      modal.addComponents(row);

      await interaction.showModal(modal);
    }
  },
};
