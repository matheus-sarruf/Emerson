const sequelize = require('../config/database');
const Admin = require('./Admin');
const Student = require('./Student');

module.exports = { sequelize, Admin, Student };