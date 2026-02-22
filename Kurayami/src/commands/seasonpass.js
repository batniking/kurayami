const Player = require('../models/Player');
const { EmbedBuilder } = require('discord.js');
const { errorEmbed, getColor, progressBar } = require('../utils/embedBuilder');
const { seasonPassExpNeeded } = require('../utils/levelSystem');

const SEASON_REWARDS = [
    { tier: 1, reward: '💰 500 Altın' },
    { tier: 2, reward: '💎 50 Elmas' },
    { tier: 3, reward: '📦 Rare Item' },
    { tier: 4, reward: '💎 100 Elmas' },
    { tier: 5, reward: '🟣 Epic Item' },
    { tier: 6, reward: '💰 5000 Altın' },
    { tier: 7, reward: '💎 200 Elmas' },
    { tier: 8, reward: '🟡 Legendary Item' },
    { tier: 9, reward: '💎 500 Elmas' },
    { tier: 10, reward: '🎖️ Özel Unvan: Season Pro' },
    { tier: 15, reward: '💎 1000 Elmas' },
    { tier: 20, reward: '🔴 Mythic Item + 🎖️ Season Master' },
];

module.exports = {
    name: 'seasonpass',
    aliases: ['season', 'sp', 'pass'],
    description: 'Season pass durumunu görüntüle.',
    cooldown: 5,
    async execute(message) {
        const player = await Player.findOne({ where: { discordId: message.author.id } });
        if (!player) return message.reply({ embeds: [errorEmbed('Önce `+start` ile karakter oluştur!')] });

        const currentTier = player.seasonPassTier;
        const currentXp = player.seasonPassXp;
        const xpNeeded = seasonPassExpNeeded(currentTier);

        const nextRewards = SEASON_REWARDS.filter(r => r.tier > currentTier).slice(0, 5);
        const pastRewards = SEASON_REWARDS.filter(r => r.tier <= currentTier);

        const embed = new EmbedBuilder()
            .setColor(0x9b59b6)
            .setTitle('🎫 Season Pass')
            .setDescription(`**Mevcut Tier:** ${currentTier}\n**İlerleme:** ${progressBar(currentXp, xpNeeded)}`)
            .addFields(
                {
                    name: '📋 Gelecek Ödüller',
                    value: nextRewards.length
                        ? nextRewards.map(r => `**Tier ${r.tier}:** ${r.reward}`).join('\n')
                        : '_Tüm ödüller alındı!_ 🎉',
                    inline: false,
                },
                {
                    name: '✅ Kazanılan Ödüller',
                    value: pastRewards.length
                        ? pastRewards.map(r => `~~Tier ${r.tier}: ${r.reward}~~`).join('\n')
                        : '_Henüz ödül kazanılmadı._',
                    inline: false,
                },
            )
            .addFields({ name: '💡 Nasıl XP Kazanılır?', value: 'Hunt • Daily • Görevler • PvP • Boss', inline: false })
            .setFooter({ text: '⚡ Kurayami RPG • Season Pass • Sezon sonu sıfırlanır' })
            .setTimestamp();

        return message.reply({ embeds: [embed] });
    }
};
