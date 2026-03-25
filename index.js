const { Client, Collection, ActionRowBuilder, ActivityType, ButtonBuilder, EmbedBuilder, ButtonStyle, GatewayIntentBits, Partials, Colors, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const discordTranscripts = require('discord-html-transcripts');
const fs = require('fs');
const mysql = require('mysql2');
const config = require('./config.json');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: config.database_config.connection_limit,
  queueLimit: config.database_config.queue_limit
});

pool.query(`
  CREATE TABLE IF NOT EXISTS \`orders\` (
    \`id\` int(11) NOT NULL AUTO_INCREMENT,
    \`order_number\` int(11) NOT NULL,
    PRIMARY KEY (\`id\`)
  )
`, (err) => {
  if (err) console.error('Failed to create orders table:', err);
});

pool.query(`
  CREATE TABLE IF NOT EXISTS \`suggestions\` (
    \`message_id\` VARCHAR(20) NOT NULL,
    \`suggestion\` TEXT NOT NULL,
    \`upvotes\` TEXT NOT NULL DEFAULT '[]',
    \`downvotes\` TEXT NOT NULL DEFAULT '[]',
    PRIMARY KEY (\`message_id\`)
  )
`, (err) => {
  if (err) console.error('Failed to create suggestions table:', err);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildInvites
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction
  ]
});

client.config = config;
client.db = pool.promise();
client.commands = new Collection();

const commandFiles = fs.readdirSync('./commands/').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.data.name, command);
}

function updateActivityAndPresence() {
  client.user.setActivity(client.config.mainConfig.botStatus, { type: ActivityType[client.config.mainConfig.botPresence] });
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
    console.error('Failed to send transcript to user:', error);
  }
}

async function handleCloseTicketButton(interaction, client) {
  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild;
  const channel = interaction.channel;
  const validPrefixes = ['inquiry-', 'purchase-', 'support-'];
  const isTicketChannel = validPrefixes.some(prefix => channel.name.startsWith(prefix));

  if (!isTicketChannel) {
    return interaction.editReply({ content: 'This button can only be used in ticket channels.', ephemeral: true });
  }

  const allowedRoles = client.config.command_center.allowed_ticket_roles;
  const hasPermission = interaction.member.roles.cache.some(role => allowedRoles.includes(role.id));

  if (!hasPermission) {
    return interaction.editReply({ content: 'You do not have permission to use this button.', ephemeral: true });
  }

  const user = guild.members.cache.get(channel.topic);
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
      const targetChannel = guild.channels.cache.get(targetChannelID);
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

async function handleClaimTicketButton(interaction, client) {
  const allowedRoles = client.config.command_center.allowed_ticket_roles;
  const hasPermission = interaction.member.roles.cache.some(role => allowedRoles.includes(role.id));

  if (!hasPermission) {
    return interaction.reply({ content: 'This can only be used by a support agent.', ephemeral: true });
  }

  const message = await interaction.message.fetch();

  const closeButton = new ButtonBuilder()
    .setCustomId('close_ticket')
    .setLabel('Close Ticket')
    .setStyle(ButtonStyle.Danger);

  const row = new ActionRowBuilder().addComponents(closeButton);

  await message.edit({ components: [row] });
  await interaction.reply({ content: `<@${interaction.user.id}> has claimed this ticket and will assist you today!` });
}

client.once('ready', async () => {
  console.log(`\x1b[32mBot Online! Logged in as ${client.user.tag}.\x1b[0m`);
  updateActivityAndPresence();
  setInterval(updateActivityAndPresence, 50 * 60 * 1000);

  const commandsData = client.commands.map(command => command.data.toJSON());

  try {
    const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commandsData }
    );
  } catch (error) {
  }
});

