const { Sequelize, DataTypes } = require('sequelize');

const sequelize = require("../config/database_dev.js");

const Books = sequelize.define('books', {
    guild_id: {
        type: DataTypes.STRING,
        allowNull: false
    },
    month: {
		  type: DataTypes.DATEONLY,
		  allowNull: false
	  },
    title: {
		  type: DataTypes.STRING,
		  allowNull: false
	  },
    author: {
		  type: DataTypes.STRING,
		  allowNull: false
	  },
    pages: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    grUrl: DataTypes.STRING,
    submitted_by: {
		  type: DataTypes.STRING,
		  allowNull: false
	  },
    chosen: {
		  type: DataTypes.BOOLEAN,
		  allowNull: false,
      defaultValue: false
	}

});

module.exports = Books;