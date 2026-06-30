import { handleInteractionError } from '../helpers/errorHandler.js';
import { logger } from '../helpers/logger.js';
import { checkComponentPermission, getPermissionRequirement, sendComponentPermissionDenied } from '../helpers/componentPermissions.js';
import { checkInteractionRateLimit, getInteractionRateLimitInfo } from '../helpers/rateLimiter.js';
import { config } from '../config/bot.config.js';
import { createV2Container, createV2Error, v2Payload } from '../helpers/v2Helper.js';
import { emojis } from '../config/emojis.config.js';

export default {
  name: 'interactionCreate',

  async execute(interaction, client) {
    // Check rate limit for all interaction types
    if (!checkInteractionRateLimit(interaction.user.id, interaction.customId)) {
      const info = getInteractionRateLimitInfo(interaction.user.id, interaction.customId);
      const retryAfter = Math.ceil(info.resetIn / 1000);
      const errContainer = createV2Error(
        `${emojis.error} You're interacting too fast. Please wait **${retryAfter}s** before trying again.`,
        client
      );
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ ...v2Payload(errContainer, [], true) });
        } else {
          await interaction.reply({ ...v2Payload(errContainer, [], true) });
        }
      } catch {}
      return;
    }

    // ── Button interactions ────────────────────────────────────
    if (interaction.isButton()) {
      const handler = resolveHandler(interaction.customId, client.buttons);
      if (!handler) {
        logger.warn('INTERACTION', `No button handler found for: ${interaction.customId}`);
        return;
      }

      // Permission check
      const requirement = getPermissionRequirement(interaction.customId);
      if (!(await checkComponentPermission(interaction, requirement))) {
        await sendComponentPermissionDenied(interaction);
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

      // Permission check
      const requirement = getPermissionRequirement(interaction.customId);
      if (!(await checkComponentPermission(interaction, requirement))) {
        await sendComponentPermissionDenied(interaction);
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

      // Permission check
      const requirement = getPermissionRequirement(interaction.customId);
      if (!(await checkComponentPermission(interaction, requirement))) {
        await sendComponentPermissionDenied(interaction);
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
 * Strategy: try three-part, then two-part, then single-part prefix.
 * Examples: 'help:support:modal:uid' → 'help:support:modal' → 'help:support' → 'help'
 */
function resolveHandler(customId, collection) {
  const parts = customId.split(':');

  // Try exact three-part key: 'system:action:sub'
  if (parts.length >= 3) {
    const threePartKey = `${parts[0]}:${parts[1]}:${parts[2]}`;
    const handler = collection.get(threePartKey);
    if (handler) return handler;
  }

  // Try exact two-part key: 'system:action'
  if (parts.length >= 2) {
    const twoPartKey = `${parts[0]}:${parts[1]}`;
    const handler = collection.get(twoPartKey);
    if (handler) return handler;
  }

  // Try single-part key: 'system'
  return collection.get(parts[0]) || null;
}
