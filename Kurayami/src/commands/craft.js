const Player = require('../models/Player');
const InventoryItem = require('../models/InventoryItem');
const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { errorEmbed } = require('../utils/embedBuilder');

// Craft tarifleri
const RECIPES = {
    // ─── ARRANCAR SİLAHLARI ────────────────────────────────────
    murcielago_blade: {
        result: { id: 'murcielago_blade', name: 'Murciélago', emoji: '🦇', tier: 'legendary', type: 'weapon', slot: 'weapon', stats: { power: 85, defense: 30, speed: 20 } },
        ingredients: [
            { id: 'hollow_mask', name: 'Hollow Maskesi', emoji: '😱', qty: 3 },
            { id: 'menos_mask', name: 'Menos Maskesi', emoji: '🦂', qty: 2 },
            { id: 'dark_fragment', name: 'Karanlık Parça', emoji: '🌑', qty: 5 },
        ],
        goldCost: 5000,
        requiredRace: 'hollow',
        minEvolution: 3,
    },
    pantera_claw: {
        result: { id: 'pantera_claw', name: 'Pantera Pençesi', emoji: '🐆', tier: 'legendary', type: 'weapon', slot: 'weapon', stats: { power: 90, speed: 45 } },
        ingredients: [
            { id: 'hollow_mask', name: 'Hollow Maskesi', emoji: '😱', qty: 3 },
            { id: 'dragon_scale', name: 'Ejderha Pulu', emoji: '🐉', qty: 2 },
            { id: 'dark_fragment', name: 'Karanlık Parça', emoji: '🌑', qty: 5 },
        ],
        goldCost: 5000,
        requiredRace: 'hollow',
        minEvolution: 2,
    },
    arrogante_axe: {
        result: { id: 'arrogante_axe', name: 'Arrogante Baltası', emoji: '💀', tier: 'legendary', type: 'weapon', slot: 'weapon', stats: { power: 70, defense: 80 } },
        ingredients: [
            { id: 'menos_mask', name: 'Menos Maskesi', emoji: '🦂', qty: 3 },
            { id: 'dark_fragment', name: 'Karanlık Parça', emoji: '🌑', qty: 6 },
            { id: 'spirit_core', name: 'Ruh Özü', emoji: '🌟', qty: 4 },
        ],
        goldCost: 6000,
        requiredRace: 'hollow',
        minEvolution: 2,
    },
    los_lobos_gun: {
        result: { id: 'los_lobos_gun', name: 'Los Lobos Tabancası', emoji: '🐺', tier: 'legendary', type: 'weapon', slot: 'weapon', stats: { power: 80, speed: 50 } },
        ingredients: [
            { id: 'menos_mask', name: 'Menos Maskesi', emoji: '🦂', qty: 2 },
            { id: 'spirit_core', name: 'Ruh Özü', emoji: '🌟', qty: 5 },
            { id: 'dark_fragment', name: 'Karanlık Parça', emoji: '🌑', qty: 4 },
        ],
        goldCost: 5000,
        requiredRace: 'hollow',
        minEvolution: 2,
    },
    tiburon_blade: {
        result: { id: 'tiburon_blade', name: 'Tiburón Kılıcı', emoji: '🦈', tier: 'legendary', type: 'weapon', slot: 'weapon', stats: { power: 75, defense: 40, speed: 30 } },
        ingredients: [
            { id: 'menos_mask', name: 'Menos Maskesi', emoji: '🦂', qty: 2 },
            { id: 'reishi_shard', name: 'Reishi Kırığı', emoji: '✨', qty: 8 },
            { id: 'spirit_core', name: 'Ruh Özü', emoji: '🌟', qty: 4 },
        ],
        goldCost: 4500,
        requiredRace: 'hollow',
        minEvolution: 2,
    },
    cero_oscuras_staff: {
        result: { id: 'cero_oscuras_staff', name: 'Cero Oscuras Asası', emoji: '🌑', tier: 'mythic', type: 'weapon', slot: 'weapon', stats: { power: 115, defense: 35, speed: 25 } },
        ingredients: [
            { id: 'hogyoku', name: 'Hōgyoku', emoji: '💠', qty: 1 },
            { id: 'menos_mask', name: 'Menos Maskesi', emoji: '🦂', qty: 3 },
            { id: 'void_crystal', name: 'Void Kristali', emoji: '🔮', qty: 2 },
            { id: 'dark_fragment', name: 'Karanlık Parça', emoji: '🌑', qty: 8 },
        ],
        goldCost: 15000,
        requiredRace: 'hollow',
        minEvolution: 4,
    },

    // ─── GENEL EFSANEVİ SİLAHLAR ───────────────────────────────
    god_slash: {
        result: { id: 'god_slash', name: 'God Slash', emoji: '🌟', tier: 'legendary', type: 'weapon', slot: 'weapon', stats: { power: 90, defense: 25 } },
        ingredients: [
            { id: 'dragon_scale', name: 'Ejderha Pulu', emoji: '🐉', qty: 3 },
            { id: 'void_crystal', name: 'Void Kristali', emoji: '🔮', qty: 1 },
            { id: 'spirit_core', name: 'Ruh Özü', emoji: '🌟', qty: 6 },
        ],
        goldCost: 8000,
        requiredRace: null,
        minEvolution: 0,
    },
    chaos_breaker: {
        result: { id: 'chaos_breaker', name: 'Chaos Breaker', emoji: '🌪️', tier: 'legendary', type: 'weapon', slot: 'weapon', stats: { power: 85, hp: 100 } },
        ingredients: [
            { id: 'dark_fragment', name: 'Karanlık Parça', emoji: '🌑', qty: 5 },
            { id: 'dragon_scale', name: 'Ejderha Pulu', emoji: '🐉', qty: 3 },
            { id: 'spirit_core', name: 'Ruh Özü', emoji: '🌟', qty: 5 },
        ],
        goldCost: 7500,
        requiredRace: null,
        minEvolution: 0,
    },
    void_god_blade: {
        result: { id: 'void_god_blade', name: 'Void God Blade', emoji: '🔮', tier: 'mythic', type: 'weapon', slot: 'weapon', stats: { power: 130, speed: 40, defense: 35 } },
        ingredients: [
            { id: 'void_crystal', name: 'Void Kristali', emoji: '🔮', qty: 3 },
            { id: 'dragon_scale', name: 'Ejderha Pulu', emoji: '🐉', qty: 5 },
            { id: 'dark_fragment', name: 'Karanlık Parça', emoji: '🌑', qty: 10 },
            { id: 'spirit_core', name: 'Ruh Özü', emoji: '🌟', qty: 8 },
        ],
        goldCost: 20000,
        requiredRace: null,
        minEvolution: 0,
    },

    // ─── ZANPAKUTO (SHİNİGAMİ) ────────────────────────────────
    tensa_zangetsu: {
        result: { id: 'tensa_zangetsu_sword', name: 'Tensa Zangetsu (Kılıç)', emoji: '🌑', tier: 'legendary', type: 'weapon', slot: 'weapon', stats: { power: 95, speed: 30 } },
        ingredients: [
            { id: 'bankai_crystal', name: 'Bankai Kristali', emoji: '🔮', qty: 2 },
            { id: 'spirit_core', name: 'Ruh Özü', emoji: '🌟', qty: 6 },
            { id: 'dark_fragment', name: 'Karanlık Parça', emoji: '🌑', qty: 4 },
        ],
        goldCost: 10000,
        requiredRace: 'shinigami',
        minEvolution: 2,
    },
};

