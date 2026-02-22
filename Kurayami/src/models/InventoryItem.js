const { DataTypes } = require('sequelize');
const { sequelize } = require('../database');

const InventoryItem = sequelize.define('InventoryItem', {
    playerId: { type: DataTypes.INTEGER, allowNull: false },
    itemId: { type: DataTypes.STRING, allowNull: false },
    itemType: { type: DataTypes.ENUM('weapon', 'armor', 'accessory', 'pot', 'material', 'race_item', 'pet', 'cosmetic'), allowNull: false },
    tier: { type: DataTypes.STRING, defaultValue: 'common' },
    quantity: { type: DataTypes.INTEGER, defaultValue: 1 },
    equipped: { type: DataTypes.BOOLEAN, defaultValue: false },
    slot: { type: DataTypes.STRING, defaultValue: null },
    upgradeLevel: { type: DataTypes.INTEGER, defaultValue: 0 },
    data: { type: DataTypes.JSONB, defaultValue: {} },
});

module.exports = InventoryItem;
