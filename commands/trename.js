const { SlashCommandBuilder } = require('discord.js');

const cooldowns = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('trename')
    .setDescription('Rename the ticket channel')
    .addStringOption(option =>
      option.setName('name').setDescription('New name for the ticket channel').setRequired(true)),
  async execute(interaction, client) {
    try {
      const allowedRoles = client.config.command_centre.allowed_ticket_roles;
      const hasPermission = interaction.member.roles.cache.some(role => allowedRoles.includes(role.id));

      if (!hasPermission) {
        return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
      }

      const newName = interaction.options.getString('name');
      const channel = await client.channels.fetch(interaction.channelId);

      const now = Date.now();
      const cooldownAmount = 5 * 60 * 1000;

      if (cooldowns.has(channel.id)) {
        const expirationTime = cooldowns.get(channel.id) + cooldownAmount;

        if (now < expirationTime) {
          const timeLeft = (expirationTime - now) / 1000;
          return interaction.reply({ content: `This channel was renamed recently. Please wait ${timeLeft.toFixed(1)} more seconds before trying again.`, ephemeral: true });
        }
      }

      await channel.edit({ name: newName });

      cooldowns.set(channel.id, now);

      await interaction.reply({ content: `Successfully renamed the channel to ${newName}.`, ephemeral: true });

    } catch (error) {
      console.error('Error executing command:', error);
      await interaction.reply({ content: 'There was an error executing the command.', ephemeral: true });
    }
  },
};
