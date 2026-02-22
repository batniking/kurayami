const Player = require('../models/Player');
const InventoryItem = require('../models/InventoryItem');
const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { errorEmbed, combatEmbed, getColor } = require('../utils/embedBuilder');
const { calcDamage, applyEffects, processDotsAndStatuses, isSkipping, buildFighterState } = require('../utils/combatEngine');
const { addExp } = require('../utils/levelSystem');
const { rollNpcDrop } = require('../utils/dropSystem');
const { checkAchievements } = require('../utils/achievementSystem');

const NPCS = [
    { id: 'weak_hollow', name: 'Zayıf Hollow', tier: 'weak', emoji: '👻', hp: 150, maxHp: 150, power: 20, defense: 10, speed: 15, exp: 30, race: 'hollow' },
    { id: 'hollow_soldier', name: 'Hollow Asker', tier: 'weak', emoji: '💀', hp: 250, maxHp: 250, power: 30, defense: 15, speed: 20, exp: 50, race: 'hollow' },
    { id: 'pure_titan', name: 'Saf Titan', tier: 'weak', emoji: '👹', hp: 400, maxHp: 400, power: 45, defense: 20, speed: 10, exp: 80, race: 'titan' },
    { id: 'soul_reaper', name: 'Soul Reaper Grunt', tier: 'medium', emoji: '⚫', hp: 600, maxHp: 600, power: 60, defense: 35, speed: 40, exp: 120, race: 'shinigami' },
    { id: 'quincy_soldier', name: 'Quincy Askeri', tier: 'medium', emoji: '🏹', hp: 550, maxHp: 550, power: 65, defense: 30, speed: 50, exp: 130, race: 'quincy' },
    { id: 'shadow_soldier', name: 'Gölge Asker', tier: 'medium', emoji: '🌑', hp: 700, maxHp: 700, power: 70, defense: 40, speed: 45, exp: 150, race: null },
    { id: 'captain_reaper', name: 'Captain Soul Reaper', tier: 'strong', emoji: '⚡', hp: 1200, maxHp: 1200, power: 100, defense: 70, speed: 80, exp: 250, race: 'shinigami' },
    { id: 'sternritter', name: 'Sternritter', tier: 'strong', emoji: '✦', hp: 1100, maxHp: 1100, power: 95, defense: 65, speed: 85, exp: 240, race: 'quincy' },
];

function pickNpc(playerLevel) {
    // Level'e göre uygun NPC'ler
    let pool;
    if (playerLevel < 15) pool = NPCS.filter(n => n.tier === 'weak');
    else if (playerLevel < 40) pool = NPCS.filter(n => n.tier !== 'strong').concat(NPCS.filter(n => n.tier === 'weak'));
    else pool = NPCS;
    return pool[Math.floor(Math.random() * pool.length)];
}

function getPlayerSkills(player) {
    if (player.raceForm) {
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
    }
    return null;
}

