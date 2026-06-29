import { getDb } from '../../database/connection.js';
import { CasesRepo } from '../../database/repositories/cases.repo.js';
import { logger } from '../../helpers/logger.js';
import { logModeration } from '../../services/loggingService.js';
import { emojis } from '../../config/emojis.config.js';

export const moderationManager = {
  async ban(member, moderator, reason, deleteDays = 0) {
    await member.ban({ deleteMessageSeconds: deleteDays * 86400, reason: reason || 'No reason provided' });
    await this.logCase(member.guild.id, 'BAN', moderator.id, member.id, reason);
    await logModeration({ action: 'Ban', moderator, target: member.user, reason, guild: member.guild });
  },

  async kick(member, moderator, reason) {
    await member.kick(reason || 'No reason provided');
    await this.logCase(member.guild.id, 'KICK', moderator.id, member.id, reason);
    await logModeration({ action: 'Kick', moderator, target: member.user, reason, guild: member.guild });
  },

  async softban(member, moderator, reason) {
    await member.ban({ deleteMessageSeconds: 86400, reason: `Softban: ${reason || 'No reason'}` });
    await member.guild.members.unban(member.id, `Softban complete: ${reason || 'No reason'}`);
    await this.logCase(member.guild.id, 'SOFTBAN', moderator.id, member.id, reason);
    await logModeration({ action: 'Softban', moderator, target: member.user, reason, guild: member.guild });
  },

  async unban(guild, targetId, moderator, reason) {
    await guild.members.unban(targetId, reason || 'No reason provided');
    await this.logCase(guild.id, 'UNBAN', moderator.id, targetId, reason);
    await logModeration({ action: 'Unban', moderator, target: { id: targetId }, reason, guild });
  },

  async timeout(member, moderator, durationMs, reason) {
    await member.timeout(durationMs, reason || 'No reason provided');
    await this.logCase(member.guild.id, 'TIMEOUT', moderator.id, member.id, reason, Math.floor(durationMs / 1000));
    await logModeration({ action: 'Timeout', moderator, target: member.user, reason, guild: member.guild });
  },

  async untimeout(member, moderator, reason) {
    await member.timeout(null, reason || 'Timeout removed');
    await this.logCase(member.guild.id, 'UNTIMEOUT', moderator.id, member.id, reason);
    await logModeration({ action: 'Untimeout', moderator, target: member.user, reason, guild: member.guild });
  },

  async warn(guild, targetId, moderator, reason) {
    await this.logCase(guild.id, 'WARN', moderator.id, targetId, reason);
    await logModeration({ action: 'Warn', moderator, target: { id: targetId }, reason, guild });
  },

  async purge(channel, amount, filter = null) {
    const messages = await channel.messages.fetch({ limit: Math.min(amount, 100) });
    let toDelete = [...messages.values()];
    if (filter === 'bots') toDelete = toDelete.filter(m => m.author.bot);
    else if (filter === 'embeds') toDelete = toDelete.filter(m => m.embeds.length > 0);
    else if (filter === 'links') toDelete = toDelete.filter(m => /https?:\/\/[^\s]+/.test(m.content));
    else if (filter === 'images') toDelete = toDelete.filter(m => m.attachments.size > 0 || (m.embeds.length > 0 && m.embeds[0]?.image));
    else if (filter === 'reactions') toDelete = toDelete.filter(m => m.reactions.cache.size > 0);
    else if (typeof filter === 'string') toDelete = toDelete.filter(m => m.author.id === filter.replace(/[<@!>]/g, ''));

    if (toDelete.length === 0) return 0;
    if (toDelete.length === 1) {
      await toDelete[0].delete();
      return 1;
    }

    // Bulk delete handles 2-100 messages
    const ids = toDelete.map(m => m.id);
    await channel.bulkDelete(ids);
    return ids.length;
  },

  async purgeUser(channel, userId, amount) {
    const messages = await channel.messages.fetch({ limit: Math.min(amount, 100) });
    const userMessages = messages.filter(m => m.author.id === userId);
    if (userMessages.size === 0) return 0;
    if (userMessages.size === 1) {
      await userMessages.first().delete();
      return 1;
    }
    await channel.bulkDelete(userMessages.map(m => m.id));
    return userMessages.size;
  },

  async setSlowmode(channel, seconds) {
    await channel.setRateLimitPerUser(seconds);
  },

  async lockChannel(channel, reason) {
    await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
      SendMessages: false,
      AddReactions: false,
    });
    const msg = reason ? `🔒 Channel locked: ${reason}` : `🔒 Channel locked.`;
    await channel.send(msg).catch(() => null);
  },

  async unlockChannel(channel, reason) {
    await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
      SendMessages: null,
      AddReactions: null,
    });
    const msg = reason ? `🔓 Channel unlocked: ${reason}` : `🔓 Channel unlocked.`;
    await channel.send(msg).catch(() => null);
  },

  async lockAll(guild, reason) {
    const results = { locked: 0, failed: 0 };
    const channels = guild.channels.cache.filter(c => c.isTextBased?.() && c.viewable);
    for (const ch of channels.values()) {
      try {
        await ch.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false, AddReactions: false });
        results.locked++;
      } catch { results.failed++; }
    }
    return results;
  },

  async unlockAll(guild, reason) {
    const results = { unlocked: 0, failed: 0 };
    const channels = guild.channels.cache.filter(c => c.isTextBased?.() && c.viewable);
    for (const ch of channels.values()) {
      try {
        await ch.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: null, AddReactions: null });
        results.unlocked++;
      } catch { results.failed++; }
    }
    return results;
  },

  async setNickname(member, nickname) {
    await member.setNickname(nickname);
  },

  logCase(guildId, action, moderatorId, targetId, reason, duration = null) {
    try {
      const db = getDb();
      CasesRepo.create(db, { guildId, action, moderatorId, targetId, reason, duration });
    } catch (err) {
      logger.error('CASES', `Failed to log case: ${err.message}`);
    }
  },

  getWarnings(guildId, targetId) {
    const db = getDb();
    return CasesRepo.getByTarget(db, targetId).filter(c => c.action === 'WARN' && c.guild_id === guildId);
  },

  clearWarnings(guildId, targetId) {
    const db = getDb();
    db.prepare("DELETE FROM cases WHERE guild_id = ? AND target_id = ? AND action = 'WARN'").run(guildId, targetId);
  },
};
