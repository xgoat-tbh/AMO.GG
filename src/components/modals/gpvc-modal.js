import { MessageFlags } from 'discord.js';
import { pendingVcs, buildSetupPayload } from '../../commands/voice/gpvc.js';
import { emojis } from '../../config/emojis.config.js';
import { sanitizeContent } from '../../helpers/sanitizer.js';

export default {
  customId: 'gpvc:modal_config',

  async execute(interaction, client) {
    const parts = interaction.customId.split(':');
    const userId = parts[2];

    if (interaction.user.id !== userId) {
      await interaction.reply({
        content: `${emojis.error} This configuration menu does not belong to you.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const vcName = interaction.fields.getTextInputValue('vc_name');
    const vcLimitRaw = interaction.fields.getTextInputValue('vc_limit');

    // Validate VC name/topic
    const { sanitized: statusText, valid, reason } = sanitizeContent(vcName, 100, 'Channel topic');
    if (vcName && !valid) {
      await interaction.reply({
        content: `${emojis.error} ${reason}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Limit validation
    let finalLimit = 0;
    if (vcLimitRaw && vcLimitRaw.trim()) {
      const parsed = parseInt(vcLimitRaw.trim(), 10);
      if (isNaN(parsed) || parsed < 0 || parsed > 99) {
        await interaction.reply({
          content: `${emojis.error} User limit must be a number between 0 and 99.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      finalLimit = parsed;
    }

    const state = pendingVcs.get(userId) || { name: '', limit: 0, game: null };
    state.name = statusText;
    state.limit = finalLimit;
    pendingVcs.set(userId, state);

    const payload = buildSetupPayload(userId, client);
    await interaction.update(payload);
  },
};
