const Player = require('../models/Player');
const InventoryItem = require('../models/InventoryItem');
const GuildSettings = require('../models/GuildSettings');
const { EmbedBuilder } = require('discord.js');
const { errorEmbed, successEmbed } = require('../utils/embedBuilder');
const items = require('../data/items.json');

const ALL_ITEMS = [...items.general, ...items.armors, ...items.accessories, ...items.pots];

const PRICES = {
    common: { gold: 200, diamond: 0 },
    uncommon: { gold: 800, diamond: 0 },
    rare: { gold: 3000, diamond: 50 },
    epic: { gold: 10000, diamond: 200 },
    legendary: { gold: 0, diamond: 500 },
    mythic: { gold: 0, diamond: 2000 },
};

module.exports = {
    name: 'buy',
    aliases: ['satinal', 'al'],
    description: 'Dükkandan item satın al. Kullanım: +buy <item_id>',
    cooldown: 5,
    async execute(message, args) {
        const player = await Player.findOne({ where: { discordId: message.author.id } });
        if (!player) return message.reply({ embeds: [errorEmbed('Önce `+start` ile karakter oluştur!')] });

        const itemId = args[0]?.toLowerCase();
        if (!itemId) return message.reply({ embeds: [errorEmbed('Item ID\'si gir! Örnek: `+buy iron_sword`\n`+shop` ile item ID\'lerini gör.')] });

        const item = ALL_ITEMS.find(i => i.id === itemId);
        if (!item) return message.reply({ embeds: [errorEmbed(`\`${itemId}\` adlı item bulunamadı!`)] });

        const price = PRICES[item.tier] || PRICES.common;

        // Ödeme kontrolü
        if (price.diamond > 0 && player.diamond >= price.diamond) {
            player.diamond -= price.diamond;
        } else if (price.gold > 0 && player.gold >= price.gold) {
            player.gold -= price.gold;
        } else {
            const needed = price.diamond > 0 ? `💎 ${price.diamond} Elmas` : `💰 ${price.gold.toLocaleString()} Altın`;
            return message.reply({ embeds: [errorEmbed(`Yeterli paran yok! Gerekli: ${needed}`)] });
        }

        await InventoryItem.create({
            playerId: player.id,
            itemId: item.id,
            itemType: item.type || 'material',
            tier: item.tier,
            quantity: 1,
            data: item,
        });
        await player.save();

        return message.reply({
            embeds: [successEmbed(
                'Satın Alındı!',
                `${item.emoji || '📦'} **${item.name}** envanterine eklendi!`
            )]
        });
    }
};
