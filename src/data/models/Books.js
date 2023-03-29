const { Sequelize, DataTypes } = require('sequelize');

const sequelize = require(`../config/database.js`);

const Books = sequelize.define('books', {
    book_uid: {
      type: DataTypes.UUID,
      defaultValue: Sequelize.UUIDV4,
      allowNull: false,
      primaryKey: true
    },
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
    botm_flag: {
		  type: DataTypes.BOOLEAN,
		  allowNull: false,
      defaultValue: false
	}

});

module.exports = Books;