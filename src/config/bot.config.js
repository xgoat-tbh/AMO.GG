import 'dotenv/config';

export const config = {
  token: process.env.BOT_TOKEN,
  guildId: process.env.GUILD_ID,
  prefix: '?',

  branding: {
    name: 'Amo.GG',
    icon: process.env.BOT_ICON || null,
  },

  colors: {
    primary: 0xFFFFFF,
    success: 0x57F287,
    error: 0xED4245,
    warning: 0xFEE75C,
    info: 0xFFFFFF,
    confession: 0x2B2D31,
    suggestion: 0xF1C40F,
    voice: 0x3BA55D,
    jail: 0xE74C3C,
  },

  channels: {
    log: process.env.LOG_CHANNEL || process.env.LOG_CHANNEL_MODERATION,
    suggestion: process.env.SUGGESTION_CHANNEL,
    confession: process.env.CONFESSION_CHANNEL,
  },

  jailRoleId: process.env.JAIL_ROLE_ID,
  gamepingRoleId: null,
  gamepingPermission: 'everyone',
};
