import { getDb } from '../../database/connection.js';
import { VoiceRepo } from '../../database/repositories/voice.repo.js';
import { ConfigRepo } from '../../database/repositories/config.repo.js';
import { isImmune } from '../../helpers/permissions.js';
import { logger } from '../../helpers/logger.js';

// ── Public API ──────────────────────────────────────────────────

/**
 * Get all members in a voice channel.
 * @param {VoiceChannel} channel
 * @returns {Collection<Snowflake, GuildMember>}
 */
export function getVoiceMembers(channel) {
  return channel.members;
}

/**
 * Mute or unmute a collection of members.
 * @param {Collection<Snowflake, GuildMember>|GuildMember[]} members
 * @param {boolean} mute - true to mute, false to unmute
 * @returns {{ succeeded: number, failed: number, errors: Error[] }}
 */
export async function muteMembers(members, mute) {
  const results = { succeeded: 0, failed: 0, errors: [] };
  const memberList = members instanceof Map ? [...members.values()] : Array.isArray(members) ? members : [...members.values()];

  for (const member of memberList) {
    try {
      if (member.voice.channel) {
        await member.voice.setMute(mute);
        results.succeeded++;
      }
    } catch (error) {
      results.failed++;
      results.errors.push(error);
      logger.warn('VOICE', `Failed to ${mute ? 'mute' : 'unmute'} ${member.id}: ${error.message}`);
    }
  }

  return results;
}

/**
 * Deafen or undeafen a collection of members.
 * @param {Collection<Snowflake, GuildMember>|GuildMember[]} members
 * @param {boolean} deafen - true to deafen, false to undeafen
 * @returns {{ succeeded: number, failed: number, errors: Error[] }}
 */
export async function deafenMembers(members, deafen) {
  const results = { succeeded: 0, failed: 0, errors: [] };
  const memberList = members instanceof Map ? [...members.values()] : Array.isArray(members) ? members : [...members.values()];

  for (const member of memberList) {
    try {
      if (member.voice.channel) {
        await member.voice.setDeaf(deafen);
        results.succeeded++;
      }
    } catch (error) {
      results.failed++;
      results.errors.push(error);
      logger.warn('VOICE', `Failed to ${deafen ? 'deafen' : 'undeafen'} ${member.id}: ${error.message}`);
    }
  }

  return results;
}

/**
 * Move a collection of members to a target voice channel.
 * @param {Collection<Snowflake, GuildMember>|GuildMember[]} members
 * @param {VoiceChannel} targetChannel
 * @returns {{ succeeded: number, failed: number, errors: Error[] }}
 */
export async function moveMembers(members, targetChannel) {
  const results = { succeeded: 0, failed: 0, errors: [] };
  const memberList = members instanceof Map ? [...members.values()] : Array.isArray(members) ? members : [...members.values()];

  for (const member of memberList) {
    try {
      if (member.voice.channel) {
        await member.voice.setChannel(targetChannel);
        results.succeeded++;
      }
    } catch (error) {
      results.failed++;
      results.errors.push(error);
      logger.warn('VOICE', `Failed to move ${member.id}: ${error.message}`);
    }
  }

  return results;
}

/**
 * Disconnect a collection of members from voice.
 * @param {Collection<Snowflake, GuildMember>|GuildMember[]} members
 * @returns {{ succeeded: number, failed: number, errors: Error[] }}
 */
export async function disconnectMembers(members) {
  const results = { succeeded: 0, failed: 0, errors: [] };
  const memberList = members instanceof Map ? [...members.values()] : Array.isArray(members) ? members : [...members.values()];

  for (const member of memberList) {
    try {
      if (member.voice.channel) {
        await member.voice.disconnect();
        results.succeeded++;
      }
    } catch (error) {
      results.failed++;
      results.errors.push(error);
      logger.warn('VOICE', `Failed to disconnect ${member.id}: ${error.message}`);
    }
  }

  return results;
}

