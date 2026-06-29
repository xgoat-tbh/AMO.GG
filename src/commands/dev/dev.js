import { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createV2Container, createV2Success, createV2Error, v2Payload, v2EditPayload } from '../../helpers/v2Helper.js';
import { emojis } from '../../config/emojis.config.js';
import { config } from '../../config/bot.config.js';
import { getDb, closeDb } from '../../database/connection.js';
import { ConfigRepo } from '../../database/repositories/config.repo.js';
import { BlacklistRepo } from '../../database/repositories/blacklist.repo.js';
import { isBotOwner } from '../../helpers/permissions.js';
import { reloadConfig } from '../../index.js'; // Expose in index.js
import fs from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import os from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default {
  name: 'dev',
  category: 'dev',
  permission: 'dev',
  description: 'Amo.GG Developer Control Center (Owner Only).',
  usage: '?dev [status|maintenance|restart|shutdown|reload|logs|backup|database|announce|blacklist|whitelist]',

  async execute(message, args, client) {
    // Ephemeral deletion for clean chat
    const deleteTrigger = () => {
      try { message.delete().catch(() => {}); } catch {}
    };

    const sendEphemeralResult = async (container) => {
      deleteTrigger();
      const reply = await message.reply({
        ...v2Payload(container),
        allowedMentions: { repliedUser: false },
      });
      setTimeout(() => {
        try { reply.delete().catch(() => {}); } catch {}
      }, 6000);
    };

    if (!args.length) {
      // ── COMPACT DEVELOPER DASHBOARD ──
      const db = getDb();
      const uptime = process.uptime();
      const days = Math.floor(uptime / 86400);
      const hours = Math.floor((uptime % 86400) / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      const uptimeStr = `${days}d ${hours}h ${minutes}m`;

      const mem = process.memoryUsage();
      const heapUsedMB = (mem.heapUsed / 1024 / 1024).toFixed(1);
      const rssMB = (mem.rss / 1024 / 1024).toFixed(1);
      const memoryStr = `${heapUsedMB}MB (RSS: ${rssMB}MB)`;

      // CPU percent calculation
      const cpuUsage = process.cpuUsage();
      const totalCpuTime = (cpuUsage.user + cpuUsage.system) / 1000000;
      const cpuPercent = ((totalCpuTime / uptime) * 100).toFixed(1);
      const cpuStr = `${cpuPercent}%`;

      const dbStart = performance.now();
      db.prepare('SELECT 1').get();
      const dbLatency = (performance.now() - dbStart).toFixed(2);
      const dbStatus = `Connected (${dbLatency}ms)`;

      const pkgPath = join(__dirname, '..', '..', '..', 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const botVersion = pkg.version || '1.0.0';

      const dashboard = createV2Container({
        title: '💻 Amo.GG Developer Center',
        color: config.colors.primary,
        fields: [
          { name: 'Bot Status', value: `${emojis.success} Online` },
          { name: 'Uptime', value: uptimeStr },
          { name: 'Ping', value: `${client.ws.ping}ms` },
          { name: `${emojis.memory || '💾'} Memory Usage`, value: memoryStr },
          { name: `${emojis.cpu || '💻'} CPU Usage`, value: cpuStr },
          { name: `${emojis.database || '🗄️'} Database Status`, value: dbStatus },
          { name: 'Bot Version', value: `v${botVersion}` },
        ],
        client,
      });

      deleteTrigger();
      await message.channel.send(v2Payload(dashboard));
      return;
    }

    const sub = args[0].toLowerCase();

    switch (sub) {
      case 'status': {
        const db = getDb();
        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const uptimeStr = `${days}d ${hours}h ${minutes}m`;

        const mem = process.memoryUsage();
        const memoryStr = `${(mem.heapUsed / 1024 / 1024).toFixed(1)}MB (RSS: ${(mem.rss / 1024 / 1024).toFixed(1)}MB)`;

        const cpuUsage = process.cpuUsage();
        const totalCpuTime = (cpuUsage.user + cpuUsage.system) / 1000000;
        const cpuPercent = ((totalCpuTime / uptime) * 100).toFixed(1);
        const cpuStr = `${cpuPercent}%`;

        // DB Health check
        let dbHealth = 'Healthy';
        try {
          db.prepare('SELECT 1').get();
        } catch {
          dbHealth = 'Unhealthy';
        }

        // Discord Status API
        let apiStatus = 'Operational';
        try {
          const res = await fetch('https://discordstatus.com/api/v2/status.json');
          if (res.ok) {
            const data = await res.json();
            apiStatus = data.status.description || 'Operational';
          }
        } catch {
          apiStatus = 'Unknown (Request failed)';
        }

        const pkgPath = join(__dirname, '..', '..', '..', 'package.json');
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const botVersion = pkg.version || '1.0.0';

        const statusContainer = createV2Container({
          title: '📊 Full System Status',
          color: config.colors.primary,
          fields: [
            { name: 'Status', value: `${emojis.success} Active` },
            { name: 'Uptime', value: uptimeStr },
            { name: 'Ping', value: `${client.ws.ping}ms` },
            { name: `${emojis.memory || '💾'} Memory Usage`, value: memoryStr },
            { name: `${emojis.cpu || '💻'} CPU Usage`, value: cpuStr },
            { name: `${emojis.database || '🗄️'} Database Health`, value: dbHealth },
            { name: 'Discord API Status', value: apiStatus },
            { name: 'Version', value: `v${botVersion}` },
          ],
          client,
        });

        deleteTrigger();
        await message.channel.send(v2Payload(statusContainer));
        break;
      }

      case 'maintenance': {
        if (args.length < 2) {
          const status = client.maintenanceMode ? 'enabled' : 'disabled';
          await sendEphemeralResult(createV2Error(`${emojis.error} Maintenance mode is currently **${status}**. Use: \`?dev maintenance <on/off>\``, client));
          return;
        }

        const mode = args[1].toLowerCase();
        const db = getDb();

        if (mode === 'on') {
          client.maintenanceMode = true;
          ConfigRepo.set(db, 'maintenance_mode', 'true');
          await sendEphemeralResult(createV2Success(`${emojis.success} Maintenance mode has been **enabled**. Command access restricted to Developer.`, client));
        } else if (mode === 'off') {
          client.maintenanceMode = false;
          ConfigRepo.set(db, 'maintenance_mode', 'false');
          await sendEphemeralResult(createV2Success(`${emojis.success} Maintenance mode has been **disabled**. Normal bot access restored.`, client));
        } else {
          await sendEphemeralResult(createV2Error(`${emojis.error} Invalid mode. Use \`on\` or \`off\`.`, client));
        }
        break;
      }

      case 'restart': {
        deleteTrigger();
        const notifyMsg = await message.channel.send(v2Payload(createV2Success(`${emojis.loading} Restarting Amo.GG... Spawning detached process.`, client)));

        logger.info('DEV', 'Graceful restart initiated via command.');
        closeDb();
        client.destroy();

        // Spawn a new process of the bot
        const child = spawn(process.argv[0], process.argv.slice(1), {
          detached: true,
          stdio: 'ignore',
        });
        child.unref();
        process.exit(0);
        break;
      }

      case 'shutdown': {
        deleteTrigger();
        await message.channel.send(v2Payload(createV2Success('🛑 Shutting down Amo.GG safely... Database closed.', client)));

        logger.info('DEV', 'Shutdown command received. Safely terminating process.');
        closeDb();
        client.destroy();
        process.exit(0);
        break;
      }

      case 'reload': {
        if (args.length < 2) {
          await sendEphemeralResult(createV2Error(`${emojis.error} Specify target: \`commands\`, \`events\`, \`config\`, or \`all\`.`, client));
          return;
        }

        const target = args[1].toLowerCase();
        try {
          if (target === 'commands') {
            await client.loadCommands();
            await sendEphemeralResult(createV2Success(`${emojis.success} Reloaded all commands successfully.`, client));
          } else if (target === 'events') {
            await client.loadEvents();
            await sendEphemeralResult(createV2Success(`${emojis.success} Reloaded all events successfully.`, client));
          } else if (target === 'config') {
            await reloadConfig();
            await sendEphemeralResult(createV2Success(`${emojis.success} Reloaded configuration files successfully.`, client));
          } else if (target === 'all') {
            await client.loadCommands();
            await client.loadEvents();
            await reloadConfig();
            await sendEphemeralResult(createV2Success(`${emojis.success} Reloaded commands, events, and configurations successfully.`, client));
          } else {
            await sendEphemeralResult(createV2Error(`${emojis.error} Unknown reload target: \`${target}\`.`, client));
          }
        } catch (err) {
          logger.error('RELOAD', `Reload failed: ${err.message}`, err);
          await sendEphemeralResult(createV2Error(`${emojis.error} Reload failed: ${err.message}`, client));
        }
        break;
      }

      case 'logs': {
        const logPath = join(__dirname, '..', '..', '..', 'logs', 'combined.log');
        if (!fs.existsSync(logPath)) {
          await sendEphemeralResult(createV2Error(`${emojis.error} No logs found in \`logs/combined.log\`.`, client));
          return;
        }

        const allLines = fs.readFileSync(logPath, 'utf8')
          .split('\n')
          .filter(Boolean)
          .reverse(); // Latest logs first

        const pageSize = 10;
        const totalPages = Math.max(1, Math.ceil(allLines.length / pageSize));

        const pageLines = allLines.slice(0, pageSize);
        const formattedLogs = pageLines.map(line => {
          if (line.includes('[ERROR]')) return ` [31m${line} [0m`;
          if (line.includes('[WARN]')) return ` [33m${line} [0m`;
          if (line.includes('[SUCCESS]')) return ` [32m${line} [0m`;
          return line;
        }).reverse().join('\n');

        const logContent = formattedLogs ? `\`\`\`ansi\n${formattedLogs}\n\`\`\`` : '*No log entries.*';

        const container = createV2Container({
          title: `📋 System Logs (Page 1/${totalPages})`,
          description: logContent,
          color: config.colors.primary,
          client,
        });

        const prevBtn = new ButtonBuilder()
          .setCustomId(`dev:logs:prev:1:${message.author.id}`)
          .setLabel('◀️ Previous')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true);

        const nextBtn = new ButtonBuilder()
          .setCustomId(`dev:logs:next:1:${message.author.id}`)
          .setLabel('Next ▶️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(totalPages <= 1);

        const row = new ActionRowBuilder().addComponents(prevBtn, nextBtn);

        deleteTrigger();
        await message.channel.send(v2Payload(container, [row]));
        break;
      }

      case 'backup': {
        if (args.length < 2) {
          await sendEphemeralResult(createV2Error(`${emojis.error} Usage: \`?dev backup <create|list|restore>\``, client));
          return;
        }

        const action = args[1].toLowerCase();
        const backupsDir = join(__dirname, '..', '..', '..', 'backups');
        const dbPath = join(__dirname, '..', '..', '..', 'amo.db');

        if (action === 'create') {
          const db = getDb();
          // Flush WAL log file before copying database file
          db.exec('PRAGMA wal_checkpoint(TRUNCATE)');

          if (!fs.existsSync(backupsDir)) {
            fs.mkdirSync(backupsDir, { recursive: true });
          }

          const filename = `backup_${Date.now()}.db`;
          const backupFilePath = join(backupsDir, filename);

          try {
            fs.copyFileSync(dbPath, backupFilePath);
            await sendEphemeralResult(createV2Success(`${emojis.success} Backup created: \`${filename}\``, client));
          } catch (err) {
            await sendEphemeralResult(createV2Error(`${emojis.error} Failed to create backup: ${err.message}`, client));
          }
        } else if (action === 'list') {
          if (!fs.existsSync(backupsDir)) {
            await sendEphemeralResult(createV2Error(`${emojis.error} No backups found. backups directory is empty.`, client));
            return;
          }

          const files = fs.readdirSync(backupsDir)
            .filter(f => f.startsWith('backup_') && f.endsWith('.db'))
            .sort((a, b) => b.localeCompare(a)); // Newest first

          if (!files.length) {
            await sendEphemeralResult(createV2Error(`${emojis.error} No backup files found.`, client));
            return;
          }

          const lines = files.map((f, index) => {
            const stats = fs.statSync(join(backupsDir, f));
            const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
            const date = new Date(parseInt(f.replace('backup_', '').replace('.db', ''), 10)).toLocaleString();
            return `**[${index + 1}]** \`${f}\` (${sizeMB}MB) — *${date}*`;
          });

          const container = createV2Container({
            title: `${emojis.backup || '🗄️'} Database Backups`,
            description: lines.join('\n'),
            color: config.colors.primary,
            client,
          });

          deleteTrigger();
          await message.channel.send(v2Payload(container));
        } else if (action === 'restore') {
          if (args.length < 3) {
            await sendEphemeralResult(createV2Error(`${emojis.error} Usage: \`?dev backup restore <index_or_filename>\``, client));
            return;
          }

          if (!fs.existsSync(backupsDir)) {
            await sendEphemeralResult(createV2Error(`${emojis.error} No backup files found.`, client));
            return;
          }

          const files = fs.readdirSync(backupsDir)
            .filter(f => f.startsWith('backup_') && f.endsWith('.db'))
            .sort((a, b) => b.localeCompare(a)); // Newest first

          const target = args[2];
          let targetFile = null;

          if (/^\d+$/.test(target)) {
            const index = parseInt(target, 10) - 1;
            if (index >= 0 && index < files.length) {
              targetFile = files[index];
            }
          } else {
            if (files.includes(target)) {
              targetFile = target;
            }
          }

          if (!targetFile) {
            await sendEphemeralResult(createV2Error(`${emojis.error} Backup not found.`, client));
            return;
          }

          const backupFilePath = join(backupsDir, targetFile);

          deleteTrigger();
          const progressMsg = await message.channel.send(v2Payload(createV2Success(`${emojis.loading} Restoring backup \`${targetFile}\`... Closing DB.`, client)));

          try {
            closeDb();
            fs.copyFileSync(backupFilePath, dbPath);
            getDb(); // Reopen/initialize database
            await progressMsg.edit(v2EditPayload(createV2Success(`${emojis.success} Backup restored successfully. Database re-opened.`, client)));
          } catch (err) {
            await progressMsg.edit(v2EditPayload(createV2Error(`${emojis.error} Restore failed: ${err.message}`, client)));
          }
        } else {
          await sendEphemeralResult(createV2Error(`${emojis.error} Unknown action: \`${action}\`. Use \`create\`, \`list\`, or \`restore\`.`, client));
        }
        break;
      }

      case 'database': {
        const db = getDb();
        const dbStart = performance.now();
        db.prepare('SELECT 1').get();
        const dbLatency = (performance.now() - dbStart).toFixed(2);

        const dbPath = join(__dirname, '..', '..', '..', 'amo.db');
        const stats = fs.statSync(dbPath);
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

        // Find last backup time
        const backupsDir = join(__dirname, '..', '..', '..', 'backups');
        let lastBackupTime = 'Never';
        if (fs.existsSync(backupsDir)) {
          const files = fs.readdirSync(backupsDir)
            .filter(f => f.startsWith('backup_') && f.endsWith('.db'))
            .sort((a, b) => b.localeCompare(a));
          if (files.length) {
            const timestamp = parseInt(files[0].replace('backup_', '').replace('.db', ''), 10);
            lastBackupTime = new Date(timestamp).toLocaleString();
          }
        }

        const container = createV2Container({
          title: `${emojis.database || '🗄️'} Database Operations Status`,
          color: config.colors.primary,
          fields: [
            { name: 'Connection Status', value: `${emojis.success} Connected` },
            { name: 'Latency', value: `${dbLatency}ms` },
            { name: 'Database Size', value: `${sizeMB}MB` },
            { name: `${emojis.backup || '🗃️'} Last Backup Time`, value: lastBackupTime },
          ],
          client,
        });

        deleteTrigger();
        await message.channel.send(v2Payload(container));
        break;
      }

      case 'announce': {
        const messageText = args.slice(1).join(' ');
        if (!messageText) {
          await sendEphemeralResult(createV2Error(`${emojis.error} Provide an announcement message.`, client));
          return;
        }

        const db = getDb();
        const rawChannels = ConfigRepo.get(db, 'announcement_channels');
        let channelIds = [];
        if (rawChannels) {
          channelIds = rawChannels.split(',').map(id => id.trim()).filter(Boolean);
        } else {
          // Fallback search
          const guild = message.guild;
          const annChannel = guild.channels.cache.find(c => c.name.toLowerCase() === 'announcements' || c.name.toLowerCase() === 'announcement');
          if (annChannel) {
            channelIds.push(annChannel.id);
          } else if (guild.systemChannelId) {
            channelIds.push(guild.systemChannelId);
          }
        }

        if (!channelIds.length) {
          await sendEphemeralResult(createV2Error(`${emojis.error} No announcement channels configured in database.`, client));
          return;
        }

        const announceContainer = createV2Container({
          title: '📢 System Announcement',
          description: messageText,
          color: config.colors.primary,
          client,
        });

        let success = 0;
        let failed = 0;

        for (const cid of channelIds) {
          try {
            const ch = message.guild.channels.cache.get(cid) || await message.guild.channels.fetch(cid).catch(() => null);
            if (ch && ch.isTextBased()) {
              await ch.send(v2Payload(announceContainer));
              success++;
            } else {
              failed++;
            }
          } catch {
            failed++;
          }
        }

        await sendEphemeralResult(createV2Success(`${emojis.success} Announcement sent to **${success}** channels (${failed} failed).`, client));
        break;
      }

      case 'blacklist': {
        if (args.length < 2) {
          await sendEphemeralResult(createV2Error(`${emojis.error} Specify a user to blacklist.`, client));
          return;
        }

        const userArg = args[1];
        const userId = userArg.replace(/[<@!>]/g, '');
        const targetUser = await client.users.fetch(userId).catch(() => null);

        if (!targetUser) {
          await sendEphemeralResult(createV2Error(`${emojis.error} Could not find that user.`, client));
          return;
        }

        if (isBotOwner(targetUser)) {
          await sendEphemeralResult(createV2Error(`${emojis.error} You cannot blacklist the Developer.`, client));
          return;
        }

        const db = getDb();
        BlacklistRepo.add(db, targetUser.id, message.author.id);
        client.blacklist.add(targetUser.id);
        logger.info('BLACKLIST', `User ${targetUser.tag} (${targetUser.id}) was blacklisted by ${message.author.tag} (${message.author.id})`);

        await sendEphemeralResult(createV2Success(`${emojis.success} **${targetUser.tag}** has been globally blacklisted.`, client));
        break;
      }

      case 'whitelist': {
        if (args.length < 2) {
          await sendEphemeralResult(createV2Error(`${emojis.error} Specify a user to whitelist.`, client));
          return;
        }

        const userArg = args[1];
        const userId = userArg.replace(/[<@!>]/g, '');
        const targetUser = await client.users.fetch(userId).catch(() => null);

        if (!targetUser) {
          await sendEphemeralResult(createV2Error(`${emojis.error} Could not find that user.`, client));
          return;
        }

        const db = getDb();
        BlacklistRepo.remove(db, targetUser.id);
        client.blacklist.delete(targetUser.id);
        logger.info('BLACKLIST', `User ${targetUser.tag} (${targetUser.id}) was whitelisted by ${message.author.tag} (${message.author.id})`);

        await sendEphemeralResult(createV2Success(`${emojis.success} **${targetUser.tag}** has been whitelisted.`, client));
        break;
      }

      default: {
        await sendEphemeralResult(createV2Error(`${emojis.error} Unknown developer subcommand. Use \`?dev\` to see dashboard.`, client));
        break;
      }
    }
  },
};
