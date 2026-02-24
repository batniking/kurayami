const Player = require('../models/Player');
const InventoryItem = require('../models/InventoryItem');
const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { errorEmbed, combatEmbed, getColor } = require('../utils/embedBuilder');
const { calcDamage, applyEffects, processDotsAndStatuses, isSkipping, buildFighterState } = require('../utils/combatEngine');
const { addExp } = require('../utils/levelSystem');
const { checkAchievements } = require('../utils/achievementSystem');
const { safeDeferUpdate, safeReply } = require('../utils/interactionUtils');
const battleSessions = require('../utils/battleSessions');
const { getOrCreateBattleThread } = require('../utils/threadHelper');

const BOSSES_DATA = require('../data/bosses.json');
const RACE_SKILLS = require('../data/race_skills.json');

function getAllBosses() {
    const all = [];
    for (const key of ['bleach', 'aot', 'sololeveling', 'crossover', 'anime_bosses']) {
        if (BOSSES_DATA[key]) all.push(...BOSSES_DATA[key]);
    }
    return all;
}

function pickBoss(playerLevel, bossId) {
    const all = getAllBosses();
    if (bossId) return all.find(b => b.id === bossId) || null;
    let pool;
    if (playerLevel < 20) pool = all.filter(b => b.tier === 'weak');
    else if (playerLevel < 50) pool = all.filter(b => ['weak', 'medium'].includes(b.tier));
    else pool = all;
    if (!pool.length) pool = all;
    return pool[Math.floor(Math.random() * pool.length)];
}

