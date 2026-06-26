/**
 * Permission configuration.
 * Role IDs are loaded from env as comma-separated strings.
 */
function parseRoleIds(envVar) {
  if (!envVar) return [];
  return envVar.split(',').map(id => id.trim()).filter(Boolean);
}

export const permConfig = {
  moderatorRoles: parseRoleIds(process.env.MODERATOR_ROLES),
  adminRoles: parseRoleIds(process.env.ADMIN_ROLES),
  immuneRoles: parseRoleIds(process.env.IMMUNE_ROLES),

  levels: {
    EVERYONE: 0,
    MODERATOR: 1,
    ADMIN: 2,
    OWNER: 3,
    DEV: 4,
  },
};
