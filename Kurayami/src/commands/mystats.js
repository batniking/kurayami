const Player = require('../models/Player');
const { EmbedBuilder } = require('discord.js');
const { errorEmbed, getColor, progressBar } = require('../utils/embedBuilder');
const { getPowerScore } = require('../utils/levelSystem');

module.exports = {
    name: 'mystats',
    aliases: ['mystat', 'istatistik'],
    description: 'Detaylı istatistiklerini görüntüle.',
    cooldown: 5,
    async execute(message) {
        const player = await Player.findOne({ where: { discordId: message.author.id } });
        if (!player) return message.reply({ embeds: [errorEmbed('Önce `+start` ile karakter oluştur!')] });

        const winRate = player.pvpWins + player.pvpLosses > 0
            ? ((player.pvpWins / (player.pvpWins + player.pvpLosses)) * 100).toFixed(1)
            : '0.0';

        const embed = new EmbedBuilder()
            .setColor(getColor(player.race))
            .setAuthor({ name: `${player.username}'in İstatistikleri`, iconURL: message.author.displayAvatarURL() })
            .setTitle('📊 Detaylı İstatistikler')
            .addFields(
                { name: '💀 NPC Kill', value: `${player.totalKills}`, inline: true },
                { name: '👹 Boss Kill', value: `${player.totalBossKills}`, inline: true },
                { name: '💥 Toplam Hasar', value: `${Number(player.totalDamageDealt).toLocaleString()}`, inline: true },
                { name: '⚔️ PvP Kazanım', value: `${player.pvpWins}`, inline: true },
                { name: '❌ PvP Kayıp', value: `${player.pvpLosses}`, inline: true },
                { name: '📈 Win Rate', value: `%${winRate}`, inline: true },
                { name: '🔥 En İyi Seri', value: `${player.bestWinStreak} Kazanım`, inline: true },
                { name: '💪 Güç Skoru', value: `${getPowerScore(player)}`, inline: true },
                { name: '🏆 Ranked', value: `${player.rankedTier} (${player.rankedPoints} puan)`, inline: true },
                { name: '🏅 Başarımlar', value: `${player.achievements.length} / 20`, inline: true },
                { name: '🎖️ Unvan', value: player.title || '_Yok_', inline: true },
                { name: '🤝 Arkadaşlar', value: `${player.friends.length} kişi`, inline: true },
            )
            .setFooter({ text: '⚡ Kurayami RPG • İstatistikler' })
            .setTimestamp();

        return message.reply({ embeds: [embed] });
    }
};
