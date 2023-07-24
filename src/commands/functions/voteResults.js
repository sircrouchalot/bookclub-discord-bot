const { SlashCommandBuilder } = require('discord.js');
const { StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const Votes = require("../../data/models/Votes.js");
const { Sequelize } = require('sequelize');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('voteresults')
        .setDescription('Use this command to see the results of the voting for each month')
        .setDefaultMemberPermissions(0)
        .setDMPermission(false),
    async execute(interaction) {
        // Get all dates for votes in Votes table
        const dates = await Votes.findAll({
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
        const select = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('resultsMonthSelect')
                .setPlaceholder('Select Month')
                .addOptions(stringSelect),
        );
        
        try {
            await interaction.reply({
                content: "",
                components: [select],
                ephemeral: true
            });
        } catch(e) {
            await interaction.reply({
                content: "No one has voted for anything!",
                ephemeral: true
            })
        }
    }
}