import { createV2Container, createV2Error, v2Payload, v2EditPayload } from '../../helpers/v2Helper.js';
import { config } from '../../config/bot.config.js';
import { emojis } from '../../config/emojis.config.js';
import { handleCommandError, sendUsageError } from '../../helpers/errorHandler.js';
import { findRole } from '../../helpers/matcherHelper.js';
import { roleManager } from '../../systems/roles/roleManager.js';
import { logRole } from '../../services/loggingService.js';

export default {
  name: 'inrole',
  aliases: ['ir'],
  description: 'Toggle a target role on all members who have a source role.',
  usage: '?inrole <source role>, <target role>',
  permission: 'admin',

  async execute(message, args, client) {
    try {
      const input = args.join(' ');
      const parts = input.split(',').map(s => s.trim()).filter(Boolean);

      if (parts.length < 2) {
        return sendUsageError(message, this.usage);
      }

      const sourceMatch = findRole(message.guild, parts[0]);
      const targetMatch = findRole(message.guild, parts[1]);

      if (!sourceMatch) {
        return message.reply({
          ...v2Payload(createV2Error(`${emojis.error} Source role not found: \`${parts[0]}\``, client)),
          allowedMentions: { repliedUser: false },
        });
      }

      if (!targetMatch) {
        return message.reply({
          ...v2Payload(createV2Error(`${emojis.error} Target role not found: \`${parts[1]}\``, client)),
          allowedMentions: { repliedUser: false },
        });
      }

      const sourceRole = sourceMatch.role;
      const targetRole = targetMatch.role;

      // Fetch all members and filter by source role
      const members = await roleManager.getInRoleMembers(message.guild, sourceRole);

      if (!members.size) {
        return message.reply({
          ...v2Payload(createV2Error(`${emojis.error} No members found with **${sourceRole.name}**.`, client)),
          allowedMentions: { repliedUser: false },
        });
      }

      // Send initial progress message
      const progressMsg = await message.reply({
        ...v2Payload(createV2Container({
          description: `${emojis.loading} Processing... 0 / ${members.size}`,
          color: config.colors.warning,
          client,
        })),
        allowedMentions: { repliedUser: false },
      });

      const memberArray = [...members.values()];

      const result = await roleManager.toggleRoleBulk(memberArray, targetRole, (done, total) => {
        progressMsg.edit(
          v2EditPayload(createV2Container({
            description: `${emojis.loading} Processing... ${done} / ${total}`,
            color: config.colors.warning,
            client,
          }))
        ).catch(() => {});
      });

      // Log the bulk operation
      await logRole(client, {
        action: 'bulk',
        role: targetRole,
        sourceRole,
        moderator: message.member,
        added: result.added,
        removed: result.removed,
        failed: result.failed,
      });

      const container = createV2Container({
        description: [
          `${emojis.roles} **Inrole Complete**`,
          `Source: **${sourceRole.name}** → Target: **${targetRole.name}**`,
          '',
          `${emojis.success} ${result.added} added`,
          `${emojis.error} ${result.removed} removed`,
          `${emojis.warning} ${result.failed} failed`,
        ].join('\n'),
        color: config.colors.success,
        client,
      });

      await progressMsg.edit(v2EditPayload(container));
    } catch (error) {
      await handleCommandError(message, error);
    }
  },
};
