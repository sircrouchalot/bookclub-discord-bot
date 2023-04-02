const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('genre')
		.setDescription('Provides information about the current genre.')
		.setDMPermission(false),
	async execute(interaction) {
		// interaction.guild is the object representing the Guild in which the command was run
		await interaction.reply({
			content: `This month's genre has not been set.`,
			ephemeral: true
		});
	},
};