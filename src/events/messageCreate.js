import { MessageFlags } from 'discord.js';
import { config } from '../config/bot.config.js';
import { checkPermission, isBotOwner } from '../helpers/permissions.js';
import { handleCommandError, sendPermissionDenied } from '../helpers/errorHandler.js';
import { createV2Container, v2Payload } from '../helpers/v2Helper.js';
import { metricsManager } from '../helpers/metricsManager.js';

export default {
  name: 'messageCreate',

  async execute(message, client) {
    // Ignore bots and DMs
    if (message.author.bot) return;
    if (!message.guild) return;

    // Blacklist check (in-memory cache)
    if (client.blacklist && client.blacklist.has(message.author.id)) {
      return;
    }

    // Check for prefix
    if (!message.content.startsWith(config.prefix)) return;

    // Parse command name and arguments
    const args = message.content.slice(config.prefix.length).trim().split(/\s+/);
    const commandName = args.shift().toLowerCase();

    if (!commandName) return;

    // Look up command by name or alias
    const command =
      client.commands.get(commandName) ||
      client.commands.get(client.aliases.get(commandName));

    if (!command) return;

    // Maintenance check
    if (client.maintenanceMode && !isBotOwner(message.author)) {
      try {
        const container = createV2Container({
          title: '⚙️ Maintenance Mode',
          description: 'Amo.GG is currently undergoing maintenance. Please try again later.',
          color: config.colors.warning,
          client,
        });
        const reply = await message.reply({
          ...v2Payload(container),
          allowedMentions: { repliedUser: false },
        });
        try { await message.delete(); } catch {}
        setTimeout(async () => {
          try { await reply.delete(); } catch {}
        }, 6000);
      } catch {}
      return;
    }

    // Permission check
    if (command.category === 'dev' || command.permission === 'dev') {
      if (!isBotOwner(message.author)) {
        return sendPermissionDenied(message);
      }
    } else if (command.permission && command.permission !== 'everyone') {
      if (!checkPermission(message.member, command.permission)) {
        return sendPermissionDenied(message);
      }
    }

    // Execute with performance monitoring
    const start = performance.now();
    try {
      await command.execute(message, args, client);
      const duration = performance.now() - start;
      metricsManager.recordCommand(command.name, duration, false);
    } catch (error) {
      const duration = performance.now() - start;
      metricsManager.recordCommand(command.name, duration, true);
      await handleCommandError(message, error);
    }
  },
};