const TIER_COLOR = {
    common: 0x95a5a6,
    uncommon: 0x2ecc71,
    rare: 0x3498db,
    epic: 0x9b59b6,
    legendary: 0xf1c40f,
    mythic: 0xe74c3c,
};

module.exports = {
    name: 'craft',
    aliases: ['yapmak', 'uret'],
    description: 'Item craft et! +craft list | +craft <item_id>',
    cooldown: 5,
    async execute(message, args) {
        const player = await Player.findOne({ where: { discordId: message.author.id } });
        if (!player) return message.reply({ embeds: [errorEmbed('Önce `+start` ile karakter oluştur!')] });

        // Tarif listesi
        if (!args[0] || args[0] === 'list' || args[0] === 'liste') {
            const available = Object.entries(RECIPES).filter(([, r]) => {
                if (r.requiredRace && r.requiredRace !== player.race) return false;
                if (r.minEvolution && (player.raceEvolution || 0) < r.minEvolution) return false;
                return true;
            });

            const allList = Object.entries(RECIPES).map(([id, r]) => {
                const res = r.result;
                const locked = (r.requiredRace && r.requiredRace !== player.race) || ((player.raceEvolution || 0) < (r.minEvolution || 0));
                const ingStr = r.ingredients.map(i => `${i.emoji}×${i.qty}`).join('+');
                return `${locked ? '🔒' : '✅'} ${res.emoji} **${res.name}** (\`${id}\`) — ${ingStr} + 💰${r.goldCost.toLocaleString()}`;
            }).join('\n');

            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor(0x9b59b6)
                    .setTitle('🔨 Craft Tarifleri')
                    .setDescription(allList || 'Tarif yok.')
                    .addFields({ name: '💡 Kullanım', value: '`+craft <item_id>` — item craft et\n`+craft list` — bu listeyi gör', inline: false })
                    .setFooter({ text: `⚡ Kurayami RPG • Craft Sistemi | ✅ Erişilebilir: ${available.length}/${Object.keys(RECIPES).length}` })
                ]
            });
        }

        const recipeId = args[0].toLowerCase();
        const recipe = RECIPES[recipeId];
        if (!recipe) return message.reply({ embeds: [errorEmbed(`\`${recipeId}\` tarifi bulunamadı! \`+craft list\` ile tariflere bak.`)] });

        // Irk ve evrim kontrolü
        if (recipe.requiredRace && recipe.requiredRace !== player.race) {
            return message.reply({ embeds: [errorEmbed(`Bu tarif sadece **${recipe.requiredRace}** ırkı için!`)] });
        }
        if (recipe.minEvolution && (player.raceEvolution || 0) < recipe.minEvolution) {
            return message.reply({ embeds: [errorEmbed(`Bu tarif için Evrim **${recipe.minEvolution}** gerekiyor! (Şu an: ${player.raceEvolution || 0})`)] });
        }

        // Gold kontrolü
        if (player.gold < recipe.goldCost) {
            return message.reply({ embeds: [errorEmbed(`Yeterli altın yok! Gerekli: 💰 **${recipe.goldCost.toLocaleString()}** (Sahip: ${player.gold.toLocaleString()})`)] });
        }

        // Malzeme kontrolü
        const missing = [];
        const inventoryChecks = await Promise.all(
            recipe.ingredients.map(async ing => {
                const inv = await InventoryItem.findOne({ where: { playerId: player.id, itemId: ing.id } });
                const has = inv?.quantity || 0;
                if (has < ing.qty) missing.push(`${ing.emoji} **${ing.name}**: ${has}/${ing.qty}`);
                return { ing, inv, has };
            })
        );

        if (missing.length > 0) {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor(0xe74c3c)
                    .setTitle('❌ Yetersiz Malzeme')
                    .setDescription(missing.join('\n'))
                    .setFooter({ text: '⚡ Kurayami RPG • Craft' })
                ]
            });
        }

        // Crafting önizleme ve onay
        const res = recipe.result;
        const statLines = Object.entries(res.stats || {}).map(([k, v]) => `+${v} ${k.toUpperCase()}`).join(' | ');
        const ingPreview = recipe.ingredients.map(i => `${i.emoji} ${i.name} ×${i.qty}`).join('\n');

        const confirmRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('craft:confirm').setLabel(`🔨 ${res.name} Craft Et!`).setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('craft:cancel').setLabel('❌ İptal').setStyle(ButtonStyle.Secondary)
        );

        const previewEmbed = new EmbedBuilder()
            .setColor(TIER_COLOR[res.tier] || 0x9b59b6)
            .setTitle(`🔨 Craft Önizleme — ${res.emoji} ${res.name}`)
            .setDescription(`**Tier:** ${res.tier.toUpperCase()}\n**Statlar:** ${statLines}`)
            .addFields(
                { name: '📦 Kullanılacak Malzemeler', value: ingPreview, inline: true },
                { name: '💰 Altın Maliyeti', value: `${recipe.goldCost.toLocaleString()}`, inline: true }
            )
            .setFooter({ text: '⚡ Kurayami RPG • 30 saniye içinde onayla!' });

        const msg = await message.reply({ embeds: [previewEmbed], components: [confirmRow] });
        const collector = msg.createMessageComponentCollector({ time: 30000, filter: i => i.user.id === message.author.id, max: 1 });

        collector.on('collect', async btn => {
            await btn.deferUpdate();
            if (btn.customId === 'craft:cancel') {
                await msg.edit({ embeds: [new EmbedBuilder().setColor(0x95a5a6).setDescription('❌ Crafting iptal edildi.')], components: [] });
                return;
            }

            // Malzemeleri tüket
            for (const { ing, inv } of inventoryChecks) {
                if (inv.quantity > ing.qty) {
                    inv.quantity -= ing.qty;
                    await inv.save();
                } else {
                    await inv.destroy();
                }
            }

            // Gold tüket
            player.gold -= recipe.goldCost;
            await player.save();

            // Sonuç itemi envantere ekle
            await InventoryItem.create({
                playerId: player.id,
                itemId: res.id,
                itemType: res.type,
                tier: res.tier,
                quantity: 1,
                equipped: false,
                data: res,
            });

            const doneEmbed = new EmbedBuilder()
                .setColor(TIER_COLOR[res.tier] || 0x2ecc71)
                .setTitle('✅ Craft Başarılı!')
                .setDescription(`${res.emoji} **${res.name}** üretildi ve envanterine eklendi!`)
                .addFields(
                    { name: '📊 Statlar', value: statLines || 'Yok', inline: true },
                    { name: '🎁 Tier', value: res.tier.toUpperCase(), inline: true }
                )
                .setFooter({ text: '⚡ Kurayami RPG • Craft • +equip ile tak!' });

            await msg.edit({ embeds: [doneEmbed], components: [] });
        });

        collector.on('end', async (_, reason) => {
            if (reason === 'time') msg.edit({ components: [] }).catch(() => { });
        });
    }
};
