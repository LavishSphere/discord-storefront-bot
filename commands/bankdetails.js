const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bankdetails')
    .setDescription('Display payment details'),

  async execute(interaction, client) {
    const allowedRoles = client.config["command_center"].allowed_ticket_roles;
    const hasPermission = interaction.member.roles.cache.some(role => allowedRoles.includes(role.id));

    if (!hasPermission) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }

    const payment = client.config["payment_config"];
    const { bank, paypal } = payment;

    const embed = new EmbedBuilder()
      .setColor(client.config["server_config"].accent_color)
      .setTitle(payment.header)
      .addFields(
        { name: 'Name on Card', value: bank.name_on_card, inline: false },
        { name: bank.routing_label, value: bank.routing_number, inline: true },
        { name: 'Account Number', value: bank.account_number, inline: true },
        { name: '\u200b', value: '**Or Alternatively**', inline: false },
        { name: 'PayPal', value: `[Click here to pay](${paypal.link})\n${paypal.link}`, inline: false }
      );

    if (paypal.qr_enabled && paypal.qr_image_url) {
      embed.setImage(paypal.qr_image_url);
    }

    await interaction.reply({ embeds: [embed] });
  }
};
