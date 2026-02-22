const achievements = require('../data/achievements.json');
const { EmbedBuilder } = require('discord.js');

async function checkAchievements(player, channel) {
    for (const ach of achievements) {
        if (player.achievements.includes(ach.id)) continue;

        let unlocked = false;
        try {
            // eslint-disable-next-line no-eval
            unlocked = eval(ach.condition.replace(/(\w+)/g, (m) => {
                if (player[m] !== undefined) return JSON.stringify(player[m]);
                return m;
            }));
        } catch { }

        if (!ach.condition.includes('===') && !ach.condition.includes('>=') && !ach.condition.includes('<=')) {
            // Special conditions
            if (ach.condition === 'clanOwner' && player.clanId) unlocked = true;
            if (ach.condition === 'hasPet' && player.petId) unlocked = true;
        }

        if (unlocked) {
            player.achievements = [...player.achievements, ach.id];
            if (ach.reward.gold) player.gold += ach.reward.gold;
            if (ach.reward.diamond) player.diamond += ach.reward.diamond;
            if (ach.reward.title) player.title = ach.reward.title;
            await player.save();

            if (channel) {
                const embed = new EmbedBuilder()
                    .setColor(0xf39c12)
                    .setTitle(`🏆 Başarım Kazandın!`)
                    .setDescription(`**${ach.name}**\n${ach.description}`)
                    .addFields(
                        {
                            name: '🎁 Ödül', value: [
                                ach.reward.gold ? `💰 ${ach.reward.gold} Altın` : null,
                                ach.reward.diamond ? `💎 ${ach.reward.diamond} Elmas` : null,
                                ach.reward.title ? `🎖️ Unvan: ${ach.reward.title}` : null,
                            ].filter(Boolean).join('\n'), inline: false
                        }
                    )
                    .setFooter({ text: '⚡ Kurayami RPG • Başarım Sistemi' });
                await channel.send({ embeds: [embed] }).catch(() => { });
            }
        }
    }
}

module.exports = { checkAchievements };
