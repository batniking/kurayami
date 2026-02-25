const { DataTypes } = require('sequelize');
const { sequelize } = require('../database');

const InventoryItem = sequelize.define('InventoryItem', {
    playerId: { type: DataTypes.INTEGER, allowNull: false },
    itemId: { type: DataTypes.STRING, allowNull: false },
    itemType: { type: DataTypes.STRING, defaultValue: 'material' },
    tier: { type: DataTypes.STRING, defaultValue: 'common' },
    quantity: { type: DataTypes.INTEGER, defaultValue: 1 },
    equipped: { type: DataTypes.BOOLEAN, defaultValue: false },
    data: { type: DataTypes.JSONB, defaultValue: {} },
});

module.exports = InventoryItem;
