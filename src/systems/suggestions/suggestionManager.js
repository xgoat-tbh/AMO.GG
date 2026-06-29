import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { getDb } from '../../database/connection.js';
import { SuggestionsRepo } from '../../database/repositories/suggestions.repo.js';
import { createV2Container, createV2Error, createV2Success, v2Payload, v2EditPayload } from '../../helpers/v2Helper.js';
import { config } from '../../config/bot.config.js';
import { emojis } from '../../config/emojis.config.js';
import { logger } from '../../helpers/logger.js';

/**
 * Build the vote action row for a suggestion.
 */
function buildVoteRow(suggestionId, yesCt = 0, noCt = 0, threadUrl = null, isCompleted = false) {
  if (isCompleted) {
    const row = new ActionRowBuilder();
    if (threadUrl) {
      row.addComponents(
        new ButtonBuilder()
          .setLabel('💬 Discussion')
          .setStyle(ButtonStyle.Link)
          .setURL(threadUrl)
      );
    }
    return row;
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`suggestion:vote:yes:${suggestionId}`)
      .setLabel(`${emojis.success} Yes (${yesCt})`)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`suggestion:vote:no:${suggestionId}`)
      .setLabel(`${emojis.error} No (${noCt})`)
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`suggestion:complete:${suggestionId}`)
      .setLabel('Complete')
      .setStyle(ButtonStyle.Secondary)
  );

  if (threadUrl) {
    row.addComponents(
      new ButtonBuilder()
        .setLabel('💬 Discussion')
        .setStyle(ButtonStyle.Link)
        .setURL(threadUrl)
    );
  }

  return row;
}

/**
 * Build the suggestion container.
 */
function buildSuggestionContainer(author, content, suggestionId, client, status = 'open') {
  return createV2Container({
    title: `💡 Suggestion #${suggestionId}`,
    description: `> ${content.replace(/\n/g, '\n> ')}`,
    color: status === 'completed' ? config.colors.success : config.colors.suggestion,
    fields: [
      { name: 'Suggested By', value: `<@${author.id}> (${author.tag || author.user?.tag || author.id})` },
      { name: 'Date', value: `<t:${Math.floor(Date.now() / 1000)}:F>` },
      { name: 'Status', value: status === 'completed' ? '✅ Completed' : '⏳ Open' },
      { name: 'User ID', value: `\`${author.id}\`` },
    ],
    thumbnail: author.displayAvatarURL?.() || author.user?.displayAvatarURL?.() || undefined,
    client,
  });
}

// ── Public API ──────────────────────────────────────────────────

/**
 * Create a new suggestion and send it to the channel.
 */
export async function create(author, content, channel) {
  const db = getDb();

  // Create DB record
  const record = SuggestionsRepo.create(db, author.id, content);
  const suggestionId = record.id;

  // Build container and initial buttons
  const container = buildSuggestionContainer(author, content, suggestionId, channel.client);
  const row = buildVoteRow(suggestionId, 0, 0);

  // Send to channel
  const sentMessage = await channel.send({
    ...v2Payload(container, [row]),
  });

  // Store the message ID for later lookups
  SuggestionsRepo.setMessageId(db, suggestionId, sentMessage.id);

  // ── Auto-thread Creation ──
  let threadUrl = null;
  try {
    const thread = await sentMessage.startThread({
      name: `Suggestion #${suggestionId} Discussion`,
      autoArchiveDuration: 1440, // 24 hours
    });

    // Store thread ID in DB
    SuggestionsRepo.setThreadId(db, suggestionId, thread.id);
    threadUrl = thread.url;

    // Update the message with the Link button pointing to the thread
    const updatedRow = buildVoteRow(suggestionId, 0, 0, threadUrl);
    await sentMessage.edit(v2EditPayload(container, [updatedRow]));
  } catch (threadErr) {
    logger.error('SUGGESTION_THREAD', `Failed to auto-create thread for suggestion #${suggestionId}: ${threadErr.message}`);
  }

  logger.info('SUGGESTION', `Created suggestion #${suggestionId} by ${author.id}`);
  return sentMessage;
}

/**
 * Handle a vote on a suggestion.
 * Same vote twice = toggle off. Different vote = switch.
 */