function getPlayerSkills(player) {
    const race = player.race;
    const evolution = player.raceEvolution || 0;
    if (!race || evolution === 0) return [];

    // Önce race-specific skill'leri al
    let skills = [];
    
    if (race === 'shinigami') {
        const id = player.raceData?.zanpakuto || 'default_shinigami';
        const z = RACE_SKILLS.shinigami.find(z => z.id === id) || RACE_SKILLS.shinigami.find(z => z.id === 'default_shinigami');
        skills = z ? (evolution >= 2 ? z.bankai : z.shikai) : [];
    }
    if (race === 'hollow') {
        const id = player.raceData?.espada || 'default_hollow';
        const e = RACE_SKILLS.hollow.find(e => e.id === id) || RACE_SKILLS.hollow.find(e => e.id === 'default_hollow');
        skills = e?.skills || [];
    }
    if (race === 'quincy') {
        const q = RACE_SKILLS.quincy.find(q => q.id === 'default_quincy');
        if (!q) skills = [];
        else if (evolution >= 3) skills = q.yhwach;
        else if (evolution >= 2) skills = q.sternritter;
        else skills = q.vollstandig;
    }
    
    // Anime special skill'leri - her ırk kullanabilir
    if (RACE_SKILLS.anime_special && RACE_SKILLS.anime_special.length > 0) {
        const animeSkills = RACE_SKILLS.anime_special[0]?.skills || [];
        // Race skill'leri varsa onları kullan, yoksa anime skill'leri kullan
        if (skills.length === 0) {
            skills = animeSkills.slice(0, 3); // Max 3 skill göster
        }
    }
    
    return skills;
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
    name: 'bosshunt',
    aliases: ['boss', 'bh'],
    description: 'Boss ile savaş! Kullanım: +bosshunt [boss_id]',
    cooldown: 30,
    async execute(message, args) {
        const player = await Player.findOne({ where: { discordId: message.author.id } });
        if (!player) return message.reply({ embeds: [errorEmbed('Önce `+start` ile karakter oluştur!')] });
        if (player.inBattle) return message.reply({ embeds: [errorEmbed('Zaten bir savaştasın!')] });
        if (player.hp <= 0) return message.reply({ embeds: [errorEmbed('HP\'n tükendi! `+rest` ile iyileş.')] });
        if (player.level < 5) return message.reply({ embeds: [errorEmbed('Boss hunta girmek için en az **Level 5** olmalısın!')] });

        const bossId = args[0]?.toLowerCase() || null;
        const bossTemplate = pickBoss(player.level, bossId);
        if (!bossTemplate) return message.reply({ embeds: [errorEmbed('Boss bulunamadı! `+bosslist` ile mevcut bosslara bak.')] });

        player.inBattle = true;
        await player.save();

        const boss = {
            ...bossTemplate,
            hp: bossTemplate.hp,
            maxHp: bossTemplate.hp,
            tempBuffs: {}, burn: null, dot: null, frozen: 0, stunned: 0, skipTurns: 0, noHeal: 0,
            skillCooldowns: {},
        };

        const skills = getPlayerSkills(player);
        const skillCooldowns = skills.map(() => 0); // skill cooldown sayaçları
        const fighter = buildFighterState(player, player.username);
        let turn = 1;
        let battleLog = `⚠️ **${boss.emoji} ${boss.name}** ortaya çıktı! Savaş başlıyor...`;
        const color = getColor(player.race);

        const tierLabel = { weak: '🟢 Zayıf', medium: '🟡 Orta', strong: '🔴 Güçlü' }[boss.tier] || '❓';

        const buildButtons = (disabled = false) => {
            const attackBtn = new ButtonBuilder().setCustomId('bh:attack').setLabel('⚔️ Saldır').setStyle(ButtonStyle.Danger).setDisabled(disabled);
            const fleeBtn = new ButtonBuilder().setCustomId('bh:flee').setLabel('🏃 Kaç').setStyle(ButtonStyle.Secondary).setDisabled(disabled);
            const row = new ActionRowBuilder().addComponents(attackBtn, fleeBtn);
            if (skills.length > 0) {
                const skillRow = new ActionRowBuilder().addComponents(
                    skills.slice(0, 4).map((s, idx) => {
                        const cd = skillCooldowns[idx] || 0;
                        return new ButtonBuilder()
                            .setCustomId(`bh:skill:${idx}`)
                            .setLabel(cd > 0 ? `🕐 ${s.name.slice(0, 16)} (${cd}t)` : `⚡ ${s.name.slice(0, 20)}`)
                            .setStyle(cd > 0 ? ButtonStyle.Secondary : ButtonStyle.Primary)
                            .setDisabled(disabled || cd > 0);
                    })
                );
                return [row, skillRow];
            }
            return [row];
        };

        const makeBossEmbed = (log) => {
            const playerHpPercent = Math.floor((fighter.hp / fighter.maxHp) * 100);
            const bossHpPercent = Math.floor((boss.hp / boss.maxHp) * 100);
            
            const embed = new EmbedBuilder()
                .setColor(0xe74c3c)
                .setTitle(`${boss.emoji} ${boss.name} Boss Savaşı`)
                .setDescription(`**${tierLabel}** • **Tur ${turn}**\n\n${log}`)
                .setThumbnail(boss.emoji)
                .addFields(
                    { 
                        name: `⚔️ ${player.username}`, 
                        value: `❤️ ${fighter.hp}/${fighter.maxHp} (${playerHpPercent}%)\n⚡ ${fighter.power} • 🛡️ ${fighter.defense} • 💨 ${fighter.speed}`, 
                        inline: true 
                    },
                    { 
                        name: `💀 ${boss.name}`, 
                        value: `❤️ ${Math.max(0, boss.hp)}/${boss.maxHp} (${bossHpPercent}%)\n⚡ ${boss.power} • 🛡️ ${boss.defense} • 💨 ${boss.speed}`, 
                        inline: true 
                    }
                )
                .setFooter({ text: '⚡ Kurayami RPG • Boss Hunt' })
                .setTimestamp();
            
            const skillsText = formatSkills(skills, skillCooldowns);
            if (skillsText) {
                embed.addFields({ 
                    name: '⚡ Yetenekler', 
                    value: skillsText, 
                    inline: false 
                });
            }
            
            return embed;
        };

        const battleChannel = await getOrCreateBattleThread(message, `Boss — ${player.username}`);
        const msg = await battleChannel.send({ content: message.author.toString(), embeds: [makeBossEmbed(battleLog)], components: buildButtons() });
        battleSessions.register(msg.id, 'bosshunt', message.author.id);
        const collector = msg.createMessageComponentCollector({
            time: 120000,
            filter: i => i.user.id === message.author.id,
        });

        collector.on('collect', async (i) => {
            await safeDeferUpdate(i);
            try {
                let actionLog = '';

                // Flee
                if (i.customId === 'bh:flee') {
                    player.inBattle = false;
                    await player.save();
                    await msg.edit({
                        embeds: [new EmbedBuilder().setColor(0x95a5a6).setDescription('🏃 Boss savaşından kaçtın!').setFooter({ text: '⚡ Kurayami RPG' })],
                        components: []
                    });
                    collector.stop('fled');
                    return;
                }

                let usedSkill = null;
                let skillIdx = -1;
                if (i.customId.startsWith('bh:skill:')) {
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

                const playerDmg = calcDamage(fighter, boss, usedSkill);
                boss.hp -= playerDmg;
                actionLog += `⚔️ **${player.username}** ${usedSkill ? `**${usedSkill.name}** ile` : ''} **${playerDmg}** hasar verdi!\n`;
                if (usedSkill && skillIdx >= 0) {
                    skillCooldowns[skillIdx] = usedSkill.cooldown || 2;
                }
                if (usedSkill) {
                    const effectLogs = applyEffects(usedSkill, fighter, boss);
                    if (effectLogs && effectLogs.length) actionLog += effectLogs.join('\n') + '\n';
                }

                // Boss ölümü
                if (boss.hp <= 0) {
                    collector.stop('win');
                    player.inBattle = false;
                    player.totalKills += 1;
                    player.bossKills = (player.bossKills || 0) + 1;
                    player.totalDamageDealt = BigInt(player.totalDamageDealt) + BigInt(playerDmg);
                    player.winStreak += 1;
                    if (player.winStreak > player.bestWinStreak) player.bestWinStreak = player.winStreak;

                    // Drop hesapla
                    const drops = boss.drops;
                    const goldGained = drops.gold
                        ? Math.floor(Math.random() * (drops.gold[1] - drops.gold[0]) + drops.gold[0])
                        : 0;
                    const diamondGained = drops.diamond || 0;
                    const expGained = Math.floor(boss.hp / 10) + 200;

                    player.gold += goldGained;
                    player.diamond += diamondGained;

                    // Race item drop
                    let raceItemStr = '';
                    if (drops.raceItem && Math.random() < (drops.raceItemChance || 0.1)) {
                        await InventoryItem.create({
                            playerId: player.id,
                            itemId: drops.raceItem,
                            itemType: 'race_item',
                            tier: 'legendary',
                            quantity: 1,
                            data: { name: drops.raceItem, emoji: '🌟', type: 'race_item' },
                        });
                        raceItemStr = `\n🌟 **${drops.raceItem}** (Irk İtemi!)`;
                    }

                    // Anime item drop
                    let animeItemStr = '';
                    if (drops.animeItem && Math.random() < (drops.animeItemChance || 0.05)) {
                        await InventoryItem.create({
                            playerId: player.id,
                            itemId: drops.animeItem,
                            itemType: 'anime_material',
                            tier: 'rare',
                            quantity: 1,
                            data: { name: drops.animeItem, emoji: '📦', type: 'anime_material' },
                        });
                        animeItemStr = `\n📦 **${drops.animeItem}** (Anime Malzemesi!)`;
                    }

                    // Anime item 2 drop
                    if (drops.animeItem2 && Math.random() < (drops.animeItem2Chance || 0.05)) {
                        await InventoryItem.create({
                            playerId: player.id,
                            itemId: drops.animeItem2,
                            itemType: 'anime_material',
                            tier: 'rare',
                            quantity: 1,
                            data: { name: drops.animeItem2, emoji: '📦', type: 'anime_material' },
                        });
                        animeItemStr += `\n📦 **${drops.animeItem2}** (Anime Malzemesi!)`;
                    }

                    await player.save();
                    await addExp(player, expGained, message.channel);
                    await checkAchievements(player, message.channel);

                    const wonEmbed = new EmbedBuilder()
                        .setColor(0xf1c40f)
                        .setTitle('🏆 Zafer!')
                        .setThumbnail(boss.emoji)
                        .setDescription(`${boss.emoji} **${boss.name}** bertaraf edildi!`)
                        .addFields(
                            {
                                name: '🎁 Kazanılan Ödüller',
                                value: `💰 **${goldGained.toLocaleString()}** Altın\n💎 **${diamondGained}** Elmas\n📈 **${expGained}** EXP${raceItemStr}${animeItemStr}`,
                                inline: true
                            },
                            {
                                name: '📊 İstatistikler',
                                value: `⚔️ **${turn}** Turda\n🏆 **${player.winStreak}** Galibiyet Serisi\n👹 **${player.bossKills}** Toplam Boss`,
                                inline: true
                            },
                            { name: `🎯 ${boss.name} Bilgisi`, value: `**Tier:** ${tierLabel}\n⚡ ${boss.power} • 🛡️ ${boss.defense} • 💨 ${boss.speed}`, inline: true }
                        )
                        .setFooter({ text: '⚡ Kurayami RPG • Boss Hunt' })
                        .setTimestamp();

                    await msg.edit({ embeds: [wonEmbed], components: [] });
                    return;
                }

                // Boss DOT
                const dotLogs = processDotsAndStatuses(boss);
                if (dotLogs && dotLogs.length) actionLog += dotLogs.join(' ') + '\n';

                // Boss saldırı — cooldown sistemi
                if (!isSkipping(boss)) {
                    // Boss skill mi, normal saldırı mı?
                    let bossUsedSkill = null;
                    if (boss.skills?.length) {
                        for (const sk of boss.skills) {
                            const cd = boss.skillCooldowns[sk.name] || 0;
                            if (cd <= 0) {
                                bossUsedSkill = sk;
                                boss.skillCooldowns[sk.name] = sk.cooldown;
                                break;
                            }
                        }
                        // Cooldownları azalt
                        for (const key in boss.skillCooldowns) {
                            if (boss.skillCooldowns[key] > 0) boss.skillCooldowns[key]--;
                        }
                    }

                    let bossDmg;
                    if (bossUsedSkill) {
                        bossDmg = Math.max(1, bossUsedSkill.damage - Math.floor(fighter.defense / 2));
                        actionLog += `💀 **${boss.name}** → **${bossUsedSkill.name}** ile **${bossDmg}** hasar verdi!\n`;
                        // Boss skill efekti (self heal)
                        if (bossUsedSkill.effect?.self?.healPercent) {
                            const heal = Math.floor(boss.maxHp * bossUsedSkill.effect.self.healPercent);
                            boss.hp = Math.min(boss.maxHp, boss.hp + heal);
                            actionLog += `💚 **${boss.name}** ${heal} HP iyileşti!\n`;
                        }
                    } else {
                        bossDmg = Math.max(1, Math.floor(boss.power * 1.5 - fighter.defense / 2 + Math.random() * 15));
                        actionLog += `🔴 **${boss.name}** → **${bossDmg}** hasar verdi!`;
                    }

                    fighter.hp -= bossDmg;
                } else {
                    actionLog += `⏸️ **${boss.name}** tur atlıyor...`;
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
                            .setColor(0xe74c3c)
                            .setTitle('💀 Mağlubiyet')
                            .setThumbnail(boss.emoji)
                            .setDescription(`${boss.emoji} **${boss.name}** seni yendi!`)
                            .addFields(
                                {
                                    name: '💡 İpuçları',
                                    value: `⚔️ Daha fazla **Power** ve **Defense** statı\n🛡️ Daha iyi **item'ler** ve **set'ler**\n💊 **Boss** ile aynı seviyede dövüşme\n🎯 **Skill'lerini** stratejik kullan`,
                                    inline: false
                                },
                                {
                                    name: '📊 Mevcut Durum',
                                    value: `⚡ ${fighter.power} • 🛡️ ${fighter.defense}\n💨 ${fighter.speed} • ❤️ ${fighter.maxHp} HP`,
                                    inline: true
                                },
                                {
                                    name: `🎯 ${boss.name} Bilgisi`,
                                    value: `**Tier:** ${tierLabel}\n⚡ ${boss.power} • 🛡️ ${boss.defense}`,
                                    inline: true
                                }
                            )
                            .setFooter({ text: '⚡ Kurayami RPG • Pes etme, devam et!' })
                            .setTimestamp();
                        await msg.edit({ embeds: [lostEmbed], components: [] });
                        return;
                    }
                }

                // Cooldown'ları 1 azalt (her tur)
                for (let i = 0; i < skillCooldowns.length; i++) {
                    if (skillCooldowns[i] > 0) skillCooldowns[i]--;
                }

                turn++;
                await msg.edit({ embeds: [makeBossEmbed(actionLog)], components: buildButtons() });
            } catch (err) {
                console.error('Boss hunt interaction error:', err);
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
        // Boss hunt butonları zaten collector ile yönetiliyor
        await interaction.deferUpdate();
        
        const [prefix, action, ...rest] = interaction.customId.split(':');
        if (prefix === 'bh') {
            // Bu butonlar zaten bossCollector tarafından handle ediliyor
            return;
        }
    }
};
