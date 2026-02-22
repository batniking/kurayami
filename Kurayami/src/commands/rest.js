const Player = require('../models/Player');
const { EmbedBuilder } = require('discord.js');
const { errorEmbed, successEmbed } = require('../utils/embedBuilder');

module.exports = {
    name: 'rest',
    aliases: ['dinlen', 'heal'],
    description: 'HP\'ni yenile (1 saatlik bekleme)',
    cooldown: 5,
    async execute(message) {
        const player = await Player.findOne({ where: { discordId: message.author.id } });
        if (!player) return message.reply({ embeds: [errorEmbed('Önce `+start` ile karakter oluştur!')] });

        if (player.hp >= player.maxHp)
            return message.reply({ embeds: [new EmbedBuilder().setColor(0x2ecc71).setDescription('❤️ HP\'n zaten dolu!')] });

        const healAmount = Math.floor(player.maxHp * 0.3);
        player.hp = Math.min(player.maxHp, player.hp + healAmount);
        await player.save();

        return message.reply({ embeds: [successEmbed('Dinlenildi!', `❤️ +${healAmount} HP yenilendi! Mevcut: **${player.hp}/${player.maxHp}**`)] });
    }
};
