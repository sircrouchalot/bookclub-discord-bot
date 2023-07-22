const { DataTypes } = require('sequelize');

const sequelize = require(`../config/database.js`);

const Channels = sequelize.define('channels', {
    channel_id: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true
    },
    guild_id: {
        type: DataTypes.STRING,
        allowNull: false
    },
    channel_name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    channel_type: {
        type: DataTypes.STRING,
        allowNull: false
    },
    botm_channel_flag: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    }
});

module.exports = Channels;