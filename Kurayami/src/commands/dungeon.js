const Player = require('../models/Player');
const InventoryItem = require('../models/InventoryItem');
const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { errorEmbed } = require('../utils/embedBuilder');
const { calcDamage, applyEffects, buildFighterState, processDotsAndStatuses, isSkipping } = require('../utils/combatEngine');
const { addExp } = require('../utils/levelSystem');
const { checkAchievements } = require('../utils/achievementSystem');
const { safeDeferUpdate, safeReply } = require('../utils/interactionUtils');
const battleSessions = require('../utils/battleSessions');
const { getOrCreateBattleThread } = require('../utils/threadHelper');
const RACE_SKILLS = require('../data/race_skills.json');
// ──────── Dungeon Tanımları ────────
const DUNGEONS = {
    goblin_cave: {
        name: '🕳️ Goblin Mağarası',
        minLevel: 1,
        rooms: 3,
        color: 0x2ecc71,
        enemies: [
            { name: 'Goblin', emoji: '👺', hp: 100, maxHp: 100, power: 15, defense: 5, speed: 20, exp: 25 },
            { name: 'Goblin Şefi', emoji: '👿', hp: 250, maxHp: 250, power: 30, defense: 15, speed: 25, exp: 60 },
        ],
        boss: { name: 'Dev Goblin Kral', emoji: '🔰', hp: 600, maxHp: 600, power: 55, defense: 28, speed: 30, exp: 180 },
        rewards: { gold: [200, 500], diamond: 30, expBonus: 120 },
    },
    hollow_forest: {
        name: '🌲 Hollow Ormanı',
        minLevel: 10,
        rooms: 4,
        color: 0x27ae60,
        enemies: [
            { name: 'Orman Hollow\'u', emoji: '👻', hp: 300, maxHp: 300, power: 40, defense: 20, speed: 35, exp: 70 },
            { name: 'Hollow Avcısı', emoji: '🎯', hp: 450, maxHp: 450, power: 55, defense: 30, speed: 45, exp: 100 },
        ],
        boss: { name: 'Orman Ruhu Menos', emoji: '🌑', hp: 1400, maxHp: 1400, power: 95, defense: 55, speed: 60, exp: 400 },
        rewards: { gold: [700, 1400], diamond: 120, expBonus: 350 },
    },
    soul_tower: {
        name: '🗼 Ruh Kulesi',
        minLevel: 25,
        rooms: 5,
        color: 0x8e44ad,
        enemies: [
            { name: 'Shinigami Muhafızı', emoji: '⚫', hp: 700, maxHp: 700, power: 80, defense: 50, speed: 60, exp: 150 },
            { name: 'Quincy Askeri', emoji: '🏹', hp: 650, maxHp: 650, power: 90, defense: 45, speed: 70, exp: 160 },
        ],
        boss: { name: 'General Yamamoto', emoji: '🔥', hp: 3200, maxHp: 3200, power: 160, defense: 110, speed: 85, exp: 750 },
        rewards: { gold: [2500, 5000], diamond: 350, expBonus: 900 },
    },
    shadow_dungeon: {
        name: '🌌 Gölge Zindanı',
        minLevel: 50,
        rooms: 6,
        color: 0x1a1a2e,
        enemies: [
            { name: 'Gölge Ordusu', emoji: '🌑', hp: 1500, maxHp: 1500, power: 130, defense: 80, speed: 100, exp: 280 },
            { name: 'Double Dungeon Cini', emoji: '😈', hp: 2000, maxHp: 2000, power: 160, defense: 100, speed: 110, exp: 350 },
        ],
        boss: { name: 'Karanlık Kral', emoji: '👑', hp: 8500, maxHp: 8500, power: 260, defense: 190, speed: 165, exp: 1600 },
        rewards: { gold: [10000, 18000], diamond: 1200, expBonus: 2200 },
    },
    jjk_domain: {
        name: '🌀 JJK Alan Genişlemesi',
        minLevel: 35,
        rooms: 4,
        color: 0xe74c3c,
        enemies: [
            { name: 'Lanet Ruhu (Sınıf 2)', emoji: '👁️', hp: 900, maxHp: 900, power: 100, defense: 60, speed: 80, exp: 200 },
            { name: 'Lanet Ruhu (Sınıf 1)', emoji: '☠️', hp: 1200, maxHp: 1200, power: 120, defense: 75, speed: 90, exp: 250 },
        ],
        boss: { name: 'Mahkum Lanet Ruhu', emoji: '🩸', hp: 4500, maxHp: 4500, power: 190, defense: 130, speed: 110, exp: 1000 },
        rewards: { gold: [4000, 8000], diamond: 600, expBonus: 1200 },
    },
    gate_abyss: {
        name: '⚫ S-Rank Kapısı',
        minLevel: 70,
        rooms: 7,
        color: 0x2c3e50,
        enemies: [
            { name: 'Kapı Canavarı', emoji: '🐉', hp: 2500, maxHp: 2500, power: 180, defense: 130, speed: 120, exp: 400 },
            { name: 'S-Rank Yaratık', emoji: '💀', hp: 3000, maxHp: 3000, power: 200, defense: 150, speed: 130, exp: 450 },
        ],
        boss: { name: 'Kaos Canavarı', emoji: '🌪️', hp: 12000, maxHp: 12000, power: 320, defense: 230, speed: 180, exp: 2500 },
        rewards: { gold: [20000, 35000], diamond: 2000, expBonus: 3500 },
    },
};