/**
 * Lock down a voice channel: save pre-lockdown states, rename channel with lock icon,
 * update permissions to deny Connect for @everyone, and server mute + deafen
 * all non-immune members (excluding the executor).
 *
 * @param {VoiceChannel} voiceChannel
 * @param {GuildMember} executor - The moderator executing the lockdown (excluded)
 * @param {Client} client - Discord client
 * @returns {{ affected: number }}
 */
export async function lockdown(voiceChannel, executor, client) {
  const db = getDb();
  const members = voiceChannel.members;

  // 1. Rename channel to include lock icon prefix
  if (!ConfigRepo.get(db, `lockdown:name:${voiceChannel.id}`)) {
    ConfigRepo.set(db, `lockdown:name:${voiceChannel.id}`, voiceChannel.name);
    if (!voiceChannel.name.startsWith('🔒')) {
      try {
        await voiceChannel.setName(`🔒 ${voiceChannel.name}`);
      } catch (err) {
        logger.warn('VOICE', `Failed to rename voice channel ${voiceChannel.id}: ${err.message}`);
      }
    }
  }

  // 2. Save original Connect override and set Connect = false for @everyone
  if (!ConfigRepo.get(db, `lockdown:connect:${voiceChannel.id}`)) {
    const everyoneOverwrite = voiceChannel.permissionOverwrites.cache.get(voiceChannel.guild.roles.everyone.id);
    const wasConnectAllowed = everyoneOverwrite ? everyoneOverwrite.allow.has('Connect') : null;
    const wasConnectDenied = everyoneOverwrite ? everyoneOverwrite.deny.has('Connect') : null;
    let originalConnect = 'inherit';
    if (wasConnectAllowed) originalConnect = 'allow';
    else if (wasConnectDenied) originalConnect = 'deny';
    ConfigRepo.set(db, `lockdown:connect:${voiceChannel.id}`, originalConnect);

    try {
      await voiceChannel.permissionOverwrites.edit(voiceChannel.guild.roles.everyone, {
        Connect: false
      });
    } catch (err) {
      logger.warn('VOICE', `Failed to set Connect override to false for channel ${voiceChannel.id}: ${err.message}`);
    }
  }

  // Filter: exclude executor, moderators, and immune roles
  const targetMembers = members.filter(
    (member) => member.id !== executor.id && !isImmune(member)
  );

  // Save pre-lockdown states
  if (targetMembers.size > 0) {
    const states = targetMembers.map((member) => ({
      userId: member.id,
      wasMuted: member.voice.serverMute || false,
      wasDeafened: member.voice.serverDeaf || false,
    }));

    VoiceRepo.saveBulkState(db, voiceChannel.id, states);

    // Mute + deafen everyone
    let affected = 0;
    for (const [, member] of targetMembers) {
      try {
        await member.voice.setMute(true, 'Voice lockdown');
        await member.voice.setDeaf(true, 'Voice lockdown');
        affected++;
      } catch (error) {
        logger.warn('VOICE', `Lockdown failed for ${member.id}: ${error.message}`);
      }
    }
    logger.info('VOICE', `Locked down ${voiceChannel.name}: ${affected} members affected`);
    return { affected };
  }

  logger.info('VOICE', `Locked down ${voiceChannel.name} (permissions only)`);
  return { affected: 0 };
}

/**
 * Unlock a voice channel: restore original channel name, restore connect permissions,
 * and restore pre-lockdown mute/deafen states for all members.
 *
 * @param {VoiceChannel} voiceChannel
 * @param {Client} client - Discord client
 * @returns {{ restored: number }}
 */
