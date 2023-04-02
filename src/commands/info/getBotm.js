const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('getbotm')
		.setDescription('Provides information about the current book of the month.')
		.setDMPermission(false),
		// .addStringOption(option =>
		// 	option.setName('month')
		// 		.setDescription('Type in which month you need the book for (mm/yyyy).')
		// ),
	
	async execute(interaction) {
		
		// Choose month from list of months in database

		// Get Book from Botm table for that month and reply in a message
		
		// interaction.guild is the object representing the Guild in which the command was run
		await interaction.reply({
			content: `${month}'s book has not been set.`,
			ephemeral: true
		});
	},
};