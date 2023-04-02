const { SlashCommandBuilder } = require('discord.js');
const { StringSelectMenuBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');


module.exports = {
    data: new SlashCommandBuilder()
        .setName('rate')
        .setDescription('Rate the chosen Book of the Month!')
        .setDMPermission(false),
    async execute(interaction) {

        //TODO: Confirm Month

        //TODO: Grab all books for selected month

        const bookInput = new StringSelectMenuBuilder()
            .setCustomId('botmInput')
            .setRequired(true)
            .setLabel(`Select which book`)
            .addOptions (
                {
                    //TODO: Add options
                }
            )
    }
}