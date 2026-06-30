import { createV2Container, v2Payload, notification, codeStat, field } from '../../helpers/v2Helper.js';
import { config } from '../../config/bot.config.js';
import { emojis } from '../../config/emojis.config.js';
import { handleCommandError } from '../../helpers/errorHandler.js';
import { metricsManager } from '../../helpers/metricsManager.js';
import { getDb } from '../../database/connection.js';
import { UsageRepo } from '../../database/repositories/usage.repo.js';

export default {
  name: 'analytics',
  aliases: ['stats', 'usage', 'cmdstats'],
  description: 'View command usage analytics and performance metrics.',
  usage: '?analytics [commands | users]',
  permission: 'admin',

  async execute(message, args, client) {
    try {
      const sub = args[0]?.toLowerCase();

      if (sub === 'commands' || sub === 'cmds') {
        return this.showCommands(message, client);
      }

      if (sub === 'users' || sub === 'user') {
        return this.showUsers(message, client);
      }

      return this.showOverview(message, client);
    } catch (error) {
      await handleCommandError(message, error);
    }
  },

  async showOverview(message, client) {
    const db = getDb();
    const total = UsageRepo.getTotalUsage(db, message.guild.id);
    const today = UsageRepo.getUsageToday(db, message.guild.id);

    const lines = [
      `### ${emojis.database || '📊'} Command Analytics Overview`,
      '',
      codeStat('Total Commands Run', total?.total || 0),
      codeStat('Errors', total?.errors || 0),
      codeStat('Today', today?.count || 0),
      codeStat('Cache Hit Rate', metricsManager.getCacheHitRate()),
      '',
      `\`?analytics commands\` — Top commands by usage`,
      `\`?analytics users\` — Top users by command usage`,
    ];

    const container = createV2Container({ description: lines.join('\n'), color: config.colors.primary, client });
    await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
  },

  async showCommands(message, client) {
    const db = getDb();
    const topCmds = UsageRepo.getTopCommands(db, message.guild.id, 15);

    if (!topCmds.length) {
      return message.reply({ ...v2Payload(notification('info', `${emojis.info} No command usage data yet.`, client)), allowedMentions: { repliedUser: false } });
    }

    const lines = [
      `### ${emojis.database || '📊'} Top Commands`,
      '',
      ...topCmds.map((c, i) =>
        `${i + 1}. \`${c.command_name}\` — ${c.count} uses` +
        (c.errors > 0 ? ` (${c.errors} errors)` : '') +
        (c.avg_duration ? ` — ${Math.round(c.avg_duration)}ms avg` : '')
      ),
    ];

    const container = createV2Container({ description: lines.join('\n'), color: config.colors.primary, client });
    await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
  },

  async showUsers(message, client) {
    const db = getDb();
    const topUsers = UsageRepo.getTopUsers(db, message.guild.id, 15);

    if (!topUsers.length) {
      return message.reply({ ...v2Payload(notification('info', `${emojis.info} No command usage data yet.`, client)), allowedMentions: { repliedUser: false } });
    }

    const lines = [
      `### ${emojis.database || '📊'} Top Users`,
      '',
      ...topUsers.map((u, i) =>
        `${i + 1}. <@${u.user_id}> — ${u.count} commands`
      ),
    ];

    const container = createV2Container({ description: lines.join('\n'), color: config.colors.primary, client });
    await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
  },
};
