const Player = require('../models/Player');
const InventoryItem = require('../models/InventoryItem');
const { EmbedBuilder } = require('discord.js');
const { errorEmbed, successEmbed } = require('../utils/embedBuilder');
const items = require('../data/items.json');

const ALL_ITEMS = [
    ...items.general,
    ...(items.armors || []),
    ...(items.accessories || []),
    ...(items.pots || []),
    ...(items.arrancar_weapons || []),
    ...(items.craft_materials || []),
    ...(items.bleach_weapons || []),
    ...(items.race_items || []),
];

// ⚠️ Admin Discord ID'leri buraya ekle
const ADMIN_IDS = ['1194705296946380882'];

module.exports = {
    name: 'admin',
    aliases: ['a'],
    description: 'Admin komutları. +admin <give|reset|info> @user <tür> <miktar>',
    cooldown: 0,
    async execute(message, args) {
        if (!ADMIN_IDS.includes(message.author.id) && !message.member.permissions.has('Administrator')) {
            return message.reply({ embeds: [errorEmbed('❌ Bu komut sadece adminler için!')] });
        }

        const sub = args[0]?.toLowerCase();

        // ─────── +admin give @user gold 5000 ───────
        // ─────── +admin give @user diamond 500 ──────
        // ─────── +admin give @user item iron_sword ──
        if (sub === 'give') {
            const target = message.mentions.users.first();
            if (!target) return message.reply({ embeds: [errorEmbed('Kullanıcı belirt! `+admin give @user <tür> <miktar>`')] });

            const player = await Player.findOne({ where: { discordId: target.id } });
            if (!player) return message.reply({ embeds: [errorEmbed('Bu kullanıcının karakteri yok!')] });

            const type = args[2]?.toLowerCase();
            const value = args[3];

            if (!type || !value) return message.reply({ embeds: [errorEmbed('Tür ve değer belirt! `+admin give @user gold 5000`')] });

            if (type === 'gold') {
                const amount = parseInt(value);
                if (isNaN(amount) || amount <= 0) return message.reply({ embeds: [errorEmbed('Geçerli bir miktar gir!')] });
                player.gold += amount;
                await player.save();
                return message.reply({ embeds: [successEmbed('Altın Verildi', `💰 **${target.displayName}**'e **${amount.toLocaleString()} Altın** verildi!\nYeni bakiye: **${player.gold.toLocaleString()}**`)] });
            }

            if (type === 'diamond' || type === 'elmas') {
                const amount = parseInt(value);
                if (isNaN(amount) || amount <= 0) return message.reply({ embeds: [errorEmbed('Geçerli bir miktar gir!')] });
                player.diamond += amount;
                await player.save();
                return message.reply({ embeds: [successEmbed('Elmas Verildi', `💎 **${target.displayName}**'e **${amount} Elmas** verildi!\nYeni bakiye: **${player.diamond}**`)] });
            }

            if (type === 'hollowcoin' || type === 'hc') {
                const amount = parseInt(value);
                if (isNaN(amount) || amount <= 0) return message.reply({ embeds: [errorEmbed('Geçerli bir miktar gir!')] });
                player.hollowCoin += amount;
                await player.save();
                return message.reply({ embeds: [successEmbed('Hollow Coin Verildi', `🪙 **${target.displayName}**'e **${amount} Hollow Coin** verildi!`)] });
            }

            if (type === 'item') {
                const itemId = value.toLowerCase();
                const item = ALL_ITEMS.find(i => i.id === itemId);
                if (!item) return message.reply({ embeds: [errorEmbed(`\`${itemId}\` adlı item bulunamadı!\n\nÖrnek item ID'leri: \`iron_sword\`, \`dragon_fang\`, \`void_god_blade\``)] });

                const qty = parseInt(args[4]) || 1;
                await InventoryItem.create({
                    playerId: player.id,
                    itemId: item.id,
                    itemType: item.type || 'material',
                    tier: item.tier,
                    quantity: qty,
                    data: item,
                });
                return message.reply({ embeds: [successEmbed('Item Verildi', `${item.emoji || '📦'} **${target.displayName}**'e **${item.name}** (x${qty}) verildi!`)] });
            }

            if (type === 'exp' || type === 'xp') {
                const amount = parseInt(value);
                if (isNaN(amount) || amount <= 0) return message.reply({ embeds: [errorEmbed('Geçerli bir miktar gir!')] });
                const { addExp } = require('../utils/levelSystem');
                await addExp(player, amount, message.channel);
                return message.reply({ embeds: [successEmbed('EXP Verildi', `📈 **${target.displayName}**'e **${amount} EXP** verildi!`)] });
            }

            return message.reply({ embeds: [errorEmbed('Geçersiz tür! Geçerli türler: `gold`, `diamond`, `hollowcoin`, `item`, `exp`')] });
        }

        // ─────── +admin reset @user ───────
        if (sub === 'reset') {
            const target = message.mentions.users.first();
            if (!target) return message.reply({ embeds: [errorEmbed('Kullanıcı belirt!')] });
            const player = await Player.findOne({ where: { discordId: target.id } });
            if (!player) return message.reply({ embeds: [errorEmbed('Bu kullanıcının karakteri yok!')] });

            await player.update({
                level: 1, exp: 0, expNeeded: 100, statPoints: 0,
                power: 10, defense: 10, speed: 10, hp: 100, maxHp: 100,
                gold: 100, diamond: 0, hollowCoin: 0,
                race: 'human', raceEvolution: 0, raceForm: null, raceData: {},
                rankedTier: 'unranked', rankedPoints: 0,
                totalKills: 0, totalBossKills: 0, pvpWins: 0, pvpLosses: 0,
                achievements: [], title: null, friends: [],
                inBattle: false, winStreak: 0, bestWinStreak: 0,
            });
            await InventoryItem.destroy({ where: { playerId: player.id } });

            return message.reply({ embeds: [successEmbed('Karakter Sıfırlandı', `🔄 **${target.displayName}**'in karakteri sıfırlandı!`)] });
        }

        // ─────── +admin info @user ───────
        if (sub === 'info') {
            const target = message.mentions.users.first();
            if (!target) return message.reply({ embeds: [errorEmbed('Kullanıcı belirt!')] });
            const player = await Player.findOne({ where: { discordId: target.id } });
            if (!player) return message.reply({ embeds: [errorEmbed('Bu kullanıcının karakteri yok!')] });

            const embed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle(`🔍 Admin — ${target.displayName} Bilgileri`)
                .addFields(
                    { name: 'DB ID', value: `${player.id}`, inline: true },
                    { name: 'Discord ID', value: player.discordId, inline: true },
                    { name: 'Level', value: `${player.level}`, inline: true },
                    { name: 'Altın', value: `${player.gold}`, inline: true },
                    { name: 'Elmas', value: `${player.diamond}`, inline: true },
                    { name: 'Irk', value: player.race, inline: true },
                    { name: 'PvP W/L', value: `${player.pvpWins}/${player.pvpLosses}`, inline: true },
                    { name: 'Savaşta mı?', value: `${player.inBattle}`, inline: true },
                )
                .setFooter({ text: '⚡ Kurayami RPG • Admin Panel' });
            return message.reply({ embeds: [embed] });
        }

        // ─────── Help ───────
        return message.reply({
            embeds: [new EmbedBuilder()
                .setColor(0xe67e22)
                .setTitle('⚙️ Admin Komutları')
                .addFields(
                    { name: '+admin give @user gold <miktar>', value: 'Altın ver', inline: false },
                    { name: '+admin give @user diamond <miktar>', value: 'Elmas ver', inline: false },
                    { name: '+admin give @user hollowcoin <miktar>', value: 'Hollow Coin ver', inline: false },
                    { name: '+admin give @user item <item_id> [adet]', value: 'Item ver (`+admin items` ile ID\'leri listele)', inline: false },
                    { name: '+admin give @user exp <miktar>', value: 'EXP ver', inline: false },
                    { name: '+admin reset @user', value: 'Karakteri sıfırla', inline: false },
                    { name: '+admin info @user', value: 'Oyuncu bilgilerini gör', inline: false },
                )
                .setFooter({ text: '⚡ Kurayami RPG • Admin Panel' })
            ]
        });
    }
};
