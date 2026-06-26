import { MessageFlags } from 'discord.js';
import { createV2Container, createV2Success, createV2Error } from '../../helpers/v2Helper.js';
import { config } from '../../config/bot.config.js';
import { emojis } from '../../config/emojis.config.js';
import { handleCommandError, sendUsageError } from '../../helpers/errorHandler.js';
import { gamepingManager } from '../../systems/gameping/gamepingManager.js';

export default {
  name: 'gamepingalias',
  aliases: ['gpa'],
  description: 'Manage gameping aliases.',
  usage: '?gamepingalias <add|remove|edit|list> [...]',
  permission: 'admin',

  async execute(message, args, client) {
    try {
      if (!args.length) {
        return sendUsageError(message, this.usage);
      }

      const sub = args[0].toLowerCase();

      switch (sub) {
        case 'add': {
          // ?gamepingalias add <alias> <@role> [@required_role]
          if (args.length < 3) {
            return sendUsageError(message, '?gamepingalias add <alias> <@role> [@required_role]');
          }

          const alias = args[1].toLowerCase();
          const roleMentions = message.mentions.roles;
          const roles = [...roleMentions.values()];

          if (!roles.length) {
            return message.reply({
              components: [createV2Error(`${emojis.error} You must mention at least one role.`, client)],
              flags: [MessageFlags.IsComponentsV2],
              allowedMentions: { repliedUser: false },
            });
          }

          const roleId = roles[0].id;
          const requiredRoleId = roles.length > 1 ? roles[1].id : null;

          await gamepingManager.addAlias(alias, roleId, requiredRoleId);

          await message.reply({
            components: [createV2Success(`${emojis.success} Alias \`${alias}\` created.`, client)],
            flags: [MessageFlags.IsComponentsV2],
            allowedMentions: { repliedUser: false },
          });
          break;
        }

        case 'remove': {
          // ?gamepingalias remove <alias>
          if (args.length < 2) {
            return sendUsageError(message, '?gamepingalias remove <alias>');
          }

          const alias = args[1].toLowerCase();
          const removed = await gamepingManager.removeAlias(alias);

          if (!removed) {
            return message.reply({
              components: [createV2Error(`${emojis.error} Alias \`${alias}\` not found.`, client)],
              flags: [MessageFlags.IsComponentsV2],
              allowedMentions: { repliedUser: false },
            });
          }

          await message.reply({
            components: [createV2Success(`${emojis.success} Alias \`${alias}\` removed.`, client)],
            flags: [MessageFlags.IsComponentsV2],
            allowedMentions: { repliedUser: false },
          });
          break;
        }

        case 'edit': {
          // ?gamepingalias edit <alias> <field> <value...>
          if (args.length < 4) {
            return sendUsageError(message, '?gamepingalias edit <alias> <role_id|required_role_id> <value>');
          }

          const alias = args[1].toLowerCase();
          const field = args[2].toLowerCase();
          const value = args.slice(3).join(' ');

          const validFields = ['role_id', 'required_role_id'];
          if (!validFields.includes(field)) {
            return message.reply({
              components: [createV2Error(`${emojis.error} Invalid field. Use: ${validFields.join(', ')}`, client)],
              flags: [MessageFlags.IsComponentsV2],
              allowedMentions: { repliedUser: false },
            });
          }

          // If field is a role ID field, extract from mention
          let finalValue = value;
          if ((field === 'role_id' || field === 'required_role_id') && message.mentions.roles.size) {
            finalValue = message.mentions.roles.first().id;
          }

          try {
            await gamepingManager.editAlias(alias, field, finalValue);

            await message.reply({
              components: [createV2Success(`${emojis.success} Alias \`${alias}\` updated: **${field}** set.`, client)],
              flags: [MessageFlags.IsComponentsV2],
              allowedMentions: { repliedUser: false },
            });
          } catch (err) {
            return message.reply({
              components: [createV2Error(`${emojis.error} ${err.message}`, client)],
              flags: [MessageFlags.IsComponentsV2],
              allowedMentions: { repliedUser: false },
            });
          }
          break;
        }

        case 'list': {
          const aliases = await gamepingManager.listAliases();

          if (!aliases.length) {
            return message.reply({
              components: [createV2Error(`${emojis.error} No gameping aliases configured.`, client)],
              flags: [MessageFlags.IsComponentsV2],
              allowedMentions: { repliedUser: false },
            });
          }

          const lines = aliases.map(a =>
            `\`${a.alias}\` → <@&${a.role_id}>${a.required_role_id ? ` (requires <@&${a.required_role_id}>)` : ''}`,
          );

          const container = createV2Container({
            title: `${emojis.game} GamePing Aliases`,
            description: lines.join('\n'),
            color: config.colors.primary,
            client,
          });

          await message.reply({
            components: [container],
            flags: [MessageFlags.IsComponentsV2],
            allowedMentions: { repliedUser: false },
          });
          break;
        }

        default:
          return sendUsageError(message, this.usage);
      }
    } catch (error) {
      await handleCommandError(message, error);
    }
  },
};
