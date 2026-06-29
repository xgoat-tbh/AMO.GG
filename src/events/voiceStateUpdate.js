import { logger } from '../helpers/logger.js';
import { voiceManager } from '../systems/voice/voiceManager.js';
import { xpManager } from '../systems/levels/xpManager.js';
import { getDb } from '../database/connection.js';
import { TempVcsRepo } from '../database/repositories/tempVcs.repo.js';

export default {
  name: 'voiceStateUpdate',

  async execute(oldState, newState, client) {
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;

    const guildId = (oldState.guild?.id || newState.guild?.id);

    // Determine if user joined or left a voice channel
    const wasInVC = oldState.channelId !== null && oldState.channelId !== undefined;
    const isInVC = newState.channelId !== null && newState.channelId !== undefined;

    if (wasInVC && !isInVC) {
      // User left VC — award voice XP
      xpManager.handleVoiceState(member.id, guildId, false).catch(() => null);

      // Check if temp VC is now empty
      const db = getDb();
      const tempVc = TempVcsRepo.get(db, oldState.channelId);
      if (tempVc) {
        const channel = oldState.guild.channels.cache.get(oldState.channelId);
        if (channel && channel.members.size === 0) {
          // Delete the temp VC after 5 seconds
          setTimeout(async () => {
            try {
              const currentChannel = oldState.guild.channels.cache.get(oldState.channelId);
              if (currentChannel && currentChannel.members.size === 0) {
                await currentChannel.delete('Temporary VC empty');
                TempVcsRepo.delete(db, oldState.channelId);
              }
            } catch (err) {
              logger.warn('TEMPVC', `Cleanup error: ${err.message}`);
            }
          }, 5000);
        }
      }

      // Handle lockdown leave
      await voiceManager.handleLeave(oldState, newState, client).catch(() => null);
    }

    if (!wasInVC && isInVC) {
      // User joined VC — start XP timer
      xpManager.handleVoiceState(member.id, guildId, true).catch(() => null);

      // Handle lockdown join
      await voiceManager.handleJoin(oldState, newState, client).catch(() => null);
    }
  },
};
