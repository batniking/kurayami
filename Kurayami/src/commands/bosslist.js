const { EmbedBuilder } = require('discord.js');
const BOSSES = require('../data/bosses.json');

const TIER_LABEL = { weak: '🟢 Zayıf', medium: '🟡 Orta', strong: '🔴 Güçlü' };

function bossLine(b) {
    const tier = TIER_LABEL[b.tier] || '❓';
    let drop = '';
    if (b.drops?.raceItem) {
        drop = ` | 🌟 ${b.drops.raceItem} %${Math.round((b.drops.raceItemChance || 0) * 100)}`;
    } else if (b.drops?.itemDrops?.length) {
        const best = b.drops.itemDrops[0];
        drop = ` | 🎁 ${best.itemId} %${Math.round((best.chance || 0) * 100)}`;
    }
    return `${b.emoji} **${b.name}** \`${b.id}\` — ${tier}${drop}`;
}

// Split array into chunks that fit within 1024 chars per field
function chunkBosses(bosses, maxLen = 1000) {
    const chunks = [];
    let current = [];
    let currentLen = 0;
    for (const b of bosses) {
        const line = bossLine(b) + '\n';
        if (currentLen + line.length > maxLen && current.length > 0) {
            chunks.push(current);
            current = [];
            currentLen = 0;
        }
        current.push(b);
        currentLen += line.length;
    }
    if (current.length > 0) chunks.push(current);
    return chunks;
}

module.exports = {
    name: 'bosslist',
    aliases: ['bosses', 'bosslar'],
    description: 'Tüm bossları listele. +bosslist | +bosslist bleach | +bosslist aot | +bosslist solo | +bosslist jjk',
    cooldown: 5,
    async execute(message, args) {
        const filter = args[0]?.toLowerCase();

        const SECTION_MAP = {
            bleach: { key: 'bleach', label: '⚔️ Bleach' },
            aot: { key: 'aot', label: '🏔️ Attack on Titan' },
            solo: { key: 'sololeveling', label: '🌑 Solo Leveling' },
            sololeveling: { key: 'sololeveling', label: '🌑 Solo Leveling' },
            crossover: { key: 'crossover', label: '🌟 Crossover (JJK & Diğer)' },
            jjk: { key: 'crossover', label: '🌟 Crossover (JJK & Diğer)' },
            cross: { key: 'crossover', label: '🌟 Crossover (JJK & Diğer)' },
        };

        const sections = filter && SECTION_MAP[filter]
            ? [SECTION_MAP[filter]]
            : Object.values(SECTION_MAP).filter((v, i, arr) => arr.findIndex(a => a.key === v.key) === i);


        const embed = new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle('📋 Boss Listesi')
            .setDescription('`+bosshunt <boss_id>` ile boss avla | Bosslardan **Race Item** düşer!')
            .setFooter({ text: '⚡ Kurayami RPG • Boss Listesi' })
            .setTimestamp();

        for (const section of sections) {
            const bossArr = BOSSES[section.key];
            if (!bossArr || !Array.isArray(bossArr)) continue;

            const chunks = chunkBosses(bossArr);
            chunks.forEach((chunk, i) => {
                embed.addFields({
                    name: chunks.length > 1 ? `${section.label} (${i + 1}/${chunks.length})` : section.label,
                    value: chunk.map(bossLine).join('\n'),
                    inline: false
                });
            });
        }

        // Weekly boss
        const wb = BOSSES.weekly;
        if (wb && (!filter || filter === 'weekly')) {
            embed.addFields({
                name: '🌍 Weekly World Boss',
                value: `${wb.emoji} **${wb.name}** \`${wb.id}\` — 🔴 Güçlü — HP ${wb.hp.toLocaleString()}`,
                inline: false
            });
        }

        return message.reply({ embeds: [embed] });
    }
};
