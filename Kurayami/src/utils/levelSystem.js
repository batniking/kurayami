/**
 * EXP ve Level sistemi
 */

function expForNextLevel(level) {
    return Math.floor(100 * Math.pow(1.15, level - 1));
}

async function addExp(player, amount, channel) {
    player.exp += amount;
    player.seasonPassXp += Math.floor(amount / 10);

    let leveledUp = false;
    while (player.exp >= player.expNeeded) {
        player.exp -= player.expNeeded;
        player.level += 1;
        player.statPoints += 3;
        player.maxHp += 10;
        player.hp = player.maxHp;
        player.expNeeded = expForNextLevel(player.level);
        leveledUp = true;

        if (channel) {
            const { EmbedBuilder } = require('discord.js');
            const embed = new EmbedBuilder()
                .setColor(0xf39c12)
                .setTitle('🎉 Level Atladın!')
                .setDescription(`**${player.username}** Level **${player.level}** oldu!\n+3 Stat Puanı kazandın!`)
                .setFooter({ text: '⚡ Kurayami RPG' });
            await channel.send({ embeds: [embed] }).catch(() => { });
        }
    }

    // Season pass
    while (player.seasonPassXp >= seasonPassExpNeeded(player.seasonPassTier)) {
        player.seasonPassXp -= seasonPassExpNeeded(player.seasonPassTier);
        player.seasonPassTier += 1;
    }

    await player.save();
    return leveledUp;
}

function seasonPassExpNeeded(tier) {
    return 500 + tier * 100;
}

function getRankedTier(points) {
    if (points < 100) return 'bronze';
    if (points < 300) return 'silver';
    if (points < 600) return 'gold';
    if (points < 1000) return 'platinum';
    if (points < 1500) return 'diamond';
    return 'grandmaster';
}

function getPowerScore(player) {
    const statTotal = player.power + player.defense + player.speed + player.maxHp;
    const raceBonus = player.raceEvolution * 50;
    const rankBonus = { bronze: 0, silver: 50, gold: 150, platinum: 300, diamond: 500, grandmaster: 1000, unranked: 0 }[player.rankedTier] || 0;
    return statTotal + raceBonus + rankBonus;
}

function getPassiveIncome(player) {
    const base = 50;
    const levelBonus = player.level * 2;
    return base + levelBonus;
}

module.exports = { addExp, expForNextLevel, getRankedTier, getPowerScore, getPassiveIncome, seasonPassExpNeeded };
