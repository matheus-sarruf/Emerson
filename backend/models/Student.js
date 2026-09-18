const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Student = sequelize.define('Student', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  yearClass: { type: DataTypes.ENUM('1ano','2ano','3ano','4ano'), allowNull: false },
  image: { type: DataTypes.STRING, allowNull: true },
  deletedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: 'students',
  timestamps: true,
  paranoid: true, // Habilita soft delete (deletedAt)
});

module.exports = Student;