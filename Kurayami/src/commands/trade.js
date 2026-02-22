const Player = require('../models/Player');
const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { errorEmbed, successEmbed } = require('../utils/embedBuilder');
const { getOrCreateBattleThread } = require('../utils/threadHelper');
const battleSessions = require('../utils/battleSessions');
const tradeStore = require('../utils/tradeStore');
const { safeDeferUpdate, safeReply } = require('../utils/interactionUtils');

const inTrade = new Set();

function formatOffer(o) {
    const parts = [];
    if (o.gold > 0) parts.push(`💰 ${o.gold} Altın`);
    if (o.diamond > 0) parts.push(`💎 ${o.diamond} Elmas`);
    return parts.length ? parts.join(' • ') : '—';
}

function buildTradeEmbed(state, name1, name2) {
    const o1 = state.offer1;
    const o2 = state.offer2;
    const c1 = state.confirmed1 ? '✅' : '⬜';
    const c2 = state.confirmed2 ? '✅' : '⬜';
    return new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle('🔄 Takas')
        .setDescription('Her iki taraf da **Onayla** basarsa takas tamamlanır. Teklif değişince onaylar sıfırlanır.')
        .addFields(
            { name: `${c1} ${name1}`, value: formatOffer(o1), inline: true },
            { name: `${c2} ${name2}`, value: formatOffer(o2), inline: true },
            { name: '\u200b', value: '➕ Altın/Elmas ekle → **Onayla** → Karşı taraf da onaylarsa takas biter.', inline: false }
        )
        .setFooter({ text: '⚡ Kurayami RPG • Trade' })
        .setTimestamp();
}

function buildTradeButtons(disabled = false) {
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('trade:add100gold').setLabel('💰 +100 Altın').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
            new ButtonBuilder().setCustomId('trade:add500gold').setLabel('💰 +500 Altın').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
            new ButtonBuilder().setCustomId('trade:add10diamond').setLabel('💎 +10 Elmas').setStyle(ButtonStyle.Secondary).setDisabled(disabled)
        ),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('trade:confirm').setLabel('✅ Onayla').setStyle(ButtonStyle.Success).setDisabled(disabled),
            new ButtonBuilder().setCustomId('trade:cancel').setLabel('❌ İptal').setStyle(ButtonStyle.Danger).setDisabled(disabled)
        ),
    ];
}

