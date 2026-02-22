const Player = require('../models/Player');
const { EmbedBuilder } = require('discord.js');
const { errorEmbed } = require('../utils/embedBuilder');

// Arrancar / Hollow Resurreción verileri
// Her Espada'nın kendine özel Resurreción formu var
const RESURRECCION_DATA = {
    // Stage 1 → Menos / Mask formu
    menos: {
        requiredEvolution: 1,
        formName: '😱 Menos Formu',
        call: 'Hollow maskeni tak!',
        color: 0x4a0e0e,
        description: 'Hollow maskeni takarak gücünü serbest bırakıyorsun.',
        skills: [
            { name: 'Cero', power: 1.8, desc: 'Temel Cero ışını — hızlı ve güçlü' },
            { name: 'Hierro', power: 0, desc: 'Deri zırha döner — DEF +15 (pasif)' },
        ],
        statBoost: { power: 10, defense: 15, hp: 50 }
    },

    // Stage 2 → Adjuchas formu
    adjuchas: {
        requiredEvolution: 2,
        formName: '🦂 Adjuchas Formu',
        call: 'Resurreción... daha erken!',
        color: 0x7b0000,
        description: 'Adjuchas gücünü serbest bırakıyorsun. Hayvan formu beliriyor.',
        skills: [
            { name: 'Gran Cero', power: 2.2, desc: 'Büyük Cero — daha güçlü' },
            { name: 'Hierro Akuma', power: 0, desc: 'Gelişmiş Hierro — DEF +30 (pasif)' },
            { name: 'Sonido', power: 1.5, desc: 'Hız atağı — hız +40 + hasar' },
        ],
        statBoost: { power: 25, defense: 20, speed: 20, hp: 150 }
    },

    // Stage 3 → Vasto Lorde
    vasto_lorde: {
        requiredEvolution: 3,
        formName: '👿 Vasto Lorde Formu',
        call: 'Bu gücün sınırını bilmiyorum...',
        color: 0xb00000,
        description: 'Vasto Lorde gücünü tam olarak serbest bırakıyorsun. Captain sınıfı güç!',
        skills: [
            { name: 'Ultima Cero', power: 3.0, desc: 'Nihai Cero — maksimum güç' },
            { name: 'Resurreción: İlk Form', power: 2.5, desc: 'Hayvan/güç formu aktif' },
            { name: 'Regeneración', power: 0, desc: 'Her turda %5 HP yenile (pasif)' },
        ],
        statBoost: { power: 60, defense: 40, speed: 50, hp: 400 }
    },

    // Stage 4 → Arrancar tam form
    arrancar: {
        requiredEvolution: 4,
        formName: '💀 Resurreción: Segunda Etapa',
        call: 'Resurreccion Segunda Etapa... aşılmaz güç!',
        color: 0x1a0000,
        description: 'Arrancar\'ın en üst formu. Segunda Etapa — sadece Ulquiorra ulaşabilmişti.',
        skills: [
            { name: 'Cero Oscuras', power: 4.0, desc: 'Tam karanlık Cero — Shinigami Getsuga\'yı geçer' },
            { name: 'Lanza del Relámpago', power: 3.5, desc: 'Şimşek mızrağı — alan hasar' },
            { name: 'Hierro Absoluto', power: 0, desc: 'Mutlak zırh — DEF +80 (pasif)' },
            { name: 'Murciélago', power: 5.0, desc: 'Nihai form — tüm güç patlaması' },
        ],
        statBoost: { power: 100, defense: 80, speed: 90, hp: 700 }
    },
};

// Espada'ya özel Resurreción isimleri (flavor)
const ESPADA_RESURRECCION = {
    ulquiorra: { name: 'Murciélago', call: 'Enla sombra de mi ala, consume todo...!', emoji: '🦇' },
    grimmjow: { name: 'Pantera', call: 'Gao, Pantera!', emoji: '🐆' },
    baraggan: { name: 'Arrogante', call: 'Rust away... Arrogante!', emoji: '💀' },
    starrk: { name: 'Los Lobos', call: 'Kick about... Los Lobos!', emoji: '🐺' },
    halibel: { name: 'Tiburón', call: 'Destroy... Tiburón!', emoji: '🦈' },
    nnoitra: { name: 'Santa Teresa', call: 'Santa Teresa!', emoji: '🦂' },
    szayelaporro: { name: 'Fornicarás', call: 'Fornicarás!', emoji: '🕷️' },
    yammy: { name: 'Ira', call: 'Ira!', emoji: '💢' },
};

function getFormForEvolution(evolution) {
    if (evolution >= 4) return RESURRECCION_DATA.arrancar;
    if (evolution >= 3) return RESURRECCION_DATA.vasto_lorde;
    if (evolution >= 2) return RESURRECCION_DATA.adjuchas;
    if (evolution >= 1) return RESURRECCION_DATA.menos;
    return null;
}

module.exports = {
    name: 'resurreccion',
    aliases: ['resur', 'mask', 'hollowform', 'cero'],
    description: 'Hollow/Arrancar formunu aktif et! +resurreccion',
    cooldown: 60,
    async execute(message) {
        const player = await Player.findOne({ where: { discordId: message.author.id } });
        if (!player) return message.reply({ embeds: [errorEmbed('Önce `+start` ile karakter oluştur!')] });
        if (player.race !== 'hollow') return message.reply({ embeds: [errorEmbed('Bu komut sadece **Hollow** ırkı için!\nShinigami → `+bankai` | Quincy → `+vollstandig`')] });

        const evolution = player.raceEvolution || 0;
        if (evolution < 1) {
            return message.reply({ embeds: [errorEmbed('Önce `+evolve` ile **Menos** formuna ulaş! (Evrim 1 gerekli)')] });
        }

        const form = getFormForEvolution(evolution);
        const espada = player.raceData?.espada ? ESPADA_RESURRECCION[player.raceData.espada] : null;

        const formName = espada ? `${espada.emoji} ${espada.name} — ${form.formName}` : form.formName;
        const callText = espada
            ? `"${espada.call}"\n*${form.call}*`
            : `*"${form.call}"*`;

        // Formu aktif kaydet
        player.raceForm = formName;
        await player.save();

        const skillLines = form.skills.map(s =>
            `⚡ **${s.name}** — ${s.desc} (${s.power > 0 ? `Hasar ×${s.power}` : 'Pasif'})`
        ).join('\n');

        const boostLines = Object.entries(form.statBoost)
            .map(([k, v]) => `+${v} ${k.toUpperCase()}`).join(' | ');

        const embed = new EmbedBuilder()
            .setColor(form.color)
            .setTitle(`💀 RESURRECIÓN — ${espada ? espada.name.toUpperCase() : 'HOLLOW FORM'}!`)
            .setDescription([
                callText,
                '',
                form.description,
                '',
                `**${message.author.displayName}** ${formName} aktif!`,
            ].join('\n'))
            .addFields(
                { name: '⚡ Aktif Yetenekler', value: skillLines, inline: false },
                { name: '📊 Form Bonusu', value: boostLines, inline: true },
                { name: '⬆️ Evrim', value: `${evolution}/4 (Arrancar max)`, inline: true },
                { name: '🎮 Kullanım', value: '`+hunt`, `+duel`, `+bosshunt` sırasında skill butonları aktif!', inline: false }
            )
            .setFooter({ text: `⚡ Kurayami RPG • Hollow • Evrim ${evolution}` })
            .setTimestamp();

        return message.reply({ embeds: [embed] });
    }
};
