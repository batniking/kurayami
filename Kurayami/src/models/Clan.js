const { DataTypes } = require('sequelize');
const { sequelize } = require('../database');

const Clan = sequelize.define('Clan', {
    name: { type: DataTypes.STRING, unique: true, allowNull: false },
    description: { type: DataTypes.TEXT, defaultValue: '' },
    ownerId: { type: DataTypes.STRING, allowNull: false },
    level: { type: DataTypes.INTEGER, defaultValue: 1 },
    exp: { type: DataTypes.INTEGER, defaultValue: 0 },
    members: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
    maxMembers: { type: DataTypes.INTEGER, defaultValue: 10 },
    icon: { type: DataTypes.STRING, defaultValue: '⚔️' },
    gold: { type: DataTypes.INTEGER, defaultValue: 0 },
    building: { type: DataTypes.JSONB, defaultValue: { treasury: 1, barracks: 1, forge: 1 } },
    quests: { type: DataTypes.JSONB, defaultValue: [] },
});

module.exports = Clan;
