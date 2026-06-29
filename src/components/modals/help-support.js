import { MessageFlags } from 'discord.js';
import { emojis } from '../../config/emojis.config.js';
import { config } from '../../config/bot.config.js';
import { notification, v2Payload } from '../../helpers/v2Helper.js';

export default {
  customId: 'help:support:modal',

  async execute(interaction, client) {
    const query = interaction.fields.getTextInputValue('support-query');
    const ownerId = process.env.OWNER_ID;

    if (!ownerId) {
      await interaction.reply({
        content: `${emojis.error} Support is not configured yet.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const guildName = interaction.guild?.name || 'DMs';
    const tag = interaction.user.tag;

    const ownerMsg = [
      `### 🆘 Support Query`,
      `**From:** ${tag} (<@${interaction.user.id}>)`,
      `**Server:** ${guildName} (\`${interaction.guildId || 'N/A'}\`)`,
      '',
      `**Message:**`,
      `> ${query}`,
    ].join('\n');

    try {
      const owner = await client.users.fetch(ownerId);
      const card = notification('info', ownerMsg, client);
      await owner.send(v2Payload(card));

      const success = notification('success', `${emojis.success} Your support query has been sent to the bot owner. They'll get back to you soon!`, client);
      await interaction.editReply({ ...v2Payload(success, [], true), flags: [MessageFlags.Ephemeral] });
    } catch {
      const err = notification('error', `${emojis.error} Failed to send your query. The owner might have DMs disabled.`, client);
      await interaction.editReply({ ...v2Payload(err, [], true), flags: [MessageFlags.Ephemeral] });
    }
  },
};