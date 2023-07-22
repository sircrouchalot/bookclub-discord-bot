const { SlashCommandBuilder } = require('discord.js');
const { StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const Botms = require("../../data/models/Botms.js");

module.exports = {
	data: new SlashCommandBuilder()
		.setName('getbotm')
		.setDescription('Provides information about the current book of the month.')
		.setDMPermission(false)
		// .addStringOption(option =>
		// 	option.setName('month')
		// 		.setDescription('Type in which month you need the book for (mm/yyyy).')
		// ),
		,
	async execute(interaction) {
		// Grab Months from db
		const monthList = await Botms.findAll({
			attributes: ['month_string', 'date'],
			where: {
				guild_id: interaction.guild.id,
				
			},
			order: [['date', 'DESC']]
		})

		let monthSelect = [];

		if ((monthList) && Object.keys(monthList).length > 0) {
			for (const entry in monthList) {
				monthSelect.push({
					label: `${monthList[entry].month_string}`,
					value: `${monthList[entry].month_string}//${monthList[entry].date}`
				})
			}
		} else {
			return await interaction.reply({
				content: "There are no Books chosen. Please vote and select a Book of the Month and try again.",
				ephemeral: true
			})
		}

		// Choose month from list of months in database
		const monthDrop = new ActionRowBuilder().addComponents(
			new StringSelectMenuBuilder()
			.setCustomId('botmMonthSelect')
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