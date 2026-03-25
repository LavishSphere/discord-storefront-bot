const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Shows the help command with all available commands'),
  async execute(interaction, client) {
    const commandsPath = client.config.paths_config.commands_path;
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    const commands = [];

    for (const file of commandFiles) {
      const command = require(`${commandsPath}/${file}`);
      if (command.data && command.data.name && command.data.description) {
        commands.push({
          name: command.data.name,
          description: command.data.description
        });
      }
    }

    const helpEmbed = new EmbedBuilder()
      .setAuthor({
        name: `Help Command for ${client.user.tag}!`,
        iconURL: interaction.user.displayAvatarURL({ dynamic: true })
      })
      .setColor(client.config.server_config.embed_colors)
      .setFooter({
        text: client.config.server_config.copyright,
        iconURL: client.config.server_config.server_icon
      });

    commands.forEach(command => {
      helpEmbed.addFields({
        name: `**\`${command.name}\`**`,
        value: command.description,
        inline: true
      });
    });

    await interaction.reply({ embeds: [helpEmbed] });
  }
};
