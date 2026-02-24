const Player = require('../models/Player');
const InventoryItem = require('../models/InventoryItem');
const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { errorEmbed, getColor, TIER_EMOJIS } = require('../utils/embedBuilder');
const battleSessions = require('../utils/battleSessions');

const TABS = [
    { id: 'weapon', label: '⚔️ Silahlar', emoji: '⚔️' },
    { id: 'armor', label: '🛡️ Zırhlar', emoji: '🛡️' },
    { id: 'accessory', label: '💍 Aksesuarlar', emoji: '💍' },
    { id: 'pot', label: '🧪 Potlar', emoji: '🧪' },
    { id: 'material', label: '📦 Diğer', emoji: '📦' },
];

function buildInvEmbed(player, items, tab, color) {
    const tierEmoji = TIER_EMOJIS;
    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`🎒 ${player.username}'in Envanteri — ${TABS.find(t => t.id === tab)?.label}`)
        .setFooter({ text: '⚡ Kurayami RPG • Envanter' })
        .setTimestamp();

    if (!items.length) {
        embed.setDescription('_Bu kategoride eşya yok._');
        return embed;
    }

    items.forEach(item => {
        const data = item.data || {};
        const name = data.name || item.itemId;
        const emoji = data.emoji || '📦';
        const tier = item.tier || 'common';
        const equippedTag = item.equipped ? ' ✅' : '';
        const upgradeTag = item.upgradeLevel > 0 ? ` [+${item.upgradeLevel}]` : '';
        embed.addFields({
            name: `${emoji} ${name}${equippedTag}${upgradeTag} [${tierEmoji[tier] || '⚪'} ${tier}]`,
            value: `Miktar: ${item.quantity}`,
            inline: true,
        });
    });

    return embed;
}

module.exports = {
    name: 'inv',
    aliases: ['inventory', 'i'],
    description: 'Envanterini görüntüle.',
    cooldown: 5,
    async execute(message) {
        const player = await Player.findOne({ where: { discordId: message.author.id } });
        if (!player) return message.reply({ embeds: [errorEmbed('Önce `+start` ile karakter oluştur!')] });

        const color = getColor(player.race);
        let currentTab = 'weapon';

        const items = await InventoryItem.findAll({ where: { playerId: player.id, itemType: currentTab } });

        const embed = buildInvEmbed(player, items, currentTab, color);

        const row = new ActionRowBuilder().addComponents(
            TABS.map(t =>
                new ButtonBuilder()
                    .setCustomId(`inv:tab:${t.id}:${player.id}`)
                    .setLabel(t.label)
                    .setStyle(t.id === currentTab ? ButtonStyle.Primary : ButtonStyle.Secondary)
            )
        );

        const msg = await message.reply({ embeds: [embed], components: [row] });
        battleSessions.register(msg.id, 'inv', message.author.id);

        const collector = msg.createMessageComponentCollector({
            time: 120000,
            filter: i => i.user.id === message.author.id,
        });

        collector.on('collect', async (i) => {
            const [, , tab] = i.customId.split(':');
            currentTab = tab;
            const newItems = await InventoryItem.findAll({ where: { playerId: player.id, itemType: tab } });
            const newEmbed = buildInvEmbed(player, newItems, tab, color);
            const newRow = new ActionRowBuilder().addComponents(
                TABS.map(t =>
                    new ButtonBuilder()
                        .setCustomId(`inv:tab:${t.id}:${player.id}`)
                        .setLabel(t.label)
                        .setStyle(t.id === tab ? ButtonStyle.Primary : ButtonStyle.Secondary)
                )
            );
            await i.update({ embeds: [newEmbed], components: [newRow] });
        });

        collector.on('end', () => {
            battleSessions.unregister(msg.id);
            msg.edit({ components: [] }).catch(() => { });
        });
    },

    async handleInteraction(interaction) {
        const [, , tab] = interaction.customId.split(':');
        const player = await Player.findOne({ where: { discordId: interaction.user.id } });
        if (!player) {
            await interaction.reply({ embeds: [errorEmbed('Önce `+start` ile karakter oluştur!')], ephemeral: true });
            return;
        }

        const color = getColor(player.race);
        const newItems = await InventoryItem.findAll({ where: { playerId: player.id, itemType: tab } });
        const newEmbed = buildInvEmbed(player, newItems, tab, color);
        const newRow = new ActionRowBuilder().addComponents(
            TABS.map(t =>
                new ButtonBuilder()
                    .setCustomId(`inv:tab:${t.id}:${player.id}`)
                    .setLabel(t.label)
                    .setStyle(t.id === tab ? ButtonStyle.Primary : ButtonStyle.Secondary)
            )
        );
        await interaction.update({ embeds: [newEmbed], components: [newRow] });
    }
};
