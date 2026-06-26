import { emojis } from '../config/emojis.config.js';
import { logger } from './logger.js';
import { v2Payload, createV2Error } from './v2Helper.js';

/**
 * Centralized error handler.
 * User-facing: clean, short, friendly.
 * Developer logs: detailed with stack traces.
 */

/**
 * Handle errors from prefix commands.
 */
export async function handleCommandError(message, error) {
  logger.error('CMD', `Error in command: ${error.message}`, error);

  try {
    const errContainer = createV2Error(
      `${emojis.error} Something went wrong. Please try again.`,
      message.client
    );
    const reply = await message.reply({
      ...v2Payload(errContainer),
      allowedMentions: { repliedUser: false }
    });

    // Attempt to delete user's triggering message
    try { await message.delete(); } catch {}

    // Auto-delete error message after 6 seconds
    setTimeout(async () => {
      try { await reply.delete(); } catch {}
    }, 6000);
  } catch {
    // Can't reply — message may have been deleted
  }
}

/**
 * Handle errors from interactions (buttons, selects, modals).
 */
export async function handleInteractionError(interaction, error) {
  logger.error('INTERACTION', `Error in interaction: ${error.message}`, error);

  try {
    const errContainer = createV2Error(
      `${emojis.error} Something went wrong. Please try again.`,
      interaction.client
    );
    const payload = {
      ...v2Payload(errContainer, [], true)
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
  } catch {
    // Interaction may have expired
  }
}

/**
 * Send a clean permission-denied message.
 */
export async function sendPermissionDenied(message) {
  try {
    const errContainer = createV2Error(
      `${emojis.error} You don't have permission to use this command.`,
      message.client
    );
    const reply = await message.reply({
      ...v2Payload(errContainer),
      allowedMentions: { repliedUser: false }
    });

    try { await message.delete(); } catch {}

    setTimeout(async () => {
      try { await reply.delete(); } catch {}
    }, 6000);
  } catch {}
}

/**
 * Send a clean usage error.
 */
export async function sendUsageError(message, usage) {
  try {
    const errContainer = createV2Error(
      `${emojis.warning} **Usage:** \`${usage}\``,
      message.client
    );
    const reply = await message.reply({
      ...v2Payload(errContainer),
      allowedMentions: { repliedUser: false }
    });

    try { await message.delete(); } catch {}

    setTimeout(async () => {
      try { await reply.delete(); } catch {}
    }, 6000);
  } catch {}
}
