import { createV2Success, createV2Error, v2Payload } from '../../helpers/v2Helper.js';
import { emojis } from '../../config/emojis.config.js';
import { handleCommandError, sendUsageError } from '../../helpers/errorHandler.js';
import { gamepingManager } from '../../systems/gameping/gamepingManager.js';
import { botConfig } from '../../helpers/configHelper.js';
import { checkPermission } from '../../helpers/permissions.js';

export default {
  name: 'gameping',
  aliases: ['gp'],
  description: 'Ping a game role using an alias.',
  usage: '?gameping <alias> <message>',
  permission: 'everyone',

  async execute(message, args, client) {
    try {
      const allowedRoleId = botConfig.gamepingRoleId;
      const reqPermLevel = botConfig.gamepingPermission || 'everyone';

      let hasAccess = false;
      if (checkPermission(message.member, 'admin')) {
        hasAccess = true;
      } else if (allowedRoleId) {
        if (message.member.roles.cache.has(allowedRoleId)) {
          hasAccess = true;
        }
      } else {
        hasAccess = checkPermission(message.member, reqPermLevel);
      }

      if (!hasAccess) {
        return message.reply({
          ...v2Payload(createV2Error(`${emojis.error} You do not have permission to use the GamePing command.`, client)),
          allowedMentions: { repliedUser: false },
        });
      }

      if (args.length < 2) {
        return sendUsageError(message, this.usage);
      }

      const alias = args[0].toLowerCase();
      const customMessage = args.slice(1).join(' ');
      const result = await gamepingManager.execute(alias, customMessage, message.member, message.channel);

      if (result.error) {
        return message.reply({
          ...v2Payload(createV2Error(`${emojis.error} ${result.error}`, client)),
          allowedMentions: { repliedUser: false },
        });
      }

      // The gamepingManager.execute handles sending the ping message itself.
      // If it returns a success message, show it.
      if (result.message) {
        await message.reply({
          ...v2Payload(createV2Success(`${emojis.game} ${result.message}`, client)),
          allowedMentions: { repliedUser: false },
        });
      }
    } catch (error) {
      await handleCommandError(message, error);
    }
  },
};