export async function unlockdown(voiceChannel, client) {
  const db = getDb();

  // 1. Restore original name
  const originalName = ConfigRepo.get(db, `lockdown:name:${voiceChannel.id}`);
  if (originalName) {
    try {
      await voiceChannel.setName(originalName);
    } catch (err) {
      logger.warn('VOICE', `Failed to restore name for voice channel ${voiceChannel.id}: ${err.message}`);
    }
    ConfigRepo.delete(db, `lockdown:name:${voiceChannel.id}`);
  } else if (voiceChannel.name.startsWith('🔒')) {
    try {
      await voiceChannel.setName(voiceChannel.name.replace(/^🔒\s*/, ''));
    } catch (err) {
      logger.warn('VOICE', `Failed to strip lock icon from voice channel ${voiceChannel.id}: ${err.message}`);
    }
  }

  // 2. Restore original Connect override
  const originalConnect = ConfigRepo.get(db, `lockdown:connect:${voiceChannel.id}`);
  if (originalConnect) {
    try {
      if (originalConnect === 'allow') {
        await voiceChannel.permissionOverwrites.edit(voiceChannel.guild.roles.everyone, {
          Connect: true
        });
      } else if (originalConnect === 'deny') {
        await voiceChannel.permissionOverwrites.edit(voiceChannel.guild.roles.everyone, {
          Connect: false
        });
      } else {
        // Inherit (remove Connect key from overwrites)
        await voiceChannel.permissionOverwrites.edit(voiceChannel.guild.roles.everyone, {
          Connect: null
        });
      }
    } catch (err) {
      logger.warn('VOICE', `Failed to restore Connect override for channel ${voiceChannel.id}: ${err.message}`);
    }
    ConfigRepo.delete(db, `lockdown:connect:${voiceChannel.id}`);
  } else {
    try {
      await voiceChannel.permissionOverwrites.edit(voiceChannel.guild.roles.everyone, {
        Connect: null
      });
    } catch (err) {
      logger.warn('VOICE', `Failed to reset Connect override to null for channel ${voiceChannel.id}: ${err.message}`);
    }
  }

  // 3. Restore pre-lockdown member voice states
  const states = VoiceRepo.getStates(db, voiceChannel.id);
  let restored = 0;
  if (states && states.length > 0) {
    for (const state of states) {
      try {
        const member = voiceChannel.members.get(state.user_id);
        if (member && member.voice.channel) {
          await member.voice.setMute(!!state.was_muted, 'Voice unlockdown');
          await member.voice.setDeaf(!!state.was_deafened, 'Voice unlockdown');
          restored++;
        }
      } catch (error) {
        logger.warn('VOICE', `Unlockdown restore failed for ${state.user_id}: ${error.message}`);
      }
    }
    // Clear stored states
    VoiceRepo.clearStates(db, voiceChannel.id);
  }

  logger.info('VOICE', `Unlocked ${voiceChannel.name}: ${restored} members restored`);
  return { restored };
}

/**
 * Handle a user joining a voice channel.
 * If the channel is under lockdown, the joining member is auto-muted + auto-deafened.
 */
export async function handleJoin(oldState, newState, client) {
  if (!newState.channelId) return;
  const channel = newState.channel;
  if (!channel) return;
  const member = newState.member;
  if (!member || member.user.bot) return;

  const db = getDb();
  const isLocked = ConfigRepo.get(db, `lockdown:connect:${channel.id}`);
  if (!isLocked) return;

  try {
    await member.voice.setMute(true, 'Joined locked-down voice channel');
    await member.voice.setDeaf(true, 'Joined locked-down voice channel');
    // Store pre-lockdown state (they were neither muted nor deafened before joining)
    VoiceRepo.saveState(db, channel.id, member.id, false, false);
    logger.info('VOICE', `Auto-muted ${member.user.tag} for joining locked channel ${channel.name}`);
  } catch (error) {
    logger.warn('VOICE', `Failed to auto-mute joining member ${member.id}: ${error.message}`);
  }
}

/**
 * Handle a user leaving a voice channel.
 * Currently a no-op; pre-lockdown states are preserved for re-join auto-muting.
 */
export async function handleLeave(oldState, newState, client) {
  // Intentionally a no-op — stored states persist for handleJoin on re-join.
}

export const voiceManager = {
  getVoiceMembers,
  muteMembers,
  deafenMembers,
  moveMembers,
  disconnectMembers,
  lockdown,
  unlockdown,
  handleJoin,
  handleLeave,
};