// ──────── Skill çekimi ────────
function getPlayerSkills(player) {
    const race = player.race;
    const evolution = player.raceEvolution || 0;
    if (!race || evolution === 0) return [];

    if (race === 'shinigami') {
        const id = player.raceData?.zanpakuto || 'default_shinigami';
        const z = RACE_SKILLS.shinigami.find(z => z.id === id) || RACE_SKILLS.shinigami.find(z => z.id === 'default_shinigami');
        return z ? (evolution >= 2 ? z.bankai : z.shikai) : [];
    }
    if (race === 'hollow') {
        const id = player.raceData?.espada || 'default_hollow';
        const e = RACE_SKILLS.hollow.find(e => e.id === id) || RACE_SKILLS.hollow.find(e => e.id === 'default_hollow');
        return e?.skills || [];
    }
    if (race === 'quincy') {
        const q = RACE_SKILLS.quincy.find(q => q.id === 'default_quincy');
        if (!q) return [];
        if (evolution >= 3) return q.yhwach;
        if (evolution >= 2) return q.sternritter;
        return q.vollstandig;
    }
    return [];
}

// ──────── HP Bar ────────
function hpBar(hp, max, len = 8) {
    const fill = Math.round((Math.max(0, hp) / max) * len);
    return '🟩'.repeat(fill) + '⬛'.repeat(len - fill);
}

function formatSkills(skills, cooldowns) {
    if (!skills.length) return null;
    const parts = skills.slice(0, 4).map((s, idx) => {
        const cd = cooldowns[idx] || 0;
        return cd > 0 ? `🕐 ${s.name} (${cd}t)` : `⚡ ${s.name}`;
    });
    const text = parts.join(' | ');
    return text.length > 800 ? parts.join('\n') : text;
}

