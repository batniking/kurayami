const Player = require('../models/Player');
const { EmbedBuilder } = require('discord.js');
const { errorEmbed, successEmbed, getColor } = require('../utils/embedBuilder');
const achievementsData = require('../data/achievements.json');

module.exports = {
    name: 'achievements',
    aliases: ['ach', 'basarim', 'başarım'],
    description: 'Tüm başarımlarını görüntüle.',
    cooldown: 5,
    async execute(message) {
        const player = await Player.findOne({ where: { discordId: message.author.id } });
        if (!player) return message.reply({ embeds: [errorEmbed('Önce `+start` ile karakter oluştur!')] });

        const unlocked = player.achievements || [];
        const embed = new EmbedBuilder()
            .setColor(getColor(player.race))
            .setTitle(`🏆 Başarımlar — ${unlocked.length}/${achievementsData.length}`)
            .setAuthor({ name: player.username, iconURL: message.author.displayAvatarURL() })
            .setFooter({ text: '⚡ Kurayami RPG • Başarım Sistemi' })
            .setTimestamp();

        achievementsData.forEach(ach => {
            const done = unlocked.includes(ach.id);
            embed.addFields({
                name: `${done ? '✅' : '🔒'} ${ach.name}`,
                value: `${ach.description}\n*Ödül: ${Object.entries(ach.reward).map(([k, v]) => `${k} ${v}`).join(', ')}*`,
                inline: true,
            });
        });

        return message.reply({ embeds: [embed] });
    }
};
