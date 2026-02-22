const Player = require('../models/Player');
const { errorEmbed, successEmbed, infoEmbed } = require('../utils/embedBuilder');

module.exports = {
    name: 'unstuck',
    aliases: ['fix', 'battlefix'],
    description: 'Savaşta takıldıysan kilidi kaldır.',
    cooldown: 30,
    async execute(message) {
        const player = await Player.findOne({ where: { discordId: message.author.id } });
        if (!player) return message.reply({ embeds: [errorEmbed('Önce `+start` ile karakter oluştur!')] });

        if (!player.inBattle) {
            return message.reply({ embeds: [infoEmbed('Zaten Serbestsin', 'Şu anda aktif bir savaşta görünmüyorsun.')] });
        }

        player.inBattle = false;
        player.hp = Math.max(1, player.hp || 1);
        await player.save();

        return message.reply({ embeds: [successEmbed('Savaş Kilidi Kaldırıldı', 'Artık komutları kullanabilirsin.')] });
    }
};
