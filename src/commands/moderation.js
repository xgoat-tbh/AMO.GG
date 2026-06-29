import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { createV2Container, v2Payload, v2Ephemeral, notification, codeStat, field, relativeTime, paginationRow, permissionBadge } from '../helpers/v2Helper.js';
import { config } from '../config/bot.config.js';
import { emojis } from '../config/emojis.config.js';
import { handleCommandError, sendUsageError } from '../helpers/errorHandler.js';
import { checkPermission, isBotOwner } from '../helpers/permissions.js';
import { moderationManager } from '../systems/moderation/moderationManager.js';
import { getDb } from '../database/connection.js';
import { CasesRepo } from '../database/repositories/cases.repo.js';
import { logModeration } from '../services/loggingService.js';

const HELP_TEXT = [
  `### 🛡️ Moderation System`,
  '',
  '**Commands** (moderator+)',
  `\`kick\` \`ban\` \`softban\` \`tempban\` \`massban\` \`unban\``,
  `\`mute\` \`timeout\` \`untimeout\` \`warn\` \`warnings\` \`clearwarnings\``,
  `\`purge\` \`slowmode\``,
  '',
  '**Commands** (admin+)',
  `\`lock\` \`unlock\` \`lockall\` \`unlockall\``,
  `\`nickname\` \`jail\` \`unjail\``,
  '',
  '**Commands** (everyone)',
  `\`history\` \`reason\` \`case\``,
  '',
  `**Usage:** \`${config.prefix}mod <subcommand> [args]\``,
  `**Example:** \`${config.prefix}mod ban @user spamming\``,
].join('\n');

function isMod(message) { return checkPermission(message.member, 'moderator'); }
function isAdmin(message) { return checkPermission(message.member, 'admin'); }

function parseUser(text) { return text?.replace(/[<@!>]/g, ''); }

function parseDuration(text) {
  if (!text) return null;
  const match = text.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return null;
  const num = parseInt(match[1]);
  const unit = match[2];
  const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
  return num * (multipliers[unit] || 1);
}

function formatDuration(seconds) {
  if (!seconds) return 'Permanent';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s) parts.push(`${s}s`);
  return parts.join(' ') || '0s';
}

async function confirmAction(message, actionLabel, target, reason, callback) {
  const card = notification('warning', [
    `⚠️ **${actionLabel}**`,
    `**Target:** ${target.user?.tag || target}`,
    reason ? `**Reason:** ${reason}` : '',
    '',
    'Confirm this action?',
  ].filter(Boolean).join('\n'), message.client);

  const confirmId = `mod:confirm:${message.author.id}:${Date.now()}`;
  const cancelId = `mod:cancel:${message.author.id}:${Date.now()}`;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(confirmId).setLabel('Confirm').setStyle(ButtonStyle.Danger).setEmoji(emojis.warning),
    new ButtonBuilder().setCustomId(cancelId).setLabel('Cancel').setStyle(ButtonStyle.Secondary).setEmoji(emojis.error),
  );

  const reply = await message.reply({ ...v2Payload(card, [row]), allowedMentions: { repliedUser: false } });

  // Simple confirmation collector
  const filter = i => [confirmId, cancelId].includes(i.customId) && i.user.id === message.author.id;
  try {
    const collected = await reply.awaitMessageComponent({ filter, time: 30000 });
    if (collected.customId === confirmId) {
      await collected.deferUpdate();
      await callback();
      await reply.edit({ components: [] }).catch(() => null);
      return true;
    }
    const cancelCard = notification('info', `ℹ️ Action cancelled.`, message.client);
    await collected.update(v2Payload(cancelCard));
    setTimeout(async () => { try { await message.delete(); } catch {}; try { await collected.message?.delete().catch(() => {}); } catch {}; }, 5000);
    return false;
  } catch {
    const expireCard = notification('warning', `⚠️ Confirmation expired.`, message.client);
    await reply.edit(v2Payload(expireCard)).catch(() => null);
    setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
    return false;
  }
}

