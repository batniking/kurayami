const Player = require('../models/Player');
const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { errorEmbed, getColor } = require('../utils/embedBuilder');
const { calcDamage, applyEffects, buildFighterState } = require('../utils/combatEngine');
const { addExp } = require('../utils/levelSystem');
const { checkAchievements } = require('../utils/achievementSystem');

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

function buildDuelEmbed(f1, f2, log, turn, ranked) {
    return new EmbedBuilder()
        .setColor(ranked ? 0xe74c3c : 0x3498db)
        .setTitle(`${ranked ? '🏆 Ranked' : '⚔️ Normal'} Düello`)
        .setDescription(log)
        .addFields(
            { name: `${f1.name}`, value: `❤️ ${Math.max(0, f1.hp)}/${f1.maxHp}`, inline: true },
            { name: '⚔️ Tur', value: `${turn}`, inline: true },
            { name: `${f2.name}`, value: `❤️ ${Math.max(0, f2.hp)}/${f2.maxHp}`, inline: true }
        )
        .setFooter({ text: '⚡ Kurayami RPG • PvP' })
        .setTimestamp();
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

        // Davet mesajı
        const inviteRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('duel:accept').setLabel('✅ Kabul Et').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('duel:decline').setLabel('❌ Reddet').setStyle(ButtonStyle.Danger)
        );

        const inviteEmbed = new EmbedBuilder()
            .setColor(ranked ? 0xe74c3c : 0x3498db)
            .setTitle(`${ranked ? '🏆 Ranked' : '⚔️ Normal'} Düello Daveti`)
            .setDescription(`**${target.displayName}**, **${message.author.displayName}** seni ${ranked ? 'ranked ' : ''}düelloya davet ediyor!\n\n60 saniye içinde kabul et!`)
            .setFooter({ text: '⚡ Kurayami RPG • PvP' });

        const inviteMsg = await message.reply({ content: `${target}`, embeds: [inviteEmbed], components: [inviteRow] });

        const inviteCollector = inviteMsg.createMessageComponentCollector({
            time: 60000,
            filter: i => i.user.id === target.id,
            max: 1
        });

        inviteCollector.on('collect', async (inv) => {
            await inv.deferUpdate();
            if (inv.customId === 'duel:decline') {
                await inviteMsg.edit({ embeds: [new EmbedBuilder().setColor(0x95a5a6).setDescription(`❌ ${target.displayName} düelloyu reddetti.`)], components: [] });
                return;
            }

            // Savaş başla
            challenger.inBattle = true;
            defender.inBattle = true;
            await challenger.save();
            await defender.save();

            const f1 = buildFighterState(challenger, challenger.username);
            const f2 = buildFighterState(defender, defender.username);
            const skills1 = getPlayerSkills(challenger);
            const skills2 = getPlayerSkills(defender);

            let turn = 1;
            let currentTurn = f1.speed >= f2.speed ? 'f1' : 'f2'; // Hızlı başlar
            let log = `⚡ Savaş başladı! **${currentTurn === 'f1' ? f1.name : f2.name}** ilk hamleyi yapıyor!`;

            const buildButtons = (whoseTurn, disabled = false) => {
                const skills = whoseTurn === 'f1' ? skills1 : skills2;
                const prefix = whoseTurn === 'f1' ? 'duel1' : 'duel2';

                const attackBtn = new ButtonBuilder().setCustomId(`${prefix}:attack`).setLabel('⚔️ Saldır').setStyle(ButtonStyle.Danger).setDisabled(disabled);
                const row = new ActionRowBuilder().addComponents(attackBtn);

                if (skills.length > 0) {
                    const skillRow = new ActionRowBuilder().addComponents(
                        skills.slice(0, 4).map((s, idx) =>
                            new ButtonBuilder()
                                .setCustomId(`${prefix}:skill:${idx}`)
                                .setLabel(`⚡ ${s.name.slice(0, 20)}`)
                                .setStyle(ButtonStyle.Primary)
                                .setDisabled(disabled)
                        )
                    );
                    return [row, skillRow];
                }
                return [row];
            };

            const duelMsg = await inviteMsg.edit({
                content: `${message.author} ${target}`,
                embeds: [buildDuelEmbed(f1, f2, log, turn, ranked)],
                components: buildButtons(currentTurn)
            });

            const duelCollector = duelMsg.createMessageComponentCollector({ time: 120000 });

            duelCollector.on('collect', async (btn) => {
                const isF1Turn = currentTurn === 'f1';
                const expectedUser = isF1Turn ? message.author.id : target.id;
                if (btn.user.id !== expectedUser) {
                    await btn.reply({ content: '⏳ Senin turun değil!', ephemeral: true });
                    return;
                }
                await btn.deferUpdate();

                const attacker = isF1Turn ? f1 : f2;
                const defender2 = isF1Turn ? f2 : f1;
                const skills = isF1Turn ? skills1 : skills2;
                const prefix = isF1Turn ? 'duel1' : 'duel2';

                let usedSkill = null;
                if (btn.customId.startsWith(`${prefix}:skill:`)) {
                    const idx = parseInt(btn.customId.split(':')[2]);
                    usedSkill = skills[idx] || null;
                }

                const dmg = calcDamage(attacker, defender2, usedSkill);
                defender2.hp -= dmg;
                let actionLog = `${isF1Turn ? '🔵' : '🔴'} **${attacker.name}** ${usedSkill ? `**${usedSkill.name}** ile` : ''} **${dmg}** hasar verdi!\n`;

                if (usedSkill) {
                    const effectLogs = applyEffects(usedSkill, attacker, defender2);
                    if (effectLogs.length) actionLog += effectLogs.join('\n') + '\n';
                }

                // Kazanan kontrolü
                if (defender2.hp <= 0) {
                    duelCollector.stop('done');
                    const winner = isF1Turn ? challenger : defender;
                    const loser = isF1Turn ? defender : challenger;
                    const winPlayer = isF1Turn ? f1 : f2;
                    const losePlayer = isF1Turn ? f2 : f1;

                    winner.pvpWins += 1;
                    loser.pvpLosses += 1;
                    winner.inBattle = false;
                    loser.inBattle = false;
                    loser.hp = Math.max(1, Math.floor(loser.maxHp * 0.1));

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
                        .setTitle(`🏆 Düello Bitti!`)
                        .setDescription(`⚡ **${winner.username}** kazandı!`)
                        .addFields(
                            {
                                name: `🥇 ${winner.username}`,
                                value: `+${expWin} EXP\n+${diamondWin} 💎${ranked ? `\n+25 Ranked Puan` : ''}`,
                                inline: true
                            },
                            {
                                name: `💀 ${loser.username}`,
                                value: `+${expLose} EXP${ranked ? `\n-15 Ranked Puan` : ''}`,
                                inline: true
                            }
                        )
                        .setFooter({ text: '⚡ Kurayami RPG • PvP' });

                    await duelMsg.edit({ embeds: [endEmbed], components: [] });
                    return;
                }

                // Tur geçiş
                currentTurn = isF1Turn ? 'f2' : 'f1';
                turn++;

                await duelMsg.edit({
                    embeds: [buildDuelEmbed(f1, f2, actionLog + `\n➡️ **${currentTurn === 'f1' ? f1.name : f2.name}** hamlesi!`, turn, ranked)],
                    components: buildButtons(currentTurn)
                });
            });

            duelCollector.on('end', async (_, reason) => {
                if (reason !== 'done') {
                    challenger.inBattle = false;
                    defender.inBattle = false;
                    await challenger.save();
                    await defender.save();
                    duelMsg.edit({ components: [] }).catch(() => { });
                }
            });
        });

        inviteCollector.on('end', async (_, reason) => {
            if (reason === 'time') {
                inviteMsg.edit({ components: [], embeds: [new EmbedBuilder().setColor(0x95a5a6).setDescription('⏰ Davet süresi doldu.')] }).catch(() => { });
            }
        });
    }
};
