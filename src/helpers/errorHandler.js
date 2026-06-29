import { logger } from './logger.js';
import { v2Payload, notification } from './v2Helper.js';

/**
 * Centralized error handler.
 * Uses compact V2 notification cards.
 */

export async function handleCommandError(message, error) {
  logger.error('CMD', `Error in command: ${error.message}`, error);

  try {
    const card = notification('error', '❌ Something went wrong.', message.client);
    const reply = await message.reply({
      ...v2Payload(card),
      allowedMentions: { repliedUser: false },
    });

    try { await message.delete(); } catch {}

    setTimeout(async () => {
      try { await reply.delete(); } catch {}
    }, 6000);
  } catch {}
}

export async function handleInteractionError(interaction, error) {
  logger.error('INTERACTION', `Error in interaction: ${error.message}`, error);

  try {
    const card = notification('error', '❌ Something went wrong.', interaction.client);
    const payload = { ...v2Payload(card, [], true) };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
  } catch {}
}

export async function sendPermissionDenied(message) {
  try {
    const card = notification('error', '❌ You don\'t have permission to use this command.', message.client);
    const reply = await message.reply({
      ...v2Payload(card),
      allowedMentions: { repliedUser: false },
    });

    try { await message.delete(); } catch {}

    setTimeout(async () => {
      try { await reply.delete(); } catch {}
    }, 6000);
  } catch {}
}

export async function sendUsageError(message, usage) {
  try {
    const card = notification('warning', `⚠️ **Usage:** \`${usage}\``, message.client);
    const reply = await message.reply({
      ...v2Payload(card),
      allowedMentions: { repliedUser: false },
    });

    try { await message.delete(); } catch {}

    setTimeout(async () => {
      try { await reply.delete(); } catch {}
    }, 6000);
  } catch {}
}