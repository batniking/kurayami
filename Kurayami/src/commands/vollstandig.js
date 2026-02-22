const Player = require('../models/Player');
const { EmbedBuilder } = require('discord.js');
const { errorEmbed } = require('../utils/embedBuilder');

// Quincy form verileri
const QUINCY_FORMS = {
    // Stage 1 — Vollständig
    vollstandig: {
        requiredEvolution: 1,
        name: '✦ Vollständig',
        call: 'Vollständig: [Quincy Adı]!',
        color: 0xd4f0ff,
        description: 'Ruhsal partikülleri tam olarak emip kanatlar beliriyor.',
        skills: [
            { name: 'Heilig Pfeil', power: 2.0, desc: 'Ruhsal ok — hızlı atış' },
            { name: 'Blut Arterie', power: 0, desc: 'Tüm hasarı +20% arttır (pasif)' },
            { name: 'Hirenkyaku', power: 1.5, desc: 'Ruhsal zemin kayışı — hız atağı' },
        ],
        statBoost: { power: 15, speed: 25 }
    },
    // Stage 2 — Sternritter
    sternritter: {
        requiredEvolution: 2,
        name: '⭐ Letzt Stil',
        call: 'Letzt Stil — Tüm gücü serbest bırak!',
        color: 0xffffff,
        description: 'Quincy yeteneğini son kez tam olarak serbest bırakıyor. Kullandıktan sonra uzun yorgunluk!',
        skills: [
            { name: 'Sklaverei', power: 2.8, desc: 'Ruhu çal — varlığı emiyor' },
            { name: 'Ransōtengai', power: 2.0, desc: 'Kontrol kaybolsa da hareket et' },
            { name: 'Heilig Feuer', power: 3.5, desc: 'Kutsal ateş bombası' },
        ],
        statBoost: { power: 40, speed: 50 }
    },
    // Stage 3 — Yhwach Reishi (en üst)
    yhwach: {
        requiredEvolution: 3,
        name: '👑 Schrift Aktif',
        call: 'Almighty... az da olsa görebiliyorum!',
        color: 0xf0e68c,
        description: 'Yhwach\'ın kanıyla gelecek ve olasılıkları görebiliyorsun. Rakip hamlelerini tahmin edebilirsin.',
        skills: [
            { name: 'Auswählen', power: 4.0, desc: 'Seçilmişleri kurban et' },
            { name: 'The Almighty (Kısmi)', power: 5.0, desc: 'Zamanı yeniden yaz (kısmi)' },
            { name: 'Bach\'ın Mirası', power: 3.5, desc: 'Güç çalma' },
        ],
        statBoost: { power: 70, speed: 80 }
    },
};

// Hangi form aktif edilecek belirle
function getFormForEvolution(evolution) {
    if (evolution >= 3) return QUINCY_FORMS.yhwach;
    if (evolution >= 2) return QUINCY_FORMS.sternritter;
    if (evolution >= 1) return QUINCY_FORMS.vollstandig;
    return null;
}

module.exports = {
    name: 'vollstandig',
    aliases: ['letzstil', 'quincy', 'qform', 'schrift'],
    description: 'Quincy formunu aktif et! +vollstandig',
    cooldown: 60,
    async execute(message) {
        const player = await Player.findOne({ where: { discordId: message.author.id } });
        if (!player) return message.reply({ embeds: [errorEmbed('Önce `+start` ile karakter oluştur!')] });
        if (player.race !== 'quincy') return message.reply({ embeds: [errorEmbed('Bu komut sadece **Quincy** ırkı için!')] });

        const evolution = player.raceEvolution || 0;
        if (evolution < 1) {
            return message.reply({ embeds: [errorEmbed('Önce `+evolve` ile **Vollständig** formuna ulaş! (Evrim 1 gerekli)')] });
        }

        const form = getFormForEvolution(evolution);
        if (!form) return message.reply({ embeds: [errorEmbed('Yeterli evrim seviyesi yok!')] });

        // Formu aktif kaydet
        player.raceForm = form.name;
        await player.save();

        const skillLines = form.skills.map(s =>
            `⚡ **${s.name}** — ${s.desc} (Hasar ×${s.power > 0 ? s.power : 'Pasif'})`
        ).join('\n');

        const boostLines = Object.entries(form.statBoost)
            .map(([k, v]) => `+${v} ${k.toUpperCase()}`).join(' | ');

        const embed = new EmbedBuilder()
            .setColor(form.color)
            .setTitle(`🏹 ${form.name} Aktif!`)
            .setDescription([
                `*"${form.call}"*`,
                '',
                form.description,
                '',
                `**${message.author.displayName}** Quincy formuna girdi!`,
            ].join('\n'))
            .addFields(
                { name: '⚡ Aktif Yetenekler', value: skillLines, inline: false },
                { name: '📊 Form Bonusu', value: boostLines, inline: true },
                { name: '🎮 Kullanım', value: '`+hunt`, `+duel`, `+bosshunt` komutlarında skilleri kullan!', inline: false }
            )
            .setFooter({ text: `⚡ Kurayami RPG • Quincy • Evrim ${evolution}` })
            .setTimestamp();

        return message.reply({ embeds: [embed] });
    }
};
