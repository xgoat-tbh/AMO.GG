import { MessageFlags } from 'discord.js';
import { pendingVcs, buildSetupPayload } from '../../commands/voice/gpvc.js';
import { emojis } from '../../config/emojis.config.js';

export default {
  customId: 'gpvc:select_game',

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

    const state = pendingVcs.get(userId) || { name: `${interaction.member.displayName}'s VC`, limit: 0, game: null };
    state.game = interaction.values[0];
    pendingVcs.set(userId, state);

    const payload = buildSetupPayload(userId, client);
    await interaction.update(payload);
  },
};
