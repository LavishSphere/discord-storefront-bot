const { SlashCommandBuilder, ActionRowBuilder, SelectMenuBuilder, EmbedBuilder } = require('discord.js');
module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Open a ticket panel'),
  async execute(interaction, client) {
    const allowedRoles = client.config["command_centre"].allowed_ticket_roles;
    const hasPermission = interaction.member.roles.cache.some(role => allowedRoles.includes(role.id));

    if (!hasPermission) {
      return interaction.editReply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }
    const embed = new EmbedBuilder()
      .setColor(client.config["server_config"].embed_colours)
      .setTitle('🎫 Ticket Panel')
      .setDescription('Please select the type of ticket you would like to open:');
    const row = new ActionRowBuilder()
      .addComponents(
        new SelectMenuBuilder()
          .setCustomId('ticket-select')
          .setPlaceholder('Select Ticket Type')
          .addOptions([
            {
              label: 'Purchase Ticket',
              description: 'Open a purchase-related ticket.',
              value: 'purchase_ticket',
            },
            {
              label: 'Support Ticket',
              description: 'Open a support-related ticket.',
              value: 'support_ticket',
            },
            {
              label: 'Enquiry Ticket',
              description: 'Open a general enquiry ticket.',
              value: 'enquiry_ticket',
            },
          ])
      );
    await interaction.reply({ embeds: [embed], components: [row], ephemeral: false });
  },
};
