const GuildSettings = require('../models/GuildSettings');
const { errorEmbed, successEmbed } = require('../utils/embedBuilder');

module.exports = {
    name: 'setlog',
    description: 'Log kanalını ayarla (Admin). Kullanım: +setlog #kanal',
    cooldown: 5,
    async execute(message) {
        if (!message.member.permissions.has('ManageGuild'))
            return message.reply({ embeds: [errorEmbed('Bu komut için **Sunucuyu Yönet** yetkisi gerekli!')] });

        const channel = message.mentions.channels.first();
        if (!channel) return message.reply({ embeds: [errorEmbed('Kanal belirt! Örnek: `+setlog #log-kanal`')] });

        const [settings] = await GuildSettings.findOrCreate({ where: { guildId: message.guild.id } });
        settings.logChannelId = channel.id;
        await settings.save();

        return message.reply({ embeds: [successEmbed('Log Kanalı Ayarlandı!', `<#${channel.id}> artık log kanalı olarak ayarlandı.`)] });
    }
};
