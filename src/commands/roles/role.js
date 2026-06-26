import { MessageFlags } from 'discord.js';
import { createV2Container, createV2Error } from '../../helpers/v2Helper.js';
import { config } from '../../config/bot.config.js';
import { emojis } from '../../config/emojis.config.js';
import { handleCommandError, sendUsageError } from '../../helpers/errorHandler.js';
import { findRoles } from '../../helpers/matcherHelper.js';
import { roleManager } from '../../systems/roles/roleManager.js';
import { logRole } from '../../services/loggingService.js';
import { RolesRepo } from '../../database/repositories/roles.repo.js';
import { getDb } from '../../database/connection.js';

export default {
  name: 'role',
  aliases: ['r'],
  description: 'Toggle roles on a user.',
  usage: '?role <@user> <role1>, [role2], [role3]',
  permission: 'moderator',

  async execute(message, args, client) {
    try {
      if (args.length < 2) {
        return sendUsageError(message, this.usage);
      }

      // Parse target user
      const userArg = args[0];
      const userId = userArg.replace(/[<@!>]/g, '');
      const member = await message.guild.members.fetch(userId).catch(() => null);

      if (!member) {
        return message.reply({
          components: [createV2Error(`${emojis.error} Could not find that user.`, client)],
          flags: [MessageFlags.IsComponentsV2],
          allowedMentions: { repliedUser: false },
        });
      }

      // Remaining args = comma-separated role queries
      const roleQuery = args.slice(1).join(' ');
      const resolved = findRoles(message.guild, roleQuery);

      const results = [];
      const db = getDb();

      for (const entry of resolved) {
        if (!entry.role) {
          results.push(`${emojis.warning} Not found: \`${entry.query}\``);
          continue;
        }

        try {
          const { action } = await roleManager.toggleRole(member, entry.role);
          const icon = action === 'added' ? emojis.success : emojis.error;
          const label = action === 'added' ? 'Added' : 'Removed';
          results.push(`${icon} ${label} **${entry.role.name}**`);

          // Database audit log
          RolesRepo.logAction(
            db,
            message.author.id,
            member.id,
            entry.role.id,
            action === 'added' ? 'add' : 'remove',
            'role',
          );

          // Channel log
          await logRole(client, {
            action: action === 'added' ? 'add' : 'remove',
            role: entry.role,
            target: member,
            moderator: message.member,
          });
        } catch {
          results.push(`${emojis.warning} Failed: **${entry.role.name}**`);
        }
      }

      const container = createV2Container({
        description: `${emojis.roles} Role changes for ${member}:\n\n${results.join('\n')}`,
        color: config.colors.primary,
        client,
      });

      await message.reply({
        components: [container],
        flags: [MessageFlags.IsComponentsV2],
        allowedMentions: { repliedUser: false },
      });
    } catch (error) {
      await handleCommandError(message, error);
    }
  },
};
