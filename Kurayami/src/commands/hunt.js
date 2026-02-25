const Player = require('../models/Player');
const InventoryItem = require('../models/InventoryItem');
const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { errorEmbed, combatEmbed, getColor } = require('../utils/embedBuilder');
const { calcDamage, applyEffects, processDotsAndStatuses, isSkipping, buildFighterState } = require('../utils/combatEngine');
const { addExp } = require('../utils/levelSystem');
const { rollNpcDrop } = require('../utils/dropSystem');
const { checkAchievements } = require('../utils/achievementSystem');
const { safeDeferUpdate, safeReply } = require('../utils/interactionUtils');
const battleSessions = require('../utils/battleSessions');
const { getOrCreateBattleThread } = require('../utils/threadHelper');
const RACE_SKILLS = require('../data/race_skills.json');


const TIER_COLOR = { weak: 0x2ecc71, medium: 0xe67e22, strong: 0xe74c3c };

const NPCS = [
    // ── ZAYIF ──
    { id: 'weak_hollow', name: 'Zayıf Hollow', tier: 'weak', emoji: '👻', hp: 150, maxHp: 150, power: 20, defense: 10, speed: 15, exp: 30, gold: [30, 80], race: 'hollow' },
    { id: 'hollow_soldier', name: 'Hollow Askeri', tier: 'weak', emoji: '💀', hp: 260, maxHp: 260, power: 30, defense: 15, speed: 20, exp: 50, gold: [50, 120], race: 'hollow' },
    { id: 'low_curse', name: 'Düşük Lanet Ruhu', tier: 'weak', emoji: '👁️', hp: 200, maxHp: 200, power: 25, defense: 12, speed: 18, exp: 40, gold: [40, 100], race: null },
    { id: 'gate_goblin', name: 'Kapı Goblini', tier: 'weak', emoji: '👺', hp: 180, maxHp: 180, power: 22, defense: 8, speed: 25, exp: 35, gold: [35, 90], race: null },
    { id: 'pure_titan', name: 'Saf Titan', tier: 'weak', emoji: '👹', hp: 400, maxHp: 400, power: 45, defense: 20, speed: 10, exp: 80, gold: [70, 150], race: 'titan' },
    { id: 'hollow_grunt', name: 'Hollow Piyonu', tier: 'weak', emoji: '🦴', hp: 220, maxHp: 220, power: 28, defense: 18, speed: 16, exp: 45, gold: [45, 110], race: 'hollow' },
    // ── ORTA ──
    { id: 'soul_reaper', name: 'Soul Reaper Neferi', tier: 'medium', emoji: '⚫', hp: 600, maxHp: 600, power: 60, defense: 35, speed: 40, exp: 120, gold: [150, 300], race: 'shinigami' },
    { id: 'quincy_soldier', name: 'Quincy Askeri', tier: 'medium', emoji: '🏹', hp: 550, maxHp: 550, power: 65, defense: 30, speed: 50, exp: 130, gold: [160, 320], race: 'quincy' },
    { id: 'shadow_soldier', name: 'Gölge Asker', tier: 'medium', emoji: '🌑', hp: 700, maxHp: 700, power: 70, defense: 40, speed: 45, exp: 150, gold: [180, 350], race: null },
    { id: 'medium_curse', name: 'Lanet Ruhu (Özel Seviye)', tier: 'medium', emoji: '🫧', hp: 650, maxHp: 650, power: 68, defense: 38, speed: 42, exp: 140, gold: [170, 330], race: null },
    { id: 'adjuchas_weak', name: 'Küçük Adjuchas', tier: 'medium', emoji: '🦂', hp: 750, maxHp: 750, power: 75, defense: 45, speed: 50, exp: 160, gold: [200, 380], race: 'hollow' },
    { id: 'b_rank_hunter', name: 'B-Rank Avcısı', tier: 'medium', emoji: '🗡️', hp: 580, maxHp: 580, power: 62, defense: 40, speed: 55, exp: 125, gold: [155, 310], race: null },
    // ── GÜÇLÜ ──
    { id: 'captain_reaper', name: 'Kaptan Soul Reaper', tier: 'strong', emoji: '⚡', hp: 1200, maxHp: 1200, power: 100, defense: 70, speed: 80, exp: 250, gold: [400, 700], race: 'shinigami' },
    { id: 'sternritter', name: 'Sternritter', tier: 'strong', emoji: '✦', hp: 1100, maxHp: 1100, power: 95, defense: 65, speed: 85, exp: 240, gold: [380, 680], race: 'quincy' },
    { id: 'special_curse', name: 'Özel Lanet Ruhu', tier: 'strong', emoji: '🌀', hp: 1300, maxHp: 1300, power: 110, defense: 75, speed: 70, exp: 270, gold: [420, 750], race: null },
    { id: 'menos_grande', name: 'Menos Grande', tier: 'strong', emoji: '👿', hp: 1500, maxHp: 1500, power: 105, defense: 80, speed: 60, exp: 280, gold: [450, 800], race: 'hollow' },
    { id: 'a_rank_hunter', name: 'A-Rank Avcısı', tier: 'strong', emoji: '🔰', hp: 1000, maxHp: 1000, power: 90, defense: 60, speed: 90, exp: 220, gold: [350, 650], race: null },
    { id: 'scout_captain', name: 'Survey Corps Kaptanı', tier: 'strong', emoji: '🪖', hp: 900, maxHp: 900, power: 85, defense: 55, speed: 95, exp: 200, gold: [320, 600], race: null },
    { id: 'volt_curse', name: 'Lanet Ruhu (Sınıf 1)', tier: 'strong', emoji: '☠️', hp: 1400, maxHp: 1400, power: 115, defense: 85, speed: 75, exp: 290, gold: [460, 820], race: null },
    { id: 'phantom_soldier', name: 'Phantom Ordu Askeri', tier: 'strong', emoji: '👤', hp: 1050, maxHp: 1050, power: 92, defense: 62, speed: 88, exp: 230, gold: [360, 660], race: null },
];

