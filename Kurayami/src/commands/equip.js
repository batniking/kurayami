const Player = require('../models/Player');
const InventoryItem = require('../models/InventoryItem');
const { EmbedBuilder } = require('discord.js');
const { errorEmbed } = require('../utils/embedBuilder');

// Slot tanımları — aynı slotta sadece 1 item olabilir
const SLOT_MAP = {
    weapon: 'weapon',
    armor: null,         // armor'ın kendi slot'u (head/chest/legs) var
    accessory: null,     // accessory'nin kendi slot'u (ring/necklace) var
    pot: null,
};

function getItemSlot(item) {
    if (item.type === 'weapon') return 'weapon';
    if (item.type === 'armor') return item.slot || 'armor'; // head / chest / legs
    if (item.type === 'accessory') return item.slot || 'accessory'; // ring / necklace
    return item.type;
}

module.exports = {
    name: 'equip',
    aliases: ['tak', 'giy'],
    description: 'Item tak. +equip <item_id> | +equip list (takılıları gör)',
    cooldown: 3,
    async execute(message, args) {
        const player = await Player.findOne({ where: { discordId: message.author.id } });
        if (!player) return message.reply({ embeds: [errorEmbed('Önce `+start` ile karakter oluştur!')] });

        // Takılı itemleri listele
        if (!args[0] || args[0] === 'list' || args[0] === 'liste') {
            const equipped = await InventoryItem.findAll({ where: { playerId: player.id, equipped: true } });
            if (!equipped.length) {
                return message.reply({ embeds: [new EmbedBuilder().setColor(0x95a5a6).setDescription('⚔️ Hiç item takmamışsın! `+equip <item_id>` ile tak.')] });
            }
            const lines = equipped.map(e => {
                const d = e.data || {};
                const slot = getItemSlot(d);
                return `**${d.emoji || '📦'} ${d.name || e.itemId}** → \`${slot}\``;
            }).join('\n');
            return message.reply({ embeds: [new EmbedBuilder().setColor(0x2ecc71).setTitle('🛡️ Takılı Eşyalar').setDescription(lines).setFooter({ text: '⚡ Kurayami RPG' })] });
        }

        const itemId = args[0].toLowerCase();
        const invItem = await InventoryItem.findOne({ where: { playerId: player.id, itemId } });
        if (!invItem) return message.reply({ embeds: [errorEmbed(`\`${itemId}\` envanterinde yok!\n\`+inv\` ile envantere bak.`)] });
        if (invItem.equipped) return message.reply({ embeds: [errorEmbed('Bu eşya zaten takılı! `+unequip` ile önce çıkar.')] });

        const data = invItem.data || {};
        if (!['weapon', 'armor', 'accessory'].includes(data.type)) {
            return message.reply({ embeds: [errorEmbed('Bu item türü takılamaz (sadece silah, zırh, aksesuar).')] });
        }

        const slot = getItemSlot(data);

        // Aynı slotta önceki item var mı? Otomatik çıkar
        const existing = await InventoryItem.findOne({ where: { playerId: player.id, equipped: true, slot } });
        let removedName = null;
        if (existing) {
            const exData = existing.data || {};
            // Eski item statlarını geri al
            if (exData.stats) {
                if (exData.stats.power) player.power = Math.max(0, player.power - exData.stats.power);
                if (exData.stats.defense) player.defense = Math.max(0, player.defense - exData.stats.defense);
                if (exData.stats.speed) player.speed = Math.max(0, player.speed - exData.stats.speed);
                if (exData.stats.hp) {
                    player.maxHp = Math.max(10, player.maxHp - exData.stats.hp);
                    player.hp = Math.min(player.hp, player.maxHp);
                }
            }
            existing.equipped = false;
            existing.slot = null;
            await existing.save();
            removedName = exData.name || existing.itemId;
        }

        // Yeni itemi tak
        invItem.equipped = true;
        invItem.slot = slot;
        await invItem.save();

        // Yeni statları ekle
        const stats = data.stats || {};
        if (stats.power) player.power += stats.power;
        if (stats.defense) player.defense += stats.defense;
        if (stats.speed) player.speed += stats.speed;
        if (stats.hp) {
            player.maxHp += stats.hp;
            player.hp = Math.min(player.hp + stats.hp, player.maxHp);
        }
        await player.save();

        const statLines = Object.entries(stats).map(([k, v]) => `+${v} ${k.toUpperCase()}`).join(' | ') || 'Stat yok';
        const slotLabel = {
            weapon: '⚔️ Silah', head: '🪖 Kask', chest: '🛡️ Zırh', legs: '👖 Pantolon',
            ring: '💍 Yüzük', necklace: '📿 Kolye', accessory: '💎 Aksesuar'
        }[slot] || slot;

        const embed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('✅ Item Takıldı!')
            .setDescription([
                `${data.emoji || '📦'} **${data.name || itemId}** → ${slotLabel}`,
                removedName ? `\n🔄 Önceki: **${removedName}** çıkarıldı` : '',
                `\n📊 **Stat Bonusu:** ${statLines}`
            ].join(''))
            .setFooter({ text: '⚡ Kurayami RPG' });

        return message.reply({ embeds: [embed] });
    }
};
