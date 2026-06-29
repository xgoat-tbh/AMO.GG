import { createV2Container, v2Payload } from '../../helpers/v2Helper.js';
import { config } from '../../config/bot.config.js';
import { emojis } from '../../config/emojis.config.js';
import { assets } from '../../config/assets.config.js';

export function buildVoiceResultCard({ action, target, moderator, channel, extra, client }) {
  const lines = [
    `### 🔊 ${action}`,
  ];
  if (target) lines.push(`**Target** ${target.user ? `<@${target.id}>` : target}`);
  if (moderator) lines.push(`**Moderator** <@${moderator.id}>`);
  if (channel) lines.push(`**Channel** ${channel.name ? `<#${channel.id}>` : `<#${channel}>`}`);
  if (extra) {
    for (const [key, val] of Object.entries(extra)) {
      lines.push(`**${key}** ${val}`);
    }
  }

  return createV2Container({
    description: lines.join('\n'),
    thumbnail: assets.voice,
    color: config.colors.voice,
    client,
  });
}

export function buildVoiceSuccessCard(description, client) {
  return createV2Container({
    description,
    thumbnail: assets.success,
    color: config.colors.success,
    client,
  });
}

export function buildVoiceErrorCard(reason, client) {
  return createV2Container({
    description: `❌ ${reason}`,
    thumbnail: assets.error,
    color: config.colors.error,
    client,
  });
}