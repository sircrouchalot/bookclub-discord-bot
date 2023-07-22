const { DataTypes } = require('sequelize');

const sequelize = require(`../config/database.js`);

const ChannelRef = sequelize.define('channel_ref', {
    channel_type_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
    },
    channel_type_string: {
        type: DataTypes.STRING,
        allowNull: false,
    }
});

module.exports = ChannelRef;