import { createV2Container, createV2Error, v2Payload } from '../../helpers/v2Helper.js';
import { config } from '../../config/bot.config.js';
import { emojis } from '../../config/emojis.config.js';
import { handleCommandError, sendUsageError } from '../../helpers/errorHandler.js';
import { findRole } from '../../helpers/matcherHelper.js';
import { roleManager } from '../../systems/roles/roleManager.js';
import { logRole } from '../../services/loggingService.js';
import { RolesRepo } from '../../database/repositories/roles.repo.js';
import { getDb } from '../../database/connection.js';

export default {
  name: 'arole',
  aliases: ['ar'],
  description: 'Toggle a role on multiple users.',
  usage: '?arole <role> <@user1> [@user2] [...]',
  permission: 'moderator',

  async execute(message, args, client) {
    try {
      if (!args.length || !message.mentions.members.size) {
        return sendUsageError(message, this.usage);
      }

      // Everything before the first mention is the role query
      const mentionRegex = /<@!?\d+>/;
      const firstMentionIdx = args.findIndex(a => mentionRegex.test(a));
      if (firstMentionIdx < 1) {
        return sendUsageError(message, this.usage);
      }

      const roleQuery = args.slice(0, firstMentionIdx).join(' ');
      const match = findRole(message.guild, roleQuery);

      if (!match) {
        return message.reply({
          ...v2Payload(createV2Error(`${emojis.error} Could not find role: \`${roleQuery}\``, client)),
          allowedMentions: { repliedUser: false },
        });
      }

      const { role } = match;
      const members = message.mentions.members;
      const results = [];
      const db = getDb();

      for (const [, member] of members) {
        try {
          const { action } = await roleManager.toggleRole(member, role);
          const icon = action === 'added' ? emojis.success : emojis.error;
          const label = action === 'added' ? 'Added' : 'Removed';
          results.push(`${icon} ${label} **${role.name}** → ${member}`);

          RolesRepo.logAction(
            db,
            message.author.id,
            member.id,
            role.id,
            action === 'added' ? 'add' : 'remove',
            'arole',
          );

          await logRole(client, {
            action: action === 'added' ? 'add' : 'remove',
            role,
            target: member,
            moderator: message.member,
          });
        } catch {
          results.push(`${emojis.warning} Failed for ${member}`);
        }
      }

      const container = createV2Container({
        description: `${emojis.roles} **${role.name}** toggle results:\n\n${results.join('\n')}`,
        color: config.colors.primary,
        client,
      });

      await message.reply({
        ...v2Payload(container),
        allowedMentions: { repliedUser: false },
      });
    } catch (error) {
      await handleCommandError(message, error);
    }
  },
};
