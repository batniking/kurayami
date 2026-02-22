const { DataTypes } = require('sequelize');
const { sequelize } = require('../database');

const GuildSettings = sequelize.define('GuildSettings', {
    guildId: { type: DataTypes.STRING, unique: true, allowNull: false },
    logChannelId: { type: DataTypes.STRING, defaultValue: null },
    levelChannelId: { type: DataTypes.STRING, defaultValue: null },
    bossChannelId: { type: DataTypes.STRING, defaultValue: null },
    prefix: { type: DataTypes.STRING, defaultValue: '+' },
});

module.exports = GuildSettings;