function pickNpc(playerLevel) {
    let pool;
    if (playerLevel < 15) pool = NPCS.filter(n => n.tier === 'weak');
    else if (playerLevel < 40) pool = NPCS.filter(n => n.tier !== 'strong');
    else pool = NPCS;
    return { ...pool[Math.floor(Math.random() * pool.length)] };
}

function getPlayerSkills(player) {
    const race = player.race;
    const evolution = player.raceEvolution || 0;
    let skills = [];

    // 1. Race skill'leri (evolution >= 1 gerekli)
    if (race && evolution >= 1) {
        if (race === 'shinigami') {
            const id = player.raceData?.zanpakuto || 'default_shinigami';
            const z = RACE_SKILLS.shinigami.find(z => z.id === id) || RACE_SKILLS.shinigami.find(z => z.id === 'default_shinigami');
            skills = z ? (evolution >= 2 ? z.bankai : z.shikai) : [];
        } else if (race === 'hollow') {
            const id = player.raceData?.espada || 'default_hollow';
            const e = RACE_SKILLS.hollow.find(e => e.id === id) || RACE_SKILLS.hollow.find(e => e.id === 'default_hollow');
            skills = e?.skills || [];
        } else if (race === 'quincy') {
            const q = RACE_SKILLS.quincy.find(q => q.id === 'default_quincy');
            if (!q) skills = [];
            else if (evolution >= 3) skills = q.yhwach;
            else if (evolution >= 2) skills = q.sternritter;
            else skills = q.vollstandig;
        }

        // Anime special fallback — race skill yoksa
        if (skills.length === 0 && RACE_SKILLS.anime_special?.length > 0) {
            skills = (RACE_SKILLS.anime_special[0]?.skills || []).slice(0, 3);
        }
    }

    // 2. Silah skill'leri — equipped weapon'da skill varsa ekle
    const weapon = player.equippedWeapon;
    if (weapon?.skills && Array.isArray(weapon.skills)) {
        for (const ws of weapon.skills) {
            if (skills.length >= 4) break; // max 4 skill butonu
            // Aynı isimde skill ekleme
            if (!skills.find(s => s.name === ws.name)) {
                skills.push(ws);
            }
        }
    }

    return skills;
}

