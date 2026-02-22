const Player = require('../models/Player');
const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { errorEmbed, successEmbed, RACE_EMOJIS, getColor } = require('../utils/embedBuilder');

const RACES = [
    { id: 'shinigami', name: 'Shinigami', emoji: '⚫', desc: 'Ruh reaperları. Zanpakuto ve Bankai güçleri.', passive: 'Zanpakuto hasarı +20%' },
    { id: 'hollow', name: 'Hollow', emoji: '💀', desc: 'Ruh yiyiciler. Hollow → Arrancar evrimi.', passive: 'Cero hasar +20%, HP +150' },
    { id: 'quincy', name: 'Quincy', emoji: '🏹', desc: 'Ruh okçuları. Spirit Weapon sistemi.', passive: 'Spirit Weapon hasar +20%' },
    { id: 'titan', name: 'Titan', emoji: '👹', desc: 'Dev transformasyonlar. 9 Titan tipi.', passive: 'Titan form hasar +20%' },
    { id: 'fullbring', name: 'Fullbring', emoji: '✨', desc: 'Cisim güçlendirme. Chad & Orihime tarzı.', passive: 'Fullbring hasar +20%' },
    { id: 'human', name: 'İnsan', emoji: '👤', desc: 'Başlangıç ırkı. Tüm silahlara uyumlu.', passive: 'Tüm istatistikler +5%' },
];

module.exports = {
    name: 'raceselect',
    aliases: ['race'],
    description: 'Irkını seç veya değiştir.',
    cooldown: 10,
    async execute(message) {
        const player = await Player.findOne({ where: { discordId: message.author.id } });
        if (!player) return message.reply({ embeds: [errorEmbed('Önce `+start` ile karakter oluştur!')] });

        const embed = new EmbedBuilder()
            .setColor(getColor(player.race))
            .setTitle('🧬 Irk Seçimi')
            .setDescription('Aşağıdan ırkını seç. Irk değiştirmek için o ırkın boss\'unu öldürmen gerekir.\n\n')
            .addFields(
                RACES.map(r => ({
                    name: `${r.emoji} ${r.name} ${player.race === r.id ? '*(mevcut)*' : ''}`,
                    value: `${r.desc}\n**Pasif:** ${r.passive}`,
                    inline: false,
                }))
            )
            .setFooter({ text: '⚡ Kurayami RPG • Irk Sistemi' })
            .setTimestamp();

        const rows = [];
        for (let i = 0; i < RACES.length; i += 3) {
            const chunk = RACES.slice(i, i + 3);
            rows.push(new ActionRowBuilder().addComponents(
                chunk.map(r =>
                    new ButtonBuilder()
                        .setCustomId(`raceselect:pick:${r.id}`)
                        .setLabel(`${r.emoji} ${r.name}`)
                        .setStyle(r.id === player.race ? ButtonStyle.Primary : ButtonStyle.Secondary)
                        .setDisabled(r.id === player.race)
                )
            ));
        }

        const msg = await message.reply({ embeds: [embed], components: rows });
        const collector = msg.createMessageComponentCollector({ time: 60000, filter: i => i.user.id === message.author.id });

        collector.on('collect', async (i) => {
            const [, , raceId] = i.customId.split(':');
            const race = RACES.find(r => r.id === raceId);
            if (!race) return;

            // İnsan hariç ilk kez seçim serbest, sonrası boss kill gerektirir
            const isFirstSelect = player.race === 'human' && player.level < 5;
            if (!isFirstSelect && player.race !== raceId) {
                return i.reply({ embeds: [errorEmbed(`Irk değiştirmek için **${race.name} boss\'unu** öldürüp Race Reset Taşı kullanman gerekir!`)], ephemeral: true });
            }

            player.race = raceId;
            player.raceEvolution = 0;
            player.raceForm = null;
            player.raceData = {};
            await player.save();

            await i.update({
                embeds: [new EmbedBuilder()
                    .setColor(getColor(raceId))
                    .setTitle(`${race.emoji} ${race.name} Seçildi!`)
                    .setDescription(`**${race.name}** ırkını seçtin!\n**Pasif:** ${race.passive}\n\n` + race.desc)
                    .setFooter({ text: '⚡ Kurayami RPG • Irk Sistemi' })],
                components: []
            });
            collector.stop();
        });

        collector.on('end', () => {
            msg.edit({ components: [] }).catch(() => { });
        });
    }
};
