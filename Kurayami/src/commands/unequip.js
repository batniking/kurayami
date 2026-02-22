const Player = require('../models/Player');
const InventoryItem = require('../models/InventoryItem');
const { errorEmbed, successEmbed } = require('../utils/embedBuilder');

module.exports = {
    name: 'unequip',
    aliases: ['cikar', 'çıkar'],
    description: 'Takılı eşyayı çıkar. Kullanım: +unequip <item_id>',
    cooldown: 3,
    async execute(message, args) {
        const player = await Player.findOne({ where: { discordId: message.author.id } });
        if (!player) return message.reply({ embeds: [errorEmbed('Önce `+start` ile karakter oluştur!')] });

        const itemId = args[0]?.toLowerCase();
        if (!itemId) return message.reply({ embeds: [errorEmbed('Item ID gir! Örnek: `+unequip void_god_blade`')] });

        const invItem = await InventoryItem.findOne({
            where: { playerId: player.id, itemId: itemId, equipped: true }
        });

        if (!invItem) return message.reply({ embeds: [errorEmbed(`\`${itemId}\` takılı değil veya envanterinde yok!`)] });

        invItem.equipped = false;
        invItem.slot = null;
        await invItem.save();

        // Stat bonuslarını geri al
        const data = invItem.data || {};
        if (data.stats) {
            if (data.stats.power) player.power = Math.max(0, player.power - data.stats.power);
            if (data.stats.defense) player.defense = Math.max(0, player.defense - data.stats.defense);
            if (data.stats.speed) player.speed = Math.max(0, player.speed - data.stats.speed);
            if (data.stats.hp) {
                player.maxHp = Math.max(10, player.maxHp - data.stats.hp);
                player.hp = Math.min(player.hp, player.maxHp);
            }
            await player.save();
        }

        return message.reply({
            embeds: [successEmbed(
                'Eşya Çıkarıldı!',
                `${data.emoji || '📦'} **${data.name || itemId}** çıkarıldı.`
            )]
        });
    }
};
