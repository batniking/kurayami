const Player = require('../models/Player');
const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const battleSessions = require('../utils/battleSessions');

module.exports = {
    name: 'start',
    description: 'Oyuna başla ve karakterini oluştur.',
    cooldown: 5,
    async execute(message) {
        const existing = await Player.findOne({ where: { discordId: message.author.id } });
        if (existing) {
            return message.reply({
                embeds: [
                    new EmbedBuilder().setColor(0xe74c3c).setDescription('❌ Zaten bir karakterin var! Profil için `+profile` kullan.')
                ]
            });
        }

        const embed = new EmbedBuilder()
            .setColor(0x2980b9)
            .setTitle('⚡ Kurayami RPG\'ye Hoş Geldin!')
            .setDescription(`Merhaba **${message.author.displayName}**! Anime dünyasına adım atıyorsun.\n\nBaşlamak için aşağıdaki yönergeleri izle:`)
            .addFields(
                { name: '1️⃣ Irk Seç', value: '`+raceselect` komutuyla ırkını seç', inline: false },
                { name: '2️⃣ Hunt Başlat', value: '`+hunt` komutuyla düşman avla', inline: false },
                { name: '3️⃣ Profilini Gör', value: '`+profile` komutuyla karakterini incele', inline: false },
                { name: '4️⃣ Boss Öldür', value: '`+bosshunt` ile boss savaşına gir', inline: false },
                { name: '📋 Tüm Komutlar', value: '`+help` ile tüm komutları gör', inline: false },
            )
            .setFooter({ text: '⚡ Kurayami RPG • Tutorial' })
            .setTimestamp();

        const btn = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('start:create').setLabel('✅ Karakteri Oluştur').setStyle(ButtonStyle.Success)
        );

        const msg = await message.reply({ embeds: [embed], components: [btn] });
        battleSessions.register(msg.id, 'start', message.author.id);

        const collector = msg.createMessageComponentCollector({ time: 60000, filter: i => i.user.id === message.author.id });
        collector.on('collect', async (i) => {
            if (i.customId !== 'start:create') return;
            await Player.create({
                discordId: message.author.id,
                username: message.author.displayName,
            });
            await i.update({
                embeds: [new EmbedBuilder()
                    .setColor(0x2ecc71)
                    .setTitle('✅ Karakter Oluşturuldu!')
                    .setDescription(`**${message.author.displayName}** karakterin hazır!\n\nŞimdi \`+raceselect\` ile ırkını seç!`)
                    .setFooter({ text: '⚡ Kurayami RPG' })],
                components: []
            });
            collector.stop();
        });
        collector.on('end', () => {
            battleSessions.unregister(msg.id);
            msg.edit({ components: [] }).catch(() => {});
        });
    },

    async handleInteraction(interaction) {
        if (interaction.customId !== 'start:create') return;
        
        const existing = await Player.findOne({ where: { discordId: interaction.user.id } });
        if (existing) {
            await interaction.update({
                embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('❌ Zaten bir karakterin var! Profil için `+profile` kullan.')],
                components: []
            });
            return;
        }
        
        await Player.create({
            discordId: interaction.user.id,
            username: interaction.user.displayName,
        });
        await interaction.update({
            embeds: [new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle('✅ Karakter Oluşturuldu!')
                .setDescription(`**${interaction.user.displayName}** karakterin hazır!\n\nŞimdi \`+raceselect\` ile ırkını seç!`)
                .setFooter({ text: '⚡ Kurayami RPG' })],
            components: []
        });
    }
};
