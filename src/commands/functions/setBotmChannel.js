const { SlashCommandBuilder } = require('discord.js');
const { StringSelectMenuBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const Channels = require("../../data/models/Channels");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setbotmchannel')
        .setDescription('Admin can set the channel where Book of the Month announcements are made')
        .setDefaultMemberPermissions(0)
        .setDMPermission(false),
    async execute(interaction) {

        const channelList = await Channels.findAll({
            where: {
                guild_id: interaction.guild.id,
                channel_type: 0
            }
        })
        
        if (channelList) {
        
            let channelNames = [];
            channelList.forEach((entry) => {

                channelNames.push( {
                    label: `${entry.channel_name}`,
                    value: `${entry.channel_id}`
                })
            });

            console.log(channelNames);

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