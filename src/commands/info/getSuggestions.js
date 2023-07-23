const { SlashCommandBuilder } = require('discord.js');
const { StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const Books = require("../../data/models/Books.js");
const { Sequelize } = require('sequelize');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('getsuggestions')
        .setDescription('Provides a list of book suggestions for a month you select.')
        ,

    async execute(interaction) {
        // Grab Months from db
        const monthList = await Books.findAll({
            attributes: [
                [Sequelize.fn('DISTINCT', Sequelize.col('date')), 'date'],
                'month_string'
            ],
            where: {
                guild_id: interaction.guild.id,
            },
            order: [['date', 'DESC']]
        })

        //Build Month dropdwon
        let monthSelect = [];

        if ((monthList) && Object.keys(monthList).length > 0) {
            for (const entry in monthList) {
                monthSelect.push({
                    label: `${monthList[entry].month_string}`,
					value: `${monthList[entry].month_string}//${monthList[entry].date}`
                })
            }
        } else {
            return await interaction.reply ({
                content: "There have been no book suggestions at all! What are you doing? Suggest something!",
                ephemeral: true
            })
        }

        // Choose month from list of months in database
        const monthDrop = new ActionRowBuilder().addComponents(
			new StringSelectMenuBuilder()
			.setCustomId('suggestMonthSelect')
			.setPlaceholder('Select Month')
			.addOptions(monthSelect),
		);

		await interaction.reply({
			content: "",
			components: [monthDrop],
			ephemeral: true
		}); 
    },
};