client.on('interactionCreate', async interaction => {
  if (interaction.isCommand()) {
    const command = client.commands.get(interaction.commandName);

    if (!command) return;

    try {
      await command.execute(interaction, client);
    } catch (error) {
      console.error(error);
    }
  } else if (interaction.isButton()) {
    try {
      const [rows] = await client.db.query('SELECT * FROM suggestions WHERE message_id = ?', [interaction.message.id]);
      if (!rows.length) return;

      const record = rows[0];
      let upvotes = JSON.parse(record.upvotes);
      let downvotes = JSON.parse(record.downvotes);
      const hasRole = interaction.member.roles.cache.has(client.config.command_center.suggestion_manage_role_id);
      const embed = new EmbedBuilder(interaction.message.embeds[0]);

      switch (interaction.customId) {
        case 'upvote':
          if (upvotes.includes(interaction.user.id)) {
            upvotes = upvotes.filter(id => id !== interaction.user.id);
          } else {
            upvotes.push(interaction.user.id);
            downvotes = downvotes.filter(id => id !== interaction.user.id);
          }
          break;
        case 'downvote':
          if (downvotes.includes(interaction.user.id)) {
            downvotes = downvotes.filter(id => id !== interaction.user.id);
          } else {
            downvotes.push(interaction.user.id);
            upvotes = upvotes.filter(id => id !== interaction.user.id);
          }
          break;
        case 'approve':
          if (!hasRole) {
            await interaction.reply({ content: 'You do not have permission to approve this suggestion.', ephemeral: true });
            return;
          }
          embed.setColor(Colors.Green)
            .spliceFields(0, 1, { name: 'Status', value: 'Approved', inline: false });
          break;
        case 'reject':
          if (!hasRole) {
            await interaction.reply({ content: 'You do not have permission to reject this suggestion.', ephemeral: true });
            return;
          }
          embed.setColor(Colors.Red)
            .spliceFields(0, 1, { name: 'Status', value: 'Rejected', inline: false });
          break;
        default:
          return;
      }

      if (interaction.customId === 'upvote' || interaction.customId === 'downvote') {
        await client.db.query(
          'UPDATE suggestions SET upvotes = ?, downvotes = ? WHERE message_id = ?',
          [JSON.stringify(upvotes), JSON.stringify(downvotes), interaction.message.id]
        );
      }

      const upvoteCount = upvotes.length;
      const downvoteCount = downvotes.length;
      const totalVotes = upvoteCount + downvoteCount;
      const upvotePercentage = totalVotes ? (upvoteCount / totalVotes) * 100 : 0;
      const downvotePercentage = totalVotes ? (downvoteCount / totalVotes) * 100 : 0;

      embed.spliceFields(1, 1, {
        name: 'Votes',
        value: `👍 ${upvoteCount} upvotes (${upvotePercentage.toFixed(1)}%) • 👎 ${downvoteCount} downvotes (${downvotePercentage.toFixed(1)}%)`,
        inline: true,
      });

      const buttonRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('upvote')
            .setLabel('👍 Upvote')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(interaction.customId === 'approve' || interaction.customId === 'reject'),
          new ButtonBuilder()
            .setCustomId('downvote')
            .setLabel('👎 Downvote')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(interaction.customId === 'approve' || interaction.customId === 'reject'),
          new ButtonBuilder()
            .setCustomId('approve')
            .setLabel('✅ Approve')
            .setStyle(ButtonStyle.Success)
            .setDisabled(interaction.customId === 'approve' || interaction.customId === 'reject'),
          new ButtonBuilder()
            .setCustomId('reject')
            .setLabel('❌ Reject')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(interaction.customId === 'approve' || interaction.customId === 'reject')
        );

      await interaction.message.edit({ embeds: [embed], components: [buttonRow] });
      await interaction.deferUpdate();
    } catch (error) {
      console.error(error);
    }
  }
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isSelectMenu() && interaction.customId === 'ticket-select') {
    const selected = interaction.values[0];
    let modal;

    if (selected === 'purchase_ticket') {
      modal = new ModalBuilder()
        .setCustomId('purchase-ticket-modal')
        .setTitle('Purchase Ticket');

      const purchaseInput = new TextInputBuilder()
        .setCustomId('purchase_input')
        .setLabel('What Would You Like to Purchase?')
        .setStyle(TextInputStyle.Short);

      const foundUsInput = new TextInputBuilder()
        .setCustomId('found_us_input')
        .setLabel('Where Did You Find Us?')
        .setStyle(TextInputStyle.Short);

      modal.addComponents(
        new ActionRowBuilder().addComponents(purchaseInput),
        new ActionRowBuilder().addComponents(foundUsInput)
      );
    } else if (selected === 'support_ticket') {
      modal = new ModalBuilder()
        .setCustomId('support-ticket-modal')
        .setTitle('Support Ticket');

      const supportInput = new TextInputBuilder()
        .setCustomId('support_input')
        .setLabel('What Do You Require Support With?')
        .setStyle(TextInputStyle.Short);

      const foundUsInput = new TextInputBuilder()
        .setCustomId('found_us_input')
        .setLabel('Where Did You Find Us?')
        .setStyle(TextInputStyle.Short);

      modal.addComponents(
        new ActionRowBuilder().addComponents(supportInput),
        new ActionRowBuilder().addComponents(foundUsInput)
      );
    } else if (selected === 'inquiry_ticket') {
      modal = new ModalBuilder()
        .setCustomId('inquiry-ticket-modal')
        .setTitle('Inquiry Ticket');

      const inquiryInput = new TextInputBuilder()
        .setCustomId('inquiry_input')
        .setLabel('What Is Your Inquiry About?')
        .setStyle(TextInputStyle.Short);

      const foundUsInput = new TextInputBuilder()
        .setCustomId('found_us_input')
        .setLabel('Where Did You Find Us?')
        .setStyle(TextInputStyle.Short);

      modal.addComponents(
        new ActionRowBuilder().addComponents(inquiryInput),
        new ActionRowBuilder().addComponents(foundUsInput)
      );
    }

    await interaction.showModal(modal);
  }

  if (interaction.isModalSubmit()) {
    const selected = interaction.customId.split('-')[0];
    const foundUsResponse = interaction.fields.getTextInputValue('found_us_input');
    const purchaseResponse = selected === 'purchase'
      ? interaction.fields.getTextInputValue('purchase_input')
      : null;
    const supportResponse = selected === 'support'
      ? interaction.fields.getTextInputValue('support_input')
      : null;
    const inquiryResponse = selected === 'inquiry'
      ? interaction.fields.getTextInputValue('inquiry_input')
      : null;

    pool.query('INSERT INTO orders (order_number) VALUES (0)', async (error, results) => {
      if (error) {
        console.error('Database error:', error);
        return interaction.reply({ content: 'An error occurred while processing your order.', ephemeral: true });
      }

      const orderId = results.insertId;
      let categoryID = '';

      if (selected === 'purchase') categoryID = client.config.order_config.purchase_category_id;
      else if (selected === 'support') categoryID = client.config.order_config.support_category_id;
      else categoryID = client.config.order_config.inquiry_category_id;

      const guild = client.guilds.cache.get(client.config.server_config.guild_id);
      const ticketChannel = await guild.channels.create({
        name: `${selected}-${interaction.user.username}-${orderId}`,
        type: ChannelType.GuildText,
        topic: `${interaction.user.id}`,
        parent: categoryID,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: interaction.user.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
          },
          ...client.config.command_center.allowed_ticket_roles.map(roleId => ({
            id: roleId,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
          })),
        ],
      });

      const orderEmbed = new EmbedBuilder()
        .setAuthor({
          name: 'Ticket Created! ✅',
          iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
        })
        .setColor(client.config.server_config.embed_colors)
        .setTimestamp()
        .setDescription(`**Ticket Information**\n\n**User:** <@${interaction.user.id}>\n**Where Did You Find Us?**: ${foundUsResponse}${purchaseResponse ? `\n**What Would You Like to Purchase?**: ${purchaseResponse}` : ''}${supportResponse ? `\n**What Do You Require Support With?**: ${supportResponse}` : ''}${inquiryResponse ? `\n**What Is Your Inquiry About?**: ${inquiryResponse}` : ''}`)
        .setFooter({
          text: client.config.server_config.copyright,
          iconURL: client.config.server_config.footer_icon,
        });

      const closeButton = new ButtonBuilder()
        .setCustomId('close_ticket')
        .setLabel('Close Ticket')
        .setStyle(ButtonStyle.Danger);

      const claimButton = new ButtonBuilder()
        .setCustomId('claim_ticket')
        .setLabel('Claim Ticket')
        .setStyle(ButtonStyle.Success);

      const row = new ActionRowBuilder().addComponents(closeButton, claimButton);
      const allowedRoles = client.config.command_center.allowed_ticket_roles;

      ticketChannel.send({ content: `<@${interaction.user.id}> <@&${allowedRoles.join('> <@&')}>`, embeds: [orderEmbed], components: [row] });

      const ticketEmbed = new EmbedBuilder()
        .setTitle('New Ticket Alert! 🎫')
        .addFields(
          { name: 'Ticket Type', value: selected.replace('_', '') },
          { name: 'User', value: `<@${interaction.user.id}>` },
          { name: 'Where Did You Find Us?', value: foundUsResponse },
          ...(purchaseResponse ? [{ name: 'What Would You Like to Purchase?', value: purchaseResponse }] : []),
          ...(supportResponse ? [{ name: 'What Do You Require Support With?', value: supportResponse }] : []),
          ...(inquiryResponse ? [{ name: 'What Is Your Inquiry About?', value: inquiryResponse }] : [])
        )
        .setColor(client.config.server_config.embed_colors);

      const alertChannel = guild.channels.cache.get(client.config.order_config.alert_channel_id);
      alertChannel.send({ embeds: [ticketEmbed] });

      await interaction.reply({ content: `Your ${selected.replace('_', ' ')} ticket has been created: <#${ticketChannel.id}>`, ephemeral: true });
    });
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === 'close_ticket') {
    await handleCloseTicketButton(interaction, client);
  } else if (interaction.customId === 'claim_ticket') {
    await handleClaimTicketButton(interaction, client);
  }
});

client.login(process.env.BOT_TOKEN);
