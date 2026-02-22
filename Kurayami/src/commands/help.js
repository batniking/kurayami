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
            { name: '+bosshunt [boss_id]', desc: 'Boss avı — güçlenip gel!' },
            { name: '+dungeon [id]', desc: 'Zindana gir (oda oda ilerle)' },
            { name: '+dungeon list', desc: 'Tüm zindanları listele' },
            { name: '+duel @oyuncu [ranked]', desc: 'PvP düellosu (skill ile)' },
        ]
    },
    {
        category: '🎒 Envanter', cmds: [
            { name: '+inv', desc: 'Envanterini görüntüle' },
            { name: '+equip <item_id>', desc: 'Item tak' },
            { name: '+equip list', desc: 'Giyili itemları gör' },
            { name: '+unequip <item_id>', desc: 'Item çıkar' },
            { name: '+shop', desc: 'Dükkanı aç' },
            { name: '+buy <id>', desc: 'Item satın al' },
            { name: '+craft list', desc: 'Tüm craft tariflerini gör' },
            { name: '+craft <item_id>', desc: 'Item craft et' },
            { name: '+rest', desc: "HP'ni yenile" },
        ]
    },
    {
        category: '🧬 Irk & Evrim', cmds: [
            { name: '+raceselect', desc: 'Irkını seç (Hollow/Shinigami/Quincy...)' },
            { name: '+evolve', desc: 'Irk evrimini gerçekleştir' },
            { name: '+evolve info', desc: 'Evrim yolunu ve gereksinimlerini gör' },
            { name: '+resurreccion', desc: '💀 Hollow/Arrancar formunu aktif et' },
            { name: '+bankai', desc: '⚫ Shinigami Bankai/Shikai aktif et' },
            { name: '+vollstandig', desc: '🏹 Quincy Vollständig/Letzt Stil aktif et' },
            { name: '+bosslist', desc: 'Tüm boss\'ları ve drop\'larını gör' },
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
        category: '⚙️ Admin', cmds: [
            { name: '+admin give @user gold/diamond/item/exp', desc: 'Oyuncuya ver' },
            { name: '+admin reset @user', desc: 'Karakter sıfırla' },
            { name: '+admin info @user', desc: 'Oyuncu bilgisi' },
            { name: '+setlog #kanal', desc: 'Log kanalını ayarla' },
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
