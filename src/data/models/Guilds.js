const { Sequelize, DataTypes } = require('sequelize');

const sequelize = require("../config/database_dev.js");

const Guilds = sequelize.define('guilds', {
    guild_id: {
		  type: DataTypes.STRING,
		  allowNull: false,
          primaryKey: true
	},
    guild_name: {
		  type: DataTypes.STRING,
		  allowNull: false
	}
}); 

module.exports = Guilds;