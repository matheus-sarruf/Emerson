const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcryptjs');

const Admin = sequelize.define('Admin', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  password: { type: DataTypes.STRING(255), allowNull: false },
  profileImage: { type: DataTypes.STRING, allowNull: true },
}, {
  tableName: 'admins',
  timestamps: true,
});

// Hook para hash da senha antes de criar/atualizar
Admin.beforeCreate(async (admin) => {
  admin.password = await bcrypt.hash(admin.password, 10);
});
Admin.beforeUpdate(async (admin) => {
  if (admin.changed('password')) {
    admin.password = await bcrypt.hash(admin.password, 10);
  }
});

// Método para verificar senha
Admin.prototype.comparePassword = async function(password) {
  return bcrypt.compare(password, this.password);
};

module.exports = Admin;