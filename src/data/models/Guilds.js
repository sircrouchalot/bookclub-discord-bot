const { DataTypes } = require('sequelize');

const sequelize = require(`../config/database.js`);

const Guilds = sequelize.define('guilds', {
    guild_id: {
		  type: DataTypes.STRING,
		  allowNull: false,
          primaryKey: true
	},
    guild_name: {
		  type: DataTypes.STRING,
		  allowNull: false
	},
	guild_owner: {
		type: DataTypes.STRING,
		allowNull: false
	},
	num_members: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	guild_locale: {
		type: DataTypes.STRING,
		allowNull: false
	}
}); 

module.exports = Guilds;