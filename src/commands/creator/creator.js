import { PermissionFlagsBits, ChannelType, MessageFlags } from 'discord.js';
import { createV2Container, createV2Success, createV2Error, v2Payload } from '../../helpers/v2Helper.js';
import { checkPermission, isBotOwner } from '../../helpers/permissions.js';
import { handleCommandError, sendPermissionDenied, sendUsageError } from '../../helpers/errorHandler.js';
import { config } from '../../config/bot.config.js';
import { botConfig } from '../../helpers/configHelper.js';
import { emojis } from '../../config/emojis.config.js';
import { getDb } from '../../database/connection.js';
import { ConfigRepo } from '../../database/repositories/config.repo.js';
import { logger } from '../../helpers/logger.js';
import { logCreatorSetup } from '../../services/loggingService.js';
import { permConfig } from '../../config/permissions.config.js';
import fs from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default {
  name: 'creator',
  category: 'creator',
  permission: 'everyone', // Dynamic permission check inside execute
  description: 'Manage, setup, and dissolve the Creator workspace.',
  usage: '?creator <setup | dissolve>',

  async execute(message, args, client) {
    try {
      // 1. Permission check: Developer, Server Owner, or Creator Role
      const isOwner = checkPermission(message.member, 'owner');
      const isDev = isBotOwner(message.author);
      const creatorRoleIds = botConfig.creatorRoleIds || [];
      const hasCreatorRole = creatorRoleIds.some(roleId => message.member.roles.cache.has(roleId));

      if (!isOwner && !isDev && !hasCreatorRole) {
        return sendPermissionDenied(message);
      }

      // 2. Subcommand routing
      const sub = args[0]?.toLowerCase();
      if (sub === 'setup') {
        return await this.handleSetup(message, args.slice(1), client);
      } else if (sub === 'dissolve' || sub === 'siddolve' || sub === 'desolve' || sub === 'desolved') {
        return await this.handleDissolve(message, args.slice(1), client);
      } else {
        return sendUsageError(message, this.usage);
      }
    } catch (error) {
      await handleCommandError(message, error);
    }
  },

  async handleSetup(message, args, client) {
    const guild = message.guild;
    const db = getDb();

    // Check if Creator system is already set up
    const storedRoleId = ConfigRepo.get(db, 'creator_role_id');
    const storedCategoryId = ConfigRepo.get(db, 'creator_category_id');

    const categoryExists = storedCategoryId ? guild.channels.cache.has(storedCategoryId) : false;
    const roleExists = storedRoleId ? guild.roles.cache.has(storedRoleId) : false;

    if (categoryExists && roleExists) {
      const errContainer = createV2Error(`${emojis.error} The Creator Workspace has already been set up on this server. To rebuild it, please dissolve it first using \`?creator dissolve\`.`, client);
      await message.reply({
        ...v2Payload(errContainer),
        allowedMentions: { repliedUser: false },
      });
      return;
    }

    // Send processing feedback
    const processingContainer = createV2Container({
      title: `${emojis.creator || '🎥'} Creator System Setup`,
      description: `${emojis.loading || '⏳'} Running Creator System setup... Please wait.`,
      color: config.colors.primary,
      client,
    });
    const feedbackMsg = await message.reply({
      ...v2Payload(processingContainer),
      allowedMentions: { repliedUser: false },
    });

    const auditLogs = [];
    const statusFields = [];

    // Helper to log locally and add to audit logs
    const logAction = (action, details) => {
      logger.info('CREATOR_SETUP', `${action}: ${details}`);
      auditLogs.push(`• **${action}**: ${details}`);
    };

    // ────────────────────────────────────────────────────────
    // Step 1: Creator Role Creation/Re-use & Icon Setup
    // ────────────────────────────────────────────────────────
    let creatorRole = null;
    let roleStatus = '';

    if (storedRoleId) {
      creatorRole = guild.roles.cache.get(storedRoleId);
    }

    if (!creatorRole) {
      // Fallback name search
      creatorRole = guild.roles.cache.find(r => r.name === 'Creator');
    }

    const creatorPermissions = [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.EmbedLinks,
      PermissionFlagsBits.AttachFiles,
      PermissionFlagsBits.UseExternalEmojis,
      PermissionFlagsBits.AddReactions,
      PermissionFlagsBits.Connect,
      PermissionFlagsBits.Speak,
    ];

    try {
      if (creatorRole) {
        // Verify/update permissions
        let needsUpdate = false;
        for (const perm of creatorPermissions) {
          if (!creatorRole.permissions.has(perm)) {
            needsUpdate = true;
            break;
          }
        }

        if (needsUpdate) {
          await creatorRole.edit({
            permissions: creatorPermissions,
            reason: 'Creator System setup permission synchronization',
          });
          logAction('Role Sync', 'Permissions synchronized for existing Creator role.');
          roleStatus = `${emojis.loading} Synced & Reused`;
        } else {
          logAction('Role Verified', 'Existing Creator role found with correct permissions.');
          roleStatus = `${emojis.info} Verified & Reused`;
        }
      } else {
        // Create new Creator role
        creatorRole = await guild.roles.create({
          name: 'Creator',
          permissions: creatorPermissions,
          reason: 'Creator System Setup',
        });
        logAction('Role Created', 'New Creator role provisioned successfully.');
        roleStatus = `${emojis.success} Created`;
      }

      // Save to DB configuration
      ConfigRepo.set(db, 'creator_role_id', creatorRole.id);
      ConfigRepo.set(db, 'creator_role_ids', creatorRole.id);
      logAction('Config Saved', `creator_role_id set to ${creatorRole.id}`);

      // Attempt to load and set the custom role icon
      const assetsDir = join(__dirname, '..', '..', '..', 'assets');
      const iconPaths = [
        join(assetsDir, 'creator-role.svg'),
        join(assetsDir, 'creator role.svg'),
        join(assetsDir, 'creator-role.png'),
        join(assetsDir, 'creator role.png'),
      ];

      let iconBuffer = null;
      for (const p of iconPaths) {
        if (fs.existsSync(p)) {
          iconBuffer = fs.readFileSync(p);
          break;
        }
      }

      if (iconBuffer) {
        const hasRoleIconFeature = guild.features.includes('ROLE_ICONS') || guild.premiumTier >= 2;
        if (hasRoleIconFeature) {
          try {
            await creatorRole.edit({
              icon: iconBuffer,
            });
            logAction('Role Icon Set', 'Applied custom role icon successfully.');
          } catch (iconErr) {
            logger.warn('CREATOR_SETUP', `Could not apply role icon: ${iconErr.message}`);
            logAction('Role Icon Skipped', `Role icon not set: ${iconErr.message}`);
          }
        } else {
          logAction('Role Icon Skipped', `Server requires Boost Level 2 for custom role icons (Current Tier: ${guild.premiumTier}).`);
          logger.warn('CREATOR_SETUP', `Role icon skipped: Server lacks Boost Tier 2 (Current Tier: ${guild.premiumTier}).`);
        }
      }

    } catch (err) {
      logger.error('CREATOR_SETUP', 'Failed to configure Creator role', err);
      roleStatus = `${emojis.error} Error: ${err.message}`;
    }

    statusFields.push({ name: 'Role: Creator', value: roleStatus });

    // ────────────────────────────────────────────────────────
    // Step 2: Category Channel Creation/Re-use
    // ────────────────────────────────────────────────────────
    let categoryChannel = null;
    let categoryStatus = '';

    if (storedCategoryId) {
      categoryChannel = guild.channels.cache.get(storedCategoryId);
      if (categoryChannel && categoryChannel.type !== ChannelType.GuildCategory) {
        categoryChannel = null;
      }
    }

    if (!categoryChannel) {
      // Fallback name search
      categoryChannel = guild.channels.cache.find(
        c => c.name === 'CREATOR' && c.type === ChannelType.GuildCategory
      );
    }

    try {
      if (categoryChannel) {
        logAction('Category Verified', 'Existing CREATOR category found and verified.');
        categoryStatus = `${emojis.info} Verified & Reused`;
      } else {
        categoryChannel = await guild.channels.create({
          name: 'CREATOR',
          type: ChannelType.GuildCategory,
          reason: 'Creator System Setup',
        });
        logAction('Category Created', 'New CREATOR category created.');
        categoryStatus = `${emojis.success} Created`;
      }

      // Save to DB configuration
      ConfigRepo.set(db, 'creator_category_id', categoryChannel.id);
      logAction('Config Saved', `creator_category_id set to ${categoryChannel.id}`);
    } catch (err) {
      logger.error('CREATOR_SETUP', 'Failed to configure category channel', err);
      categoryStatus = `${emojis.error} Error: ${err.message}`;
    }

    statusFields.push({ name: 'Category: CREATOR', value: categoryStatus });

    // ────────────────────────────────────────────────────────
    // Step 3: Channels Creation/Re-use & Overwrites Sync
    // ────────────────────────────────────────────────────────
    const channelNames = ['announcements', 'commands', 'ideas', 'chat'];
    const resolvedChannels = {};

    if (categoryChannel && creatorRole) {
      // Fetch all administrator role IDs in this guild
      const adminRoleIds = guild.roles.cache
        .filter(
          r =>
            r.permissions.has(PermissionFlagsBits.Administrator) ||
            permConfig.adminRoles.includes(r.id)
        )
        .map(r => r.id);

      for (const name of channelNames) {
        let channel = null;
        let chanStatus = '';

        const dbKey = `creator_${name}_channel_id`;
        const storedChanId = ConfigRepo.get(db, dbKey);
        if (storedChanId) {
          channel = guild.channels.cache.get(storedChanId);
          if (channel && (channel.parentId !== categoryChannel.id || channel.type !== ChannelType.GuildText)) {
            channel = null;
          }
        }

        if (!channel) {
          // Fallback name search under parent category
          channel = guild.channels.cache.find(
            c =>
              c.name === `creator-${name}` &&
              c.parentId === categoryChannel.id &&
              c.type === ChannelType.GuildText
          );
        }

        try {
          if (channel) {
            logAction('Channel Verified', `Existing channel #creator-${name} found and verified.`);
            chanStatus = `${emojis.info} Verified & Reused`;
          } else {
            channel = await guild.channels.create({
              name: `creator-${name}`,
              type: ChannelType.GuildText,
              parent: categoryChannel.id,
              reason: 'Creator System Setup',
            });
            logAction('Channel Created', `New channel #creator-${name} created.`);
            chanStatus = `${emojis.success} Created`;
          }

          // Define permission overwrites based on channel type
          let overwrites = [];

          if (name === 'chat') {
            // Lounge channel: Only Creator, Owner, and Administrators
            overwrites = [
              {
                id: guild.roles.everyone.id,
                type: 0,
                deny: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory,
                ],
              },
              {
                id: creatorRole.id,
                type: 0,
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory,
                ],
              },
              {
                id: guild.ownerId,
                type: 1,
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory,
                ],
              },
            ];

            for (const adminRoleId of adminRoleIds) {
              overwrites.push({
                id: adminRoleId,
                type: 0,
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory,
                ],
              });
            }
          } else {
            // announcements, commands, ideas:
            // @everyone: View & Read only
            // Creator: Send, View, Read
            overwrites = [
              {
                id: guild.roles.everyone.id,
                type: 0,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
                deny: [PermissionFlagsBits.SendMessages],
              },
              {
                id: creatorRole.id,
                type: 0,
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory,
                ],
              },
            ];
          }

          // Sync permission overwrites
          await channel.permissionOverwrites.set(overwrites);
          logAction('Channel Permissions Sync', `Synchronized permissions for #creator-${name}.`);

          // Save to DB config
          ConfigRepo.set(db, dbKey, channel.id);
          logAction('Config Saved', `${dbKey} set to ${channel.id}`);
          resolvedChannels[name] = channel;
        } catch (err) {
          logger.error('CREATOR_SETUP', `Failed to configure channel: #creator-${name}`, err);
          chanStatus = `${emojis.error} Error: ${err.message}`;
        }

        statusFields.push({ name: `Channel: #creator-${name}`, value: chanStatus });
      }
    } else {
      // If role or category creation failed, we fail channels
      for (const name of channelNames) {
        statusFields.push({ name: `Channel: #creator-${name}`, value: `${emojis.warning} Skipped (Prerequisites failed)` });
      }
    }

    // ────────────────────────────────────────────────────────
    // Step 4: Final Logging & Feedback Card
    // ────────────────────────────────────────────────────────
    try {
      await logCreatorSetup(client, {
        action: 'System Setup Ran',
        details: auditLogs.join('\n'),
        executor: message.author,
      });
    } catch (logErr) {
      logger.warn('CREATOR_SETUP', `Failed to log Creator Setup action to audit log: ${logErr.message}`);
    }

    const isAllSuccess = !statusFields.some(f => f.value.includes('❌'));

    const resultContainer = createV2Container({
      title: isAllSuccess 
        ? `${emojis.creator || '✅'} Creator Workspace Setup Completed` 
        : `${emojis.warning || '⚠️'} Creator Workspace Setup Partially Completed`,
      description: isAllSuccess
        ? 'The Creator System workspace has been successfully provisioned and synchronized with all correct channel permissions and DB configuration overrides.'
        : 'The Creator System workspace setup ran, but one or more components encountered errors. Review the status list below:',
      color: isAllSuccess ? config.colors.success : config.colors.warning,
      fields: statusFields,
      client,
    });

    await feedbackMsg.edit({
      ...v2Payload(resultContainer),
    });

    // Cleanup user's triggering command message
    try { await message.delete(); } catch {}
  },

  async handleDissolve(message, args, client) {
    const guild = message.guild;
    const db = getDb();

    // Send processing feedback
    const processingContainer = createV2Container({
      title: `${emojis.creator || '🎥'} Creator System Dissolve`,
      description: `${emojis.loading || '⏳'} Dissolving Creator System workspace... Please wait.`,
      color: config.colors.warning,
      client,
    });
    const feedbackMsg = await message.reply({
      ...v2Payload(processingContainer),
      allowedMentions: { repliedUser: false },
    });

    const auditLogs = [];
    const statusFields = [];

    // Helper to log locally and add to audit logs
    const logAction = (action, details) => {
      logger.info('CREATOR_DISSOLVE', `${action}: ${details}`);
      auditLogs.push(`• **${action}**: ${details}`);
    };

    // 1. Delete Channels (announcements, commands, ideas, chat)
    const channelNames = ['announcements', 'commands', 'ideas', 'chat'];
    for (const name of channelNames) {
      const dbKey = `creator_${name}_channel_id`;
      const storedChanId = ConfigRepo.get(db, dbKey);
      let channel = null;

      if (storedChanId) {
        channel = guild.channels.cache.get(storedChanId);
      }

      if (!channel) {
        // Fallback search under category
        const categoryId = ConfigRepo.get(db, 'creator_category_id');
        channel = guild.channels.cache.find(
          c =>
            c.name === `creator-${name}` &&
            (categoryId ? c.parentId === categoryId : true) &&
            c.type === ChannelType.GuildText
        );
      }

      let chanStatus = '';
      if (channel) {
        try {
          await channel.delete('Creator System Dissolve');
          logAction('Channel Deleted', `Deleted channel #creator-${name}.`);
          chanStatus = '🗑️ Deleted';
        } catch (err) {
          logger.error('CREATOR_DISSOLVE', `Failed to delete channel #creator-${name}`, err);
          chanStatus = `${emojis.error} Error: ${err.message}`;
        }
      } else {
        chanStatus = `${emojis.info} Not found (Skipped)`;
      }

      // Clear DB override configuration
      ConfigRepo.set(db, dbKey, null);
      statusFields.push({ name: `Channel: #creator-${name}`, value: chanStatus });
    }

    // 2. Delete Category Category
    let categoryChannel = null;
    const storedCategoryId = ConfigRepo.get(db, 'creator_category_id');
    if (storedCategoryId) {
      categoryChannel = guild.channels.cache.get(storedCategoryId);
    }
    if (!categoryChannel) {
      categoryChannel = guild.channels.cache.find(
        c => c.name === 'CREATOR' && c.type === ChannelType.GuildCategory
      );
    }

    let categoryStatus = '';
    if (categoryChannel) {
      try {
        await categoryChannel.delete('Creator System Dissolve');
        logAction('Category Deleted', 'Deleted CREATOR category.');
        categoryStatus = '🗑️ Deleted';
      } catch (err) {
        logger.error('CREATOR_DISSOLVE', 'Failed to delete category CREATOR', err);
        categoryStatus = `${emojis.error} Error: ${err.message}`;
      }
    } else {
      categoryStatus = `${emojis.info} Not found (Skipped)`;
    }

    ConfigRepo.set(db, 'creator_category_id', null);
    statusFields.push({ name: 'Category: CREATOR', value: categoryStatus });

    // 3. Delete Creator Role
    let creatorRole = null;
    const storedRoleId = ConfigRepo.get(db, 'creator_role_id');
    if (storedRoleId) {
      creatorRole = guild.roles.cache.get(storedRoleId);
    }
    if (!creatorRole) {
      creatorRole = guild.roles.cache.find(r => r.name === 'Creator');
    }

    let roleStatus = '';
    if (creatorRole) {
      try {
        await creatorRole.delete('Creator System Dissolve');
        logAction('Role Deleted', 'Deleted Creator role.');
        roleStatus = '🗑️ Deleted';
      } catch (err) {
        logger.error('CREATOR_DISSOLVE', 'Failed to delete Creator role', err);
        roleStatus = `${emojis.error} Error: ${err.message}`;
      }
    } else {
      roleStatus = `${emojis.info} Not found (Skipped)`;
    }

    ConfigRepo.set(db, 'creator_role_id', null);
    ConfigRepo.set(db, 'creator_role_ids', null);
    statusFields.push({ name: 'Role: Creator', value: roleStatus });

    // 4. Send action to central audit logs
    try {
      await logCreatorSetup(client, {
        action: 'System Dissolved',
        details: auditLogs.join('\n'),
        executor: message.author,
      });
    } catch (logErr) {
      logger.warn('CREATOR_DISSOLVE', `Failed to log Creator Dissolve action to audit log: ${logErr.message}`);
    }

    const isAllSuccess = !statusFields.some(f => f.value.includes('❌'));

    const resultContainer = createV2Container({
      title: isAllSuccess 
        ? `${emojis.delete || '🗑️'} Creator Workspace Dissolved` 
        : `${emojis.warning || '⚠️'} Creator Workspace Dissolved with Errors`,
      description: isAllSuccess
        ? 'The Creator System workspace has been completely dissolved. All channels, category, and role have been successfully deleted, and DB configuration overrides cleared.'
        : 'The Creator System workspace dissolution ran, but one or more components encountered errors. Review the status list below:',
      color: isAllSuccess ? config.colors.success : config.colors.warning,
      fields: statusFields,
      client,
    });

    await feedbackMsg.edit({
      ...v2Payload(resultContainer),
    });

    // Cleanup user's triggering command message
    try { await message.delete(); } catch {}
  },
};
