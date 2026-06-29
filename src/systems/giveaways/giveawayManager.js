import { 
  ContainerBuilder, 
  SectionBuilder, 
  TextDisplayBuilder, 
  ThumbnailBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  MessageFlags 
} from 'discord.js';
import { getDb } from '../../database/connection.js';
import { GiveawaysRepo } from '../../database/repositories/giveaways.repo.js';
import { config } from '../../config/bot.config.js';
import { assets } from '../../config/assets.config.js';
import { emojis } from '../../config/emojis.config.js';
import { logger } from '../../helpers/logger.js';
import { v2Payload } from '../../helpers/v2Helper.js';

/**
 * Builds the V2 Container payload for a giveaway card.
 */
export function buildGiveawayPayload(client, giveaway) {
  const db = getDb();
  const entriesCount = GiveawaysRepo.getEntriesCount(db, giveaway.id);
  const isEnded = giveaway.status === 'ended';

  const lines = [
    `### ${emojis.prize || '🎁'} GIVEAWAY: ${giveaway.prize}`,
    `**${emojis.host || '👤'} Hosted By**: <@${giveaway.host_id}>`,
    `**${emojis.winner || '🏆'} Winners**: \`${giveaway.winner_count}\``,
    `**${emojis.entrants || '👥'} Total Entries**: \`${entriesCount}\``,
  ];

  let accentColor = config.colors.primary;

  if (isEnded) {
    lines.push(`\n**Status**: 🛑 **Ended**`);
    
    const winners = getWinners(db, giveaway.id);
    if (winners.length > 0) {
      lines.push(`**${emojis.winner || '🏆'} Winners**: ${winners.map(w => `<@${w}>`).join(', ')}`);
      accentColor = config.colors.success;
    } else {
      lines.push(`**${emojis.winner || '🏆'} Winners**: *No valid entries received.*`);
      accentColor = config.colors.error;
    }
  } else {
    lines.push(
      `**Ends**: <t:${giveaway.end_time}:F> (<t:${giveaway.end_time}:R>)`,
      `\n*Click the button below to join the giveaway!*`
    );
  }

  const container = new ContainerBuilder()
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(lines.join('\n'))
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder().setURL(assets.giveaway)
        )
    )
    .setAccentColor(accentColor);

  if (isEnded) {
    return {
      components: [container],
      flags: [MessageFlags.IsComponentsV2],
    };
  }

  const enterBtn = new ButtonBuilder()
    .setCustomId(`giveaway:enter:${giveaway.id}`)
    .setLabel(`🎉 Enter Giveaway (${entriesCount})`)
    .setStyle(ButtonStyle.Success);

  const row = new ActionRowBuilder().addComponents(enterBtn);

  return v2Payload(container, [row]);
}

/**
 * Updates the giveaway card message in Discord.
 */
export async function updateGiveawayCard(client, giveawayId) {
  const db = getDb();
  const giveaway = GiveawaysRepo.get(db, giveawayId);
  if (!giveaway) return;

  const channel = await client.channels.fetch(giveaway.channel_id).catch(() => null);
  if (!channel) return;

  const message = await channel.messages.fetch(giveaway.message_id).catch(() => null);
  if (!message) return;

  const payload = buildGiveawayPayload(client, giveaway);
  await message.edit(payload).catch(() => null);
}

/**
 * Rolls winners for a giveaway and updates its card.
 */
export async function rollGiveaway(client, giveaway) {
  const db = getDb();

  logger.info('GIVEAWAY', `Rolling giveaway #${giveaway.id} for "${giveaway.prize}"`);

  GiveawaysRepo.updateStatus(db, giveaway.id, 'ended');

  const entries = GiveawaysRepo.getEntries(db, giveaway.id);
  const winners = [];

  if (entries.length > 0) {
    const candidates = entries.map(e => e.user_id);
    const limit = Math.min(giveaway.winner_count, candidates.length);

    for (let i = 0; i < limit; i++) {
      const idx = Math.floor(Math.random() * candidates.length);
      winners.push(candidates.splice(idx, 1)[0]);
    }
  }

  GiveawaysRepo.update(db, giveaway.id, {
    winners: winners.join(','),
  });

  await updateGiveawayCard(client, giveaway.id);

  const channel = await client.channels.fetch(giveaway.channel_id).catch(() => null);
  if (channel) {
    if (winners.length > 0) {
      await channel.send({
        content: `🎉 **Giveaway Ended!** Congratulations to the winner(s) of **${giveaway.prize}**:\n${winners.map(w => `<@${w}>`).join(' ')}`,
        allowedMentions: { users: winners },
      }).catch(() => null);
    } else {
      await channel.send(`🛑 **Giveaway Ended!** The giveaway for **${giveaway.prize}** ended, but there were no entries.`).catch(() => null);
    }
  }
}

/**
 * Rerolls an ended giveaway, picking new winners.
 */
export async function rerollGiveaway(client, messageId) {
  const db = getDb();
  const giveaway = GiveawaysRepo.getByMessageId(db, messageId);

  if (!giveaway) {
    throw new Error('Giveaway not found.');
  }

  if (giveaway.status !== 'ended') {
    throw new Error('That giveaway is still active!');
  }

  const entries = GiveawaysRepo.getEntries(db, giveaway.id);
  if (entries.length === 0) {
    throw new Error('There are no entries to reroll from!');
  }

  const candidates = entries.map(e => e.user_id);
  const winners = [];
  const limit = Math.min(giveaway.winner_count, candidates.length);

  for (let i = 0; i < limit; i++) {
    const idx = Math.floor(Math.random() * candidates.length);
    winners.push(candidates.splice(idx, 1)[0]);
  }

  GiveawaysRepo.update(db, giveaway.id, {
    winners: winners.join(','),
  });

  await updateGiveawayCard(client, giveaway.id);

  const channel = await client.channels.fetch(giveaway.channel_id).catch(() => null);
  if (channel) {
    await channel.send({
      content: `🎉 **Giveaway Rerolled!** New winner(s) for **${giveaway.prize}**:\n${winners.map(w => `<@${w}>`).join(' ')}`,
      allowedMentions: { users: winners },
    }).catch(() => null);
  }

  return winners;
}

/**
 * Returns winners list for a giveaway.
 */
export function getWinners(db, giveawayId) {
  const row = db.prepare('SELECT winners FROM giveaways WHERE id = ?').get(giveawayId);
  if (!row || !row.winners) return [];
  return row.winners.split(',').filter(Boolean);
}

/**
 * Background checker ticker for active giveaways.
 */
export async function checkGiveaways(client) {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  const active = GiveawaysRepo.listActive(db);
  for (const gw of active) {
    if (now >= gw.end_time) {
      try {
        await rollGiveaway(client, gw);
      } catch (err) {
        logger.error('GIVEAWAY', `Error rolling giveaway #${gw.id}: ${err.message}`, err);
      }
    }
  }
}

let ticker = null;
export function startGiveawayTicker(client) {
  if (ticker) return;

  ticker = setInterval(() => {
    checkGiveaways(client).catch(err => {
      logger.error('GIVEAWAY_TICKER', `Error in giveaway background ticker: ${err.message}`, err);
    });
  }, 15000);

  logger.info('GIVEAWAY_TICKER', 'Giveaway background scheduler started');
}
