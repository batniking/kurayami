const Player = require('../models/Player');
const { EmbedBuilder } = require('discord.js');
const { errorEmbed, getColor } = require('../utils/embedBuilder');
const { getPowerScore } = require('../utils/levelSystem');

const RANKED_COLORS = {
    unranked: 0x95a5a6,
    bronze: 0xcd7f32,
    silver: 0xc0c0c0,
    gold: 0xffd700,
    platinum: 0x00b4d8,
    diamond: 0x9b59b6,
    grandmaster: 0xe74c3c,
};

const RANKED_EMOJIS = {
    unranked: '⬛', bronze: '🥉', silver: '🥈', gold: '🥇',
    platinum: '🩵', diamond: '💎', grandmaster: '👑',
};

module.exports = {
    name: 'leaderboard',
    aliases: ['lb', 'top', 'sıralama'],
    description: 'Sunucu sıralamasını görüntüle. Kullanım: +lb [güç|pvp|kill]',
    cooldown: 10,
    async execute(message, args) {
        const mode = args[0]?.toLowerCase() || 'güç';

        let players;
        let title;
        let valueFunc;

        if (mode === 'pvp') {
            players = await Player.findAll({ limit: 10, order: [['pvpWins', 'DESC']] });
            title = '⚔️ En Fazla PvP Kazanımı';
            valueFunc = p => `${p.pvpWins} Kazanım`;
        } else if (mode === 'kill') {
            players = await Player.findAll({ limit: 10, order: [['totalKills', 'DESC']] });
            title = '💀 En Fazla Kill';
            valueFunc = p => `${p.totalKills} Kill`;
        } else {
            players = await Player.findAll({ limit: 10 });
            players.sort((a, b) => getPowerScore(b) - getPowerScore(a));
            players = players.slice(0, 10);
            title = '💪 En Güçlü Oyuncular';
            valueFunc = p => `${getPowerScore(p)} Güç Skoru`;
        }

        const medals = ['🥇', '🥈', '🥉'];
        const embed = new EmbedBuilder()
            .setColor(0xf39c12)
            .setTitle(`🏆 Sıralama — ${title}`)
            .setDescription(
                players.map((p, i) => {
                    const medal = medals[i] || `**${i + 1}.**`;
                    const rankEmoji = RANKED_EMOJIS[p.rankedTier] || '⬛';
                    return `${medal} ${rankEmoji} **${p.username}** — ${valueFunc(p)}`;
                }).join('\n') || '_Henüz veri yok._'
            )
            .addFields({ name: 'Kategoriler', value: '`+lb güç` | `+lb pvp` | `+lb kill`', inline: false })
            .setFooter({ text: '⚡ Kurayami RPG • Sıralama' })
            .setTimestamp();

        return message.reply({ embeds: [embed] });
    }
};
