const { DataTypes } = require('sequelize');

const sequelize = require(`../config/database.js`);

const Botm = sequelize.define('botm', {
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

module.exports = Botm;