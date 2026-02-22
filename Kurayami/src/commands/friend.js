const Player = require('../models/Player');
const { EmbedBuilder } = require('discord.js');
const { errorEmbed, successEmbed } = require('../utils/embedBuilder');

module.exports = {
    name: 'friend',
    aliases: ['arkadaş'],
    description: 'Arkadaş sistemi. +friend add/remove/list @kullanıcı',
    cooldown: 5,
    async execute(message, args) {
        const player = await Player.findOne({ where: { discordId: message.author.id } });
        if (!player) return message.reply({ embeds: [errorEmbed('Önce `+start` ile karakter oluştur!')] });

        const sub = args[0]?.toLowerCase();

        if (sub === 'list' || !sub) {
            if (!player.friends.length)
                return message.reply({ embeds: [new EmbedBuilder().setColor(0x3498db).setTitle('👥 Arkadaş Listesi').setDescription('_Henüz arkadaşın yok. `+friend add @kullanıcı` ile ekle!_').setFooter({ text: '⚡ Kurayami RPG' })] });

            const embed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle(`👥 ${player.username}'in Arkadaşları — ${player.friends.length}`)
                .setDescription(player.friends.map(id => `<@${id}>`).join('\n'))
                .setFooter({ text: '⚡ Kurayami RPG • Arkadaş Sistemi' });
            return message.reply({ embeds: [embed] });
        }

        const target = message.mentions.users.first();
        if (!target) return message.reply({ embeds: [errorEmbed('Kullanıcı belirt! Örnek: `+friend add @kullanıcı`')] });
        if (target.id === message.author.id) return message.reply({ embeds: [errorEmbed('Kendini ekleyemezsin!')] });

        const targetPlayer = await Player.findOne({ where: { discordId: target.id } });
        if (!targetPlayer) return message.reply({ embeds: [errorEmbed(`**${target.displayName}** henüz bir karaktere sahip değil!`)] });

        if (sub === 'add') {
            if (player.friends.includes(target.id))
                return message.reply({ embeds: [errorEmbed(`**${target.displayName}** zaten arkadaş listende!`)] });
            if (player.friends.length >= 50)
                return message.reply({ embeds: [errorEmbed('Maksimum 50 arkadaş ekleyebilirsin!')] });
            player.friends = [...player.friends, target.id];
            await player.save();
            return message.reply({ embeds: [successEmbed('Arkadaş Eklendi!', `**${target.displayName}** arkadaş listene eklendi! 🤝`)] });
        }

        if (sub === 'remove') {
            if (!player.friends.includes(target.id))
                return message.reply({ embeds: [errorEmbed(`**${target.displayName}** arkadaş listende değil!`)] });
            player.friends = player.friends.filter(id => id !== target.id);
            await player.save();
            return message.reply({ embeds: [successEmbed('Arkadaş Kaldırıldı!', `**${target.displayName}** arkadaş listenden kaldırıldı.`)] });
        }

        return message.reply({ embeds: [errorEmbed('Geçersiz komut! Kullanım: `+friend add/remove/list @kullanıcı`')] });
    }
};
