const Player = require('../models/Player');
const InventoryItem = require('../models/InventoryItem');
const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { errorEmbed, getColor } = require('../utils/embedBuilder');
const { calcDamage, applyEffects, buildFighterState } = require('../utils/combatEngine');
const { addExp } = require('../utils/levelSystem');
const { checkAchievements } = require('../utils/achievementSystem');

// Dungeon tanımları
const DUNGEONS = {
    goblin_cave: {
        name: '🕳️ Goblin Mağarası',
        minLevel: 1,
        rooms: 3,
        enemies: [
            { name: 'Goblin', emoji: '👺', hp: 100, maxHp: 100, power: 15, defense: 5, speed: 20, exp: 25 },
            { name: 'Goblin Şefi', emoji: '👿', hp: 250, maxHp: 250, power: 30, defense: 15, speed: 25, exp: 60 },
        ],
        boss: { name: 'Dev Goblin', emoji: '🔰', hp: 500, maxHp: 500, power: 50, defense: 25, speed: 30, exp: 150 },
        rewards: { gold: [200, 400], diamond: 30, expBonus: 100 },
    },
    hollow_forest: {
        name: '🌲 Hollow Ormanı',
        minLevel: 10,
        rooms: 4,
        enemies: [
            { name: 'Orman Hollow\'u', emoji: '👻', hp: 300, maxHp: 300, power: 40, defense: 20, speed: 35, exp: 70 },
            { name: 'Hollow Avcısı', emoji: '🎯', hp: 450, maxHp: 450, power: 55, defense: 30, speed: 45, exp: 100 },
        ],
        boss: { name: 'Orman Ruhu Hollow', emoji: '🌑', hp: 1200, maxHp: 1200, power: 90, defense: 50, speed: 60, exp: 350 },
        rewards: { gold: [600, 1200], diamond: 100, expBonus: 300 },
    },
    soul_tower: {
        name: '🗼 Ruh Kulesi',
        minLevel: 25,
        rooms: 5,
        enemies: [
            { name: 'Shinigami Muhafızı', emoji: '⚫', hp: 700, maxHp: 700, power: 80, defense: 50, speed: 60, exp: 150 },
            { name: 'Quincy Askeri', emoji: '🏹', hp: 650, maxHp: 650, power: 90, defense: 45, speed: 70, exp: 160 },
        ],
        boss: { name: 'Kule Bekçisi Yamamoto', emoji: '🔥', hp: 3000, maxHp: 3000, power: 150, defense: 100, speed: 80, exp: 700 },
        rewards: { gold: [2000, 4000], diamond: 300, expBonus: 800 },
    },
    shadow_dungeon: {
        name: '🌌 Gölge Zindanı',
        minLevel: 50,
        rooms: 6,
        enemies: [
            { name: 'Gölge Ordusu', emoji: '🌑', hp: 1500, maxHp: 1500, power: 130, defense: 80, speed: 100, exp: 280 },
            { name: 'Double Dungeon Cini', emoji: '😈', hp: 2000, maxHp: 2000, power: 160, defense: 100, speed: 110, exp: 350 },
        ],
        boss: { name: 'Karanlık Kral', emoji: '👑', hp: 8000, maxHp: 8000, power: 250, defense: 180, speed: 160, exp: 1500 },
        rewards: { gold: [8000, 15000], diamond: 1000, expBonus: 2000 },
    },
};

function getPlayerSkills(player) {
    if (!player.raceForm) return [];
    const race = player.race;
    if (race === 'shinigami') {
        const zanpakutos = require('../data/zanpakutos.json');
        const z = zanpakutos.find(z => z.id === player.raceData?.zanpakuto);
        if (z) return player.raceEvolution >= 2 ? z.bankai : z.shikai;
    }
    if (race === 'hollow') {
        const espadas = require('../data/espadas.json');
        const e = espadas.find(e => e.id === player.raceData?.espada);
        if (e) return e.skills;
    }
    if (race === 'titan') {
        const titans = require('../data/titans.json');
        const t = titans.find(t => t.id === player.raceData?.titan);
        if (t) return t.skills;
    }
    return [];
}

