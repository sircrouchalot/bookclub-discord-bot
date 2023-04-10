const { Sequelize, DataTypes } = require('sequelize');

const sequelize = require(`../config/database.js`);

const Votes = sequelize.define('votes', {
    vote_uid: {
        type: DataTypes.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true
    },
    guild_id: {
        type: DataTypes.STRING,
        allowNull: false
    },
    date: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    month_string: {
        type: DataTypes.STRING,
        allowNull: false
    },
    user: {
        type: DataTypes.STRING,
        allowNull: false
    },
    votes: {
        type: DataTypes.TEXT('medium'),
        allowNull: true,
    }

});

module.exports = Votes;