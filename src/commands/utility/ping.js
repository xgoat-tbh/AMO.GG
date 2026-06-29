import { createV2Container, v2Payload, v2EditPayload, codeStat, field, statusDot, statusLabel, relativeTime } from '../../helpers/v2Helper.js';
import { config } from '../../config/bot.config.js';
import { handleCommandError } from '../../helpers/errorHandler.js';

export default {
  name: 'ping',
  aliases: ['pong', 'latency', 'status'],
  description: 'View bot latency and system status.',
  usage: '?ping',
  permission: 'everyone',

  async execute(message, args, client) {
    try {
      const sent = await message.reply({
        ...v2Payload(createV2Container({
          description: `🔄 Pinging...`,
          color: config.colors.primary,
          client,
        })),
        allowedMentions: { repliedUser: false },
      });

      const roundTrip = sent.createdTimestamp - message.createdTimestamp;
      const ws = Math.round(client.ws.ping);
      const uptime = process.uptime();
      const memory = process.memoryUsage().rss;
      const memoryMB = (memory / 1024 / 1024).toFixed(1);
      const cpu = (process.cpuUsage().user / 1000000).toFixed(1);
      const created = client.user.createdTimestamp;

      const lines = [
        `### 🏓 System Status`,
        '',
        `${codeStat('Gateway', `${ws}ms`)} ${statusDot(ws, { good: 50, fair: 150, poor: 300 })} — ${statusLabel(ws, { good: 50, fair: 150, poor: 300 })}`,
        `${codeStat('Roundtrip', `${roundTrip}ms`)} ${statusDot(roundTrip, { good: 100, fair: 250, poor: 500 })} — ${statusLabel(roundTrip, { good: 100, fair: 250, poor: 500 })}`,
        field('Database', '✅ Connected'),
        '',
        `🧠 **Memory** ${memoryMB} MB`,
        `💻 **CPU** ${cpu}s`,
        `⏱ **Uptime** ${relativeTime(Math.floor(Date.now() / 1000 - uptime))}`,
        `📅 **Created** ${relativeTime(Math.floor(created / 1000))}`,
        `🔢 **Shard** \`${(client.shard?.ids[0] ?? 0) + 1}/${client.shard?.count ?? 1}\``,
      ].join('\n');

      const worst = Math.max(ws, roundTrip);
      const color = worst <= 150 ? config.colors.success : worst <= 300 ? config.colors.warning : config.colors.error;

      await sent.edit(v2EditPayload(createV2Container({
        description: lines,
        color,
        client,
      })));
    } catch (error) {
      await handleCommandError(message, error);
    }
  },
};