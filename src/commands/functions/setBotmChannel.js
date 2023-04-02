const { SlashCommandBuilder } = require('discord.js');
const { StringSelectMenuBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setbotmchannel')
        .setDescription('Admin can set the channel where Book of the Month announcements are made')
        .setDefaultMemberPermissions(0)
        .setDMPermission(false),
    async execute(interaction) {

        const channelList = interaction.guild.channels.cache
            .filter((ch) => ch.type === 0);
        
        if (channelList) {
        
            let channelNames = [];
            channelList.forEach((entry) => {

                channelNames.push( {
                    label: `${entry.name}`,
                    value: `${entry.id}`
                })
            });

            const channelDrop = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('botmChannelSelect')
                    .setPlaceholder('Select Channel')
                    .addOptions(channelNames),
            );
            await interaction.reply({
                content: "",
                components: [channelDrop],
                ephemeral: true
            });
        }
    }
}