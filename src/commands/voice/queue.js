import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createV2Container, v2Payload, notification, codeStat, field } from '../../helpers/v2Helper.js';
import { config } from '../../config/bot.config.js';
import { emojis } from '../../config/emojis.config.js';
import { handleCommandError, sendUsageError } from '../../helpers/errorHandler.js';
import { checkPermission } from '../../helpers/permissions.js';
import { voiceQueueManager } from '../../systems/voicequeue/voiceQueueManager.js';
import { logger } from '../../helpers/logger.js';

export default {
  name: 'queue',
  aliases: ['vq', 'voicequeue'],
  description: 'Join, leave, or manage the voice channel queue.',
  usage: '?queue join <#channel> | ?queue leave | ?queue status | ?queue next | ?queue clear',
  permission: 'everyone',

  async execute(message, args, client) {
    try {
      if (!args.length) {
        return this.showStatus(message, client);
      }

      const sub = args[0].toLowerCase();

      if (sub === 'join') {
        return this.handleJoin(message, args.slice(1), client);
      }

      if (sub === 'leave') {
        return this.handleLeave(message, args.slice(1), client);
      }

      if (sub === 'status' || sub === 'info') {
        return this.showStatus(message, client);
      }

      if (sub === 'next') {
        if (!checkPermission(message.member, 'moderator')) {
          return message.reply({ ...v2Payload(notification('error', `${emojis.error} Only moderators can advance the queue.`, client)), allowedMentions: { repliedUser: false } });
        }
        return this.handleNext(message, args.slice(1), client);
      }

      if (sub === 'clear') {
        if (!checkPermission(message.member, 'moderator')) {
          return message.reply({ ...v2Payload(notification('error', `${emojis.error} Only moderators can clear the queue.`, client)), allowedMentions: { repliedUser: false } });
        }
        return this.handleClear(message, args.slice(1), client);
      }

      return sendUsageError(message, this.usage);
    } catch (error) {
      await handleCommandError(message, error);
    }
  },

  async handleJoin(message, args, client) {
    const channel = message.mentions.channels?.first();
    if (!channel || !channel.isVoiceBased()) {
      return sendUsageError(message, '?queue join <#voice-channel>');
    }

    if (!message.member.voice?.channelId) {
      return message.reply({ ...v2Payload(notification('warning', `${emojis.warning} You must be in a voice channel to join a queue.`, client)), allowedMentions: { repliedUser: false } });
    }

    if (message.member.voice.channelId === channel.id) {
      return message.reply({ ...v2Payload(notification('info', `${emojis.info} You are already in that channel!`, client)), allowedMentions: { repliedUser: false } });
    }

    if (voiceQueueManager.isInQueue(message.author.id, channel.id)) {
      return message.reply({ ...v2Payload(notification('info', `${emojis.info} You are already in the queue for that channel.`, client)), allowedMentions: { repliedUser: false } });
    }

    const result = voiceQueueManager.joinQueue(message.guild.id, channel.id, message.author.id);
    if (!result) {
      return message.reply({ ...v2Payload(notification('warning', `${emojis.warning} Could not join the queue. You may already be in it.`, client)), allowedMentions: { repliedUser: false } });
    }

    const position = voiceQueueManager.getPosition(channel.id, message.author.id);
    const total = voiceQueueManager.getTotalWaiting(channel.id);

    const lines = [
      `### 🎤 Queue Joined`,
      `**Channel:** ${channel.name}`,
      `**Position:** #${position} of ${total}`,
      '',
      `You'll be automatically moved when it's your turn.`,
      `Use \`?queue leave\` to leave the queue.`,
    ];

    const container = createV2Container({ description: lines.join('\n'), color: config.colors.success, client });
    await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
  },

  async handleLeave(message, args, client) {
    const channel = message.mentions.channels?.first();
    const queues = voiceQueueManager.getActiveQueuesForUser(message.author.id);

    if (!queues.length) {
      return message.reply({ ...v2Payload(notification('info', `${emojis.info} You are not in any voice queues.`, client)), allowedMentions: { repliedUser: false } });
    }

    if (channel) {
      voiceQueueManager.leaveQueue(message.guild.id, channel.id, message.author.id);
      const stillInQueue = voiceQueueManager.isInQueue(message.author.id, channel.id);
      if (!stillInQueue) {
        return message.reply({ ...v2Payload(notification('success', `${emojis.success} Left the queue for ${channel.name}.`, client)), allowedMentions: { repliedUser: false } });
      }
      return;
    }

    for (const q of queues) {
      voiceQueueManager.leaveQueue(message.guild.id, q.target_channel_id, message.author.id);
    }

    const container = createV2Container({ description: `Left **${queues.length}** queue(s).`, color: config.colors.success, client });
    await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
  },

  async showStatus(message, client) {
    const queues = voiceQueueManager.getActiveQueuesForUser(message.author.id);

    const lines = [
      `### 🎤 Voice Queue`,
      '',
    ];

    if (queues.length) {
      lines.push('**Your Queues:**');
      for (const q of queues) {
        const position = voiceQueueManager.getPosition(q.target_channel_id, message.author.id);
        const total = voiceQueueManager.getTotalWaiting(q.target_channel_id);
        const channelName = message.guild.channels.cache.get(q.target_channel_id)?.name || q.target_channel_id;
        lines.push(`• <#${q.target_channel_id}> — #${position}/${total}`);
      }
    } else {
      lines.push('You are not in any queues.');
    }

    lines.push('', `**Usage:** \`?queue join <#channel>\` to join a queue.`);

    if (checkPermission(message.member, 'moderator')) {
      const activeQueues = message.guild.channels.cache.filter(c => {
        if (!c.isVoiceBased()) return false;
        const waiting = voiceQueueManager.getTotalWaiting(c.id);
        return waiting > 0;
      });

      if (activeQueues.size) {
        lines.push('', '**Active Queues:**');
        for (const [id, ch] of activeQueues) {
          lines.push(`• <#${id}> — ${voiceQueueManager.getTotalWaiting(id)} waiting`);
        }
      }
    }

    const container = createV2Container({ description: lines.join('\n'), color: config.colors.primary, client });
    await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
  },

  async handleNext(message, args, client) {
    const channel = message.mentions.channels?.first() || message.member.voice?.channel;
    if (!channel || !channel.isVoiceBased()) {
      return sendUsageError(message, '?queue next [#channel] (or be in a voice channel)');
    }

    const moved = await voiceQueueManager.processNext(client, channel);
    if (!moved) {
      return message.reply({ ...v2Payload(notification('info', `${emojis.info} Queue is empty or no eligible members.`, client)), allowedMentions: { repliedUser: false } });
    }

    const container = createV2Container({ description: `Moved **${moved.user.tag}** into ${channel.name}.`, color: config.colors.success, client });
    await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
  },

  async handleClear(message, args, client) {
    const channel = message.mentions.channels?.first() || message.member.voice?.channel;
    if (!channel || !channel.isVoiceBased()) {
      return sendUsageError(message, '?queue clear [#channel]');
    }

    const count = voiceQueueManager.getTotalWaiting(channel.id);
    voiceQueueManager.clearQueue(message.guild.id, channel.id);

    const container = createV2Container({ description: `Cleared **${count}** member(s) from the queue for ${channel.name}.`, color: config.colors.success, client });
    await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
  },
};
