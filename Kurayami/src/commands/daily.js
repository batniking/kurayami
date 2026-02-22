const Player = require('../models/Player');
const InventoryItem = require('../models/InventoryItem');
const { EmbedBuilder } = require('discord.js');
const { errorEmbed, successEmbed } = require('../utils/embedBuilder');
const { addExp } = require('../utils/levelSystem');

const DAILY_REWARDS = { gold: 500, diamond: 100, exp: 100 };
const WEEKLY_REWARDS = { gold: 3000, diamond: 500, exp: 500 };

function msToTime(ms) {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h}s ${m}dk`;
}

module.exports = {
    name: 'daily',
    aliases: ['günlük'],
    description: 'Günlük ödülünü al.',
    cooldown: 3,
    async execute(message) {
        const player = await Player.findOne({ where: { discordId: message.author.id } });
        if (!player) return message.reply({ embeds: [errorEmbed('Önce `+start` ile karakter oluştur!')] });

        const now = new Date();
        const lastUsed = player.dailyLastUsed ? new Date(player.dailyLastUsed) : null;
        const COOLDOWN = 24 * 60 * 60 * 1000;

        if (lastUsed && (now - lastUsed) < COOLDOWN) {
            const remaining = COOLDOWN - (now - lastUsed);
            return message.reply({
                embeds: [
                    new EmbedBuilder().setColor(0xe67e22)
                        .setTitle('⏳ Günlük Ödül')
                        .setDescription(`Bir sonraki günlük ödülün: **${msToTime(remaining)}** sonra`)
                        .setFooter({ text: '⚡ Kurayami RPG' })
                ]
            });
        }

        player.gold += DAILY_REWARDS.gold;
        player.diamond += DAILY_REWARDS.diamond;
        player.dailyLastUsed = now;
        player.seasonPassXp += 50;
        await addExp(player, DAILY_REWARDS.exp, message.channel);
        await player.save();

        return message.reply({
            embeds: [
                new EmbedBuilder().setColor(0x2ecc71)
                    .setTitle('🎁 Günlük Ödül Alındı!')
                    .addFields(
                        { name: '💰 Altın', value: `+${DAILY_REWARDS.gold}`, inline: true },
                        { name: '💎 Elmas', value: `+${DAILY_REWARDS.diamond}`, inline: true },
                        { name: '📈 EXP', value: `+${DAILY_REWARDS.exp}`, inline: true },
                    )
                    .setFooter({ text: '⚡ Kurayami RPG • 24 saatte bir' })
                    .setTimestamp()
            ]
        });
    }
};
