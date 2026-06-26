import { handleInteractionError } from '../helpers/errorHandler.js';
import { logger } from '../helpers/logger.js';

export default {
  name: 'interactionCreate',

  async execute(interaction, client) {
    // ── Button interactions ────────────────────────────────────
    if (interaction.isButton()) {
      const handler = resolveHandler(interaction.customId, client.buttons);
      if (!handler) {
        logger.warn('INTERACTION', `No button handler found for: ${interaction.customId}`);
        return;
      }

      try {
        await handler.execute(interaction, client);
      } catch (error) {
        await handleInteractionError(interaction, error);
      }
      return;
    }

    // ── Select Menu interactions ───────────────────────────────
    if (interaction.isAnySelectMenu && interaction.isAnySelectMenu()) {
      const handler = resolveHandler(interaction.customId, client.selects);
      if (!handler) {
        logger.warn('INTERACTION', `No select handler found for: ${interaction.customId}`);
        return;
      }

      try {
        await handler.execute(interaction, client);
      } catch (error) {
        await handleInteractionError(interaction, error);
      }
      return;
    }

    // ── Modal Submit interactions ──────────────────────────────
    if (interaction.isModalSubmit()) {
      const handler = resolveHandler(interaction.customId, client.modals);
      if (!handler) {
        logger.warn('INTERACTION', `No modal handler found for: ${interaction.customId}`);
        return;
      }

      try {
        await handler.execute(interaction, client);
      } catch (error) {
        await handleInteractionError(interaction, error);
      }
      return;
    }
  },
};

/**
 * Resolve a component handler by customId.
 * Strategy: try 'part1:part2' first (e.g. 'suggestion:vote'), then 'part1' (e.g. 'suggestion').
 * This allows handlers to register for a category of interactions with a two-part prefix.
 */
function resolveHandler(customId, collection) {
  const parts = customId.split(':');

  // Try exact two-part key: 'system:action'
  if (parts.length >= 2) {
    const twoPartKey = `${parts[0]}:${parts[1]}`;
    const handler = collection.get(twoPartKey);
    if (handler) return handler;
  }

  // Try single-part key: 'system'
  return collection.get(parts[0]) || null;
}
