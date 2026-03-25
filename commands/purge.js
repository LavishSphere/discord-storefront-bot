const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Delete a number of messages from this channel')
    .addIntegerOption(option =>
      option
        .setName('amount')
        .setDescription('Number of messages to delete (1-100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction, client) {
    const allowedRoles = client.config["command_centre"].allowed_ticket_roles;
    const hasPermission = interaction.member.roles.cache.some(role => allowedRoles.includes(role.id));

    if (!hasPermission) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }

    const amount = interaction.options.getInteger('amount');

    const deleted = await interaction.channel.bulkDelete(amount, true).catch(() => null);

    if (!deleted) {
      return interaction.reply({ content: 'Failed to delete messages. Messages older than 14 days cannot be bulk deleted.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor(client.config["server_config"].danger_colour)
      .setDescription(`Deleted **${deleted.size}** message(s).`);

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
