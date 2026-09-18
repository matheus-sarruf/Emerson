const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const LoginAttempt = sequelize.define('LoginAttempt', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  blockedUntil: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'LoginAttempts',
  timestamps: true
});

module.exports = LoginAttempt;