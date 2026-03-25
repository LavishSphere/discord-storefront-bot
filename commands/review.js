const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('review')
    .setDescription('Leave a review for the service')
    .addIntegerOption(option =>
      option.setName('stars')
        .setDescription('Rate the service from 1 to 5 stars')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('product')
        .setDescription('What product did you buy')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('suggestion')
        .setDescription('Any suggestions for us to improve?')
        .setRequired(true))
    .addUserOption(option =>
      option.setName('staff')
        .setDescription('Which staff helped you?')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('commentary')
        .setDescription('Your commentary or review message')
        .setRequired(true)),
  async execute(interaction, client) {
    const starRating = interaction.options.getInteger('stars');
    const product = interaction.options.getString('product');
    const suggestion = interaction.options.getString('suggestion');
    const staffMember = interaction.options.getUser('staff');
    const commentary = interaction.options.getString('commentary');
    const reviewer = interaction.user;

    if (starRating < 1 || starRating > 5) {
      return interaction.reply({ content: 'Stars must be an integer from 1 to 5.', ephemeral: true });
    }

    const vouchChannel = interaction.guild.channels.cache.get(client.config.order_config.vouch_channel_id);
    if (!vouchChannel) {
      return interaction.reply({ content: 'Vouch channel not found.', ephemeral: true });
    }

    const reviewEmbed = new EmbedBuilder()
      .setAuthor({ name: reviewer.username, iconURL: reviewer.displayAvatarURL() })
      .setTitle(`${reviewer.username} Review`)
      .addFields(
        { name: 'Evaluation of work:', value: `${'⭐️'.repeat(starRating)}`, inline: false },
        { name: 'Purchased Product:', value: product, inline: false },
        { name: 'Any suggestions for us to improve?', value: suggestion, inline: false },
        { name: 'Which staff helped you?', value: `<@${staffMember.id}>`, inline: false },
        { name: 'Commentary:', value: commentary, inline: false }
      )
      .setColor(client.config.server_config.accent_color)
      .setTimestamp();

    await vouchChannel.send({ embeds: [reviewEmbed] });
    await interaction.reply({ content: 'Thank you for your review!', ephemeral: true });
  }
};