export default {
  name: 'mod',
  aliases: ['moderation', 'moderate', 'm'],
  description: 'Complete moderation system.',
  usage: '?mod <subcommand> [args]',
  permission: 'everyone',

  async execute(message, args, client) {
    try {
      if (!args.length) {
        const container = createV2Container({
          description: HELP_TEXT,
          color: config.colors.primary,
          thumbnail: message.client.user.displayAvatarURL(),
          client,
        });
        return message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
      }

      const sub = args[0].toLowerCase();
      const rest = args.slice(1);

      switch (sub) {
        // ── Kick ──
        case 'kick': {
          if (!isMod(message)) return sendPermissionDenied(message);
          if (rest.length < 1) return sendUsageError(message, '?mod kick <user> [reason]');
          const kickTarget = message.mentions.members?.first() || await message.guild.members.fetch(parseUser(rest[0])).catch(() => null);
          if (!kickTarget) return errorMsg(message, 'User not found.', client);
          const kickReason = rest.slice(1).join(' ') || 'No reason provided';
          await confirmAction(message, `Kick ${kickTarget.user.tag}`, kickTarget, kickReason, async () => {
            await moderationManager.kick(kickTarget, message.member, kickReason);
            await successMsg(message, `✅ **${kickTarget.user.tag}** has been kicked.`, client);
          });
          break;
        }

        // ── Ban ──
        case 'ban': {
          if (!isMod(message)) return sendPermissionDenied(message);
          if (rest.length < 1) return sendUsageError(message, '?mod ban <user> [reason]');
          const banTarget = message.mentions.members?.first() || await message.guild.members.fetch(parseUser(rest[0])).catch(() => null);
          if (!banTarget) return errorMsg(message, 'User not found.', client);
          const banReason = rest.slice(1).join(' ') || 'No reason provided';
          await confirmAction(message, `Ban ${banTarget.user.tag}`, banTarget, banReason, async () => {
            await moderationManager.ban(banTarget, message.member, banReason);
            await successMsg(message, `✅ **${banTarget.user.tag}** has been banned.`, client);
          });
          break;
        }

        // ── Softban ──
        case 'softban': {
          if (!isMod(message)) return sendPermissionDenied(message);
          if (rest.length < 1) return sendUsageError(message, '?mod softban <user> [reason]');
          const sbTarget = message.mentions.members?.first() || await message.guild.members.fetch(parseUser(rest[0])).catch(() => null);
          if (!sbTarget) return errorMsg(message, 'User not found.', client);
          const sbReason = rest.slice(1).join(' ') || 'No reason provided';
          await confirmAction(message, `Softban ${sbTarget.user.tag}`, sbTarget, sbReason, async () => {
            await moderationManager.softban(sbTarget, message.member, sbReason);
            await successMsg(message, `✅ **${sbTarget.user.tag}** softbanned (messages cleared).`, client);
          });
          break;
        }

        // ── Tempban ──
        case 'tempban': {
          if (!isMod(message)) return sendPermissionDenied(message);
          if (rest.length < 2) return sendUsageError(message, '?mod tempban <user> <duration> [reason]\nDuration: 1d, 2h, 30m, 60s');
          const tbTarget = message.mentions.members?.first() || await message.guild.members.fetch(parseUser(rest[0])).catch(() => null);
          if (!tbTarget) return errorMsg(message, 'User not found.', client);
          const tbDuration = parseDuration(rest[1]);
          if (!tbDuration) return errorMsg(message, `Invalid duration: \`${rest[1]}\`. Use e.g. \`1d\`, \`2h\`, \`30m\`.`, client);
          const tbReason = rest.slice(2).join(' ') || 'No reason provided';
          await confirmAction(message, `Tempban ${tbTarget.user.tag} (${formatDuration(tbDuration)})`, tbTarget, tbReason, async () => {
            await moderationManager.ban(tbTarget, message.member, `Tempban ${formatDuration(tbDuration)}: ${tbReason}`);
            moderationManager.logCase(message.guild.id, 'TEMPBAN', message.author.id, tbTarget.id, tbReason, tbDuration);
            // Schedule unban
            setTimeout(async () => {
              try { await message.guild.members.unban(tbTarget.id, 'Tempban expired'); } catch {}
            }, tbDuration * 1000);
            await successMsg(message, `✅ **${tbTarget.user.tag}** tempbanned for ${formatDuration(tbDuration)}.`, client);
          });
          break;
        }

        // ── Massban ──
        case 'massban': {
          if (!isMod(message)) return sendPermissionDenied(message);
          if (rest.length < 2) return sendUsageError(message, '?mod massban <user1> <user2> ... <reason>');
          const mentions = message.mentions.users;
          if (mentions.size < 2) return errorMsg(message, 'Mention at least 2 users to massban.', client);
          const mbReason = rest.slice(mentions.size).join(' ') || 'Massban';
          let banned = 0, failed = 0;
          for (const user of mentions.values()) {
            try {
              const member = message.guild.members.cache.get(user.id);
              if (member) await moderationManager.ban(member, message.member, `Massban: ${mbReason}`);
              else await message.guild.members.ban(user.id, { reason: `Massban: ${mbReason}` });
              banned++;
            } catch { failed++; }
          }
          await successMsg(message, `✅ Massban: **${banned}** banned, **${failed}** failed.`, client);
          break;
        }

        // ── Unban ──
        case 'unban': {
          if (!isMod(message)) return sendPermissionDenied(message);
          if (rest.length < 1) return sendUsageError(message, '?mod unban <user_id> [reason]');
          const ubId = parseUser(rest[0]);
          const ubReason = rest.slice(1).join(' ') || 'No reason provided';
          try {
            await moderationManager.unban(message.guild, ubId, message.member, ubReason);
            await successMsg(message, `✅ User \`${ubId}\` has been unbanned.`, client);
          } catch {
            await errorMsg(message, 'Could not unban that user. Check the ID.', client);
          }
          break;
        }

        // ── Timeout ──
        case 'mute':
        case 'timeout': {
          if (!isMod(message)) return sendPermissionDenied(message);
          if (rest.length < 2) return sendUsageError(message, `?mod ${sub} <user> <duration> [reason]\nDuration: 10m, 1h, 7d (max 28d)`);
          const toTarget = message.mentions.members?.first() || await message.guild.members.fetch(parseUser(rest[0])).catch(() => null);
          if (!toTarget) return errorMsg(message, 'User not found.', client);
          const toDuration = parseDuration(rest[1]);
          if (!toDuration) return errorMsg(message, `Invalid duration: \`${rest[1]}\`.`, client);
          if (toDuration > 2419200) return errorMsg(message, 'Timeout max is 28 days.', client);
          const toReason = rest.slice(2).join(' ') || 'No reason provided';
          try {
            await moderationManager.timeout(toTarget, message.member, toDuration * 1000, toReason);
            await successMsg(message, `✅ **${toTarget.user.tag}** timed out for ${formatDuration(toDuration)}.`, client);
          } catch (err) {
            await errorMsg(message, `Failed: ${err.message}`, client);
          }
          break;
        }

        // ── Untimeout ──
        case 'untimeout':
        case 'unmute': {
          if (!isMod(message)) return sendPermissionDenied(message);
          if (rest.length < 1) return sendUsageError(message, `?mod ${sub} <user> [reason]`);
          const utTarget = message.mentions.members?.first() || await message.guild.members.fetch(parseUser(rest[0])).catch(() => null);
          if (!utTarget) return errorMsg(message, 'User not found.', client);
          const utReason = rest.slice(1).join(' ') || 'No reason provided';
          try {
            await moderationManager.untimeout(utTarget, message.member, utReason);
            await successMsg(message, `✅ **${utTarget.user.tag}** timeout removed.`, client);
          } catch (err) {
            await errorMsg(message, `Failed: ${err.message}`, client);
          }
          break;
        }

        // ── Warn ──
        case 'warn': {
          if (!isMod(message)) return sendPermissionDenied(message);
          if (rest.length < 2) return sendUsageError(message, '?mod warn <user> <reason>');
          const wTarget = message.mentions.members?.first() || await message.guild.members.fetch(parseUser(rest[0])).catch(() => null);
          if (!wTarget) return errorMsg(message, 'User not found.', client);
          const wReason = rest.slice(1).join(' ');
          await moderationManager.warn(message.guild, wTarget.id, message.member, wReason);
          await successMsg(message, `⚠️ **${wTarget.user?.tag || wTarget.id}** has been warned.\n> ${wReason}`, client);
          break;
        }

        // ── Warnings ──
        case 'warnings': {
          if (!isMod(message)) return sendPermissionDenied(message);
          const warningsTarget = rest.length ? (parseUser(rest[0]) || message.author.id) : message.author.id;
          const warns = moderationManager.getWarnings(message.guild.id, warningsTarget);
          if (warns.length === 0) {
            return successMsg(message, `✅ No warnings for <@${warningsTarget}>.`, client);
          }
          const lines = [
            `### ⚠️ Warnings for <@${warningsTarget}>`,
            `Total: **${warns.length}**`,
            '',
            ...warns.map((w, i) => `${i + 1}. ${w.reason || 'No reason'} — <t:${w.created_at}:R>`),
          ];
          const container = createV2Container({ description: lines.join('\n'), color: config.colors.warning, client });
          await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
          break;
        }

        // ── Clear Warnings ──
        case 'clearwarnings':
        case 'clearwarns': {
          if (!isMod(message)) return sendPermissionDenied(message);
          if (rest.length < 1) return sendUsageError(message, '?mod clearwarnings <user>');
          const cwTarget = parseUser(rest[0]);
          await confirmAction(message, `Clear warnings for <@${cwTarget}>`, { id: cwTarget }, null, async () => {
            moderationManager.clearWarnings(message.guild.id, cwTarget);
            await successMsg(message, `✅ Warnings cleared for <@${cwTarget}>.`, client);
          });
          break;
        }

        // ── Purge ──
        case 'purge':
        case 'clear': {
          if (!isMod(message)) return sendPermissionDenied(message);
          const purgeTypes = ['bots', 'embeds', 'links', 'images', 'reactions'];
          let purged = 0;
          if (rest.length === 0) return sendUsageError(message, '?mod purge <1-100> [bots|embeds|links|images|reactions|@user]');
          const purgeAmount = parseInt(rest[0]);
          if (isNaN(purgeAmount) || purgeAmount < 1 || purgeAmount > 100) return errorMsg(message, 'Amount must be 1-100.', client);
          if (rest.length > 1) {
            const filterType = rest[1].toLowerCase();
            if (purgeTypes.includes(filterType)) {
              purged = await moderationManager.purge(message.channel, purgeAmount, filterType);
            } else {
              const userId = parseUser(rest[1]);
              purged = await moderationManager.purgeUser(message.channel, userId, purgeAmount);
            }
          } else {
            // Simple purge - use bulkDelete directly
            const msgs = await message.channel.bulkDelete(Math.min(purgeAmount, 100), true);
            purged = msgs.size;
          }
          const reply = await message.reply({
            ...v2Payload(notification('success', `✅ Purged **${purged}** message${purged !== 1 ? 's' : ''}.`, client)),
            allowedMentions: { repliedUser: false },
          });
          setTimeout(() => reply.delete().catch(() => null), 4000);
          break;
        }

        // ── Slowmode ──
        case 'slowmode':
        case 'slow': {
          if (!isMod(message)) return sendPermissionDenied(message);
          if (rest.length < 1) return sendUsageError(message, '?mod slowmode <0-21600> [reason]');
          const slowSeconds = parseInt(rest[0]);
          if (isNaN(slowSeconds) || slowSeconds < 0 || slowSeconds > 21600) return errorMsg(message, 'Slowmode must be 0-21600 seconds.', client);
          const slowReason = rest.slice(1).join(' ') || null;
          await moderationManager.setSlowmode(message.channel, slowSeconds);
          const msg = slowSeconds === 0 ? `✅ Slowmode disabled.` : `✅ Slowmode set to **${formatDuration(slowSeconds)}**.`;
          await successMsg(message, msg, client);
          break;
        }

        // ── Lock ──
        case 'lock': {
          if (!isAdmin(message)) return sendPermissionDenied(message);
          const lockReason = rest.join(' ') || null;
          await moderationManager.lockChannel(message.channel, lockReason);
          await successMsg(message, `✅ Channel locked.`, client);
          break;
        }

        // ── Unlock ──
        case 'unlock': {
          if (!isAdmin(message)) return sendPermissionDenied(message);
          const unlockReason = rest.join(' ') || null;
          await moderationManager.unlockChannel(message.channel, unlockReason);
          await successMsg(message, `✅ Channel unlocked.`, client);
          break;
        }

        // ── Lock All ──
        case 'lockall': {
          if (!isAdmin(message)) return sendPermissionDenied(message);
          const laReason = rest.join(' ') || 'Server lockdown';
          await confirmAction(message, 'Lock ALL text channels', message.guild.name, laReason, async () => {
            const result = await moderationManager.lockAll(message.guild, laReason);
            await successMsg(message, `✅ Locked **${result.locked}** channels (${result.failed} failed).`, client);
          });
          break;
        }

        // ── Unlock All ──
        case 'unlockall': {
          if (!isAdmin(message)) return sendPermissionDenied(message);
          const uaReason = rest.join(' ') || 'Lockdown lifted';
          await confirmAction(message, 'Unlock ALL text channels', message.guild.name, uaReason, async () => {
            const result = await moderationManager.unlockAll(message.guild, uaReason);
            await successMsg(message, `✅ Unlocked **${result.unlocked}** channels (${result.failed} failed).`, client);
          });
          break;
        }

        // ── Nickname ──
        case 'nickname':
        case 'nick': {
          if (!isAdmin(message)) return sendPermissionDenied(message);
          if (rest.length < 2) return sendUsageError(message, '?mod nickname <user> <new nickname | "reset">');
          const nickTarget = message.mentions.members?.first() || await message.guild.members.fetch(parseUser(rest[0])).catch(() => null);
          if (!nickTarget) return errorMsg(message, 'User not found.', client);
          const newNick = rest.slice(1).join(' ');
          try {
            await moderationManager.setNickname(nickTarget, newNick === 'reset' ? null : newNick);
            await successMsg(message, `✅ Nickname updated for **${nickTarget.user.tag}**.`, client);
          } catch (err) {
            await errorMsg(message, `Failed: ${err.message}`, client);
          }
          break;
        }

        // ── History ──
        case 'history':
        case 'cases': {
          const histTarget = rest.length ? parseUser(rest[0]) : message.author.id;
          const db = getDb();
          const cases = CasesRepo.getByTarget(db, histTarget, 15);
          if (cases.length === 0) {
            return successMsg(message, `ℹ️ No moderation history for <@${histTarget}>.`, client);
          }
          const lines = [
            `### 📋 Moderation History`,
            `**Target:** <@${histTarget}> — **${cases.length}** total`,
            '',
            ...cases.map((c, i) => {
              const badge = { BAN: `❌`, KICK: '👢', SOFTBAN: `❌`, TEMPBAN: '⏳', UNBAN: `🔓`, TIMEOUT: `🔊`, UNTIMEOUT: `🔊`, WARN: `⚠️` }[c.action] || `ℹ️`;
              return `${badge} \`${c.case_id}\` — **${c.action}** <t:${c.created_at}:R>${c.reason ? `\n> ${c.reason}` : ''}`;
            }),
          ];
          const container = createV2Container({ description: lines.join('\n'), color: config.colors.primary, client });
          await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
          break;
        }

        // ── Case Details ──
        case 'case': {
          if (rest.length < 1) return sendUsageError(message, '?mod case <case_id>');
          const db = getDb();
          const caseData = CasesRepo.getByCaseId(db, rest[0]);
          if (!caseData) return errorMsg(message, `Case \`${rest[0]}\` not found.`, client);
          const lines = [
            `### 📋 Case \`${caseData.case_id}\``,
            '',
            field('Action', caseData.action),
            field('Target', `<@${caseData.target_id}>`),
            field('Moderator', `<@${caseData.moderator_id}>`),
            caseData.reason ? field('Reason', caseData.reason) : '',
            field('Date', relativeTime(caseData.created_at)),
            caseData.duration ? field('Duration', formatDuration(caseData.duration)) : '',
          ].filter(Boolean).join('\n');
          const container = createV2Container({ description: lines, color: config.colors.primary, client });
          await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
          break;
        }

        default:
          return sendUsageError(message, `Unknown subcommand: \`${sub}\`.\n${config.prefix}mod for help.`);
      }
    } catch (error) {
      await handleCommandError(message, error);
    }
  },
};

async function successMsg(message, text, client) {
  const card = notification('success', text, client);
  const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
  setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
}

async function errorMsg(message, text, client) {
  const card = notification('error', text, client);
  const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
  setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
}

function sendPermissionDenied(message) {
  const card = notification('error', `❌ You need a higher permission level for this action.`, message.client);
  return message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
}
