import { getDraft, saveDraft, buildBuilderPayload, deleteDraft } from '../../systems/embeds/embedBuilderManager.js';
import { handleCommandError } from '../../helpers/errorHandler.js';

export default {
  name: 'embed',
  aliases: ['embedbuilder', 'builder'],
  description: 'Open the interactive visual embed builder.',
  usage: '?embed',
  permission: 'moderator', // Moderator or Admin command

  async execute(message, args, client) {
    try {
      const userId = message.author.id;

      // Delete any previous active drafts for this user to restart fresh
      deleteDraft(userId);

      // Initialize a new default draft
      const draft = getDraft(userId);

      // Build initial preview payload
      const payload = buildBuilderPayload(client, userId);
      const builderMsg = await message.channel.send(payload);

      // Update draft with message ID to lock interactions to this message
      saveDraft(userId, {
        messageId: builderMsg.id,
        channelId: message.channelId, // default target is current channel
      });

      // Delete the trigger message ?embed
      try {
        await message.delete();
      } catch {}
    } catch (error) {
      await handleCommandError(message, error);
    }
  },
};
