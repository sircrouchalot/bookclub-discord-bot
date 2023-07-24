const { SlashCommandBuilder } = require('discord.js');
const { StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const Botms = require("../../data/models/Botms");
const { Sequelize } = require('sequelize');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rate')
        .setDescription('Rate the chosen Book of the Month!')
        .setDMPermission(false),
    async execute(interaction) {

        // Get all dates for votes in Votes table
        const dates = await Botms.findAll({
            attributes: [
                [Sequelize.fn('DISTINCT', Sequelize.col('date')), 'date'],
                'month_string'
            ],
            where: {
                guild_id: interaction.guild.id,
            },
            order: [['date', 'DESC']]
        });

        let stringSelect = [];

        if ((dates) && Object.keys(dates).length > 0) {
            for (const entry in dates) {
                stringSelect.push({
                    label: `${dates[entry].month_string}`,
                    value: `${dates[entry].month_string}//${dates[entry].date}`
                })

            };
        } else {
            // return await interaction.reply({
            //     content: "There was an error. Not sure what happened. If it keeps happening, let Alex know.",
            //     ephemeral: true
            // })
        }

        // Choose Month from list of months in database
        const monthSelect = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('rateMonthSelect')
                .setPlaceholder('Select Month')
                .addOptions(stringSelect),
        );

        await interaction.reply({
            content: "",
            components: [monthSelect],
            ephemeral: true
        });
    }
}