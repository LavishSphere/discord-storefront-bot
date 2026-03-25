const { PermissionsBitField, SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tadd')
    .setDescription('Add a user to the ticket with specific permissions')
    .addUserOption(option => option.setName('user').setDescription('User').setRequired(true)),
  async execute(interaction, client) {
    const allowedRoles = client.config.command_center.allowed_ticket_roles;
    const hasPermission = interaction.member.roles.cache.some(role => allowedRoles.includes(role.id));

    if (!hasPermission) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }

    const user = interaction.options.getUser('user');
    const channel = interaction.channel;
    const guild = interaction.guild;

    if (!channel.isTextBased()) {
      return interaction.reply({ content: 'This command can only be used in text-based channels.', ephemeral: true });
    }

    try {
      await channel.permissionOverwrites.edit(user, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true
      });

      await interaction.reply({ content: `${user.tag} has been added to the ticket.`, ephemeral: true });

      const alertChannel = guild.channels.cache.get(client.config.order_config.alert_channel_id);
      if (alertChannel) {
        const embed = new EmbedBuilder()
          .setColor(client.config.server_config.success_color)
          .setTitle('User Added to Ticket')
          .setDescription(`User <@${user.id}> has been added to the ticket in ${channel.name}`)
          .addFields(
            { name: 'Added By', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'Channel', value: `<#${channel.id}>`, inline: true }
          )
          .setTimestamp();
        await alertChannel.send({ embeds: [embed] });
      }
    } catch (error) {
      console.error('Error adding user to the ticket:', error);
      await interaction.reply({ content: 'There was an error adding the user to the ticket.', ephemeral: true });
    }
  }
};
