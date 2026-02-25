const { EmbedBuilder } = require('discord.js');

const RACE_COLORS = {
    human: 0x95a5a6,
    hollow: 0x8e44ad,
    shinigami: 0x2980b9,
    quincy: 0x2ecc71,
    titan: 0xe67e22,
    fullbring: 0xe74c3c,
};

const RACE_EMOJIS = {
    human: '👤',
    hollow: '💀',
    shinigami: '⚫',
    quincy: '🏹',
    titan: '👹',
    fullbring: '✨',
};

const TIER_COLORS = {
    common: '#95a5a6',
    uncommon: '#2ecc71',
    rare: '#3498db',
    epic: '#9b59b6',
    legendary: '#f39c12',
    mythic: '#e74c3c',
};

const TIER_EMOJIS = {
    common: '⚪',
    uncommon: '🟢',
    rare: '🔵',
    epic: '🟣',
    legendary: '🟡',
    mythic: '🔴',
};

function progressBar(current, max, length = 12) {
    const ratio = Math.max(0, Math.min(1, current / max));
    const filled = Math.round(ratio * length);
    const empty = length - filled;
    return `${'█'.repeat(filled)}${'░'.repeat(empty)} ${current}/${max}`;
}

function getColor(race) {
    return RACE_COLORS[race] || 0x2c3e50;
}

function baseEmbed(player) {
    return new EmbedBuilder()
        .setColor(getColor(player?.race || 'human'))
        .setFooter({ text: `⚡ Kurayami RPG • v1.0` })
        .setTimestamp();
}

function profileEmbed(player, user) {
    const raceEmoji = RACE_EMOJIS[player.race] || '👤';
    const rankDisplay = `${player.rankedTier.charAt(0).toUpperCase() + player.rankedTier.slice(1)} (${player.rankedPoints} puan)`;

    return new EmbedBuilder()
        .setColor(getColor(player.race))
        .setAuthor({ name: `${user.displayName}'in Profili`, iconURL: user.displayAvatarURL() })
        .setThumbnail(user.displayAvatarURL())
        .setTitle(`${raceEmoji} ${user.displayName}`)
        .addFields(
            { name: '📊 Level & EXP', value: `**Level:** ${player.level}\n${progressBar(player.exp, player.expNeeded)}`, inline: false },
            { name: '❤️ HP', value: progressBar(player.hp, player.maxHp), inline: true },
            { name: '🎖️ Rank', value: rankDisplay, inline: true },
            { name: '🧬 Irk', value: `${raceEmoji} ${player.race.charAt(0).toUpperCase() + player.race.slice(1)}`, inline: true },
            { name: '⚔️ Güç', value: `${player.power}`, inline: true },
            { name: '🛡️ Savunma', value: `${player.defense}`, inline: true },
            { name: '💨 Hız', value: `${player.speed}`, inline: true },
            { name: '💰 Altın', value: `${player.gold.toLocaleString()}`, inline: true },
            { name: '💎 Elmas', value: `${player.diamond}`, inline: true },
            { name: '🪙 Hollow Coin', value: `${player.hollowCoin || 0}`, inline: true },
            { name: '📈 İstatistikler', value: `Kills: **${player.totalKills}** | Boss: **${player.bossKills}** | PvP W/L: **${player.pvpWins}/${player.pvpLosses}**`, inline: false },
        )
        .setFooter({ text: `⚡ Kurayami RPG • v1.0 ${player.title ? `| 🎖️ ${player.title}` : ''}` })
        .setTimestamp();
}

function combatEmbed(attacker, defender, lastAction, turn, color, skillsText) {
    const embed = new EmbedBuilder()
        .setColor(color || 0xe74c3c)
        .setTitle(`⚔️ Savaş — Tur ${turn}`)
        .addFields(
            {
                name: `🔴 ${attacker.name}`,
                value: progressBar(attacker.hp, attacker.maxHp),
                inline: true,
            },
            { name: '\u200b', value: '\u200b', inline: true },
            {
                name: `🔵 ${defender.name}`,
                value: progressBar(defender.hp, defender.maxHp),
                inline: true,
            },
            { name: '📋 Son Aksiyon', value: lastAction || '_Savaş başlıyor..._', inline: false },
        )
        .setFooter({ text: '⚡ Kurayami RPG • Savaş Sistemi' })
        .setTimestamp();
    if (skillsText) {
        embed.addFields({ name: '⚡ Yetenekler', value: skillsText, inline: false });
    }
    return embed;
}

function itemEmbed(item) {
    const tierEmoji = TIER_EMOJIS[item.tier] || '⚪';
    const tierColor = parseInt(TIER_COLORS[item.tier]?.replace('#', '') || '95a5a6', 16);
    const statsText = Object.entries(item.stats || {})
        .map(([k, v]) => `**${k.charAt(0).toUpperCase() + k.slice(1)}:** +${v}`)
        .join('\n') || 'Stat yok';

    return new EmbedBuilder()
        .setColor(tierColor)
        .setTitle(`${item.emoji || '🗡️'} ${item.name}`)
        .addFields(
            { name: 'Tier', value: `${tierEmoji} ${item.tier.charAt(0).toUpperCase() + item.tier.slice(1)}`, inline: true },
            { name: 'Tür', value: item.type || '—', inline: true },
            { name: 'Statlar', value: statsText, inline: false },
        )
        .setFooter({ text: '⚡ Kurayami RPG • Eşya' });
}

function shopEmbed(items, category, page, totalPages) {
    const embed = new EmbedBuilder()
        .setColor(0xf39c12)
        .setTitle(`🏪 Dükkan — ${category}`)
        .setDescription(`Altın veya Elmas ile alışveriş yap!\nSayfa ${page}/${totalPages}`)
        .setFooter({ text: '⚡ Kurayami RPG • Dükkan' })
        .setTimestamp();

    items.forEach(item => {
        const tierEmoji = TIER_EMOJIS[item.tier] || '⚪';
        embed.addFields({
            name: `${item.emoji || '📦'} ${item.name} [${tierEmoji}]`,
            value: `💰 ${item.price?.gold || 0} Altın | 💎 ${item.price?.diamond || 0} Elmas`,
            inline: false,
        });
    });

    return embed;
}

function errorEmbed(msg) {
    return new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle('❌ Hata')
        .setDescription(msg)
        .setFooter({ text: '⚡ Kurayami RPG' });
}

function successEmbed(title, msg) {
    return new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle(`✅ ${title}`)
        .setDescription(msg)
        .setFooter({ text: '⚡ Kurayami RPG' });
}

function infoEmbed(title, msg) {
    return new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle(`ℹ️ ${title}`)
        .setDescription(msg)
        .setFooter({ text: '⚡ Kurayami RPG' });
}

module.exports = {
    progressBar, getColor, baseEmbed, profileEmbed,
    combatEmbed, itemEmbed, shopEmbed,
    errorEmbed, successEmbed, infoEmbed,
    RACE_COLORS, RACE_EMOJIS, TIER_COLORS, TIER_EMOJIS,
};
