import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createV2Container, v2Payload, notification } from '../../helpers/v2Helper.js';
import { emojis } from '../../config/emojis.config.js';
import { handleCommandError, sendUsageError } from '../../helpers/errorHandler.js';
import { voiceManager } from '../../systems/voice/voiceManager.js';
import { logVoice } from '../../services/loggingService.js';
import { checkPermission } from '../../helpers/permissions.js';
import { getDb } from '../../database/connection.js';
import { MoveRepo } from '../../database/repositories/move.repo.js';

export default {
  name: 'move',
  aliases: ['mv'],
  description: 'Move a user to a voice channel (consent-based). Use --force to override.',
  usage: '?move <@user> <#channel> [--force]',
  permission: 'moderator',

  async execute(message, args, client) {
    try {
      const isForce = args.includes('--force');
      const cleanArgs = args.filter(a => a !== '--force');

      const member = message.mentions.members.first();
      const channel = message.mentions.channels.first();

      if (!member || !channel) {
        return sendUsageError(message, '?move <@user> <#channel> [--force]');
      }

      if (!channel.isVoiceBased()) {
        const card = notification('error', `❌ ${channel} is not a voice channel.`, client);
        const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
        setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
        return;
      }

      if (!member.voice.channel) {
        const card = notification('error', `❌ ${member} is not in a voice channel.`, client);
        const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
        setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
        return;
      }

      // Force move requires Administrator
      if (isForce) {
        if (!checkPermission(message.member, 'admin')) {
          const card = notification('error', `❌ \`--force\` requires Administrator permission.`, client);
          const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
          setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
          return;
        }

        await voiceManager.moveMembers([member], channel);
        await logVoice(client, {
          action: 'move',
          target: member,
          moderator: message.member,
          from: member.voice.channel,
          to: channel,
        });

        const card = notification('success', `✅ Force-moved ${member} to **${channel.name}**.`, client);
        const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
        setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
        return;
      }

      // Consent-based move
      // If target is the moderator or target is immune, skip consent
      const isImmune = checkPermission(member, 'moderator');
      if (member.id === message.author.id || isImmune) {
        await voiceManager.moveMembers([member], channel);
        const card = notification('success', `✅ Moved ${member} to **${channel.name}**.`, client);
        const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
        setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
        return;
      }

      // In-channel consent request
      const requestCard = notification('info', [
        `### 🚚 Move Request`,
        `❓ ${member}, ${message.member.displayName} wants to move you to **${channel.name}**. Do you accept?`,
        '',
        `You have **30 seconds** to respond.`,
      ].join('\n'), client);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('move:accept').setLabel('Accept').setStyle(ButtonStyle.Success).setEmoji(emojis.success),
        new ButtonBuilder().setCustomId('move:decline').setLabel('Decline').setStyle(ButtonStyle.Danger).setEmoji(emojis.error),
      );

      const sent = await message.reply({ ...v2Payload(requestCard, [row]), allowedMentions: { users: [member.id] } });

      // Log to DB
      const db = getDb();
      MoveRepo.create(db, member.id, message.author.id, member.voice.channel.id, channel.id, Math.floor(Date.now() / 1000) + 30);

      // Wait for response via collector
      const filter = i => ['move:accept', 'move:decline'].includes(i.customId) && i.user.id === member.id;
      try {
        const collected = await sent.awaitMessageComponent({ filter, time: 30000 });

        if (collected.customId === 'move:accept') {
          await collected.deferUpdate();
          await voiceManager.moveMembers([member], channel);
          await collected.editReply(v2Payload(notification('success', `✅ ${member} has been moved to **${channel.name}**.`, client)));

          await logVoice(client, {
            action: 'move',
            target: member,
            moderator: message.member,
            from: member.voice.channel,
            to: channel,
          });

          MoveRepo.updateStatus(db, MoveRepo.getPending(db, member.id)?.id, 'accepted');
        } else {
          MoveRepo.updateStatus(db, MoveRepo.getPending(db, member.id)?.id, 'declined');
          await collected.update(v2Payload(notification('info', `ℹ️ Move request declined.`, client)));
        }
      } catch {
        MoveRepo.expireOld(db);
        const expiredCard = notification('warning', `⚠️ Move request expired. ${member} did not respond in time.`, client);
        await sent.edit(v2Payload(expiredCard)).catch(() => null);
      }
    } catch (error) {
      await handleCommandError(message, error);
    }
  },
};
