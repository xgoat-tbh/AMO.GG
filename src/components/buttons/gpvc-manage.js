import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, MessageFlags, PermissionFlagsBits, UserSelectMenuBuilder } from 'discord.js';
import { getDb } from '../../database/connection.js';
import { TempVcsRepo } from '../../database/repositories/tempVcs.repo.js';
import { createV2Container, v2Payload, v2EditPayload } from '../../helpers/v2Helper.js';
import { buildInterfaceContainer, buildInterfaceRows } from '../../systems/voice/tempVcManager.js';
import { config } from '../../config/bot.config.js';
import { emojis } from '../../config/emojis.config.js';
import { logger } from '../../helpers/logger.js';
import { GAMES } from '../../commands/voice/gpvc.js';

export default {
  customId: 'gpvc:manage',

  async execute(interaction, client) {
    const parts = interaction.customId.split(':');
    const action = parts[2];
    const channelId = parts[3];

    const db = getDb();
    const record = TempVcsRepo.get(db, channelId);

    if (!record) {
      await interaction.reply({
        content: `${emojis.error} This temporary voice channel is no longer tracked or has been deleted.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Security check: creator only
    if (interaction.user.id !== record.creator_id) {
      await interaction.reply({
        content: `${emojis.error} Only the owner of this voice channel (<@${record.creator_id}>) can manage it.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const channel = interaction.guild.channels.cache.get(channelId) || await interaction.guild.channels.fetch(channelId).catch(() => null);
    if (!channel) {
      await interaction.reply({
        content: `${emojis.error} Could not locate the voice channel on this server.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // ── Actions ──────────────────────────────────────────────────

    if (action === 'status') {
      const modal = new ModalBuilder()
        .setCustomId(`gpvc:modal_status:${channelId}`)
        .setTitle(`${emojis.confession} Edit Voice Channel Status`);

      const statusInput = new TextInputBuilder()
        .setCustomId('vc_new_status')
        .setLabel('New Voice Status')
        .setValue(channel.status || '')
        .setPlaceholder('Grinding Start HH!')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(50)
        .setRequired(false);

      modal.addComponents(new ActionRowBuilder().addComponents(statusInput));
      await interaction.showModal(modal);
      return;
    }

    if (action === 'limit') {
      const modal = new ModalBuilder()
        .setCustomId(`gpvc:modal_relimit:${channelId}`)
        .setTitle(`${emojis.entrants} Edit User Limit`);

      const limitInput = new TextInputBuilder()
        .setCustomId('vc_new_limit')
        .setLabel('New User Limit (0-99)')
        .setValue(String(channel.userLimit))
        .setPlaceholder('5')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(2)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(limitInput));
      await interaction.showModal(modal);
      return;
    }

    if (action === 'game') {
      // Ephemeral selection card for game update
      const container = createV2Container({
        title: '🎮 Select New Game Category',
        description: 'Choose a new game category to update your channel branding and prefix.',
        color: config.colors.primary,
        client,
      });

      const select = new StringSelectMenuBuilder()
        .setCustomId(`gpvc:select_regame:${channelId}`)
        .setPlaceholder('Choose a Game')
        .addOptions(
          GAMES.map(g => ({
            label: g.label,
            value: g.value,
            emoji: g.emoji,
            default: record.game === g.value,
          }))
        );

      await interaction.reply({
        ...v2Payload(container, [new ActionRowBuilder().addComponents(select)], true),
      });
      return;
    }

    if (action === 'lock') {
      await interaction.deferUpdate();
      const everyoneRole = interaction.guild.roles.everyone;
      const currentConnectOverride = channel.permissionOverwrites.cache.get(everyoneRole.id);
      
      // If Connect is explicitly denied, it is currently Locked
      const isCurrentlyLocked = currentConnectOverride?.deny.has(PermissionFlagsBits.Connect) ?? false;
      const newLockState = !isCurrentlyLocked;

      await channel.permissionOverwrites.edit(everyoneRole, {
        Connect: newLockState ? false : null, // Deny connect if locking, clear override to inherit/allow if unlocking
      });

      logger.info('TEMP_VC', `VC ${channelId} locked state updated to: ${newLockState}`);

      const interfaceContainer = buildInterfaceContainer(record.creator_id, record.game, record.user_limit, newLockState, record.name, client);
      const rows = buildInterfaceRows(channelId, newLockState);

      await interaction.editReply(v2EditPayload(interfaceContainer, rows));
      return;
    }

    if (action === 'kick') {
      const otherMembers = channel.members.filter(m => m.id !== record.creator_id);
      if (!otherMembers.size) {
        await interaction.reply({
          content: `${emojis.error} There are no other members in your channel to kick.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const container = createV2Container({
        title: '🚫 Kick Member',
        description: 'Select a user from the dropdown list below to kick them out of your voice channel.',
        color: config.colors.error,
        client,
      });

      const select = new StringSelectMenuBuilder()
        .setCustomId(`gpvc:select_kick:${channelId}`)
        .setPlaceholder('Choose a User to Kick')
        .addOptions(
          otherMembers.map(m => ({
            label: m.displayName.slice(0, 100),
            value: m.id,
            description: m.user.tag.slice(0, 100),
          }))
        );

      await interaction.reply({
        ...v2Payload(container, [new ActionRowBuilder().addComponents(select)], true),
      });
      return;
    }

    if (action === 'trust') {
      const container = createV2Container({
        title: '🤝 Trust Member',
        description: 'Select a member from the dropdown below to trust them. Trusted members can join your voice channel even when it is Locked.',
        color: config.colors.success,
        client,
      });

      const select = new UserSelectMenuBuilder()
        .setCustomId(`gpvc:select_trust:${channelId}`)
        .setPlaceholder('Choose a member to trust')
        .setMinValues(1)
        .setMaxValues(1);

      await interaction.reply({
        ...v2Payload(container, [new ActionRowBuilder().addComponents(select)], true),
      });
      return;
    }

    if (action === 'untrust') {
      const container = createV2Container({
        title: '👤 Untrust Member',
        description: 'Select a member from the dropdown below to remove their trusted status.',
        color: config.colors.warning,
        client,
      });

      const select = new UserSelectMenuBuilder()
        .setCustomId(`gpvc:select_untrust:${channelId}`)
        .setPlaceholder('Choose a member to untrust')
        .setMinValues(1)
        .setMaxValues(1);

      await interaction.reply({
        ...v2Payload(container, [new ActionRowBuilder().addComponents(select)], true),
      });
      return;
    }
  },
};
