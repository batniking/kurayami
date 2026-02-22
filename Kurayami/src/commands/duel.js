const Player = require('../models/Player');
const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { errorEmbed, combatEmbed, successEmbed, getColor } = require('../utils/embedBuilder');
const { calcDamage, applyEffects, processDotsAndStatuses, isSkipping, buildFighterState } = require('../utils/combatEngine');
const { addExp } = require('../utils/levelSystem');
const { checkAchievements } = require('../utils/achievementSystem');

module.exports = {
    name: 'duel',
    aliases: ['pvp', 'duello'],
    description: 'Başka bir oyuncuya düello isteği gönder.',
    cooldown: 15,
    async execute(message, args) {
        const target = message.mentions.users.first();
        if (!target) return message.reply({ embeds: [errorEmbed('Hedef belirt! Örnek: `+duel @kullanıcı`')] });
        if (target.id === message.author.id) return message.reply({ embeds: [errorEmbed('Kendinle düello yapamazsın!')] });
        if (target.bot) return message.reply({ embeds: [errorEmbed('Bot ile düello yapamazsın!')] });

        const [challenger, defender] = await Promise.all([
            Player.findOne({ where: { discordId: message.author.id } }),
            Player.findOne({ where: { discordId: target.id } }),
        ]);

        if (!challenger) return message.reply({ embeds: [errorEmbed('Önce `+start` ile karakter oluştur!')] });
        if (!defender) return message.reply({ embeds: [errorEmbed(`**${target.displayName}** henüz bir karaktere sahip değil!`)] });
        if (challenger.inBattle) return message.reply({ embeds: [errorEmbed('Zaten bir savaştasın!')] });
        if (defender.inBattle) return message.reply({ embeds: [errorEmbed(`**${target.displayName}** zaten bir savaşta!`)] });

        // Ranked/Unranked seçimi
        const modeRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('duel:ranked').setLabel('🏆 Ranked').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('duel:unranked').setLabel('⚔️ Unranked').setStyle(ButtonStyle.Secondary),
        );

        const inviteEmbed = new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle('⚔️ Düello İsteği!')
            .setDescription(`**${message.author.displayName}** seni düelloya davet etti, **${target.displayName}**!\n\nMod seçip kabul etmen gerekiyor.`)
            .setFooter({ text: '⚡ Kurayami RPG • PvP Sistemi' });

        const msg = await message.reply({ content: `<@${target.id}>`, embeds: [inviteEmbed], components: [modeRow] });

        const collector = msg.createMessageComponentCollector({
            time: 30000,
            filter: i => i.user.id === target.id,
        });

        let ranked = false;
        collector.on('collect', async (i) => {
            ranked = i.customId === 'duel:ranked';
            collector.stop('accepted');
            await i.deferUpdate();

            // Savaş başlat
            challenger.inBattle = true;
            defender.inBattle = true;
            await challenger.save();
            await defender.save();

            const f1 = buildFighterState(challenger, message.author.displayName);
            const f2 = buildFighterState(defender, target.displayName);

            let turn = 1;
            let current = f1.speed >= f2.speed ? f1 : f2;
            let other = current === f1 ? f2 : f1;

            const getBattleButtons = (activeName, disabled = false) => {
                return new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('duel:attack').setLabel('⚔️ Normal Saldırı').setStyle(ButtonStyle.Danger).setDisabled(disabled),
                    new ButtonBuilder().setCustomId('duel:defend').setLabel('🛡️ Savun').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
                );
            };

            const buildDuelEmbed = (log) => combatEmbed(
                { name: f1.name, hp: f1.hp, maxHp: f1.maxHp },
                { name: f2.name, hp: f2.hp, maxHp: f2.maxHp },
                log || '_Düello başlıyor!_', turn, 0xe74c3c
            ).setTitle(`⚔️ Düello — ${ranked ? '🏆 Ranked' : 'Unranked'} — Tur ${turn}`);

            const activeUser = current === f1 ? message.author.id : target.id;
            await msg.edit({
                embeds: [buildDuelEmbed(`🎯 **${current.name}** sırası!`)],
                components: [getBattleButtons(current.name)],
            });

            const battleCollector = msg.createMessageComponentCollector({
                time: 90000,
                filter: i => i.user.id === (current === f1 ? message.author.id : target.id),
            });

            battleCollector.on('collect', async (bi) => {
                await bi.deferUpdate();
                let log = '';

                if (!isSkipping(current)) {
                    if (bi.customId === 'duel:defend') {
                        current.defense += 20;
                        log += `🛡️ **${current.name}** savunma aldı! (+20 Savunma bu tur)\n`;
                    } else {
                        const dmg = calcDamage(current, other, null);
                        other.hp -= dmg;
                        current.totalDmg = (current.totalDmg || 0) + dmg;
                        log += `⚔️ **${current.name}** → **${dmg}** hasar verdi!\n`;
                    }
                } else {
                    log += `⏸️ **${current.name}** tur atlandı...\n`;
                }

                const dotLogs = processDotsAndStatuses(other);
                if (dotLogs.length) log += dotLogs.join(' ') + '\n';

                if (other.hp <= 0) {
                    battleCollector.stop('done');
                    const winner = current === f1 ? challenger : defender;
                    const loser = current === f1 ? defender : challenger;
                    const winUser = current === f1 ? message.author : target;

                    winner.pvpWins++;
                    loser.pvpLosses++;
                    winner.winStreak++;
                    loser.winStreak = 0;
                    if (winner.winStreak > winner.bestWinStreak) winner.bestWinStreak = winner.winStreak;

                    winner.diamond += 75;
                    if (ranked) {
                        winner.rankedPoints = (winner.rankedPoints || 0) + 25;
                        loser.rankedPoints = Math.max(0, (loser.rankedPoints || 0) - 15);
                    }

                    winner.inBattle = false;
                    loser.inBattle = false;
                    await winner.save();
                    await loser.save();

                    await addExp(winner, 80, message.channel);
                    await addExp(loser, 20, message.channel);
                    await checkAchievements(winner, message.channel);

                    const winEmbed = new EmbedBuilder()
                        .setColor(0xf39c12)
                        .setTitle(`🏆 ${winUser.displayName} Kazandı!`)
                        .setDescription(`**${current.name}** düelloyu kazandı!\n+75 💎 Elmas${ranked ? ' | +25 🏆 Ranked Puanı' : ''}`);
                    await msg.edit({ embeds: [winEmbed], components: [] });
                    return;
                }

                // Sıra değiştir
                if (bi.customId === 'duel:defend') current.defense -= 20;
                [current, other] = [other, current];
                turn++;
                battleCollector.setOptions({ filter: i => i.user.id === (current === f1 ? message.author.id : target.id) });
                log += `\n🎯 **${current.name}** sırası!`;
                await msg.edit({
                    embeds: [buildDuelEmbed(log)],
                    components: [getBattleButtons(current.name)],
                });
            });

            battleCollector.on('end', async (_, reason) => {
                if (reason !== 'done') {
                    challenger.inBattle = false;
                    defender.inBattle = false;
                    await challenger.save();
                    await defender.save();
                    msg.edit({ components: [] }).catch(() => { });
                }
            });
        });

        collector.on('end', async (_, reason) => {
            if (reason !== 'accepted') {
                await msg.edit({ embeds: [errorEmbed('Düello isteği reddedildi veya süresi doldu.')], components: [] });
            }
        });
    }
};