module.exports = {
    name: 'trade',
    aliases: ['takas', 't'],
    description: 'Oyuncu ile takas yap. +trade @oyuncu',
    cooldown: 5,
    async execute(message) {
        const target = message.mentions.users.first();
        if (!target || target.bot || target.id === message.author.id) {
            return message.reply({ embeds: [errorEmbed('Geçerli bir oyuncu etiketle! Örnek: `+trade @Kullanici`')] });
        }

        const player1 = await Player.findOne({ where: { discordId: message.author.id } });
        const player2 = await Player.findOne({ where: { discordId: target.id } });
        if (!player1) return message.reply({ embeds: [errorEmbed('Önce `+start` ile karakter oluştur!')] });
        if (!player2) return message.reply({ embeds: [errorEmbed('Etiketlediğin oyuncunun karakteri yok.')] });
        if (player1.inBattle || player2.inBattle) return message.reply({ embeds: [errorEmbed('Oyunculardan biri savaşta!')] });
        if (inTrade.has(message.author.id) || inTrade.has(target.id)) {
            return message.reply({ embeds: [errorEmbed('Siz veya karşı taraf zaten bir takasta!')] });
        }

        inTrade.add(message.author.id);
        inTrade.add(target.id);

        const state = {
            channelId: null,
            messageId: null,
            user1Id: message.author.id,
            user2Id: target.id,
            name1: message.author.displayName,
            name2: target.displayName,
            offer1: { gold: 0, diamond: 0 },
            offer2: { gold: 0, diamond: 0 },
            confirmed1: false,
            confirmed2: false,
        };

        const tradeChannel = await getOrCreateBattleThread(message, `Trade — ${message.author.username} vs ${target.username}`);
        const tradeMsg = await tradeChannel.send({
            content: `${message.author} ${target}`,
            embeds: [buildTradeEmbed(state, state.name1, state.name2)],
            components: buildTradeButtons(),
        });

        state.channelId = tradeMsg.channel.id;
        state.messageId = tradeMsg.id;
        tradeStore.set(tradeMsg.id, state);
        battleSessions.register(tradeMsg.id, 'trade', [message.author.id, target.id]);

        const collector = tradeMsg.createMessageComponentCollector({
            time: 5 * 60 * 1000,
            filter: i => i.user.id === message.author.id || i.user.id === target.id,
        });

        function endTrade(reason) {
            battleSessions.unregister(tradeMsg.id);
            tradeStore.remove(tradeMsg.id);
            inTrade.delete(message.author.id);
            inTrade.delete(target.id);
        }

        collector.on('collect', async (i) => {
            await safeDeferUpdate(i);
            const s = tradeStore.get(tradeMsg.id);
            if (!s) return;

            const isUser1 = i.user.id === s.user1Id;

            if (i.customId === 'trade:cancel') {
                endTrade();
                await tradeMsg.edit({
                    embeds: [new EmbedBuilder().setColor(0x95a5a6).setDescription('❌ Takas iptal edildi.').setFooter({ text: '⚡ Kurayami RPG' })],
                    components: [],
                }).catch(() => {});
                return;
            }

            if (i.customId === 'trade:confirm') {
                if (isUser1) s.confirmed1 = true;
                else s.confirmed2 = true;

                if (!s.confirmed1 || !s.confirmed2) {
                    await tradeMsg.edit({ embeds: [buildTradeEmbed(s, s.name1, s.name2)], components: buildTradeButtons() }).catch(() => {});
                    return;
                }

                const p1 = await Player.findOne({ where: { discordId: s.user1Id } });
                const p2 = await Player.findOne({ where: { discordId: s.user2Id } });
                if (!p1 || !p2) {
                    await safeReply(i, '❌ Oyuncu bulunamadı.');
                    return;
                }
                if (p1.gold < s.offer1.gold || p1.diamond < s.offer1.diamond) {
                    await safeReply(i, '❌ Yeterli altın/elmas yok!');
                    s.confirmed1 = false;
                    s.confirmed2 = false;
                    await tradeMsg.edit({ embeds: [buildTradeEmbed(s, s.name1, s.name2)], components: buildTradeButtons() }).catch(() => {});
                    return;
                }
                if (p2.gold < s.offer2.gold || p2.diamond < s.offer2.diamond) {
                    await safeReply(i, '❌ Karşı tarafın yeterli altın/elması yok!');
                    s.confirmed1 = false;
                    s.confirmed2 = false;
                    await tradeMsg.edit({ embeds: [buildTradeEmbed(s, s.name1, s.name2)], components: buildTradeButtons() }).catch(() => {});
                    return;
                }

                p1.gold -= s.offer1.gold;
                p1.diamond -= s.offer1.diamond;
                p2.gold -= s.offer2.gold;
                p2.diamond -= s.offer2.diamond;
                p1.gold += s.offer2.gold;
                p1.diamond += s.offer2.diamond;
                p2.gold += s.offer1.gold;
                p2.diamond += s.offer1.diamond;
                await p1.save();
                await p2.save();

                endTrade();
                await tradeMsg.edit({
                    embeds: [successEmbed('Takas tamamlandı', `${s.name1} ↔ ${s.name2}\n\n${formatOffer(s.offer1)} ⇄ ${formatOffer(s.offer2)}`)],
                    components: [],
                }).catch(() => {});
                return;
            }

            s.confirmed1 = false;
            s.confirmed2 = false;
            const offer = isUser1 ? s.offer1 : s.offer2;
            const player = isUser1 ? await Player.findOne({ where: { discordId: s.user1Id } }) : await Player.findOne({ where: { discordId: s.user2Id } });

            if (i.customId === 'trade:add100gold') {
                if (player.gold < offer.gold + 100) {
                    await safeReply(i, '❌ Yeterli altın yok.');
                    return;
                }
                offer.gold += 100;
            } else if (i.customId === 'trade:add500gold') {
                if (player.gold < offer.gold + 500) {
                    await safeReply(i, '❌ Yeterli altın yok.');
                    return;
                }
                offer.gold += 500;
            } else if (i.customId === 'trade:add10diamond') {
                if (player.diamond < offer.diamond + 10) {
                    await safeReply(i, '❌ Yeterli elmas yok.');
                    return;
                }
                offer.diamond += 10;
            }

            await tradeMsg.edit({ embeds: [buildTradeEmbed(s, s.name1, s.name2)], components: buildTradeButtons() }).catch(() => {});
        });

        collector.on('end', (_, reason) => {
            if (reason !== 'user') {
                endTrade();
                tradeMsg.edit({ components: [] }).catch(() => {});
            }
        });
    },
};
