const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tremove')
    .setDescription('Remove a user from the ticket channel')
    .addUserOption(option => option.setName('user').setDescription('User').setRequired(true)),
  async execute(interaction, client) {
    const allowedRoles = client.config.command_centre.allowed_ticket_roles;
    const hasPermission = interaction.member.roles.cache.some(role => allowedRoles.includes(role.id));

    if (!hasPermission) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }

    const user = interaction.options.getUser('user');
    if (!user) {
      return interaction.reply({ content: 'Please provide a user to remove from this channel.', ephemeral: true });
    }

    const userID = user.id;
    const member = interaction.guild.members.cache.get(userID);

    if (!member) {
      return interaction.reply({ content: 'User with that ID is not a member of this server.', ephemeral: true });
    }

    const channel = interaction.channel;

    channel.permissionOverwrites.delete(userID)
      .then(async () => {
        await interaction.reply({ content: `Successfully removed user with ID ${userID} from this channel.`, ephemeral: true });

        const alertChannel = interaction.guild.channels.cache.get(client.config.order_config.alert_channel_id);
        if (alertChannel) {
          const embed = new EmbedBuilder()
            .setColor(client.config.server_config.danger_colour)
            .setTitle('User Removed from Ticket')
            .setDescription(`User <@${user.id}> has been removed from the ticket in ${channel.name}`)
            .addFields(
              { name: 'Removed By', value: `<@${interaction.user.id}>`, inline: true },
              { name: 'Channel', value: `<#${channel.id}>`, inline: true }
            )
            .setTimestamp();
          return alertChannel.send({ embeds: [embed] });
        }
      })
      .catch(error => {
        console.error('Error removing permissions:', error);
        return interaction.reply({ content: 'There was an error removing permissions from the user.', ephemeral: true });
      });
  }
};
