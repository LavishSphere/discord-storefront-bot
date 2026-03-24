const { ActionRowBuilder, ButtonBuilder, EmbedBuilder, SlashCommandBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('suggest')
    .setDescription('Create a suggestion for the channel')
    .addStringOption(option =>
      option.setName('suggestion')
        .setDescription('Your suggestion')
        .setRequired(true)),
  async execute(interaction, client) {
    const suggestion = interaction.options.getString('suggestion');
    const suggestionsChannel = interaction.guild.channels.cache.get(client.config.order_config.suggestions_channel_id);

    if (!suggestionsChannel) {
      return interaction.reply({ content: 'Suggestions channel not found.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
      .setColor(client.config.server_config.accent_colour)
      .setTitle('Suggestion')
      .setDescription(suggestion)
      .addFields(
        { name: 'Status', value: 'Pending', inline: false },
        { name: 'Votes', value: '👍 0 upvotes (0.0%) • 👎 0 downvotes (0.0%)', inline: false },
      );

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('upvote')
          .setLabel('👍 Upvote')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('downvote')
          .setLabel('👎 Downvote')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('approve')
          .setLabel('✅ Approve')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('reject')
          .setLabel('❌ Reject')
          .setStyle(ButtonStyle.Secondary)
      );

    const suggestionMessage = await suggestionsChannel.send({ embeds: [embed], components: [row] });

    await client.db.query(
      'INSERT INTO suggestions (message_id, suggestion, upvotes, downvotes) VALUES (?, ?, ?, ?)',
      [suggestionMessage.id, suggestion, '[]', '[]']
    );

    await interaction.reply({ content: 'Suggestion sent successfully!', ephemeral: true });
  }
};
