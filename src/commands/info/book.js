const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('book')
		.setDescription('Provides information about the current book.')
		.addStringOption(option =>
			option.setName('month')
				.setDescription('Type in which month you need the book for.')),
	async execute(interaction) {
		const month = interaction.options.getString('month');
		// interaction.guild is the object representing the Guild in which the command was run
		await interaction.reply({
			content: `${month}'s book has not been set.`,
			ephemeral: true
		});
	},
};