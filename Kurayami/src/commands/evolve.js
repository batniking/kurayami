const Player = require('../models/Player');
const InventoryItem = require('../models/InventoryItem');
const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { errorEmbed } = require('../utils/embedBuilder');

// Evrim yolları ve gereksinimleri
const EVOLUTION_PATHS = {
    hollow: {
        name: '👻 Hollow',
        stages: [
            {
                stage: 1,
                name: 'Menos Grande',
                emoji: '😱',
                description: 'İlk evrimin! Hollowlar içinde temel form.',
                requirements: { level: 10, kills: 20, raceItem: null },
                bonuses: { power: 10, defense: 5, speed: 5, maxHp: 50 },
                skills: ['Cero']
            },
            {
                stage: 2,
                name: 'Adjuchas',
                emoji: '🦂',
                description: 'Hollow yiyerek güçlenen savaşçı form.',
                requirements: { level: 25, kills: 100, raceItem: 'hollow_mask' },
                bonuses: { power: 25, defense: 15, speed: 20, maxHp: 150 },
                skills: ['Gran Cero', 'Hierro']
            },
            {
                stage: 3,
                name: 'Vasto Lorde',
                emoji: '👿',
                description: 'Hollowların en üst formu. Captain seviyesi güç!',
                requirements: { level: 50, kills: 500, raceItem: 'menos_mask' },
                bonuses: { power: 60, defense: 40, speed: 50, maxHp: 400 },
                skills: ['Ultima Cero', 'Resurreción']
            },
            {
                stage: 4,
                name: 'Arrancar',
                emoji: '💀',
                description: 'Shinigami güçleri kazanmış Hollow. Tam potansiyel!',
                requirements: { level: 75, kills: 2000, raceItem: 'hogyoku' },
                bonuses: { power: 100, defense: 80, speed: 90, maxHp: 700 },
                skills: ['Cero Oscuras', 'Hierro Absoluto', 'Sonido']
            },
        ]
    },
    shinigami: {
        name: '⚫ Shinigami',
        stages: [
            {
                stage: 1,
                name: 'Shikai',
                emoji: '🌑',
                description: 'Zanpakuto\'nun ilk serbest bırakma formu.',
                requirements: { level: 15, kills: 50, raceItem: null },
                bonuses: { power: 20, defense: 10, speed: 15, maxHp: 100 },
                skills: ['Shikai Yeteneği']
            },
            {
                stage: 2,
                name: 'Bankai',
                emoji: '⚫',
                description: 'Zanpakuto\'nun nihai formu. Captain sınıfı güç!',
                requirements: { level: 40, kills: 300, raceItem: 'bankai_crystal' },
                bonuses: { power: 80, defense: 50, speed: 60, maxHp: 500 },
                skills: ['Bankai Yeteneği', 'Genkat Shunkō']
            },
            {
                stage: 3,
                name: 'Hollow Shinigami',
                emoji: '🎭',
                description: 'İç Hollowunu kontrol altına aldın. Hollow masken var!',
                requirements: { level: 65, kills: 1000, raceItem: 'hollow_mask' },
                bonuses: { power: 120, defense: 80, speed: 90, maxHp: 700 },
                skills: ['Hollow Mask', 'Saigo no Getsuga Tenshō']
            },
        ]
    },
    quincy: {
        name: '🏹 Quincy',
        stages: [
            {
                stage: 1,
                name: 'Vollständig',
                emoji: '✦',
                description: 'Ruhsal partikülleri tam olarak topla ruhani form!',
                requirements: { level: 20, kills: 80, raceItem: null },
                bonuses: { power: 30, defense: 10, speed: 40, maxHp: 120 },
                skills: ['Heilig Pfeil', 'Blut Arterie']
            },
            {
                stage: 2,
                name: 'Sternritter',
                emoji: '⭐',
                description: 'Yhwach\'ın seçilmiş askerleri. Schrift yeteneği!',
                requirements: { level: 45, kills: 400, raceItem: 'quincy_soul' },
                bonuses: { power: 70, defense: 40, speed: 70, maxHp: 400 },
                skills: ['Schrift', 'Letzt Stil']
            },
            {
                stage: 3,
                name: 'Yhwach Reishi',
                emoji: '👑',
                description: 'Yhwach\'ın kanını taşıyan elite. Almighty glimpse!',
                requirements: { level: 70, kills: 1500, raceItem: 'quincy_soul' },
                bonuses: { power: 110, defense: 70, speed: 100, maxHp: 600 },
                skills: ['The Almighty (Kısmi)', 'Auswählen']
            },
        ]
    },
};


