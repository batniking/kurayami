const Player = require('../models/Player');
const InventoryItem = require('../models/InventoryItem');
const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { errorEmbed, getColor, TIER_EMOJIS } = require('../utils/embedBuilder');
const items = require('../data/items.json');

// ─── Sabit Fiyatlar ───
const SHOP_PRICES = {
    common: { gold: 200, diamond: 0 },
    uncommon: { gold: 800, diamond: 0 },
    rare: { gold: 3000, diamond: 50 },
    epic: { gold: 10000, diamond: 200 },
    legendary: { gold: 0, diamond: 500 },
    mythic: { gold: 0, diamond: 2000 },
};

// ─── Drop Şansları (bilgi amaçlı) ───
const TIER_CHANCES = {
    common: '%100 — Her zaman çıkar',
    uncommon: '%100 — Her zaman çıkar',
    rare: '%60 — Boss drop / stokta olabilir',
    epic: '%25 — Stokta nadir çıkar',
    legendary: '%10 — 2 saatte bir rotate eder',
    mythic: '%2  — Son derece nadir, sadece özel stokta',
};

// ─── Sabit Shop Havuzu (kategori bazlı) ───
const SHOP_POOLS = {
    weapon: [
        // Her zaman stokta (common/uncommon)
        ...items.general.filter(i => ['common', 'uncommon'].includes(i.tier)),
        // Rare grubundan rastgele 3 tane
        ...items.general.filter(i => i.tier === 'rare').sort(() => Math.random() - 0.5).slice(0, 3),
        // Epic'ten 1 tane (her 2 saatte değişir)
        ...items.general.filter(i => i.tier === 'epic').sort(() => Math.random() - 0.5).slice(0, 1),
        // Legendary %10 şansla stoka girer, yoksa epic çıkar
        ...(Math.random() < 0.10
            ? items.general.filter(i => i.tier === 'legendary').sort(() => Math.random() - 0.5).slice(0, 1)
            : items.general.filter(i => i.tier === 'epic').sort(() => Math.random() - 0.5).slice(0, 1)),
    ],
    armor: [
        ...items.armors.filter(i => ['common', 'uncommon', 'rare'].includes(i.tier)).sort(() => Math.random() - 0.5).slice(0, 4),
        ...items.armors.filter(i => i.tier === 'epic').sort(() => Math.random() - 0.5).slice(0, 1),
        ...(Math.random() < 0.10
            ? items.armors.filter(i => i.tier === 'legendary').sort(() => Math.random() - 0.5).slice(0, 1)
            : items.armors.filter(i => i.tier === 'epic').sort(() => Math.random() - 0.5).slice(0, 1)),
    ],
    accessory: [
        ...items.accessories.sort(() => Math.random() - 0.5).slice(0, 5),
    ],
    pot: [
        ...items.pots,
    ],
};

function buildShopEmbed(player, cat) {
    const pool = SHOP_POOLS[cat] || SHOP_POOLS.weapon;
    const embed = new EmbedBuilder()
        .setColor(0xf39c12)
        .setTitle('🏪 Kurayami Dükkanı')
        .setDescription(
            `💰 Altın: **${player.gold.toLocaleString()}** | 💎 Elmas: **${player.diamond}**\n` +
            `Satın almak için: \`+buy <item_id>\`\n\n` +
            `**📊 Tier Şansları:**\n` +
            Object.entries(TIER_CHANCES).map(([t, v]) => `${TIER_EMOJIS[t]} **${t}**: ${v}`).join('\n')
        )
        .setFooter({ text: '⚡ Kurayami RPG • Stok yaklaşık 2 saatte bir değişir' })
        .setTimestamp();

    pool.slice(0, 8).forEach(item => {
        const price = SHOP_PRICES[item.tier] || SHOP_PRICES.common;
        const priceText = price.diamond > 0
            ? `💎 ${price.diamond} Elmas`
            : `💰 ${price.gold.toLocaleString()} Altın`;
        embed.addFields({
            name: `${item.emoji || '📦'} ${item.name} [${TIER_EMOJIS[item.tier] || '⚪'} ${item.tier}]`,
            value: `ID: \`${item.id}\`\n${priceText}`,
            inline: true,
        });
    });

    return embed;
}

module.exports = {
    name: 'shop',
    aliases: ['dükkan', 'store', 's'],
    description: 'Dükkanı görüntüle.',
    cooldown: 5,
    async execute(message) {
        const player = await Player.findOne({ where: { discordId: message.author.id } });
        if (!player) return message.reply({ embeds: [errorEmbed('Önce `+start` ile karakter oluştur!')] });

        let cat = 'weapon';
        const catRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('shop:weapon').setLabel('⚔️ Silahlar').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('shop:armor').setLabel('🛡️ Zırhlar').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('shop:accessory').setLabel('💍 Aksesuar').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('shop:pot').setLabel('🧪 Potlar').setStyle(ButtonStyle.Success),
        );

        const msg = await message.reply({ embeds: [buildShopEmbed(player, cat)], components: [catRow] });
        const collector = msg.createMessageComponentCollector({ time: 120000, filter: i => i.user.id === message.author.id });
        collector.on('collect', async i => {
            cat = i.customId.split(':')[1];
            await i.update({ embeds: [buildShopEmbed(player, cat)], components: [catRow] });
        });
        collector.on('end', () => msg.edit({ components: [] }).catch(() => { }));
    }
};
