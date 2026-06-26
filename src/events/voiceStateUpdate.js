import { getDb } from '../database/connection.js';
import { TempVcsRepo } from '../database/repositories/tempVcs.repo.js';
import { ConfigRepo } from '../database/repositories/config.repo.js';
import { isImmune } from '../helpers/permissions.js';
import { logger } from '../helpers/logger.js';
import { ChannelType } from 'discord.js';

export default {
  name: 'voiceStateUpdate',
  once: false,

  async execute(oldState, newState, client) {
    try {
      const oldChannelId = oldState.channelId;
      const newChannelId = newState.channelId;
      const member = newState.member;
      if (!member) return;

      const db = getDb();

      // ── Handle Leaving/Moving Out of a Channel ────────────────────
      if (oldChannelId && oldChannelId !== newChannelId) {
        // 1. Check if user left a locked down channel
        const savedState = db.prepare('SELECT * FROM voice_lockdown_state WHERE channel_id = ? AND user_id = ?').get(oldChannelId, member.id);
        if (savedState) {
          try {
            await member.voice.setMute(false, 'Left locked down VC');
            await member.voice.setDeaf(false, 'Left locked down VC');
            db.prepare('DELETE FROM voice_lockdown_state WHERE channel_id = ? AND user_id = ?').run(oldChannelId, member.id);
            logger.info('VOICE_LOCKDOWN', `User ${member.user.tag} left locked down VC ${oldChannelId}, unmuted/undeafened.`);
          } catch (err) {
            logger.warn('VOICE_LOCKDOWN', `Failed to unmute/undeafen user ${member.id} on VC exit: ${err.message}`);
          }
        }

        // 2. Handle Temporary VC cleanup
        const channel = oldState.guild.channels.cache.get(oldChannelId);
        if (channel) {
          const record = TempVcsRepo.get(db, oldChannelId);
          if (record && channel.members.size === 0) {
            try {
              // Delete channel
              await channel.delete('Temporary voice channel empty');
              logger.info('TEMP_VC', `Deleted empty temporary voice channel: ${channel.name} (${oldChannelId})`);

              // Delete the creation success embed message in the public channel
              if (record.parent_text_channel_id && record.parent_message_id) {
                try {
                  const textChannel = oldState.guild.channels.cache.get(record.parent_text_channel_id) || 
                                      await oldState.guild.channels.fetch(record.parent_text_channel_id).catch(() => null);
                  if (textChannel) {
                    const msg = await textChannel.messages.fetch(record.parent_message_id).catch(() => null);
                    if (msg) {
                      await msg.delete().catch(() => null);
                      logger.info('TEMP_VC', `Deleted creation success message ${record.parent_message_id} for VC ${oldChannelId}`);
                    }
                  }
                } catch (msgErr) {
                  logger.warn('TEMP_VC', `Failed to delete parent success message: ${msgErr.message}`);
                }
              }

              // Remove database record
              TempVcsRepo.delete(db, oldChannelId);

              // Clean up the category if it was the last channel in "🎮 Gaming VCs"
              const category = channel.parent;
              if (category && category.name === '🎮 Gaming VCs' && category.type === ChannelType.GuildCategory) {
                const remaining = category.children.cache.filter(c => c.id !== oldChannelId);
                if (remaining.size === 0) {
                  await category.delete('No remaining temporary channels');
                  logger.info('TEMP_VC', 'Deleted empty "🎮 Gaming VCs" Category channel.');
                }
              }
            } catch (error) {
              logger.error('TEMP_VC', `Failed to delete empty temporary voice channel/category: ${error.message}`);
            }
          }
        }
      }

      // ── Handle Joining/Moving Into a Channel ─────────────────────
      if (newChannelId && oldChannelId !== newChannelId) {
        // Check if target channel is locked down
        const isLockedDown = ConfigRepo.get(db, `lockdown:name:${newChannelId}`) !== null;
        if (isLockedDown && !isImmune(member)) {
          try {
            // Save pre-entry states
            const wasMuted = member.voice.serverMute || false;
            const wasDeafened = member.voice.serverDeaf || false;
            
            db.prepare(
              `INSERT OR REPLACE INTO voice_lockdown_state
               (channel_id, user_id, was_muted, was_deafened)
               VALUES (?, ?, ?, ?)`
            ).run(newChannelId, member.id, wasMuted ? 1 : 0, wasDeafened ? 1 : 0);

            // Server mute + deafen
            await member.voice.setMute(true, 'Joined locked down VC');
            await member.voice.setDeaf(true, 'Joined locked down VC');
            logger.info('VOICE_LOCKDOWN', `User ${member.user.tag} joined locked down VC ${newChannelId}, muted/deafened.`);
          } catch (err) {
            logger.warn('VOICE_LOCKDOWN', `Failed to mute/deafen user ${member.id} on locked VC entry: ${err.message}`);
          }
        }
      }
    } catch (err) {
      logger.error('VOICE_STATE', `Error handling voice state update event: ${err.message}`, err);
    }
  },
};
