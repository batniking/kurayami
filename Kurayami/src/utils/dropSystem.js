/**
 * Drop sistemi — Boss ve NPC loot hesaplama
 */
const items = require('../data/items.json');

const TIER_WEIGHTS = {
    weak: { common: 60, uncommon: 40, rare: 25, epic: 0, legendary: 0, mythic: 0 },
    medium: { common: 50, uncommon: 40, rare: 25, epic: 15, legendary: 0, mythic: 0 },
    strong: { common: 30, uncommon: 25, rare: 20, epic: 15, legendary: 5, mythic: 1 },
};

function weightedRandom(weights) {
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (const [key, val] of Object.entries(weights)) {
        r -= val;
        if (r <= 0) return key;
    }
    return Object.keys(weights)[0];
}

function rollDropTier(bossTier) {
    const weights = TIER_WEIGHTS[bossTier] || TIER_WEIGHTS.weak;
    return weightedRandom(weights);
}

function getRandomItemByTier(tier, type = null) {
    const allItems = [
        ...items.general,
        ...items.armors,
        ...items.accessories,
        ...items.pots,
    ];
    const pool = allItems.filter(i => i.tier === tier && (!type || i.type === type));
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
}

function rollBossDrop(boss) {
    const drops = [];
    const goldAmount = Math.floor(
        Math.random() * (boss.drops.gold[1] - boss.drops.gold[0]) + boss.drops.gold[0]
    );
    drops.push({ type: 'gold', amount: goldAmount });

    if (boss.drops.diamond) {
        drops.push({ type: 'diamond', amount: boss.drops.diamond });
    }

    const tier = rollDropTier(boss.tier);
    const item = getRandomItemByTier(tier);
    if (item) drops.push({ type: 'item', item });

    if (boss.drops.raceItem && Math.random() < (boss.drops.raceItemChance || 0)) {
        drops.push({ type: 'raceItem', id: boss.drops.raceItem });
    }

    // Pot drop şansı
    if (Math.random() < 0.3) {
        const pot = getRandomItemByTier('common', 'pot') || getRandomItemByTier('uncommon', 'pot');
        if (pot) drops.push({ type: 'item', item: pot });
    }

    return drops;
}

function rollNpcDrop(npcTier) {
    const drops = [];
    const goldMap = { weak: [50, 150], medium: [200, 500], strong: [500, 1200] };
    const [minG, maxG] = goldMap[npcTier] || [50, 150];
    drops.push({ type: 'gold', amount: Math.floor(Math.random() * (maxG - minG) + minG) });

    // Elmas
    const diamondMap = { weak: 50, medium: 100, strong: 200 };
    drops.push({ type: 'diamond', amount: diamondMap[npcTier] || 50 });

    const tier = rollDropTier(npcTier);
    const item = getRandomItemByTier(tier);
    if (item) drops.push({ type: 'item', item });

    // Pot şansı
    if (Math.random() < 0.15) {
        const pot = getRandomItemByTier('common', 'pot');
        if (pot) drops.push({ type: 'item', item: pot });
    }

    return drops;
}

function rollPot(potTable) {
    // potTable: [{ id, name, chance }]
    const r = Math.random() * 100;
    let cumulative = 0;
    for (const pot of potTable) {
        cumulative += pot.chance;
        if (r <= cumulative) return pot;
    }
    return potTable[potTable.length - 1];
}

module.exports = { rollBossDrop, rollNpcDrop, rollPot, getRandomItemByTier, rollDropTier };