module.exports = {
    name: 'dungeon',
    aliases: ['dg', 'zindan'],
    description: 'Zindana gir! +dungeon list | +dungeon <id>',
    cooldown: 30,
    async execute(message, args) {
        const player = await Player.findOne({ where: { discordId: message.author.id } });
        if (!player) return message.reply({ embeds: [errorEmbed('Önce `+start` ile karakter oluştur!')] });

        // ── Liste ──
        if (args[0] === 'list' || args[0] === 'liste') {
            const listEmbed = new EmbedBuilder()
                .setColor(0x9b59b6)
                .setTitle('🗺️ Zindan Listesi')
                .setDescription('`+dungeon <id>` ile zindana gir\n`+dungeon list` ile tekrar göster')
                .addFields(
                    Object.entries(DUNGEONS).map(([id, d]) => ({
                        name: `${d.name} — \`${id}\``,
                        value: `📊 Min Level: **${d.minLevel}** | 🚪 ${d.rooms} Oda | 💀 Boss: **${d.boss.name}**\n💰 ${d.rewards.gold[0]}-${d.rewards.gold[1]} | 💎 ${d.rewards.diamond} | 📈 +${d.rewards.expBonus} EXP bonus`,
                        inline: false
                    }))
                )
                .setFooter({ text: '⚡ Kurayami RPG • Dungeon' });
            return message.reply({ embeds: [listEmbed] });
        }

        // ── Zindan seçimi ──
        const dungeonId = args[0]?.toLowerCase() || 'goblin_cave';
        const dungeon = DUNGEONS[dungeonId];
        if (!dungeon) return message.reply({ embeds: [errorEmbed(`Zindan bulunamadı! \`+dungeon list\` ile listeye bak.`)] });
        if (player.level < dungeon.minLevel) return message.reply({ embeds: [errorEmbed(`Bu zindana girmek için **Level ${dungeon.minLevel}** olmalısın! (Şu an: ${player.level})`)] });
        if (player.inBattle) return message.reply({ embeds: [errorEmbed('Zaten bir savaştasın!')] });
        if (player.hp <= 0) return message.reply({ embeds: [errorEmbed('HP\'n tükendi! `+rest` ile iyileş.')] });

        player.inBattle = true;
        await player.save();

        const skills = getPlayerSkills(player);
        const skillCooldowns = skills.map(() => 0);
        const fighter = buildFighterState(player, player.username);

        let currentRoom = 1;
        const totalRooms = dungeon.rooms;
        let totalExpGained = 0;
        let totalGoldGained = 0;
        let totalDiamondGained = 0;

        const getEnemy = (room) => {
            if (room >= totalRooms) {
                return { ...dungeon.boss, tempBuffs: {}, burn: null, dot: null, dotPercent: null, frozen: 0, stunned: 0, skipTurns: 0, noHeal: 0, hasRevive: false };
            }
            const base = dungeon.enemies[Math.floor(Math.random() * dungeon.enemies.length)];
            return { ...base, tempBuffs: {}, burn: null, dot: null, dotPercent: null, frozen: 0, stunned: 0, skipTurns: 0, noHeal: 0, hasRevive: false };
        };

        let enemy = getEnemy(currentRoom);

        const makeEmbed = (log) => {
            const isBoss = currentRoom >= totalRooms;
            const pctP = Math.max(0, Math.round((fighter.hp / fighter.maxHp) * 100));
            const pctE = Math.max(0, Math.round((enemy.hp / enemy.maxHp) * 100));
            const embed = new EmbedBuilder()
                .setColor(isBoss ? 0xf1c40f : (dungeon.color || 0x9b59b6))
                .setTitle(`${dungeon.name} — ${isBoss ? '💀 BOSS ODASI!' : `Oda ${currentRoom}/${totalRooms}`}`)
                .addFields(
                    { name: `🔵 ${player.username}`, value: `${hpBar(fighter.hp, fighter.maxHp)} ${pctP}%\n\`${Math.max(0, fighter.hp)}/${fighter.maxHp}\``, inline: true },
                    { name: '⚔️', value: '\u200b', inline: true },
                    { name: `${enemy.emoji} ${enemy.name}`, value: `${hpBar(enemy.hp, enemy.maxHp)} ${pctE}%\n\`${Math.max(0, enemy.hp)}/${enemy.maxHp}\``, inline: true },
                    { name: '📜 Son Hamle', value: log.slice(-900), inline: false },
                    { name: '🏆 Toplam', value: `+${totalExpGained} EXP | +${totalGoldGained} 💰 | +${totalDiamondGained} 💎`, inline: false }
                )
                .setFooter({ text: '⚡ Kurayami RPG • Dungeon' })
                .setTimestamp();
            const skillsText = formatSkills(skills, skillCooldowns);
            if (skillsText) embed.addFields({ name: '⚡ Yetenekler', value: skillsText, inline: false });
            return embed;
        };

        const buildButtons = (disabled = false) => {
            const attackBtn = new ButtonBuilder().setCustomId('dg:attack').setLabel('⚔️ Saldır').setStyle(ButtonStyle.Danger).setDisabled(disabled);
            const fleeBtn = new ButtonBuilder().setCustomId('dg:flee').setLabel('🏃 Kaç').setStyle(ButtonStyle.Secondary).setDisabled(disabled);
            const row = new ActionRowBuilder().addComponents(attackBtn, fleeBtn);

            if (skills.length > 0) {
                const skillBtns = skills.slice(0, 4).map((s, idx) => {
                    const cd = skillCooldowns[idx] || 0;
                    return new ButtonBuilder()
                        .setCustomId(`dg:skill:${idx}`)
                        .setLabel(cd > 0 ? `🕐 ${s.name.slice(0, 16)} (${cd}t)` : `⚡ ${s.name.slice(0, 20)}`)
                        .setStyle(cd > 0 ? ButtonStyle.Secondary : ButtonStyle.Primary)
                        .setDisabled(disabled || cd > 0);
                });
                return [row, new ActionRowBuilder().addComponents(...skillBtns)];
            }
            return [row];
        };

        const battleChannel = await getOrCreateBattleThread(message, `Dungeon — ${player.username}`);
        const msg = await battleChannel.send({
            content: message.author.toString(),
            embeds: [makeEmbed(`🚪 **${dungeon.name}**'a girdin!\n${enemy.emoji} **${enemy.name}** ile karşılaştın!`)],
            components: buildButtons()
        });
        battleSessions.register(msg.id, 'dungeon', message.author.id);
        const collector = msg.createMessageComponentCollector({ time: 180000, filter: i => i.user.id === message.author.id });

        collector.on('collect', async (i) => {
            await safeDeferUpdate(i);
            try {
                // ── Kaç ──
                if (i.customId === 'dg:flee') {
                    player.inBattle = false;
                    player.gold += totalGoldGained;
                    player.diamond += totalDiamondGained;
                    await player.save();
                    if (totalExpGained > 0) await addExp(player, totalExpGained, null);
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

            // ── Oyuncu hamlesi ──
            let usedSkill = null;
            let skillIdx = -1;
            if (i.customId.startsWith('dg:skill:')) {
                skillIdx = parseInt(i.customId.split(':')[2]);
                usedSkill = skills[skillIdx] || null;
                if (!usedSkill) {
                    await safeReply(i, '❌ Bu skill kullanılamıyor.');
                    return;
                }
                if ((skillCooldowns[skillIdx] || 0) > 0) {
                    await safeReply(i, '⏳ Bu skill bekleme süresinde.');
                    return;
                }
            }

            // DOT işle
            const dotLogs = processDotsAndStatuses(fighter);
            let log = dotLogs.length ? dotLogs.join('\n') + '\n' : '';

            if (isSkipping(fighter)) {
                log += `⏸️ **${player.username}** tur atlıyor!\n`;
            } else {
                const playerDmg = calcDamage(fighter, enemy, usedSkill);
                enemy.hp -= playerDmg;
                if (usedSkill && skillIdx >= 0) {
                    skillCooldowns[skillIdx] = usedSkill.cooldown || 2;
                }
                for (let k = 0; k < skillCooldowns.length; k++) {
                    if (skillCooldowns[k] > 0 && k !== skillIdx) skillCooldowns[k]--;
                }

                if (usedSkill) {
                    log += `⚔️ **${player.username}**\n> ⚡ **${usedSkill.name}** kullandı → **${playerDmg}** hasar!\n`;
                    const eff = applyEffects(usedSkill, fighter, enemy);
                    if (eff.length) log += eff.join(' ') + '\n';
                } else {
                    log += `⚔️ **${player.username}** → **${playerDmg}** hasar!\n`;
                }
            }

            // ── Düşman öldü ──
            if (enemy.hp <= 0) {
                const goldRoom = Math.floor(Math.random() * 120 + 60);
                totalExpGained += enemy.exp;
                totalGoldGained += goldRoom;
                log += `✅ **${enemy.name}** yenildi! +${enemy.exp} EXP +${goldRoom} 💰\n`;

                if (currentRoom >= totalRooms) {
                    // Zindan tamamlandı!
                    collector.stop('done');
                    player.inBattle = false;
                    totalDiamondGained += dungeon.rewards.diamond;
                    const bonusGold = Math.floor(Math.random() * (dungeon.rewards.gold[1] - dungeon.rewards.gold[0]) + dungeon.rewards.gold[0]);
                    totalGoldGained += bonusGold;
                    totalExpGained += dungeon.rewards.expBonus;
                    player.gold += totalGoldGained;
                    player.diamond += totalDiamondGained;
                    player.hp = Math.min(player.maxHp, Math.max(1, fighter.hp));
                    await player.save();
                    await addExp(player, totalExpGained, message.channel);
                    await checkAchievements(player, message.channel);

                    const pct = Math.max(0, Math.round((fighter.hp / fighter.maxHp) * 100));
                    const doneEmbed = new EmbedBuilder()
                        .setColor(0xf1c40f)
                        .setTitle('🏆 Zindan Tamamlandı!')
                        .setDescription(`${dungeon.name} tamamen temizlendi!`)
                        .addFields(
                            { name: '❤️ Kalan HP', value: `${hpBar(fighter.hp, fighter.maxHp)} ${pct}%`, inline: false },
                            { name: '🎁 Toplam Ödüller', value: `💰 +${totalGoldGained} Altın\n💎 +${totalDiamondGained} Elmas\n📈 +${totalExpGained} EXP`, inline: true },
                            { name: '🔥 Boss Bonus', value: `+${dungeon.rewards.expBonus} EXP\n+${bonusGold} 💰 ekstra`, inline: true }
                        )
                        .setFooter({ text: `⚡ Kurayami RPG • ${dungeon.name}` });
                    await msg.edit({ embeds: [doneEmbed], components: [] });
                    return;
                }

                // ── Sonraki oda ──
                currentRoom++;
                enemy = getEnemy(currentRoom);
                const isBoss = currentRoom >= totalRooms;
                log += isBoss
                    ? `\n💀 **SON ODA** — ${enemy.emoji} **${enemy.name}** BOSS ÇIKTI!`
                    : `\n🚪 Oda **${currentRoom}** — ${enemy.emoji} **${enemy.name}** belirdi!`;
                await msg.edit({ embeds: [makeEmbed(log)], components: buildButtons() });
                return;
            }

            // ── Düşman saldırısı ──
            const enemyDotLogs = processDotsAndStatuses(enemy);
            if (enemyDotLogs.length) log += enemyDotLogs.join('\n') + '\n';

            if (!isSkipping(enemy)) {
                const enemyDmg = Math.max(1, Math.floor(enemy.power * 1.5 - fighter.defense / 2 + Math.random() * 12));
                fighter.hp -= enemyDmg;
                log += `🔴 **${enemy.name}** → **${enemyDmg}** hasar!`;
            } else {
                log += `⏸️ **${enemy.name}** tur atlıyor...`;
            }

            // ── Oyuncu öldü ──
            if (fighter.hp <= 0) {
                if (fighter.hasRevive) {
                    fighter.hp = Math.floor(fighter.maxHp * 0.3);
                    fighter.hasRevive = false;
                    log += '\n✨ Ölümden döndün! (%30 HP)';
                } else {
                    collector.stop('lose');
                    player.inBattle = false;
                    player.hp = 1;
                    player.gold += Math.floor(totalGoldGained / 2);
                    await player.save();
                    if (totalExpGained > 0) await addExp(player, Math.floor(totalExpGained / 2), null);
                    await msg.edit({
                        embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle('💀 Zindanda Düştün!')
                            .setDescription(`${enemy.emoji} **${enemy.name}** seni alt etti!\nKazancının yarısı alındı.`)
                            .addFields({ name: '🎁 Alınan', value: `💰 +${Math.floor(totalGoldGained / 2)} | 📈 +${Math.floor(totalExpGained / 2)} EXP`, inline: true })
                            .setFooter({ text: '⚡ Kurayami RPG • Dungeon' })],
                        components: []
                    });
                    return;
                }
            }

                await msg.edit({ embeds: [makeEmbed(log)], components: buildButtons() });
            } catch (err) {
                console.error('Dungeon interaction error:', err);
                player.inBattle = false;
                await player.save().catch(() => { });
                await safeReply(i, '❌ İşlem sırasında hata oluştu. Lütfen tekrar dene.');
                msg.edit({ components: buildButtons(true) }).catch(() => { });
                collector.stop('error');
            }
        });

        collector.on('end', async (_, reason) => {
            battleSessions.unregister(msg.id);
            if (!['done', 'lose', 'fled'].includes(reason)) {
                player.inBattle = false;
                await player.save();
                msg.edit({ components: buildButtons(true) }).catch(() => { });
            }
        });
    }
};
