const Player = require('../models/Player');
const { EmbedBuilder } = require('discord.js');
const { errorEmbed } = require('../utils/embedBuilder');

// Zanpakuto bilgileri — +bankai ile aktifleştirilir
const ZANPAKUTO_DATA = {
    tensa_zangetsu: {
        name: 'Tensa Zangetsu',
        shikaiName: '🌑 Tensa Zangetsu (Shikai)',
        bankaiName: '⚫ Tensa Zangetsu (Bankai)',
        shikaiCall: 'Düşman Tanrısını öldür, Zangetsu!',
        bankaiCall: 'BANKAI — Tensa Zangetsu!',
        shikaiSkills: [
            { name: 'Getsuga Tenshō', power: 1.8, desc: 'Ruhu uzaktan ateşle' },
            { name: 'Hirenkyaku', power: 1.3, desc: 'Hızlı konum değişimi' },
        ],
        bankaiSkills: [
            { name: 'Kuroi Getsuga', power: 2.5, desc: 'Karanlık ruhu ateşle' },
            { name: 'Saigo no Getsuga', power: 4.0, desc: 'Son Getsuga — tek kullanım' },
        ],
    },
    senbonzakura: {
        name: 'Senbonzakura',
        shikaiName: '🌸 Senbonzakura (Shikai)',
        bankaiName: '👑 Senbonzakura Kageyoshi (Bankai)',
        shikaiCall: 'Dökül, Senbonzakura!',
        bankaiCall: 'BANKAI — Senbonzakura Kageyoshi!',
        shikaiSkills: [
            { name: 'Shard Rain', power: 1.7, desc: 'Petal yağmuru' },
            { name: 'Petal Shield', power: 0, desc: 'Savunma +30%' },
        ],
        bankaiSkills: [
            { name: 'Gōkei', power: 3.0, desc: 'Tüm petalleri topla' },
            { name: 'Hakuteiken', power: 4.2, desc: 'Saf enerji kılıcı' },
        ],
    },
    ryujin_jakka: {
        name: 'Ryūjin Jakka',
        shikaiName: '🔥 Ryūjin Jakka (Shikai)',
        bankaiName: '🌋 Zanka no Tachi (Bankai)',
        shikaiCall: 'Tüm yaratıkları yak, Ryūjin Jakka!',
        bankaiCall: 'BANKAI — Zanka no Tachi!',
        shikaiSkills: [
            { name: 'Ennetsu Jigoku', power: 2.0, desc: 'Alev sütunları' },
            { name: 'Ittō Kasō', power: 2.5, desc: 'Mühürsüz alev' },
        ],
        bankaiSkills: [
            { name: 'Higashi: Kyokujitsujin', power: 3.5, desc: 'Tüm ısıyı topla' },
            { name: 'Nishi: Zanjitsu Gokui', power: 5.0, desc: 'Güneş ısısı bıçak' },
        ],
    },
    hyorinmaru: {
        name: 'Hyōrinmaru',
        shikaiName: '🧊 Hyōrinmaru (Shikai)',
        bankaiName: '❄️ Daiguren Hyōrinmaru (Bankai)',
        shikaiCall: 'Gökleri kes, Hyōrinmaru!',
        bankaiCall: 'BANKAI — Daiguren Hyōrinmaru!',
        shikaiSkills: [
            { name: 'Bōryoku Hōhō', power: 1.9, desc: 'Buz ejderhası' },
            { name: 'Sennen Hyōrō', power: 2.0, desc: 'Buz kafesi' },
        ],
        bankaiSkills: [
            { name: 'Guncho Tsurara', power: 3.2, desc: 'Buz mızrak yağmuru' },
            { name: 'Ryūsenka', power: 4.5, desc: 'Ejderha baskısı' },
        ],
    },
};

const DEFAULT_ZANPAKUTO = {
    name: 'Bilinmeyen Zanpakuto',
    shikaiName: '🌑 Shikai',
    bankaiName: '⚫ Bankai',
    shikaiCall: 'Serbest bırak!',
    bankaiCall: 'BANKAI!',
    shikaiSkills: [{ name: 'Ruhsal Kesim', power: 1.8, desc: 'Temel Zanpakuto saldırısı' }],
    bankaiSkills: [
        { name: 'Nihai Form', power: 3.0, desc: 'Zanpakuto\'nun gerçek gücü' },
        { name: 'Ruh Patlaması', power: 4.0, desc: 'Maksimum ruhsal baskı' }
    ],
};

module.exports = {
    name: 'bankai',
    aliases: ['shikai', 'release', 'serbest'],
    description: 'Zanpakuto\'nu serbest bırak! +bankai | +shikai',
    cooldown: 60,
    async execute(message, args) {
        const player = await Player.findOne({ where: { discordId: message.author.id } });
        if (!player) return message.reply({ embeds: [errorEmbed('Önce `+start` ile karakter oluştur!')] });
        if (player.race !== 'shinigami') return message.reply({ embeds: [errorEmbed('Bu komut sadece **Shinigami** ırkı için!')] });
        if (!player.raceEvolution || player.raceEvolution < 1) {
            return message.reply({ embeds: [errorEmbed('Önce `+evolve` ile **Shikai** formuna ulaşman gerekiyor!')] });
        }

        const isBankai = message.content.startsWith('+bankai') || false;
        const wantBankai = isBankai || (args[0] === 'bankai');

        if (wantBankai && player.raceEvolution < 2) {
            return message.reply({ embeds: [errorEmbed('**Bankai** için `+evolve` ile **Bankai** formuna ulaşman gerekiyor! (Evrim 2)')] });
        }

        const zanpakutoId = player.raceData?.zanpakuto || null;
        const zanData = zanpakutoId ? (ZANPAKUTO_DATA[zanpakutoId] || DEFAULT_ZANPAKUTO) : DEFAULT_ZANPAKUTO;

        const useBankai = wantBankai && player.raceEvolution >= 2;
        const formName = useBankai ? zanData.bankaiName : zanData.shikaiName;
        const call = useBankai ? zanData.bankaiCall : zanData.shikaiCall;
        const skills = useBankai ? zanData.bankaiSkills : zanData.shikaiSkills;
        const color = useBankai ? 0x2c3e50 : 0x7f8c8d;

        // Formu aktif et (raceForm güncelle, geçici boost)
        player.raceForm = formName;
        await player.save();

        const skillLines = skills.map(s =>
            `⚡ **${s.name}** — ${s.desc} (Hasar ×${s.power})`
        ).join('\n');

        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(`${useBankai ? '🌌 BANKAI!' : '⚡ SHİKAİ!'}`)
            .setDescription([
                `*"${call}"*`,
                '',
                `**${message.author.displayName}** ${formName} formuna geçti!`,
            ].join('\n'))
            .addFields(
                { name: '⚡ Aktif Yetenekler', value: skillLines, inline: false },
                {
                    name: '💡 Kullanım',
                    value: skills.map(s => `\`+hunt\` / \`+duel\` / \`+bosshunt\` anlık seçebilirsin`).join('\n').slice(0, 200),
                    inline: false
                }
            )
            .setFooter({ text: `⚡ Kurayami RPG • ${useBankai ? 'Bankai' : 'Shikai'} Aktif` })
            .setTimestamp();

        return message.reply({ embeds: [embed] });
    }
};
