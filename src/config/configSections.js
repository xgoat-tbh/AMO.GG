export const CONFIG_SECTIONS = {
  roles: {
    name: 'Roles',
    emoji: '🎭',
    description: 'Configure role groups for staff and special members',
    settings: {
      role_group_moderators: { type: 'roles', label: 'Moderators', description: 'Users who can moderate the server' },
      role_group_staff: { type: 'roles', label: 'Staff', description: 'General staff members' },
      role_group_creators: { type: 'roles', label: 'Creators', description: 'Content creators with access to creator tools' },
      role_group_event_hosts: { type: 'roles', label: 'Event Hosts', description: 'Members who can host events' },
      role_group_managers: { type: 'roles', label: 'Server Managers', description: 'Server management team members' },
    },
  },
  notifications: {
    name: 'Notifications',
    emoji: '🔔',
    description: 'Configure which roles get notified for various events',
    settings: {
      notify_mod_suggestion: { type: 'roles', label: 'Suggestion Reported', description: 'Ping when a suggestion is reported' },
      notify_mod_ticket: { type: 'roles', label: 'Ticket Created', description: 'Ping when a support ticket is created' },
      notify_mod_voice: { type: 'roles', label: 'Voice Request', description: 'Ping for voice moderation requests' },
      notify_manager_config: { type: 'roles', label: 'Config Changed', description: 'Ping when bot configuration is changed' },
      notify_manager_backup: { type: 'roles', label: 'Backup Complete', description: 'Ping when a backup operation completes' },
      notify_creator_request: { type: 'roles', label: 'Creator Request', description: 'Ping when a new creator request is submitted' },
    },
  },
  suggestions: {
    name: 'Suggestions',
    emoji: '💡',
    description: 'Configure the suggestions system',
    settings: {
      suggestion_channel: { type: 'channel', configPath: 'channels.suggestion', label: 'Posting Channel', description: 'Where suggestions are posted for voting' },
    },
  },
  confessions: {
    name: 'Confessions',
    emoji: '📝',
    description: 'Configure the confessions system',
    settings: {
      confession_channel: { type: 'channel', configPath: 'channels.confession', label: 'Posting Channel', description: 'Where confessions are posted' },
    },
  },
  logging: {
    name: 'Logging',
    emoji: '📜',
    description: 'Configure system logging',
    settings: {
      log_channel: { type: 'channel', configPath: 'channels.log', label: 'Logs Channel', description: 'Channel for all system logs' },
    },
  },
  voice: {
    name: 'Voice',
    emoji: '🔊',
    description: 'Configure voice channel settings',
    settings: {},
  },
  creator: {
    name: 'Creator',
    emoji: '🎥',
    description: 'Configure the creator system',
    settings: {
      creator_role_ids: { type: 'roles', label: 'Creator Roles', description: 'Roles that can access the Creator system' },
      creator_category_id: { type: 'category', label: 'Creator Category', description: 'Category where creator channels are created' },
      creator_announcements_channel_id: { type: 'channel', label: 'Announcements', description: 'Creator announcements channel' },
      creator_commands_channel_id: { type: 'channel', label: 'Commands', description: 'Creator commands channel' },
      creator_ideas_channel_id: { type: 'channel', label: 'Ideas', description: 'Creator ideas channel' },
      creator_chat_channel_id: { type: 'channel', label: 'Chat', description: 'Creator chat channel' },
    },
  },
  jail: {
    name: 'Jail',
    emoji: '🔒',
    description: 'Configure the jail system',
    settings: {
      jail_role_id: { type: 'role', configPath: 'jailRoleId', label: 'Jail Role', description: 'Role assigned to jailed users' },
      jail_channel_id: { type: 'channel', configPath: 'jailChannelId', label: 'Jail Channel', description: 'Channel jailed users can access' },
    },
  },
  gameping: {
    name: 'GamePing',
    emoji: '🎮',
    description: 'Configure the GamePing system',
    settings: {
      gameping_role_id: { type: 'role', configPath: 'gamepingRoleId', label: 'Allowed Role', description: 'Role allowed to use `?gp`' },
      gameping_permission: {
        type: 'select',
        configPath: 'gamepingPermission',
        label: 'Min Permission',
        description: 'Minimum permission required to use `?gp`',
        options: [
          { value: 'everyone', label: 'Everyone', emoji: '👥' },
          { value: 'moderator', label: 'Moderator', emoji: '🛡️' },
          { value: 'admin', label: 'Admin', emoji: '⚙️' },
        ],
      },
    },
  },
  leveling: {
    name: 'Leveling',
    emoji: '⭐',
    description: 'Configure the XP and leveling system',
    settings: {
      xp_rate: { type: 'string', label: 'XP Rate', description: 'XP earned per message (default: 15)' },
      xp_cooldown: { type: 'string', label: 'XP Cooldown', description: 'Seconds between XP gains (default: 60)' },
      xp_min_messages: { type: 'string', label: 'Min Message Length', description: 'Minimum characters for XP (default: 10)' },
    },
  },
  developer: {
    name: 'Developer',
    emoji: '🔧',
    description: 'Developer-only settings',
    settings: {
      maintenance_mode: {
        type: 'select',
        label: 'Maintenance Mode',
        description: 'Enable or disable maintenance mode',
        options: [
          { value: 'true', label: 'Enabled', emoji: '🔴' },
          { value: 'false', label: 'Disabled', emoji: '🟢' },
        ],
      },
    },
  },
};
