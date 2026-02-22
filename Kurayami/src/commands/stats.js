const Player = require('../models/Player');
const { EmbedBuilder } = require('discord.js');
const { errorEmbed, successEmbed, getColor, progressBar } = require('../utils/embedBuilder');

module.exports = {
    name: 'stats',
    aliases: ['addstat', 'statdist'],
    description: 'Stat puanlarını dağıt. Kullanım: +stats <stat> <miktar>',
    cooldown: 3,
    async execute(message, args) {
        const player = await Player.findOne({ where: { discordId: message.author.id } });
        if (!player) return message.reply({ embeds: [errorEmbed('Önce `+start` ile karakter oluştur!')] });

        const validStats = ['power', 'defense', 'speed', 'hp'];
        const statEmojis = { power: '⚔️', defense: '🛡️', speed: '💨', hp: '❤️' };
        const statNames = { power: 'Güç', defense: 'Savunma', speed: 'Hız', hp: 'HP' };

        // +stats (görüntüle)
        if (!args[0]) {
            const embed = new EmbedBuilder()
                .setColor(getColor(player.race))
                .setAuthor({ name: `${player.username}'in Statları`, iconURL: message.author.displayAvatarURL() })
                .setTitle('📊 Stat Dağıtımı')
                .setDescription(`Dağıtılabilir stat puanın: **${player.statPoints}** 🔮\n\nDağıtmak için: \`+stats <stat> <miktar>\`\n**Statlar:** power, defense, speed, hp`)
                .addFields(
                    { name: `${statEmojis.power} Güç`, value: `${player.power}`, inline: true },
                    { name: `${statEmojis.defense} Savunma`, value: `${player.defense}`, inline: true },
                    { name: `${statEmojis.speed} Hız`, value: `${player.speed}`, inline: true },
                    { name: `${statEmojis.hp} Max HP`, value: `${player.maxHp}`, inline: true },
                    { name: '🔢 Toplam Stat', value: `${player.power + player.defense + player.speed + player.maxHp}`, inline: true },
                )
                .setFooter({ text: '⚡ Kurayami RPG • Her level 3 puan' })
                .setTimestamp();
            return message.reply({ embeds: [embed] });
        }

        const statName = args[0].toLowerCase();
        const amount = parseInt(args[1]);

        if (!validStats.includes(statName)) {
            return message.reply({ embeds: [errorEmbed(`Geçersiz stat! Geçerli statlar: \`${validStats.join(', ')}\``)] });
        }
        if (!amount || amount < 1) {
            return message.reply({ embeds: [errorEmbed('Geçerli bir miktar gir! Örnek: `+stats power 5`')] });
        }
        if (player.statPoints < amount) {
            return message.reply({ embeds: [errorEmbed(`Yeterli stat puanın yok! Mevcut: **${player.statPoints}**`)] });
        }

        player.statPoints -= amount;
        if (statName === 'hp') {
            player.maxHp += amount * 10;
            player.hp = Math.min(player.hp + amount * 10, player.maxHp);
        } else {
            player[statName] += amount;
        }
        await player.save();

        const displayIncrease = statName === 'hp' ? amount * 10 : amount;
        return message.reply({
            embeds: [successEmbed(
                'Stat Dağıtıldı!',
                `${statEmojis[statName]} **${statNames[statName]}** +${displayIncrease} arttırıldı!\nKalan puan: **${player.statPoints}** 🔮`
            )]
        });
    }
};