module.exports = {
    name: 'dungeon',
    aliases: ['dg', 'zindan'],
    description: 'Zindana gir! +dungeon [isim] | +dungeon list',
    cooldown: 30,
    async execute(message, args) {
        const player = await Player.findOne({ where: { discordId: message.author.id } });
        if (!player) return message.reply({ embeds: [errorEmbed('Önce `+start` ile karakter oluştur!')] });

        // Dungeon listesi
        if (args[0] === 'list' || args[0] === 'liste') {
            const listEmbed = new EmbedBuilder()
                .setColor(0x9b59b6)
                .setTitle('🗺️ Zindanlar')
                .setDescription('Zindan girmek için: `+dungeon <id>`')
                .addFields(
                    Object.entries(DUNGEONS).map(([id, d]) => ({
                        name: `${d.name} — \`${id}\``,
                        value: `Min Level: **${d.minLevel}** | ${d.rooms} Oda | Boss: ${d.boss.name}`,
                        inline: false
                    }))
                )
                .setFooter({ text: '⚡ Kurayami RPG • Dungeon' });
            return message.reply({ embeds: [listEmbed] });
        }

        // Zindan seçimi
        const dungeonId = args[0]?.toLowerCase() || 'goblin_cave';
        const dungeon = DUNGEONS[dungeonId];
        if (!dungeon) return message.reply({ embeds: [errorEmbed(`Zindan bulunamadı! \`+dungeon list\` ile listeye bak.`)] });
        if (player.level < dungeon.minLevel) return message.reply({ embeds: [errorEmbed(`Bu zindana girmek için **Level ${dungeon.minLevel}** olmalısın! (Şu an: ${player.level})`)] });
        if (player.inBattle) return message.reply({ embeds: [errorEmbed('Zaten bir savaştasın!')] });
        if (player.hp <= 0) return message.reply({ embeds: [errorEmbed('HP\'n tükendi! `+rest` ile iyileş.')] });

        player.inBattle = true;
        await player.save();

        const skills = getPlayerSkills(player);
        const fighter = buildFighterState(player, player.username);
        const color = getColor(player.race);

        let currentRoom = 1;
        const totalRooms = dungeon.rooms;
        let totalExpGained = 0;
        let totalGoldGained = 0;
        let totalDiamondGained = 0;

        const getEnemy = (room) => {
            if (room >= totalRooms) {
                return { ...dungeon.boss, tempBuffs: {}, burn: null, dot: null, frozen: 0, stunned: 0, skipTurns: 0, noHeal: 0 };
            }
            const pool = dungeon.enemies;
            const base = pool[Math.floor(Math.random() * pool.length)];
            return { ...base, tempBuffs: {}, burn: null, dot: null, frozen: 0, stunned: 0, skipTurns: 0, noHeal: 0 };
        };

        let enemy = getEnemy(currentRoom);

        const makeRoomEmbed = (log) => {
            const isBossRoom = currentRoom >= totalRooms;
            return new EmbedBuilder()
                .setColor(isBossRoom ? 0xf1c40f : color)
                .setTitle(`${dungeon.name} — ${isBossRoom ? '💀 Boss Odası!' : `Oda ${currentRoom}/${totalRooms}`}`)
                .setDescription(log)
                .addFields(
                    { name: `${player.username}`, value: `❤️ ${Math.max(0, fighter.hp)}/${fighter.maxHp}`, inline: true },
                    { name: `${enemy.emoji} ${enemy.name}`, value: `💀 ${Math.max(0, enemy.hp)}/${enemy.maxHp}`, inline: true },
                    { name: '🏆 Bu tur', value: `+${totalExpGained} EXP | +${totalGoldGained} 💰`, inline: true }
                )
                .setFooter({ text: '⚡ Kurayami RPG • Dungeon' })
                .setTimestamp();
        };

        const buildButtons = (disabled = false) => {
            const attackBtn = new ButtonBuilder().setCustomId('dg:attack').setLabel('⚔️ Saldır').setStyle(ButtonStyle.Danger).setDisabled(disabled);
            const fleeBtn = new ButtonBuilder().setCustomId('dg:flee').setLabel('🏃 Kaç').setStyle(ButtonStyle.Secondary).setDisabled(disabled);
            const row = new ActionRowBuilder().addComponents(attackBtn, fleeBtn);
            if (skills.length > 0) {
                const skillRow = new ActionRowBuilder().addComponents(
                    skills.slice(0, 4).map((s, idx) =>
                        new ButtonBuilder()
                            .setCustomId(`dg:skill:${idx}`)
                            .setLabel(`⚡ ${s.name.slice(0, 20)}`)
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(disabled)
                    )
                );
                return [row, skillRow];
            }
            return [row];
        };

        const msg = await message.reply({
            embeds: [makeRoomEmbed(`🚪 **${dungeon.name}**'a girdin! ${enemy.emoji} **${enemy.name}** ile karşılaştın!`)],
            components: buildButtons()
        });

        const collector = msg.createMessageComponentCollector({ time: 180000, filter: i => i.user.id === message.author.id });

        collector.on('collect', async (i) => {
            await i.deferUpdate();

            if (i.customId === 'dg:flee') {
                player.inBattle = false;
                player.gold += totalGoldGained;
                player.diamond += totalDiamondGained;
                await player.save();
                await addExp(player, totalExpGained, null);
                await msg.edit({
                    embeds: [new EmbedBuilder().setColor(0x95a5a6)
                        .setTitle('🏃 Zindandan Kaçtın!')
                        .setDescription(`Toplam kazanımlar:\n+${totalExpGained} EXP | +${totalGoldGained} 💰 | +${totalDiamondGained} 💎`)
                        .setFooter({ text: '⚡ Kurayami RPG' })],
                    components: []
                });
                collector.stop('fled');
                return;
            }

            // Oyuncu saldırı
            let usedSkill = null;
            if (i.customId.startsWith('dg:skill:')) {
                const idx = parseInt(i.customId.split(':')[2]);
                usedSkill = skills[idx] || null;
            }

            const playerDmg = calcDamage(fighter, enemy, usedSkill);
            enemy.hp -= playerDmg;

            let log = `⚔️ **${player.username}** ${usedSkill ? `**${usedSkill.name}** ile` : ''} **${playerDmg}** hasar verdi!\n`;
            if (usedSkill) {
                const eff = applyEffects(usedSkill, fighter, enemy);
                if (eff.length) log += eff.join('\n') + '\n';
            }

            // Düşman öldü
            if (enemy.hp <= 0) {
                const goldRoom = Math.floor(Math.random() * 100 + 50);
                const expRoom = enemy.exp;
                totalExpGained += expRoom;
                totalGoldGained += goldRoom;
                if (currentRoom >= totalRooms) totalDiamondGained += dungeon.rewards.diamond;

                log += `✅ **${enemy.name}** yenildi! +${expRoom} EXP +${goldRoom} 💰\n`;

                if (currentRoom >= totalRooms) {
                    // Zindan tamamlandı!
                    collector.stop('done');
                    player.inBattle = false;
                    const bonusGold = Math.floor(Math.random() * (dungeon.rewards.gold[1] - dungeon.rewards.gold[0]) + dungeon.rewards.gold[0]);
                    totalGoldGained += bonusGold;
                    totalExpGained += dungeon.rewards.expBonus;
                    player.gold += totalGoldGained;
                    player.diamond += totalDiamondGained;
                    player.hp = Math.min(player.maxHp, fighter.hp);
                    await player.save();
                    await addExp(player, totalExpGained, message.channel);
                    await checkAchievements(player, message.channel);

                    const doneEmbed = new EmbedBuilder()
                        .setColor(0xf1c40f)
                        .setTitle('🏆 Zindan Tamamlandı!')
                        .setDescription(`${dungeon.name} temizlendi!`)
                        .addFields(
                            { name: '🎁 Toplam Ödüller', value: `💰 +${totalGoldGained} Altın\n💎 +${totalDiamondGained} Elmas\n📈 +${totalExpGained} EXP`, inline: true },
                            { name: '❤️ Kalan HP', value: `${Math.max(0, fighter.hp)}/${fighter.maxHp}`, inline: true }
                        )
                        .setFooter({ text: '⚡ Kurayami RPG • Dungeon' });
                    await msg.edit({ embeds: [doneEmbed], components: [] });
                    return;
                }

                // Sonraki oda
                currentRoom++;
                enemy = getEnemy(currentRoom);
                const isBoss = currentRoom >= totalRooms;
                log += isBoss ? `\n💀 Son oda — **${enemy.name}** BOSS ÇIKTI!` : `\n🚪 Oda **${currentRoom}** — **${enemy.emoji} ${enemy.name}** belirdi!`;
                await msg.edit({ embeds: [makeRoomEmbed(log)], components: buildButtons() });
                return;
            }

            // Düşman saldırı
            const enemyDmg = Math.max(1, Math.floor(enemy.power * 1.5 - fighter.defense / 2 + Math.random() * 10));
            fighter.hp -= enemyDmg;
            log += `🔴 **${enemy.name}** → **${enemyDmg}** hasar verdi!`;

            if (fighter.hp <= 0) {
                if (fighter.hasRevive) {
                    fighter.hp = Math.floor(fighter.maxHp * 0.3);
                    fighter.hasRevive = false;
                    log += '\n✨ Ölümden döndün!';
                } else {
                    collector.stop('lose');
                    player.inBattle = false;
                    player.hp = 1;
                    player.gold += Math.floor(totalGoldGained / 2);
                    await player.save();
                    await addExp(player, Math.floor(totalExpGained / 2), null);
                    await msg.edit({
                        embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle('💀 Zindanda Düştün!')
                            .setDescription(`**${enemy.emoji} ${enemy.name}** seni alt etti!\nKazandığın ödüllerin yarısı alındı.`)
                            .addFields({ name: '🎁 Alınan Ödüller', value: `💰 +${Math.floor(totalGoldGained / 2)} | 📈 +${Math.floor(totalExpGained / 2)} EXP`, inline: true })
                            .setFooter({ text: '⚡ Kurayami RPG • Dungeon' })],
                        components: []
                    });
                    return;
                }
            }

            await msg.edit({ embeds: [makeRoomEmbed(log)], components: buildButtons() });
        });

        collector.on('end', async (_, reason) => {
            if (!['done', 'lose', 'fled'].includes(reason)) {
                player.inBattle = false;
                await player.save();
                msg.edit({ components: [] }).catch(() => { });
            }
        });
    }
};
