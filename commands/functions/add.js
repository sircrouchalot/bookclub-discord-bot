const { SlashCommandBuilder } = require('discord.js');
const { ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('add')
        .setDescription('Brings up dialog box to input the Book of the Month'),
    async execute(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('addBookModal')
            .setTitle('Add Book Selection');

        // Add components of Modal

        // Create the text input components
        const monthInput = new TextInputBuilder()
            .setCustomId('monthInput')
            .setRequired(true)
            .setLabel('Which Month is this book for?')
            .setStyle(TextInputStyle.Short);

        const titleInput = new TextInputBuilder()
            .setCustomId('titleInput')
            .setRequired(true)
            .setLabel('Book Title:')
            .setStyle(TextInputStyle.Short);

        const authorInput = new TextInputBuilder()
            .setCustomId('authorInput')
            .setRequired(true)
            .setLabel('Author:')
            .setStyle(TextInputStyle.Short);

        const pageCount = new TextInputBuilder()
            .setCustomId('pageInput')
            .setRequired(true)
            .setLabel('# of Pages')
            .setStyle(TextInputStyle.Short);

        const goodreadsInput = new TextInputBuilder()
            .setCustomId('grInput')
            .setRequired(true)
            .setLabel('Goodreads URL')
            .setStyle(TextInputStyle.Short);

        // Action Rows
        const monthActionRow = new ActionRowBuilder().addComponents(monthInput);
        const titleActionRow = new ActionRowBuilder().addComponents(titleInput);
        const authorActionRow = new ActionRowBuilder().addComponents(authorInput);
        const pageCountActionRow = new ActionRowBuilder().addComponents(pageCount);
        const goodreadsActionRow = new ActionRowBuilder().addComponents(goodreadsInput);

        // Add Inputs to Modal
        modal.addComponents(monthActionRow, titleActionRow, authorActionRow, pageCountActionRow, goodreadsActionRow);

        interaction.showModal(modal);
    }

}

