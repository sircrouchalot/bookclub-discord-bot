const { SlashCommandBuilder } = require('discord.js');
const { StringSelectMenuBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const Books = require("../../data/models/Books.js");
const sequelize = require('sequelize');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('choosebotm')
        .setDescription('Admin can choose the book of the month'),
    async execute(interaction) {
        // Get List of Months from database
        const dates = await Books.findAll({
            attributes: [
                [sequelize.fn('DISTINCT', sequelize.col('month')), 'month']
            ],
            order: [
                ['month', 'DESC']
            ]
        });

        if (dates) {
            let stringSelect = [];

            for (const entry in dates) {
                const date = new Date(dates[entry].month);
                const month = ("0" + (date.getMonth() + 2)).slice(-2);
                const year = date.getFullYear();
                stringSelect.push({
                    label: `${month}/${year}`,
                    value: `${month}/${year}`
                })
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
}