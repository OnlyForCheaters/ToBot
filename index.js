const { Client, GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder } = require('discord.js');
const moment = require('moment-timezone');
require('dotenv').config();  // Add this line to load .env variables

// Change from UTC to UTC+3
const turkeyNow = moment().tz("Europe/Istanbul").format('YYYY-MM-DD HH:mm:ss');

// Your bot token
const TOKEN = process.env.DISCORD_TOKEN;  // Use the token from .env file

// Channel ID where the ticket setup message should be sent
const TICKET_CHANNEL_ID = '1251544814323896401';
// Channel ID where the last message should be deleted and new message sent
const DELETE_MESSAGE_CHANNEL_ID = '1247056515362455634';

// Role ID that should also see the tickets
const SPECIFIC_ROLE_ID = '1251640239039053946';

// Create an instance of the bot with the specified intents
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMessageReactions],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// Define the initial view for setting up ticket
const createSetupTicketView = () => {
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('create_ticket')
        .setLabel('Ticket Oluştur')
        .setStyle(ButtonStyle.Primary)
    );
  return row;
};

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag} (ID: ${client.user.id})`);
  console.log("Deleting last message from channel and sending new ticket setup message...");

  // Delete the last message from the specified channel
  const channel = client.channels.cache.get(DELETE_MESSAGE_CHANNEL_ID);
  if (channel) {
    try {
      const messages = await channel.messages.fetch({ limit: 1 });
      if (messages.size > 0) {
        await messages.first().delete();
        console.log("Last message deleted successfully.");
      }
    } catch (e) {
      console.log(`Error deleting last message: ${e}`);
    }

    // Send a new ticket setup message to the specified channel
    const setupView = createSetupTicketView();
    const newMessage = await channel.send({ content: "Yetkili Başvurunuz İçin Tıklayınız!", components: [setupView] });
  } else {
    console.log(`Error: Channel (${DELETE_MESSAGE_CHANNEL_ID}) not found.`);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  if (interaction.customId === 'create_ticket') {
    const guild = interaction.guild;
    let category = guild.channels.cache.find(c => c.name === "Tickets" && c.type === 4); // 4 represents 'GUILD_CATEGORY'
    if (!category) {
      category = await guild.channels.create({ name: 'Tickets', type: 4 });
    }

    const specificRole = guild.roles.cache.get(SPECIFIC_ROLE_ID);

    const channel = await guild.channels.create({
      name: `ticket-${interaction.user.username}`,
      parent: category.id,
      permissionOverwrites: [
        {
          id: guild.id,
          deny: ['ViewChannel'],
        },
        {
          id: interaction.user.id,
          allow: ['ViewChannel', 'SendMessages'],
        },
        {
          id: client.user.id,
          allow: ['ViewChannel', 'SendMessages'],
        },
        {
          id: specificRole.id,
          allow: ['ViewChannel', 'SendMessages'],
        },
      ],
    });

    const ticketView = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('quiz_answer_button')
          .setLabel('Başvuru Butonu')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('delete_button')
          .setLabel('Ticket Sil')
          .setStyle(ButtonStyle.Danger)
      );

    await interaction.reply({ content: `Ticket oluşturuldu: ${channel}`, ephemeral: true });
    await channel.send({ content: `${interaction.user} Yetkili Başvurunuz İçin Aşağıdaki Butona`, components: [ticketView] });
  } else if (interaction.customId === 'quiz_answer_button') {
    const questions = [
      "Adınız?",
      "Aktif Olucakmısın??",
      "Yaşınız kaç?",
      "Daha Önceki Deneyimleriniz Nelerdir?",
      "E-posta Adresiniz?"
    ];

    const modal = new ModalBuilder()
      .setCustomId('quiz_answer_modal')
      .setTitle('Başvuru Formu')
      .addComponents(
        questions.map((question, i) => (
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId(`input_${i}`)
              .setLabel(question)
              .setStyle(TextInputStyle.Short)
          )
        ))
      );

    await interaction.showModal(modal);
  } else if (interaction.customId === 'delete_button') {
    await interaction.reply({ content: 'Ticket Silindi!', ephemeral: true });
    await interaction.channel.delete();
  } else if (interaction.isModalSubmit() && interaction.customId === 'quiz_answer_modal') {
    const answers = {};
    for (let i = 0; i < interaction.fields.components.length; i++) {
      answers[interaction.fields.components[i].components[0].label] = interaction.fields.getTextInputValue(`input_${i}`);
    }
    const userInfo = {
      name: interaction.user.username,
      id: interaction.user.id,
      date: turkeyNow
    };

    console.log(`Answers received:\n${JSON.stringify(answers, null, 2)}`);

    const embed = new EmbedBuilder()
      .setDescription(
        `**Name of User:** ${userInfo.name}\n` +
        `**ID of User:** ${userInfo.id}\n` +
        `**Date:** ${userInfo.date}\n\n` +
        `**Answers:**\n` +
        Object.entries(answers).map(([question, answer]) => `**${question}:** ${answer}`).join('\n')
      )
      .setColor('BLUE');

    const ticketChannel = interaction.guild.channels.cache.get(TICKET_CHANNEL_ID);
    if (ticketChannel) {
      await ticketChannel.send({ embeds: [embed] });
    } else {
      console.log(`Error: Ticket channel (${TICKET_CHANNEL_ID}) not found.`);
    }

    await interaction.reply({ content: 'Cevaplar alındı ve işlendi!', ephemeral: true });
  }
});

client.login(TOKEN);
