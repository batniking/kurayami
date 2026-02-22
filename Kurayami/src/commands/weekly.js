const Player = require('../models/Player');
const { EmbedBuilder } = require('discord.js');
const { errorEmbed } = require('../utils/embedBuilder');
const { addExp } = require('../utils/levelSystem');

const WEEKLY_REWARDS = { gold: 3000, diamond: 500, exp: 500 };

function msToTime(ms) {
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    return `${d}g ${h}s`;
}

module.exports = {
    name: 'weekly',
    aliases: ['haftalık'],
    description: 'Haftalık ödülünü al.',
    cooldown: 3,
    async execute(message) {
        const player = await Player.findOne({ where: { discordId: message.author.id } });
        if (!player) return message.reply({ embeds: [errorEmbed('Önce `+start` ile karakter oluştur!')] });

        const now = new Date();
        const lastUsed = player.weeklyLastUsed ? new Date(player.weeklyLastUsed) : null;
        const COOLDOWN = 7 * 24 * 60 * 60 * 1000;

        if (lastUsed && (now - lastUsed) < COOLDOWN) {
            const remaining = COOLDOWN - (now - lastUsed);
            return message.reply({
                embeds: [
                    new EmbedBuilder().setColor(0xe67e22)
                        .setTitle('⏳ Haftalık Ödül')
                        .setDescription(`Bir sonraki haftalık ödülün: **${msToTime(remaining)}** sonra`)
                        .setFooter({ text: '⚡ Kurayami RPG' })
                ]
            });
        }

        player.gold += WEEKLY_REWARDS.gold;
        player.diamond += WEEKLY_REWARDS.diamond;
        player.weeklyLastUsed = now;
        player.seasonPassXp += 200;
        await addExp(player, WEEKLY_REWARDS.exp, message.channel);
        await player.save();

        return message.reply({
            embeds: [
                new EmbedBuilder().setColor(0x9b59b6)
                    .setTitle('🎁 Haftalık Ödül Alındı!')
                    .addFields(
                        { name: '💰 Altın', value: `+${WEEKLY_REWARDS.gold.toLocaleString()}`, inline: true },
                        { name: '💎 Elmas', value: `+${WEEKLY_REWARDS.diamond}`, inline: true },
                        { name: '📈 EXP', value: `+${WEEKLY_REWARDS.exp}`, inline: true },
                    )
                    .setFooter({ text: '⚡ Kurayami RPG • 7 günde bir' })
                    .setTimestamp()
            ]
        });
    }
};
