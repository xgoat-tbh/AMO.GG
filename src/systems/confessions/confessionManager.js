import { getDb } from '../../database/connection.js';
import { ConfessionsRepo } from '../../database/repositories/confessions.repo.js';
import { createV2Container, v2Payload } from '../../helpers/v2Helper.js';
import { config } from '../../config/bot.config.js';
import { logConfession } from '../../services/loggingService.js';
import { logger } from '../../helpers/logger.js';

// ── Public API ──────────────────────────────────────────────────

/**
 * Create and post a confession.
 *
 * @param {object} author - The member/user who wrote the confession
 * @param {string} content - Confession text
 * @param {'known'|'anonymous'} type - Confession type
 * @param {TextChannel} channel - Channel to post the confession in
 * @param {Client} client - Discord client (for logging)
 * @returns {Message} The sent message
 */
export async function create(author, content, type, channel, client) {
  const db = getDb();

  // Create DB record
  const record = ConfessionsRepo.create(db, author.id, content, type);
  const confessionNumber = record.id;

  // Build V2 container based on type
  let container;

  if (type === 'known') {
    container = createV2Container({
      title: `📝 Confession #${confessionNumber}`,
      description: `> ${content.replace(/\n/g, '\n> ')}`,
      color: 0x2ECC71,
      author: {
        name: author.tag || author.user?.tag || author.displayName || 'Unknown',
      },
      thumbnail: author.displayAvatarURL?.() || author.user?.displayAvatarURL?.() || undefined,
      client,
    });
  } else {
    // Anonymous
    container = createV2Container({
      title: `📝 Confession #${confessionNumber}`,
      description: `> ${content.replace(/\n/g, '\n> ')}`,
      color: 0xE67E22,
      author: {
        name: 'Anonymous',
      },
      client,
    });
  }

  // Send to channel
  const sentMessage = await channel.send(v2Payload(container));

  // Store message ID
  ConfessionsRepo.setMessageId(db, confessionNumber, sentMessage.id);

  // ALWAYS log full details (including author for anonymous confessions)
  await logConfession(client, {
    author,
    content,
    type,
    messageId: sentMessage.id,
  });

  logger.info('CONFESSION', `Created ${type} confession #${confessionNumber} by ${author.id}`);
  return sentMessage;
}
