const { EmbedBuilder } = require('discord.js');

const COMMANDS = [
    {
        category: '🚀 Başlangıç', cmds: [
            { name: '+start', desc: 'Oyuna başla ve karakter oluştur' },
            { name: '+profile [@]', desc: 'Karakterini görüntüle' },
            { name: '+raceselect', desc: 'Irkını seç' },
            { name: '+stats [stat] [miktar]', desc: 'Stat puan dağıt' },
        ]
    },
    {
        category: '⚔️ Savaş', cmds: [
            { name: '+hunt', desc: 'NPC avla, EXP & item kazan' },
            { name: '+duel [@]', desc: 'PvP düellosu' },
            { name: '+bosshunt', desc: 'Boss avı (yakında)' },
        ]
    },
    {
        category: '🎒 Envanter', cmds: [
            { name: '+inv', desc: 'Envanterini görüntüle' },
            { name: '+shop', desc: 'Dükkanı aç' },
            { name: '+buy <id>', desc: 'Item satın al' },
        ]
    },
    {
        category: '💰 Ekonomi', cmds: [
            { name: '+daily', desc: 'Günlük ödül al' },
            { name: '+weekly', desc: 'Haftalık ödül al' },
        ]
    },
    {
        category: '📋 Sosyal', cmds: [
            { name: '+leaderboard [güç|pvp|kill]', desc: 'Sıralama' },
            { name: '+seasonpass', desc: 'Season pass durumu' },
            { name: '+mystats', desc: 'Detaylı istatistikler' },
            { name: '+friend add/remove @', desc: 'Arkadaş sistemi' },
            { name: '+achievements', desc: 'Başarımlarını gör' },
            { name: '+clan', desc: 'Klan sistemi' },
        ]
    },
    {
        category: '⚙️ Ayarlar (Admin)', cmds: [
            { name: '+setlog #kanal', desc: 'Log kanalını ayarla' },
            { name: '+setboss #kanal', desc: 'Boss spawn kanalını ayarla' },
            { name: '+setlevel #kanal', desc: 'Level atlama bildirim kanalı' },
        ]
    },
];

module.exports = {
    name: 'help',
    aliases: ['yardım', 'komutlar', 'h'],
    description: 'Tüm komutları listeler.',
    cooldown: 5,
    async execute(message) {
        const embed = new EmbedBuilder()
            .setColor(0x2980b9)
            .setTitle('⚡ Kurayami RPG — Komut Listesi')
            .setDescription('Prefix: `+` | Örnek: `+hunt`')
            .setThumbnail(message.client.user.displayAvatarURL())
            .setFooter({ text: '⚡ Kurayami RPG • Tüm komutlar' })
            .setTimestamp();

        COMMANDS.forEach(cat => {
            embed.addFields({
                name: cat.category,
                value: cat.cmds.map(c => `\`${c.name}\` — ${c.desc}`).join('\n'),
                inline: false,
            });
        });

        return message.reply({ embeds: [embed] });
    }
};
