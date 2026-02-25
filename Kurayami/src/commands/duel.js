const Player = require('../models/Player');
const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { errorEmbed } = require('../utils/embedBuilder');
const { applyEffects, processDotsAndStatuses, isSkipping, buildFighterState } = require('../utils/combatEngine');
const { addExp } = require('../utils/levelSystem');
const { checkAchievements } = require('../utils/achievementSystem');
const { safeDeferUpdate, safeReply } = require('../utils/interactionUtils');
const battleSessions = require('../utils/battleSessions');
const { getOrCreateBattleThread } = require('../utils/threadHelper');

const RACE_SKILLS = require('../data/race_skills.json');

// ──────── Skill çekimi ────────
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
            if (skills.length >= 4) break;
            if (!skills.find(s => s.name === ws.name)) {
                skills.push(ws);
            }
        }
    }

    return skills;
}

// ──────── Hasar hesabı (power çarpanlı + damage destekli) ────────
function calcDmg(attacker, defender, skill = null) {
    const base = attacker.power * 2;
    const rand = Math.floor(Math.random() * 10) + 1;
    let dmg;
    if (skill?.damage) {
        dmg = Math.floor(base * (skill.damage / 100)) - Math.floor(defender.defense / 2) + rand;
    } else if (skill?.power) {
        dmg = Math.floor(base * skill.power) - Math.floor(defender.defense / 2) + rand;
    } else {
        dmg = Math.floor(base) - Math.floor(defender.defense / 2) + rand;
    }
    return Math.max(1, dmg);
}


// ──────── HP bar ────────
function hpBar(hp, max, len = 10) {
    const fill = Math.round((Math.max(0, hp) / max) * len);
    return '🟩'.repeat(fill) + '⬛'.repeat(len - fill);
}

// ──────── Embed ────────
function buildDuelEmbed(f1, f2, log, turn, ranked) {
    const pct1 = Math.max(0, Math.round((f1.hp / f1.maxHp) * 100));
    const pct2 = Math.max(0, Math.round((f2.hp / f2.maxHp) * 100));

    const statusLine = (f) => {
        const parts = [];
        if (f.burn) parts.push(`🔥 Yanıyor(${f.burn.duration}t)`);
        if (f.dot) parts.push(`☠️ Zehir(${f.dot.duration}t)`);
        if (f.frozen > 0) parts.push(`🧊 Donmuş`);
        if (f.stunned > 0) parts.push(`💫 Sersem`);
        return parts.join(' ') || '✅ Normal';
    };

    return new EmbedBuilder()
        .setColor(ranked ? 0xe74c3c : 0x3498db)
        .setTitle(`${ranked ? '🏆 Ranked' : '⚔️'} Düello — Tur ${turn}`)
        .addFields(
            {
                name: `🔵 ${f1.name} [${pct1}%]`,
                value: `${hpBar(f1.hp, f1.maxHp)} \`${Math.max(0, f1.hp)}/${f1.maxHp}\`\n${statusLine(f1)}`,
                inline: true
            },
            { name: '⚔️', value: '\u200b', inline: true },
            {
                name: `🔴 ${f2.name} [${pct2}%]`,
                value: `${hpBar(f2.hp, f2.maxHp)} \`${Math.max(0, f2.hp)}/${f2.maxHp}\`\n${statusLine(f2)}`,
                inline: true
            },
            { name: '📜 Son Hamle', value: log.slice(-900) || '—', inline: false }
        )
        .setFooter({ text: '⚡ Kurayami RPG • PvP' })
        .setTimestamp();
}

// ──────── Butonlar ────────
function buildButtons(whoseTurn, skills, cooldowns, disabled = false) {
    const prefix = whoseTurn === 'f1' ? 'duel1' : 'duel2';
    const rows = [];

    const attackBtn = new ButtonBuilder()
        .setCustomId(`${prefix}:attack`)
        .setLabel('⚔️ Saldır')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(disabled);

    const surrenderBtn = new ButtonBuilder()
        .setCustomId(`${prefix}:surrender`)
        .setLabel('🏳️ Teslim Ol')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled);

    rows.push(new ActionRowBuilder().addComponents(attackBtn, surrenderBtn));

    if (skills.length > 0) {
        const skillBtns = skills.slice(0, 4).map((s, idx) => {
            const cd = cooldowns[idx] || 0;
            return new ButtonBuilder()
                .setCustomId(`${prefix}:skill:${idx}`)
                .setLabel(cd > 0 ? `🕐 ${s.name.slice(0, 16)} (${cd}t)` : `⚡ ${s.name.slice(0, 20)}`)
                .setStyle(cd > 0 ? ButtonStyle.Secondary : ButtonStyle.Primary)
                .setDisabled(disabled || cd > 0);
        });
        rows.push(new ActionRowBuilder().addComponents(...skillBtns));
    }

    return rows;
}


