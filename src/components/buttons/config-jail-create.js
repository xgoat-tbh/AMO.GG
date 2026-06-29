import { PermissionsBitField, MessageFlags } from 'discord.js';
import { getDb } from '../../database/connection.js';
import { ConfigRepo } from '../../database/repositories/config.repo.js';
import { renderDashboard } from '../../commands/admin/config.js';
import { emojis } from '../../config/emojis.config.js';
import { logger } from '../../helpers/logger.js';

export default {
  customId: 'config:jail_create',

  async execute(interaction, client) {
    const parts = interaction.customId.split(':');
    const executorId = parts[2];

    if (executorId && interaction.user.id !== executorId) {
      await interaction.reply({
        content: `${emojis.error} Only the person who ran the config command can manage jail settings.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferUpdate();

    try {
      const guild = interaction.guild;

      // Check if jail role already exists from config
      const db = getDb();
      const existingRoleId = ConfigRepo.get(db, 'jail_role_id');
      if (existingRoleId) {
        const existing = guild.roles.cache.get(existingRoleId);
        if (existing) {
          await interaction.followUp({
            content: `${emojis.warning} Jail role already exists as **${existing.name}**. Delete it first or use a different role.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
      }

      // Check if a role named "Jailed" already exists
      const existingNamed = guild.roles.cache.find(r => r.name === 'Jailed');
      if (existingNamed) {
        await interaction.followUp({
          content: `${emojis.warning} A role named **Jailed** already exists. Delete it first or rename it before creating a new one.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Create the jail role with no permissions
      const jailRole = await guild.roles.create({
        name: 'Jailed',
        color: 0x2C2F33,
        hoist: false,
        mentionable: false,
        permissions: [],
        reason: `Jail role created by ${interaction.user.tag}`,
      });

      // Deny ViewChannel on all channels for the jail role
      const denyPerms = new PermissionsBitField([
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.AddReactions,
        PermissionsBitField.Flags.CreateInstantInvite,
      ]);

      let channelCount = 0;
      for (const [, channel] of guild.channels.cache) {
        try {
          await channel.permissionOverwrites.create(jailRole, {
            ViewChannel: false,
            SendMessages: false,
            AddReactions: false,
            CreateInstantInvite: false,
          });
          channelCount++;
        } catch {}
      }

      // Check if a jail channel is configured and grant access there
      const jailChannelId = ConfigRepo.get(db, 'jail_channel_id');
      if (jailChannelId) {
        const jailChannel = guild.channels.cache.get(jailChannelId);
        if (jailChannel) {
          try {
            await jailChannel.permissionOverwrites.create(jailRole, {
              ViewChannel: true,
              SendMessages: true,
              AddReactions: true,
              ReadMessageHistory: true,
            });
          } catch {}
        }
      }

      // Store the role ID in config
      ConfigRepo.set(db, 'jail_role_id', jailRole.id);

      // Re-render dashboard
      const payload = renderDashboard(client, executorId);
      await interaction.editReply(payload);

      await interaction.followUp({
        content: `${emojis.success} Created **Jailed** role and denied channel access on **${channelCount}** channels.${jailChannelId ? '' : '\n' + emojis.info + ' No jail channel is configured — jailed users won\'t be able to see any channels. Use \`?config\` to set one.'}`,
        flags: MessageFlags.Ephemeral,
      });

      logger.info('JAIL', `Admin ${interaction.user.id} created jailed role and set up channel overrides.`);
    } catch (error) {
      logger.error('JAIL_CREATE', `Failed to create jail role: ${error.message}`, error);
      await interaction.followUp({
        content: `${emojis.error} Failed to create jail role: ${error.message}`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