module.exports = {
    name: 'evolve',
    aliases: ['evrim', 'evolution'],
    description: 'Irk evrimini gerçekleştir. +evolve | +evolve info',
    cooldown: 10,
    async execute(message, args) {
        const player = await Player.findOne({ where: { discordId: message.author.id } });
        if (!player) return message.reply({ embeds: [errorEmbed('Önce `+start` ile karakter oluştur!')] });
        if (!player.race || player.race === 'human') return message.reply({ embeds: [errorEmbed('Önce `+raceselect` ile bir ırk seç!')] });

        const path = EVOLUTION_PATHS[player.race];
        if (!path) return message.reply({ embeds: [errorEmbed(`**${player.race}** ırkı için evrim yolu henüz mevcut değil.`)] });

        const currentStage = player.raceEvolution || 0;
        const nextStage = path.stages[currentStage];
        const maxStage = path.stages.length;

        // Evrim yolu bilgisi göster
        if (args[0] === 'info' || args[0] === 'bilgi') {
            const embed = new EmbedBuilder()
                .setColor(0x9b59b6)
                .setTitle(`${path.name} Evrim Yolu`)
                .setDescription(`Mevcut evrim: **${currentStage > 0 ? path.stages[currentStage - 1].name : 'Başlangıç'}** (${currentStage}/${maxStage})`)
                .addFields(
                    path.stages.map((s, i) => ({
                        name: `${i < currentStage ? '✅' : i === currentStage ? '➡️' : '🔒'} ${s.emoji} ${s.name} (Aşama ${s.stage})`,
                        value: [
                            s.description,
                            `**Gereksinimler:** Level ${s.requirements.level} | ${s.requirements.kills} Kill${s.requirements.raceItem ? ` | \`${s.requirements.raceItem}\`` : ''}`,
                            `**Bonus:** +${s.bonuses.power} PWR | +${s.bonuses.defense} DEF | +${s.bonuses.speed} SPD | +${s.bonuses.maxHp} HP`
                        ].join('\n'),
                        inline: false
                    }))
                )
                .setFooter({ text: '⚡ Kurayami RPG • Evrim Sistemi' });
            return message.reply({ embeds: [embed] });
        }

        // Max evrime ulaştı mı?
        if (currentStage >= maxStage) {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor(0xf1c40f)
                    .setTitle('🏆 Maksimum Evrim!')
                    .setDescription(`Tebrikler! **${path.stages[currentStage - 1].name}** formundasın — bu ırkın en üst evrimi!`)
                    .setFooter({ text: '⚡ Kurayami RPG' })]
            });
        }

        // Gereksinimleri kontrol et
        const req = nextStage.requirements;
        const errors = [];
        if (player.level < req.level) errors.push(`❌ Level **${req.level}** gerekiyor (Şu an: ${player.level})`);
        if (player.totalKills < req.kills) errors.push(`❌ **${req.kills}** kill gerekiyor (Şu an: ${player.totalKills})`);

        let hasRaceItem = true;
        if (req.raceItem) {
            const raceItemInv = await InventoryItem.findOne({ where: { playerId: player.id, itemId: req.raceItem } });
            if (!raceItemInv) {
                hasRaceItem = false;
                errors.push(`❌ **${req.raceItem}** (Irk İtemi) gerekiyor — boss'lardan düşer!`);
            }
        }

        if (errors.length > 0) {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor(0xe74c3c)
                    .setTitle('❌ Evrim Gereksinimleri Karşılanmıyor')
                    .setDescription(errors.join('\n'))
                    .addFields({ name: `➡️ ${nextStage.emoji} ${nextStage.name}`, value: nextStage.description, inline: false })
                    .setFooter({ text: '⚡ Kurayami RPG • Evrim' })]
            });
        }

        // Onay butonu
        const confirmRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('evolve:confirm').setLabel(`✅ ${nextStage.name} Formuna Geç!`).setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('evolve:cancel').setLabel('❌ İptal').setStyle(ButtonStyle.Secondary)
        );

        const preview = new EmbedBuilder()
            .setColor(0x9b59b6)
            .setTitle(`⚡ Evrim Hazır — ${nextStage.emoji} ${nextStage.name}`)
            .setDescription(nextStage.description)
            .addFields(
                {
                    name: '📊 Stat Bonusu',
                    value: `+${nextStage.bonuses.power} PWR | +${nextStage.bonuses.defense} DEF | +${nextStage.bonuses.speed} SPD | +${nextStage.bonuses.maxHp} HP`,
                    inline: false
                },
                {
                    name: '⚡ Açılan Yetenekler',
                    value: nextStage.skills.join(', '),
                    inline: false
                }
            )
            .setFooter({ text: '⚡ Kurayami RPG • 30 saniye içinde onayla!' });

        const msg = await message.reply({ embeds: [preview], components: [confirmRow] });
        const collector = msg.createMessageComponentCollector({ time: 30000, filter: i => i.user.id === message.author.id, max: 1 });

        collector.on('collect', async (btn) => {
            await btn.deferUpdate();
            if (btn.customId === 'evolve:cancel') {
                await msg.edit({ embeds: [new EmbedBuilder().setColor(0x95a5a6).setDescription('❌ Evrim iptal edildi.')], components: [] });
                return;
            }

            // Evrim gerçekleştir
            player.raceEvolution = currentStage + 1;
            player.raceForm = nextStage.name;
            player.power += nextStage.bonuses.power;
            player.defense += nextStage.bonuses.defense;
            player.speed += nextStage.bonuses.speed;
            player.maxHp += nextStage.bonuses.maxHp;
            player.hp = Math.min(player.hp + nextStage.bonuses.maxHp, player.maxHp);

            // Race item tüket (varsa)
            if (req.raceItem) {
                const ri = await InventoryItem.findOne({ where: { playerId: player.id, itemId: req.raceItem } });
                if (ri) {
                    if (ri.quantity > 1) { ri.quantity -= 1; await ri.save(); }
                    else await ri.destroy();
                }
            }

            await player.save();

            const successEmbed = new EmbedBuilder()
                .setColor(0xf1c40f)
                .setTitle(`🌟 EVRİM TAMAMLANDI!`)
                .setDescription(`**${message.author.displayName}** artık ${nextStage.emoji} **${nextStage.name}** formunda!`)
                .addFields(
                    { name: '📊 Kazanılan Statlar', value: `+${nextStage.bonuses.power} PWR | +${nextStage.bonuses.defense} DEF | +${nextStage.bonuses.speed} SPD | +${nextStage.bonuses.maxHp} HP`, inline: false },
                    { name: '⚡ Yeni Yetenekler', value: nextStage.skills.join(', '), inline: false },
                    { name: '🔢 Evrim Seviyesi', value: `${player.raceEvolution}/${maxStage}`, inline: true }
                )
                .setFooter({ text: '⚡ Kurayami RPG • Evrim Sistemi' });

            await msg.edit({ embeds: [successEmbed], components: [] });
        });

        collector.on('end', async (_, reason) => {
            if (reason === 'time') msg.edit({ components: [] }).catch(() => { });
        });
    }
};
