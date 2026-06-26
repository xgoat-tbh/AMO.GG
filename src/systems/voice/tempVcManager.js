import { ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getDb } from '../../database/connection.js';
import { TempVcsRepo } from '../../database/repositories/tempVcs.repo.js';
import { createV2Container, v2Payload } from '../../helpers/v2Helper.js';
import { config } from '../../config/bot.config.js';
import { assets } from '../../config/assets.config.js';
import { emojis } from '../../config/emojis.config.js';
import { logger } from '../../helpers/logger.js';

/**
 * Temp VC Manager — Handles creation and private interface setup for temporary gaming channels.
 */
export async function createTempVc(member, name, limit, game, client) {
  // 1. Find or create Category "🎮 Gaming VCs"
  let category = member.guild.channels.cache.find(
    c => c.name === '🎮 Gaming VCs' && c.type === ChannelType.GuildCategory
  );

  if (!category) {
    try {
      category = await member.guild.channels.create({
        name: '🎮 Gaming VCs',
        type: ChannelType.GuildCategory,
      });
      logger.info('TEMP_VC', 'Created "🎮 Gaming VCs" Category channel.');
    } catch (err) {
      logger.error('TEMP_VC', `Failed to create Category: ${err.message}`);
      throw new Error('Could not create category channel for temporary VCs.');
    }
  }

  // 2. Format name (always game name, no emojis)
  const finalLimit = parseInt(limit) || 0;
  const finalName = game ? game : 'Lounge';

  // 3. Create Voice Channel
  let channel;
  try {
    channel = await member.guild.channels.create({
      name: finalName,
      type: ChannelType.GuildVoice,
      parent: category.id,
      userLimit: finalLimit,
      permissionOverwrites: [
        {
          id: member.guild.roles.everyone.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
          ],
        },
        {
          id: member.id,
          allow: [
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.MuteMembers,
            PermissionFlagsBits.DeafenMembers,
            PermissionFlagsBits.MoveMembers,
          ],
        },
      ],
    });
    logger.info('TEMP_VC', `Created temporary VC ${channel.id} for user ${member.id}`);

    // Set voice channel status
    if (name && name.trim()) {
      await client.rest.put(`/channels/${channel.id}/voice-status`, {
        body: { status: name.trim() }
      }).catch(err => {
        logger.warn('TEMP_VC', `Could not set VC status: ${err.message}`);
      });
    }
  } catch (err) {
    logger.error('TEMP_VC', `Failed to create Voice Channel: ${err.message}`);
    throw err;
  }

  // 4. Save to Database (storing the status message in name field)
  const db = getDb();
  TempVcsRepo.create(db, channel.id, member.id, game, name || '', finalLimit);

  // 5. Move Creator if they are currently in another VC
  if (member.voice.channel) {
    await member.voice.setChannel(channel).catch(err => {
      logger.warn('TEMP_VC', `Could not automatically move creator to new VC: ${err.message}`);
    });
  }

  // 6. Post Control Interface in the voice text chat
  const interfaceContainer = buildInterfaceContainer(member.id, game, finalLimit, false, name || 'None', client);
  const rows = buildInterfaceRows(channel.id, false);

  try {
    await channel.send({
      ...v2Payload(interfaceContainer, rows),
    });
  } catch (err) {
    logger.error('TEMP_VC', `Failed to post control interface inside VC text: ${err.message}`);
  }

  return channel;
}

/**
 * Build V2 Container for the VC interface.
 */
export function buildInterfaceContainer(creatorId, game, limit, isLocked = false, statusText = 'None', client) {
  const gameEmoji = emojis.games?.[game] || '🎮';
  return createV2Container({
    title: '🎮 Voice Channel Control Panel',
    description: `> This private controller allows the owner to manage the temporary voice channel.`,
    color: config.colors.primary,
    fields: [
      { name: 'Creator', value: `<@${creatorId}>` },
      { name: 'Current Game', value: game ? `${gameEmoji} ${game}` : 'None' },
      { name: 'User Limit', value: limit ? `${limit} members` : 'No limit' },
      { name: 'VC Status', value: statusText || 'None' },
      { name: 'Privacy Status', value: isLocked ? '🔒 Private (Locked)' : '🔓 Public' },
    ],
    thumbnail: assets.voice,
    client,
  });
}

/**
 * Build buttons ActionRows for the VC interface.
 */
export function buildInterfaceRows(channelId, isLocked = false) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`gpvc:manage:status:${channelId}`)
      .setLabel('Status')
      .setEmoji(emojis.general)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`gpvc:manage:limit:${channelId}`)
      .setLabel('Limit')
      .setEmoji(emojis.voice)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`gpvc:manage:game:${channelId}`)
      .setLabel('Game')
      .setEmoji(emojis.game)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`gpvc:manage:lock:${channelId}`)
      .setLabel(isLocked ? 'Unlock' : 'Lock')
      .setEmoji(isLocked ? emojis.unlock : emojis.lock)
      .setStyle(isLocked ? ButtonStyle.Success : ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`gpvc:manage:kick:${channelId}`)
      .setLabel('Kick')
      .setEmoji(emojis.moderation)
      .setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`gpvc:manage:trust:${channelId}`)
      .setLabel('Trust')
      .setEmoji(emojis.success)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`gpvc:manage:untrust:${channelId}`)
      .setLabel('Untrust')
      .setEmoji(emojis.warning)
      .setStyle(ButtonStyle.Secondary)
  );

  return [row1, row2];
}
