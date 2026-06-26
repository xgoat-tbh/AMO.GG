import { MessageFlags } from 'discord.js';
import { getDb } from '../../database/connection.js';
import { GiveawaysRepo } from '../../database/repositories/giveaways.repo.js';
import { updateGiveawayCard } from '../../systems/giveaways/giveawayManager.js';

export default {
  customId: 'giveaway:enter',

  async execute(interaction, client) {
    const parts = interaction.customId.split(':');
    const giveawayId = parseInt(parts[2], 10);

    if (isNaN(giveawayId)) {
      await interaction.reply({ content: '❌ Invalid giveaway ID.', flags: MessageFlags.Ephemeral });
      return;
    }

    const db = getDb();
    const giveaway = GiveawaysRepo.get(db, giveawayId);

    if (!giveaway) {
      await interaction.reply({ content: '❌ Giveaway not found in the database.', flags: MessageFlags.Ephemeral });
      return;
    }

    if (giveaway.status !== 'active') {
      await interaction.reply({ content: '❌ This giveaway has already ended!', flags: MessageFlags.Ephemeral });
      return;
    }

    const hasEntered = GiveawaysRepo.hasEntered(db, giveaway.id, interaction.user.id);
    if (hasEntered) {
      await interaction.reply({ content: '⚠️ You have already entered this giveaway!', flags: MessageFlags.Ephemeral });
      return;
    }

    GiveawaysRepo.addEntry(db, giveaway.id, interaction.user.id);

    await interaction.reply({ 
      content: '✅ **You have successfully entered the giveaway!** Good luck! 🍀', 
      flags: MessageFlags.Ephemeral 
    });

    // Rebuild and update card to reflect the new entry count on the button
    await updateGiveawayCard(client, giveaway.id);
  },
};
