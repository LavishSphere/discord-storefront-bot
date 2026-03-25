const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const discordTranscripts = require('discord-html-transcripts');

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
  } catch (e) {
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tclose')
    .setDescription('Close the current ticket channel'),
  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild;
    const channel = interaction.channel;
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

    if (channel.parentId !== client.config.order_config.purchase_category_id) {
      await channel.setParent(client.config.order_config.purchase_category_id);
    }

    await guild.members.fetch();

    const user = interaction.guild.members.cache.get(channel.topic);
    const transcriptAttachment = await discordTranscripts.createTranscript(channel);

    const confirmationEmbed = new EmbedBuilder()
      .setAuthor({ name: 'Ticket Closing', iconURL: client.user.displayAvatarURL() })
      .setColor(client.config.server_config.embed_colors)
      .setDescription('This ticket channel will be deleted in 5 seconds.')
      .setFooter({ text: client.config.server_config.copyright, iconURL: client.config.server_config.server_icon });

    try {
      const firstMessage = await channel.messages.fetch({ limit: 1 });
      const firstMessageTimestamp = firstMessage.first()?.createdTimestamp || Date.now();
      const formattedTimestamp = `<t:${Math.floor(firstMessageTimestamp / 1000)}:F>`;

      const targetChannelID = client.config.order_config.transcript_log_channel_id;
      if (targetChannelID) {
        const targetChannel = interaction.guild.channels.cache.get(targetChannelID);
        if (targetChannel) {
          const embed = new EmbedBuilder()
            .setColor(client.config.server_config.success_color)
            .setTitle('Ticket Closed')
            .setDescription(`Ticket closed in ${channel.name}`)
            .addFields(
              { name: 'Opened By', value: `<@${channel.topic}>`, inline: true },
              { name: 'Closed By', value: `<@${interaction.user.id}>`, inline: true },
              { name: 'Opened On', value: formattedTimestamp, inline: true }
            )
            .setTimestamp();
          await targetChannel.send({ embeds: [embed], files: [transcriptAttachment] });
        }
      }

      await interaction.editReply({ embeds: [confirmationEmbed] });

      setTimeout(() => {
        channel.delete().catch(err => console.error('Failed to delete the channel:', err));
      }, 5000);

      await sendTranscriptToUser(user, transcriptAttachment, guild, interaction, formattedTimestamp);

    } catch (error) {
      interaction.editReply('An error occurred while closing the ticket. Please make sure I have ADMINISTRATOR permissions and I made this ticket channel!');
    }
  }
};
