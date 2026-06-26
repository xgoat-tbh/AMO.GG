import { EmbedBuilder, ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder, MessageFlags, ActionRowBuilder } from 'discord.js';
import { config } from '../config/bot.config.js';
import { assets } from '../config/assets.config.js';

/**
 * Creates a Discord Components V2 ContainerBuilder layout.
 */
export function createV2Container({
  title,
  description,
  color,
  fields,
  thumbnail,
  author,
  footer,
  client,
} = {}) {
  const parts = [];
  if (title) parts.push(`### ${title}`);
  if (author?.name) {
    parts.push(`*By ${author.name}*`);
  }
  if (description) parts.push(description);
  
  if (fields && fields.length) {
    const fieldParts = [];
    fields.forEach(f => {
      if (String(f.value).includes('\n')) {
        fieldParts.push(`**${f.name}**\n${f.value}`);
      } else {
        fieldParts.push(`**${f.name}**: ${f.value}`);
      }
    });
    parts.push(fieldParts.join('\n'));
  }

  if (footer) {
    parts.push(`*${footer}*`);
  }

  const textContent = parts.join('\n\n');

  const container = new ContainerBuilder();

  // If a thumbnail is specified, we must use a Section to pair it as an accessory.
  // If there is no thumbnail, we append the TextDisplay directly to the Container,
  // which prevents validation errors and avoids empty grey boxes in Discord Dark Mode.
  if (thumbnail) {
    const imgUrl = thumbnail.url || thumbnail;
    const section = new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(textContent || ' ')
      )
      .setThumbnailAccessory(new ThumbnailBuilder().setURL(imgUrl));
    container.addSectionComponents(section);
  } else {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(textContent || ' ')
    );
  }

  const finalColor = color ?? config.colors.primary;
  if (finalColor !== undefined && finalColor !== null) {
    container.setAccentColor(finalColor);
  }

  return container;
}

/**
 * Helper to package V2 container or V1 embed, and extra action row components.
 */
export function v2Payload(target, extraComponents = [], ephemeral = false, isEdit = false) {
  if (target instanceof EmbedBuilder) {
    const payload = {
      embeds: [target],
      components: extraComponents,
    };
    if (!isEdit) {
      const flags = [];
      if (ephemeral) flags.push(MessageFlags.Ephemeral);
      payload.flags = flags;
    }
    return payload;
  }

  // If it is a ContainerBuilder (or raw JSON object)
  const container = target;
  if (container instanceof ContainerBuilder && extraComponents && extraComponents.length) {
    for (const component of extraComponents) {
      if (component instanceof ActionRowBuilder || component.type === 1) {
        container.addActionRowComponents(component);
      }
    }
  }

  const payload = {
    components: [container],
  };
  if (!isEdit) {
    const flags = [];
    if (ephemeral) flags.push(MessageFlags.Ephemeral);
    payload.flags = [MessageFlags.IsComponentsV2, ...flags];
  }
  return payload;
}

export function v2EditPayload(target, extraComponents = []) {
  return v2Payload(target, extraComponents, false, true);
}

export function createV2Success(description, client) {
  return createV2Container({
    description,
    color: config.colors.success,
    client,
  });
}

export function createV2Error(description, client) {
  return createV2Container({
    description,
    color: config.colors.error,
    client,
  });
}

