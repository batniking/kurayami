const { EmbedBuilder } = require('discord.js');
const BOSSES = require('../data/bosses.json');

const TIER_LABEL = { weak: '🟢 Zayıf', medium: '🟡 Orta', strong: '🔴 Güçlü' };

module.exports = {
    name: 'bosslist',
    aliases: ['bosses', 'bosslar'],
    description: 'Tüm boss\'ları listele. +bosslist | +bosslist bleach | +bosslist aot | +bosslist solo',
    cooldown: 5,
    async execute(message, args) {
        const filter = args[0]?.toLowerCase();

        const SECTION_MAP = {
            bleach: { key: 'bleach', label: '⚔️ Bleach Bossları' },
            aot: { key: 'aot', label: '🏔️ AoT Bossları' },
            solo: { key: 'sololeveling', label: '🌑 Solo Leveling Bossları' },
            sololeveling: { key: 'sololeveling', label: '🌑 Solo Leveling Bossları' },
        };

        const sections = filter && SECTION_MAP[filter]
            ? [SECTION_MAP[filter]]
            : Object.values(SECTION_MAP).filter((v, i, arr) => arr.findIndex(a => a.key === v.key) === i);

        const embed = new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle('📋 Boss Listesi')
            .setDescription('Boss avlamak için: `+bosshunt <boss_id>`\n\nBosslardan **Race Item** düşer — evrim için gereklidir!')
            .setFooter({ text: '⚡ Kurayami RPG • Boss Listesi' })
            .setTimestamp();

        for (const section of sections) {
            const bossArr = BOSSES[section.key];
            if (!bossArr || !Array.isArray(bossArr)) continue;

            const lines = bossArr.map(b => {
                const tier = TIER_LABEL[b.tier] || '❓';
                const dropHints = [];
                if (b.drops?.raceItem) dropHints.push(`🌟 ${b.drops.raceItem} (%${Math.round((b.drops.raceItemChance || 0) * 100)})`);
                if (b.drops?.diamond) dropHints.push(`💎 ${b.drops.diamond}`);
                return `${b.emoji} **${b.name}** \`${b.id}\` — ${tier} — HP ${b.hp.toLocaleString()}${dropHints.length ? `\n   └ ${dropHints.join(' | ')}` : ''}`;
            }).join('\n');

            embed.addFields({ name: section.label, value: lines || 'Yok', inline: false });
        }

        // Weekly boss
        if (!filter || filter === 'weekly') {
            const wb = BOSSES.weekly;
            if (wb) {
                embed.addFields({
                    name: '🌍 Weekly World Boss',
                    value: `${wb.emoji} **${wb.name}** \`${wb.id}\` — 🔴 Güçlü — HP ${wb.hp.toLocaleString()}\n   └ 💰 ${wb.drops.gold[0]}-${wb.drops.gold[1]} | 💎 ${wb.drops.diamond}`,
                    inline: false
                });
            }
        }

        return message.reply({ embeds: [embed] });
    }
};