function formatSkills(skills, cooldowns) {
    if (!skills.length) return null;
    const parts = skills.slice(0, 3).map((s, idx) => {
        const cd = cooldowns[idx] || 0;
        return cd > 0 ? `🕐 ${s.name} (${cd}t)` : `⚡ ${s.name}`;
    });
    const text = parts.join(' | ');
    return text.length > 800 ? parts.join('\n') : text;
}

module.exports = {
    name: 'hunt',
    aliases: ['h', 'av'],
    description: 'NPC avla, EXP ve item kazan.',
    cooldown: 10,
    async execute(message) {
        // Önce mevcut battle session'larını temizle
        try {
            const existingSessions = battleSessions.sessions;
            for (const [messageId, session] of existingSessions) {
                if (session.userId === message.author.id && ['bosshunt', 'hunt'].includes(session.type)) {
                    console.log(`Clearing stuck battle session for user ${message.author.id}`);
                    battleSessions.unregister(messageId);

                    // Player'ın inBattle durumunu da düzelt
                    const player = await Player.findOne({ where: { discordId: message.author.id } });
                    if (player) {
                        player.inBattle = false;
                        await player.save();
                    }
                }
            }
        } catch (err) {
            console.error('Error clearing battle sessions:', err);
        }

        const player = await Player.findOne({ where: { discordId: message.author.id } });
        if (!player) return message.reply({ embeds: [errorEmbed('Önce `+start` ile karakter oluştur!')] });
        if (player.inBattle) return message.reply({ embeds: [errorEmbed('Zaten bir savaştasın!')] });
        if (player.hp <= 0) return message.reply({ embeds: [errorEmbed('HP\'n tükendi! `+rest` veya pot kullanarak iyileş.')] });

        player.inBattle = true;
        await player.save();

        const npc = pickNpc(player.level);
        const skills = getPlayerSkills(player);
        const skillCooldowns = skills.map(() => 0);
        const fighter = buildFighterState(player, player.username);
        const enemy = { ...npc, tempBuffs: {}, burn: null, dot: null, frozen: 0, stunned: 0, skipTurns: 0, noHeal: 0 };
        let turn = 1;
        let battleLog = '_Savaş başlıyor!_';
        const color = getColor(player.race);

        const buildButtons = (disabled = false) => {
            const attackBtn = new ButtonBuilder().setCustomId('hunt:attack').setLabel('⚔️ Saldır').setStyle(ButtonStyle.Danger).setDisabled(disabled);
            const fleeBtn = new ButtonBuilder().setCustomId('hunt:flee').setLabel('🏃 Kaç').setStyle(ButtonStyle.Secondary).setDisabled(disabled);
            const row = new ActionRowBuilder().addComponents(attackBtn, fleeBtn);

            if (skills.length > 0) {
                const skillBtns = skills.slice(0, 3).map((s, idx) => {
                    const cd = skillCooldowns[idx] || 0;
                    return new ButtonBuilder()
                        .setCustomId(`hunt:skill:${idx}`)
                        .setLabel(cd > 0 ? `🕐 ${s.name.slice(0, 16)} (${cd}t)` : `⚡ ${s.name.slice(0, 20)}`)
                        .setStyle(cd > 0 ? ButtonStyle.Secondary : ButtonStyle.Primary)
                        .setDisabled(disabled || cd > 0);
                });
                return [row, new ActionRowBuilder().addComponents(...skillBtns)];
            }
            return [row];
        };


        const embed = combatEmbed(
            { name: player.username, hp: fighter.hp, maxHp: fighter.maxHp },
            { name: `${npc.emoji} ${npc.name}`, hp: enemy.hp, maxHp: enemy.maxHp },
            battleLog, turn, color, formatSkills(skills, skillCooldowns)
        );

        const battleChannel = await getOrCreateBattleThread(message, `Hunt — ${message.author.username}`);
        const msg = await battleChannel.send({ content: message.author.toString(), embeds: [embed], components: buildButtons() });
        battleSessions.register(msg.id, 'hunt', message.author.id);
        const collector = msg.createMessageComponentCollector({
            time: 60000,
            filter: i => i.user.id === message.author.id,
        });

        collector.on('collect', async (i) => {
            await safeDeferUpdate(i);
            try {
                let actionLog = '';

                if (i.customId === 'hunt:flee') {
                    const fled = Math.random() < 0.5;
                    player.inBattle = false;
                    await player.save();
                    const result = fled ? '🏃 Başarıyla kaçtın!' : '💨 Kaçmaya çalıştın ama başaramadın! Savaş bitti.';
                    await msg.edit({
                        embeds: [new EmbedBuilder().setColor(0x95a5a6).setDescription(result).setFooter({ text: '⚡ Kurayami RPG' })],
                        components: []
                    });
                    collector.stop('fled');
                    return;
                }

                // ── Skill / Saldırı tespiti ──
                let usedSkill = null;
                let skillIdx = -1;
                if (i.customId.startsWith('hunt:skill:')) {
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

                // DOT işleme (saldırıdan önce)
                const dotLogs = processDotsAndStatuses(fighter);
                if (dotLogs && dotLogs.length) actionLog += dotLogs.join('\n') + '\n';

                // Oyuncu saldırı
                const playerDmg = calcDamage(fighter, enemy, usedSkill);
                enemy.hp -= playerDmg;
                if (usedSkill && skillIdx >= 0) skillCooldowns[skillIdx] = usedSkill.cooldown || 2;
                for (let k = 0; k < skillCooldowns.length; k++) if (skillCooldowns[k] > 0 && k !== skillIdx) skillCooldowns[k]--;

                if (usedSkill) {
                    actionLog += `⚔️ **${player.username}**\n> ⚡ **${usedSkill.name}** kullandı → **${playerDmg}** hasar!\n`;
                    const effectLogs = applyEffects(usedSkill, fighter, enemy);
                    if (effectLogs && effectLogs.length) actionLog += effectLogs.join('\n') + '\n';
                } else {
                    actionLog += `⚔️ **${player.username}** → **${playerDmg}** hasar!\n`;
                }

                // Düşman ölümü
                if (enemy.hp <= 0) {
                    collector.stop('win');
                    player.inBattle = false;
                    player.totalKills += 1;
                    player.totalDamageDealt = BigInt(player.totalDamageDealt) + BigInt(playerDmg);
                    player.winStreak += 1;
                    if (player.winStreak > player.bestWinStreak) player.bestWinStreak = player.winStreak;

                    // Drop
                    const drops = rollNpcDrop(npc.tier);
                    for (const drop of drops) {
                        if (drop.type === 'item') {
                            await InventoryItem.create({
                                playerId: player.id,
                                itemId: drop.item.id,
                                itemType: drop.item.type || 'material',
                                tier: drop.item.tier || 'common',
                                quantity: 1,
                                data: drop.item,
                            });
                        }
                    }

                    const goldDrop = drops.find(d => d.type === 'gold')?.amount || (npc.gold ? Math.floor(Math.random() * (npc.gold[1] - npc.gold[0]) + npc.gold[0]) : 50);
                    const diamondDrop = drops.find(d => d.type === 'diamond')?.amount || 0;
                    const itemDrop = drops.find(d => d.type === 'item');

                    player.gold += goldDrop;
                    player.diamond += diamondDrop;

                    const pct = Math.max(0, Math.round((fighter.hp / fighter.maxHp) * 100));
                    const hpBar = '🟩'.repeat(Math.round(pct / 10)) + '⬛'.repeat(10 - Math.round(pct / 10));

                    const wonEmbed = new EmbedBuilder()
                        .setColor(TIER_COLOR[npc.tier] || 0x2ecc71)
                        .setTitle('🏆 Zafer!')
                        .setDescription(`${npc.emoji} **${npc.name}** yenildi!`)
                        .addFields(
                            { name: '❤️ Kalan HP', value: `${hpBar} ${pct}%`, inline: false },
                            { name: '🎁 Ödüller', value: `💰 +${goldDrop} Altın\n💎 +${diamondDrop} Elmas${itemDrop ? `\n📦 ${itemDrop.item.emoji || '📦'} ${itemDrop.item.name}` : ''}`, inline: true },
                            { name: '📈 Kazanç', value: `+${npc.exp} EXP\n🔥 Seri: ${player.winStreak}`, inline: true },
                        )
                        .setFooter({ text: `⚡ Kurayami RPG • Hunt • Tier: ${npc.tier.toUpperCase()}` });


                    await addExp(player, npc.exp, message.channel);
                    await player.save();
                    await checkAchievements(player, message.channel);
                    await msg.edit({ embeds: [wonEmbed], components: [] });
                    return;
                }

                // Düşman DOT işleme
                const enemyDotLogs = processDotsAndStatuses(enemy);
                if (enemyDotLogs && enemyDotLogs.length) actionLog += enemyDotLogs.join(' ') + '\n';

                // Düşman saldırı
                if (!isSkipping(enemy)) {
                    const npcDmg = Math.max(1, Math.floor((enemy.power * 2) - (fighter.defense / 2) + Math.floor(Math.random() * 10)));
                    fighter.hp -= npcDmg;
                    actionLog += `🔴 **${npc.name}** → **${npcDmg}** hasar verdi!`;
                } else {
                    actionLog += `⏸️ **${npc.name}** tur atlıyor...`;
                }

                // Oyuncu ölüm
                if (fighter.hp <= 0) {
                    if (fighter.hasRevive) {
                        fighter.hp = Math.floor(fighter.maxHp * 0.3);
                        fighter.hasRevive = false;
                        actionLog += '\n✨ Ölümden döndün!';
                    } else {
                        collector.stop('lose');
                        player.inBattle = false;
                        player.hp = 1;
                        player.winStreak = 0;
                        await player.save();
                        const lostEmbed = new EmbedBuilder()
                            .setColor(0xe74c3c).setTitle('💀 Yenildin!')
                            .setDescription(`**${npc.emoji} ${npc.name}** seni alt etti! HP 1\'e düştü.`)
                            .setFooter({ text: '⚡ Kurayami RPG • Hunt' });
                        await msg.edit({ embeds: [lostEmbed], components: [] });
                        return;
                    }
                }

                turn++;
                const newEmbed = combatEmbed(
                    { name: player.username, hp: fighter.hp, maxHp: fighter.maxHp },
                    { name: `${npc.emoji} ${npc.name}`, hp: enemy.hp, maxHp: enemy.maxHp },
                    actionLog, turn, color, formatSkills(skills, skillCooldowns)
                );
                await msg.edit({ embeds: [newEmbed], components: buildButtons() });
            } catch (err) {
                console.error('Hunt interaction error:', err);
                player.inBattle = false;
                await player.save().catch(() => { });
                await safeReply(i, '❌ İşlem sırasında hata oluştu. Lütfen tekrar dene.');
                msg.edit({ components: buildButtons(true) }).catch(() => { });
                collector.stop('error');
            }
        });

        collector.on('end', async (_, reason) => {
            battleSessions.unregister(msg.id);
            if (!['win', 'lose', 'fled'].includes(reason)) {
                try {
                    const currentPlayer = await Player.findOne({ where: { discordId: message.author.id } });
                    if (currentPlayer) {
                        currentPlayer.inBattle = false;
                        await currentPlayer.save();
                    }
                } catch (err) {
                    console.error('Error clearing battle state:', err);
                }
                msg.edit({ components: buildButtons(true) }).catch(() => { });
            }
        });
    },

    async handleInteraction(interaction) {
        // Hunt butonları zaten collector ile yönetiliyor
        await interaction.deferUpdate();

        const [prefix, action, ...rest] = interaction.customId.split(':');
        if (prefix === 'hunt') {
            // Bu butonlar zaten huntCollector tarafından handle ediliyor
            return;
        }
    }
};
