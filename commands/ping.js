const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong and shows the bot latency'),

  async execute(interaction) {
    const ping = Date.now() - interaction.createdTimestamp;
    await interaction.reply(`Pong! Latency is ${ping}ms. API Latency is ${Math.round(interaction.client.ws.ping)}ms`);
  }
};