export async function handleVote(suggestionId, userId, voteType, interaction) {
  const db = getDb();

  // Verify suggestion exists
  const suggestion = SuggestionsRepo.getById(db, suggestionId);
  if (!suggestion) {
    const errContainer = createV2Error(`❌ Suggestion not found.`, interaction.client);
    await interaction.reply({
      ...v2Payload(errContainer, [], true),
    });
    return;
  }

  if (suggestion.status === 'completed') {
    await interaction.reply({
      content: `${emojis.error} This suggestion is already marked as completed. Votes cannot be changed.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Toggle/switch vote
  const result = SuggestionsRepo.vote(db, suggestionId, userId, voteType);

  // Get updated counts
  const counts = SuggestionsRepo.getVoteCounts(db, suggestionId);

  // Get thread URL if it exists
  let threadUrl = null;
  if (suggestion.thread_id) {
    threadUrl = `https://discord.com/channels/${interaction.guildId}/${suggestion.thread_id}`;
  }

  // Update the message buttons with new counts
  const row = buildVoteRow(suggestionId, counts.yes, counts.no, threadUrl);

  const reporter = await interaction.client.users.fetch(suggestion.author_id).catch(() => null);
  const container = buildSuggestionContainer(reporter || { id: suggestion.author_id }, suggestion.content, suggestionId, interaction.client, suggestion.status);
  await interaction.update(v2EditPayload(container, [row]));

  logger.debug('SUGGESTION', `Vote ${result} on #${suggestionId} by ${userId}: ${voteType} (yes: ${counts.yes}, no: ${counts.no})`);
}

/**
 * Create a discussion thread on the suggestion message.
 */
export async function createThread(suggestionId, interaction) {
  const db = getDb();

  const suggestion = SuggestionsRepo.getById(db, suggestionId);
  if (!suggestion) {
    const errContainer = createV2Error(`❌ Suggestion not found.`, interaction.client);
    await interaction.reply({
      ...v2Payload(errContainer, [], true),
    });
    return;
  }

  // Check if thread already exists
  if (suggestion.thread_id) {
    const warnContainer = createV2Container({
      description: `⚠️ A discussion thread already exists: <#${suggestion.thread_id}>`,
      color: config.colors.warning,
      client: interaction.client,
    });
    await interaction.reply({
      ...v2Payload(warnContainer, [], true),
    });
    return;
  }

  // Defer so we have time to create the thread
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // Get the suggestion message
  const message = interaction.message;

  // Create thread on the message
  const thread = await message.startThread({
    name: `Suggestion #${suggestionId} Discussion`,
    autoArchiveDuration: 1440, // 24 hours
  });

  // Store thread ID in DB
  SuggestionsRepo.setThreadId(db, suggestionId, thread.id);

  const successContainer = createV2Success(`✅ Discussion thread created: <#${thread.id}>`, interaction.client);
  await interaction.editReply(v2EditPayload(successContainer));

  logger.info('SUGGESTION', `Thread created for suggestion #${suggestionId}: ${thread.id}`);
}

/**
 * Mark a suggestion as completed (Moderator only).
 */
export async function complete(suggestionId, moderator, interaction) {
  const db = getDb();

  const suggestion = SuggestionsRepo.getById(db, suggestionId);
  if (!suggestion) {
    const errContainer = createV2Error(`❌ Suggestion not found.`, interaction.client);
    await interaction.reply({
      ...v2Payload(errContainer, [], true),
    });
    return;
  }

  if (suggestion.status === 'completed') {
    const errContainer = createV2Error(`❌ This suggestion is already marked as completed.`, interaction.client);
    await interaction.reply({
      ...v2Payload(errContainer, [], true),
    });
    return;
  }

  // Update status in DB
  SuggestionsRepo.updateStatus(db, suggestionId, 'completed');

  const counts = SuggestionsRepo.getVoteCounts(db, suggestionId);
  const reporter = await interaction.client.users.fetch(suggestion.author_id).catch(() => null);
  const reporterTag = reporter ? reporter.tag : 'Unknown';

  // Lock and archive thread if it exists
  let threadUrl = null;
  if (suggestion.thread_id) {
    threadUrl = `https://discord.com/channels/${interaction.guildId}/${suggestion.thread_id}`;
    try {
      const thread = await interaction.guild.channels.fetch(suggestion.thread_id).catch(() => null);
      if (thread) {
        await thread.edit({
          locked: true,
          archived: true,
          reason: `Suggestion completed by moderator ${moderator.user.tag}`,
        });
      }
    } catch (err) {
      logger.warn('SUGGESTION', `Failed to lock thread ${suggestion.thread_id}: ${err.message}`);
    }
  }

  // Build completed V2 container
  const completedContainer = createV2Container({
    title: `✅ Completed Suggestion #${suggestionId}`,
    description: `> ${suggestion.content.replace(/\n/g, '\n> ')}`,
    color: config.colors.success, // Green
    fields: [
      { name: 'Suggested By', value: `<@${suggestion.author_id}> (${reporterTag})` },
      { name: 'Status', value: `✅ Completed by <@${moderator.id}>` },
      { name: 'Final Votes', value: `✅ Yes (${counts.yes}) • ❌ No (${counts.no})` },
    ],
    thumbnail: reporter?.displayAvatarURL?.() || undefined,
    client: interaction.client,
  });

  const row = buildVoteRow(suggestionId, counts.yes, counts.no, threadUrl, true);

  await interaction.update(v2EditPayload(completedContainer, [row]));

  // Log completion to suggestion log channel
  try {
    const { logSuggestion } = await import('../../services/loggingService.js');
    await logSuggestion(interaction.client, {
      action: 'complete',
      author: reporter || { id: suggestion.author_id },
      content: suggestion.content,
      extra: {
        'Completed By': `<@${moderator.id}>`,
        'Final Votes': `Yes: ${counts.yes}, No: ${counts.no}`,
      },
    });
  } catch (err) {
    logger.error('SUGGESTION', `Failed to send suggestion log: ${err.message}`);
  }

  logger.info('SUGGESTION', `Suggestion #${suggestionId} completed by moderator ${moderator.id}`);
}
