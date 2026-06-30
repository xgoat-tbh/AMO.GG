import { PermissionFlagsBits } from 'discord.js';
import { createV2Container, v2Payload, notification } from '../../helpers/v2Helper.js';
import { config } from '../../config/bot.config.js';
import { emojis } from '../../config/emojis.config.js';
import { handleCommandError } from '../../helpers/errorHandler.js';

const PERM_LABELS = {
  Administrator: 'Administrator',
  ManageGuild: 'Manage Server',
  ManageRoles: 'Manage Roles',
  ManageChannels: 'Manage Channels',
  KickMembers: 'Kick Members',
  BanMembers: 'Ban Members',
  ModerateMembers: 'Timeout Members',
  ManageMessages: 'Manage Messages',
  MuteMembers: 'Mute Members',
  DeafenMembers: 'Deafen Members',
  MoveMembers: 'Move Members',
  ManageNicknames: 'Manage Nicknames',
  ManageWebhooks: 'Manage Webhooks',
  CreateInstantInvite: 'Create Invite',
  ChangeNickname: 'Change Nickname',
  SendMessages: 'Send Messages',
  ReadMessageHistory: 'Read History',
  Connect: 'Connect (VC)',
  Speak: 'Speak (VC)',
  Stream: 'Go Live',
  UseVAD: 'Use Voice Activity',
  PrioritySpeaker: 'Priority Speaker',
  RequestToSpeak: 'Request to Speak',
  EmbedLinks: 'Embed Links',
  AttachFiles: 'Attach Files',
  AddReactions: 'Add Reactions',
  UseExternalEmojis: 'External Emojis',
  UseExternalStickers: 'External Stickers',
  MentionEveryone: 'Mention Everyone',
};

const CHANNEL_PERMS = [
  'ViewChannel', 'SendMessages', 'SendMessagesInThreads',
  'CreatePublicThreads', 'CreatePrivateThreads', 'EmbedLinks',
  'AttachFiles', 'AddReactions', 'UseExternalEmojis',
  'MentionEveryone', 'ReadMessageHistory',
  'Connect', 'Speak', 'Stream', 'UseVAD',
];

const SERVER_PERMS = [
  'Administrator', 'ManageGuild', 'ManageRoles', 'ManageChannels',
  'KickMembers', 'BanMembers', 'ModerateMembers',
  'ManageMessages', 'MuteMembers', 'DeafenMembers',
  'MoveMembers', 'ManageNicknames', 'ManageWebhooks',
];

export default {
  name: 'perms',
  aliases: ['permissions', 'permcheck'],
  description: 'Check permissions for a user, role, or in a specific channel.',
  usage: '?perms [@user | @role] [#channel]',
  permission: 'everyone',

  async execute(message, args, client) {
    try {
      const role = message.mentions.roles?.first();
      if (role) return this.checkRole(message, role, client);

      const target = message.mentions.members?.first() || message.member;
      const channel = message.mentions.channels?.first() || message.channel;

      const memberPerms = channel.permissionsFor(target);
      if (!memberPerms) {
        return message.reply({
          ...v2Payload(notification('error', `${emojis.error} Could not check permissions for this target.`, client)),
          allowedMentions: { repliedUser: false },
        });
      }

      const lines = [
        `### 🔐 Permission Check`,
        `**Target:** ${target.user.tag} (<@${target.id}>)`,
        `**Channel:** <#${channel.id}>`,
        '',
        '**Server Permissions**',
      ];

      const hasAdmin = memberPerms.has(PermissionFlagsBits.Administrator);
      if (hasAdmin) {
        lines.push(`> ${emojis.success} **Administrator** — All permissions granted`);
      } else {
        for (const perm of SERVER_PERMS) {
          const has = memberPerms.has(PermissionFlagsBits[perm]);
          const label = PERM_LABELS[perm] || perm;
          lines.push(`${has ? emojis.success : emojis.error} ${label}`);
        }
      }

      lines.push('', '**Channel Permissions**');

      for (const perm of CHANNEL_PERMS) {
        const has = memberPerms.has(PermissionFlagsBits[perm]);
        const label = PERM_LABELS[perm] || perm;
        lines.push(`${has ? emojis.success : emojis.error} ${label}`);
      }

      const container = createV2Container({ description: lines.join('\n'), color: config.colors.primary, thumbnail: target.user.displayAvatarURL(), client });

      await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
    } catch (error) {
      await handleCommandError(message, error);
    }
  },

  async checkRole(message, role, client) {
    const channel = message.mentions.channels?.first() || message.channel;

    const rolePerms = role.permissions;
    const overwrites = channel.permissionOverwrites?.cache?.get(role.id);

    const lines = [
      `### 🔐 Role Permissions`,
      `**Role:** ${role.name} (<@&${role.id}>)`,
      `**Channel:** <#${channel.id}>`,
      `**Members:** ${role.members.size}`,
      '',
      '**Server Permissions**',
    ];

    const hasAdmin = rolePerms.has(PermissionFlagsBits.Administrator);
    if (hasAdmin) {
      lines.push(`> ${emojis.success} **Administrator** — All permissions granted`);
    } else {
      for (const perm of SERVER_PERMS) {
        const has = rolePerms.has(PermissionFlagsBits[perm]);
        const label = PERM_LABELS[perm] || perm;
        lines.push(`${has ? emojis.success : emojis.error} ${label}`);
      }
    }

    if (overwrites) {
      lines.push('', '**Channel Overwrites**');
      for (const perm of CHANNEL_PERMS) {
        const allowed = overwrites.allowed.has(PermissionFlagsBits[perm]);
        const denied = overwrites.denied.has(PermissionFlagsBits[perm]);
        const label = PERM_LABELS[perm] || perm;
        if (allowed) lines.push(`${emojis.success} ${label}`);
        else if (denied) lines.push(`${emojis.error} ${label} (denied)`);
      }
    }

    const container = createV2Container({ description: lines.join('\n'), color: config.colors.primary, client });
    await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
  },
};