module.exports = {
    name: 'hunt',
    aliases: ['h', 'av'],
    description: 'NPC avla, EXP ve item kazan.',
    cooldown: 10,
    async execute(message) {
        const player = await Player.findOne({ where: { discordId: message.author.id } });
        if (!player) return message.reply({ embeds: [errorEmbed('Önce `+start` ile karakter oluştur!')] });
        if (player.inBattle) return message.reply({ embeds: [errorEmbed('Zaten bir savaştasın!')] });
        if (player.hp <= 0) return message.reply({ embeds: [errorEmbed('HP\'n tükendi! `+rest` veya pot kullanarak iyileş.')] });

        player.inBattle = true;
        await player.save();

        const npc = pickNpc(player.level);
        const skills = getPlayerSkills(player);

        const fighter = buildFighterState(player, player.username);
        const enemy = { ...npc, tempBuffs: {}, burn: null, dot: null, frozen: 0, stunned: 0, skipTurns: 0, noHeal: 0 };
        let turn = 1;
        let battleLog = '_Savaş başlıyor!_';
        const color = getColor(player.race);

        const buildButtons = (disabled = false) => {
            const attackBtn = new ButtonBuilder().setCustomId('hunt:attack').setLabel('⚔️ Saldır').setStyle(ButtonStyle.Danger).setDisabled(disabled);
            const fleeBtn = new ButtonBuilder().setCustomId('hunt:flee').setLabel('🏃 Kaç').setStyle(ButtonStyle.Secondary).setDisabled(disabled);
            const row = new ActionRowBuilder().addComponents(attackBtn, fleeBtn);

            if (skills && skills.length > 0) {
                const skillRow = new ActionRowBuilder().addComponents(
                    skills.slice(0, 3).map((s, idx) =>
                        new ButtonBuilder()
                            .setCustomId(`hunt:skill:${idx}`)
                            .setLabel(`⚡ ${s.name.slice(0, 20)}`)
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(disabled)
                    )
                );
                return [row, skillRow];
            }
            return [row];
        };

        const embed = combatEmbed(
            { name: player.username, hp: fighter.hp, maxHp: fighter.maxHp },
            { name: `${npc.emoji} ${npc.name}`, hp: enemy.hp, maxHp: enemy.maxHp },
            battleLog, turn, color
        );

        const msg = await message.reply({ embeds: [embed], components: buildButtons() });
        const collector = msg.createMessageComponentCollector({
            time: 60000,
            filter: i => i.user.id === message.author.id,
        });

        collector.on('collect', async (i) => {
            await i.deferUpdate();

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

            // Oyuncu saldırı
            let usedSkill = null;
            if (i.customId.startsWith('hunt:skill:')) {
                const idx = parseInt(i.customId.split(':')[2]);
                usedSkill = skills?.[idx] || null;
            }

            const playerDmg = calcDamage(fighter, enemy, usedSkill);
            enemy.hp -= playerDmg;
            actionLog += `⚔️ **${player.username}** → ${usedSkill ? `**${usedSkill.name}** ile` : ''} **${playerDmg}** hasar verdi!\n`;
            if (usedSkill) {
                const effectLogs = applyEffects(usedSkill, fighter, enemy);
                if (effectLogs.length) actionLog += effectLogs.join('\n') + '\n';
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
                    if (drop.type === 'gold') player.gold += drop.amount;
                    if (drop.type === 'diamond') player.diamond += drop.amount;
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

                const goldDrop = drops.find(d => d.type === 'gold')?.amount || 0;
                const diamondDrop = drops.find(d => d.type === 'diamond')?.amount || 0;
                const itemDrop = drops.find(d => d.type === 'item');

                const wonEmbed = new EmbedBuilder()
                    .setColor(0x2ecc71)
                    .setTitle('🏆 Zafer!')
                    .setDescription(`**${npc.emoji} ${npc.name}** yenildi!`)
                    .addFields(
                        { name: '🎁 Ödüller', value: `💰 +${goldDrop} Altın\n💎 +${diamondDrop} Elmas${itemDrop ? `\n📦 +1 ${itemDrop.item.name}` : ''}`, inline: true },
                        { name: '📈 EXP', value: `+${npc.exp} EXP`, inline: true },
                    )
                    .setFooter({ text: '⚡ Kurayami RPG • Hunt' });

                await addExp(player, npc.exp, message.channel);
                await player.save();
                await checkAchievements(player, message.channel);
                await msg.edit({ embeds: [wonEmbed], components: [] });
                return;
            }

            // DOT işleme
            const dotLogs = processDotsAndStatuses(enemy);
            if (dotLogs.length) actionLog += dotLogs.join(' ') + '\n';

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
                actionLog, turn, color
            );
            await msg.edit({ embeds: [newEmbed], components: buildButtons() });
        });

        collector.on('end', async (_, reason) => {
            if (!['win', 'lose', 'fled'].includes(reason)) {
                player.inBattle = false;
                await player.save();
                msg.edit({ components: [] }).catch(() => { });
            }
        });
    }
};