module.exports = {
    name: 'duel',
    aliases: ['pvp'],
    description: 'Bir oyuncuya düello meydan oku. +duel @oyuncu [ranked]',
    cooldown: 15,
    async execute(message, args) {
        const ranked = args.includes('ranked');
        const target = message.mentions.users.first();
        if (!target || target.bot || target.id === message.author.id)
            return message.reply({ embeds: [errorEmbed('Geçerli bir oyuncuya meydan oku! Örnek: `+duel @Kullanici`')] });

        const challenger = await Player.findOne({ where: { discordId: message.author.id } });
        const defender = await Player.findOne({ where: { discordId: target.id } });

        if (!challenger) return message.reply({ embeds: [errorEmbed('Önce `+start` komutu ile karakter oluştur!')] });
        if (!defender) return message.reply({ embeds: [errorEmbed(`${target.displayName} henüz karakter oluşturmamış!`)] });
        if (challenger.inBattle || defender.inBattle) return message.reply({ embeds: [errorEmbed('Oyunculardan biri zaten bir savaşta!')] });
        if (challenger.hp <= 0) return message.reply({ embeds: [errorEmbed('HP\'n tükendi! Önce `+rest` ile iyileş.')] });
        if (ranked && challenger.rankedTier === 'unranked') return message.reply({ embeds: [errorEmbed('Ranked\'e girmek için önce 10 düello oyna!')] });

        // Davet
        const inviteRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('duel:accept').setLabel('✅ Kabul Et').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('duel:decline').setLabel('❌ Reddet').setStyle(ButtonStyle.Danger)
        );

        const inviteEmbed = new EmbedBuilder()
            .setColor(ranked ? 0xe74c3c : 0x3498db)
            .setTitle(`${ranked ? '🏆 Ranked' : '⚔️'} Düello Daveti`)
            .setDescription(`**${target.displayName}**, **${message.author.displayName}** seni düelloya davet ediyor!\n\n60 saniyede kabul et!`)
            .setFooter({ text: '⚡ Kurayami RPG • PvP' });

        const inviteMsg = await message.reply({ content: `${target}`, embeds: [inviteEmbed], components: [inviteRow] });
        const inviteCollector = inviteMsg.createMessageComponentCollector({ time: 60000, filter: i => i.user.id === target.id, max: 1 });

        inviteCollector.on('collect', async (inv) => {
            await safeDeferUpdate(inv);
            try {
                if (inv.customId === 'duel:decline') {
                    await inviteMsg.edit({ embeds: [new EmbedBuilder().setColor(0x95a5a6).setDescription(`❌ ${target.displayName} düelloyu reddetti.`)], components: [] });
                    return;
                }

                // Savaş başlat
                challenger.inBattle = true;
                defender.inBattle = true;
                await challenger.save();
                await defender.save();

                const f1 = buildFighterState(challenger, challenger.username);
                const f2 = buildFighterState(defender, defender.username);

                const skills1 = getPlayerSkills(challenger);
                const skills2 = getPlayerSkills(defender);
                const cd1 = skills1.map(() => 0); // cooldown sayaçları
                const cd2 = skills2.map(() => 0);

                let turn = 1;
                let currentTurn = f1.speed >= f2.speed ? 'f1' : 'f2';
                let log = `⚔️ **${currentTurn === 'f1' ? f1.name : f2.name}** ilk hamleyi yapıyor!`;

                await inviteMsg.edit({ embeds: [new EmbedBuilder().setColor(0x2ecc71).setDescription('✅ Duel kabul edildi! Aşağıda devam ediyor.')], components: [] }).catch(() => { });
                const duelChannel = await getOrCreateBattleThread(inviteMsg, `Duel — ${message.author.username} vs ${target.username}`);
                const duelMsg = await duelChannel.send({
                    content: `${message.author} ${target}`,
                    embeds: [buildDuelEmbed(f1, f2, log, turn, ranked)],
                    components: buildButtons(currentTurn, currentTurn === 'f1' ? skills1 : skills2, currentTurn === 'f1' ? cd1 : cd2)
                });
                battleSessions.register(duelMsg.id, 'duel', [message.author.id, target.id]);

                const duelCollector = duelMsg.createMessageComponentCollector({ time: 180000 });

                duelCollector.on('collect', async (btn) => {
                    await safeDeferUpdate(btn);
                    try {
                        const isF1Turn = currentTurn === 'f1';
                        const expectedUser = isF1Turn ? message.author.id : target.id;

                        if (btn.user.id !== expectedUser) {
                            await safeReply(btn, '⏳ Senin turun değil!');
                            return;
                        }

                        const prefix = isF1Turn ? 'duel1' : 'duel2';

                        // 🏳️ Teslim ol
                        if (btn.customId === `${prefix}:surrender`) {
                            duelCollector.stop('done');
                            const loserPlayer = isF1Turn ? challenger : defender;
                            const winnerPlayer = isF1Turn ? defender : challenger;
                            loserPlayer.pvpLosses += 1;
                            loserPlayer.winStreak = 0;
                            winnerPlayer.pvpWins += 1;
                            winnerPlayer.diamond += ranked ? 100 : 20;
                            loserPlayer.inBattle = false;
                            winnerPlayer.inBattle = false;
                            if (ranked) {
                                winnerPlayer.rankedPoints = (winnerPlayer.rankedPoints || 0) + 25;
                                loserPlayer.rankedPoints = Math.max(0, (loserPlayer.rankedPoints || 0) - 15);
                            }
                            await loserPlayer.save();
                            await winnerPlayer.save();
                            await duelMsg.edit({
                                embeds: [new EmbedBuilder().setColor(0x95a5a6)
                                    .setTitle('🏳️ Teslim Olundu!')
                                    .setDescription(`**${isF1Turn ? f1.name : f2.name}** teslim oldu! **${isF1Turn ? f2.name : f1.name}** kazandı!`)
                                    .setFooter({ text: '⚡ Kurayami RPG • PvP' })],
                                components: []
                            });
                            return;
                        }

                        const attacker = isF1Turn ? f1 : f2;
                        const defenderF = isF1Turn ? f2 : f1;
                        const skills = isF1Turn ? skills1 : skills2;
                        const cd = isF1Turn ? cd1 : cd2;
                        const otherCd = isF1Turn ? cd2 : cd1;

                        // DOT/burn efektleri tur başında
                        const dotLogs = processDotsAndStatuses(attacker);

                        if (isSkipping(attacker)) {
                            log = `${dotLogs.join('\n')}\n⏸️ **${attacker.name}** tur atlıyor!`;
                        } else {
                            let usedSkill = null;
                            let skillIdx = -1;

                            if (btn.customId.startsWith(`${prefix}:skill:`)) {
                                skillIdx = parseInt(btn.customId.split(':')[2]);
                                usedSkill = skills[skillIdx] || null;
                                if (!usedSkill) {
                                    await safeReply(btn, '❌ Bu skill kullanılamıyor.');
                                    return;
                                }
                                if ((cd[skillIdx] || 0) > 0) {
                                    await safeReply(btn, '⏳ Bu skill bekleme süresinde.');
                                    return;
                                }
                            }

                            const dmg = calcDmg(attacker, defenderF, usedSkill);
                            defenderF.hp -= dmg;

                            if (usedSkill && skillIdx >= 0) {
                                cd[skillIdx] = usedSkill.cooldown || 2;
                            }

                            // ── Aksiyon logu — skill adı büyük çıksın ──
                            let actionLog = `${isF1Turn ? '🔵' : '🔴'} **${attacker.name}**\n`;
                            if (usedSkill) {
                                actionLog += `> ⚡ **${usedSkill.name}** kullandı → **${dmg}** hasar!`;
                            } else {
                                actionLog += `> ⚔️ Normal saldırı → **${dmg}** hasar!`;
                            }

                            if (usedSkill) {
                                const effectLogs = applyEffects(usedSkill, attacker, defenderF);
                                if (effectLogs.length) actionLog += '\n' + effectLogs.join(' ');
                            }

                            log = (dotLogs.length ? dotLogs.join('\n') + '\n' : '') + actionLog;

                            // Kazanan kontrolü
                            if (defenderF.hp <= 0) {
                                // Revive kontrolü
                                if (defenderF.hasRevive) {
                                    defenderF.hasRevive = false;
                                    defenderF.hp = Math.floor(defenderF.maxHp * 0.2);
                                    log += `\n✨ **${defenderF.name}** ölümden döndü! (%20 HP)`;
                                } else {
                                    duelCollector.stop('done');
                                    const winner = isF1Turn ? challenger : defender;
                                    const loser = isF1Turn ? defender : challenger;

                                    winner.pvpWins += 1;
                                    loser.pvpLosses += 1;
                                    winner.inBattle = false;
                                    loser.inBattle = false;
                                    loser.hp = Math.max(1, Math.floor(loser.maxHp * 0.1));
                                    winner.winStreak = (winner.winStreak || 0) + 1;
                                    loser.winStreak = 0;

                                    const expWin = ranked ? 300 : 100;
                                    const expLose = ranked ? 50 : 30;
                                    const diamondWin = ranked ? 100 : 20;
                                    winner.diamond += diamondWin;

                                    if (ranked) {
                                        winner.rankedPoints = (winner.rankedPoints || 0) + 25;
                                        loser.rankedPoints = Math.max(0, (loser.rankedPoints || 0) - 15);
                                    }

                                    await winner.save();
                                    await loser.save();
                                    await addExp(winner, expWin, message.channel);
                                    await addExp(loser, expLose, null);
                                    await checkAchievements(winner, message.channel);

                                    const endEmbed = new EmbedBuilder()
                                        .setColor(0xf1c40f)
                                        .setTitle('🏆 Düello Bitti!')
                                        .setDescription(`⚡ **${winner.username}** kazandı!\n\n${log}`)
                                        .addFields(
                                            { name: `🥇 ${winner.username}`, value: `+${expWin} EXP\n+${diamondWin} 💎${ranked ? `\n+25 🏆 Ranked Puan` : ''}`, inline: true },
                                            { name: `💀 ${loser.username}`, value: `+${expLose} EXP${ranked ? `\n-15 🏆 Ranked Puan` : ''}`, inline: true }
                                        )
                                        .setFooter({ text: '⚡ Kurayami RPG • PvP' });

                                    await duelMsg.edit({ embeds: [endEmbed], components: [] });
                                    return;
                                }
                            }
                        }

                        // Cooldown'ları 1 azalt (her tur)
                        for (let i = 0; i < cd.length; i++) if (cd[i] > 0) cd[i]--;
                        for (let i = 0; i < otherCd.length; i++) if (otherCd[i] > 0) otherCd[i]--;

                        // Tur geçiş
                        currentTurn = isF1Turn ? 'f2' : 'f1';
                        turn++;
                        const nextSkills = currentTurn === 'f1' ? skills1 : skills2;
                        const nextCd = currentTurn === 'f1' ? cd1 : cd2;

                        await duelMsg.edit({
                            embeds: [buildDuelEmbed(f1, f2, `${log}\n\n➡️ **${currentTurn === 'f1' ? f1.name : f2.name}** hamlesi!`, turn, ranked)],
                            components: buildButtons(currentTurn, nextSkills, nextCd)
                        });
                    } catch (err) {
                        console.error('Duel interaction error:', err);
                        challenger.inBattle = false;
                        defender.inBattle = false;
                        await challenger.save().catch(() => { });
                        await defender.save().catch(() => { });
                        await safeReply(btn, '❌ İşlem sırasında hata oluştu. Lütfen tekrar dene.');
                        duelMsg.edit({ components: [] }).catch(() => { });
                        duelCollector.stop('error');
                    }
                });

                duelCollector.on('end', async (_, reason) => {
                    battleSessions.unregister(duelMsg.id);
                    if (reason !== 'done') {
                        challenger.inBattle = false;
                        defender.inBattle = false;
                        await challenger.save();
                        await defender.save();
                        duelMsg.edit({ components: [] }).catch(() => { });
                    }
                });
            } catch (err) {
                console.error('Duel invite interaction error:', err);
                await safeReply(inv, '❌ İşlem sırasında hata oluştu. Lütfen tekrar dene.');
                inviteCollector.stop('error');
            }
        });

        inviteCollector.on('end', async (_, reason) => {
            if (reason === 'time') {
                inviteMsg.edit({ components: [], embeds: [new EmbedBuilder().setColor(0x95a5a6).setDescription('⏰ Davet süresi doldu.')] }).catch(() => { });
            }
        });
    },

    async handleInteraction(interaction) {
        // Duel butonları zaten collector ile yönetiliyor, 
        // ama global sistem için buraya da ekleyelim
        await interaction.deferUpdate();

        // Davet kabul/red butonları
        if (interaction.customId === 'duel:accept' || interaction.customId === 'duel:decline') {
            // Bu butonlar zaten inviteCollector tarafından handle ediliyor
            return;
        }

        // Skill butonları ve diğer duel butonları
        const [prefix, action, ...rest] = interaction.customId.split(':');
        if (prefix === 'duel1' || prefix === 'duel2') {
            // Bu butonlar zaten duelCollector tarafından handle ediliyor
            return;
        }
    }
};
