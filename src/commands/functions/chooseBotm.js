const { SlashCommandBuilder } = require('discord.js');
const { StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const Books = require("../../data/models/Books.js");
const { QueryTypes} = require('sequelize');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('choosebotm')
        .setDescription('Admin can choose the book of the month')
        .setDefaultMemberPermissions(0)
        .setDMPermission(false),
    async execute(interaction) {
        // Get all dates in Books that do not have entries in Botms
        const dates = await Books.sequelize.query("SELECT DISTINCT books.date, books.month_string FROM bookclub_database.books books WHERE books.date not in (SELECT botms.date FROM bookclub_database.botms botms) ORDER BY date DESC", {type: QueryTypes.SELECT});

        let stringSelect = [];

        if ((dates) && dates.length > 0) {
            for (const entry in dates) {
                stringSelect.push({
                    label: `${dates[entry].month_string}`,
                    value: `${dates[entry].month_string}`
                })

            };
        }
            
        // Choose Month from list of months in database
        const select = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('monthSelect')
                .setPlaceholder('Select Month')
                .addOptions(stringSelect),
        );
        await interaction.reply({
            content: "",
            components: [select],
            ephemeral: true
        });
        
    }
}