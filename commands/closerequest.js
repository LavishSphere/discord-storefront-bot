const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, SlashCommandBuilder, ButtonStyle } = require('discord.js');
const discordTranscripts = require('discord-html-transcripts');

async function logToChannel(channel, title, description, fields, transcriptAttachment = null) {
  const embed = new EmbedBuilder()
    .setColor(client.config.server_config.success_color)
    .setTitle(title)
    .setDescription(description)
    .addFields(fields)
    .setTimestamp();

  await channel.send({ embeds: [embed], files: transcriptAttachment ? [transcriptAttachment] : [] });
}

async function sendTranscriptToUser(user, transcriptAttachment, guild, interaction, formattedTimestamp) {
  try {
    const embed = new EmbedBuilder()
      .setColor(client.config.server_config.success_color)
      .setTitle('Ticket Closed')
      .setAuthor({ name: guild.name, iconURL: guild.iconURL() })
      .setDescription('Please consider leaving a review in our vouch channel using /review of our services!')
      .addFields(
        { name: 'Opened By', value: `<@${interaction.channel.topic}>`, inline: true },
        { name: 'Closed By', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'Opened On', value: formattedTimestamp, inline: true }
      )
      .setTimestamp();
    await user.send({ embeds: [embed], files: [transcriptAttachment] });
  } catch (error) {
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('closerequest')
    .setDescription('Request to close the current ticket channel')
    .addIntegerOption(option =>
      option.setName('time')
        .setDescription('Time before the ticket auto-closes (in hours)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for closing the ticket')
        .setRequired(true)),
  async execute(interaction, client) {
    const time = interaction.options.getInteger('time');
    const reason = interaction.options.getString('reason');
    const channel = interaction.channel;
    const guild = interaction.guild;

    guild.members.fetch();

    const user = interaction.guild.members.cache.get(channel.topic);
    const autoCloseTimestamp = Math.floor(Date.now() / 1000) + (time * 3600);

    if (!user) {
      return interaction.reply({ content: 'Error: User not found.', ephemeral: true });
    }

    const validPrefixes = ['inquiry-', 'purchase-', 'support-'];
    const isTicketChannel = validPrefixes.some(prefix => channel.name.startsWith(prefix));

    if (!isTicketChannel) {
      return interaction.editReply({ content: 'This command can only be used in ticket channels.', ephemeral: true });
    }

    const allowedRoles = client.config.command_center.allowed_ticket_roles;
    const hasPermission = interaction.member.roles.cache.some(role => allowedRoles.includes(role.id));

    if (!hasPermission) {
      return interaction.editReply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }

    const closeEmbed = new EmbedBuilder()
      .setColor(client.config.server_config.warning_color)
      .setTitle('Close Request')
      .setDescription(`A request to close this ticket has been made.\n\n**Reason:** ${reason}\n**Auto-close** <t:${autoCloseTimestamp}:R>`)
      .setTimestamp();

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('acceptClose')
          .setLabel('Accept')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('denyClose')
          .setLabel('Deny')
          .setStyle(ButtonStyle.Danger)
      );

    await interaction.reply({ embeds: [closeEmbed], components: [row] });

    const filter = i => i.customId === 'acceptClose' || i.customId === 'denyClose';
    const collector = channel.createMessageComponentCollector({ filter, time: time * 3600000 });

    collector.on('collect', async i => {
      if (i.customId === 'acceptClose') {
        collector.stop('accepted');
      } else if (i.customId === 'denyClose') {
        collector.stop('denied');
      }
    });

    collector.on('end', async (_, reasonEnd) => {
      const targetChannelID = client.config.order_config.transcript_log_channel_id;
      const targetChannel = guild.channels.cache.get(targetChannelID);

      const firstMessage = await channel.messages.fetch({ limit: 1 });
      const firstMessageTimestamp = firstMessage.first()?.createdTimestamp || Date.now();
      const formattedTimestamp = `<t:${Math.floor(firstMessageTimestamp / 1000)}:F>`;

      const transcriptAttachment = await discordTranscripts.createTranscript(channel);

      if (reasonEnd === 'accepted') {
        await sendTranscriptToUser(user, transcriptAttachment, guild, interaction, formattedTimestamp);
        await logToChannel(
          targetChannel,
          'Ticket Closed',
          `Ticket closed in ${channel.name}`,
          [
            { name: 'Opened By', value: `<@${channel.topic}>`, inline: true },
            { name: 'Closed By', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'Opened On', value: formattedTimestamp, inline: true }
          ],
          transcriptAttachment
        );

        const closedEmbed = new EmbedBuilder()
          .setColor(client.config.server_config.success_color)
          .setTitle('Ticket Closed')
          .setDescription(`Ticket has been closed by <@${interaction.user.id}>.`)
          .setTimestamp();

        await channel.send({ embeds: [closedEmbed], files: [transcriptAttachment] });
        await channel.delete();
      } else if (reasonEnd === 'denied') {
        await interaction.followUp({ content: 'The close request has been denied.', ephemeral: false });
      } else {
        await logToChannel(
          targetChannel,
          'Ticket Auto-Closed',
          `Ticket auto-closed in ${channel.name}`,
          [
            { name: 'Opened By', value: `<@${channel.topic}>`, inline: true },
            { name: 'Closed By', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'Opened On', value: formattedTimestamp, inline: true }
          ],
          transcriptAttachment
        );

        const autoClosedEmbed = new EmbedBuilder()
          .setColor(client.config.server_config.success_color)
          .setTitle('Ticket Auto-Closed')
          .setDescription(`Ticket has been auto-closed after ${time} hour(s).`)
          .setTimestamp();

        await channel.send({ embeds: [autoClosedEmbed], files: [transcriptAttachment] });
        await channel.delete();
        await sendTranscriptToUser(user, transcriptAttachment, guild, interaction, formattedTimestamp);
      }
    });
  },
};
