const { DataTypes } = require('sequelize');

const sequelize = require(`../config/database.js`);

const Botms = sequelize.define('botms', {
    book_uid: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey:true
    },
    guild_id: {
      type: DataTypes.STRING,
      allowNull: false
    },
    month: {
		  type: DataTypes.STRING,
		  allowNull: false,
      unique: true
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
    grUrl: {
      type: DataTypes.STRING
    },
    submitted_by: {
	    type: DataTypes.STRING,
	    allowNull: false
	  },
    avg_rating: {
	    type: DataTypes.FLOAT,
		  allowNull: true,
      defaultValue: 0
	}
});

module.exports = Botms;