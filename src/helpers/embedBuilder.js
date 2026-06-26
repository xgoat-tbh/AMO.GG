import { EmbedBuilder } from 'discord.js';
import { config } from '../config/bot.config.js';

/**
 * Branded embed factory.
 * Every embed auto-includes the "Created by Naman" footer and timestamp.
 */
export function createEmbed({
  title,
  description,
  color,
  fields,
  thumbnail,
  author,
  image,
} = {}) {
  const embed = new EmbedBuilder()
    .setColor(color ?? config.colors.primary)
    .setTimestamp();

  if (title) embed.setTitle(title);
  
  if (description) embed.setDescription(description);

  if (thumbnail) embed.setThumbnail(thumbnail);
  if (image) embed.setImage(image);
  if (author) {
    embed.setAuthor({
      name: author.name,
      iconURL: author.iconURL ?? undefined,
    });
  }
  if (fields?.length) {
    embed.addFields(
      fields.map(f => ({
        name: f.name,
        value: f.value,
        inline: f.inline ?? false,
      }))
    );
  }

  return embed;
}

/**
 * Quick success embed.
 */
export function createSuccessEmbed(description) {
  return createEmbed({
    description,
    color: config.colors.success,
  });
}

/**
 * Quick error embed.
 */
export function createErrorEmbed(description) {
  return createEmbed({
    description,
    color: config.colors.error,
  });
}

/**
 * Quick warning embed.
 */
export function createWarningEmbed(description) {
  return createEmbed({
    description,
    color: config.colors.warning,
  });
}

/**
 * Quick info embed.
 */
export function createInfoEmbed(description) {
  return createEmbed({
    description,
    color: config.colors.info,
  });
}
