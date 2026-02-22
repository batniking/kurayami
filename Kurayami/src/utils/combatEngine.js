/**
 * Savaş Motoru — PvP ve Hunt için ortak temel
 */

function calcDamage(attacker, defender, skill) {
    let base = Math.floor(attacker.power * 2);
    if (skill?.damage) {
        base = Math.floor((attacker.power * 2) * (skill.damage / 100));
    } else if (skill?.power) {
        base = Math.floor((attacker.power * 2) * skill.power);
    }
    const defReduction = Math.floor(defender.defense / 2);
    const random = Math.floor(Math.random() * 10) + 1;
    let dmg = Math.max(1, base - defReduction + random);

    // Armor pierce
    if (skill?.effect === 'armorPierce') dmg = Math.max(1, base + random);
    if (skill?.effect?.armorPiercePercent) {
        const pierce = Math.floor(defender.defense * skill.effect.armorPiercePercent);
        dmg = Math.max(1, base - Math.floor(defender.defense / 2) + pierce + random);
    }

    // Multi-hit
    if (skill?.hits && skill.hits > 1) {
        dmg = Math.floor(dmg * skill.hits);
    }

    return dmg;
}

function applyEffects(skill, caster, target) {
    const logs = [];
    if (!skill?.effect || typeof skill.effect === 'string') return logs;

    const e = skill.effect;

    if (e.self) {
        const s = e.self;
        if (s.power) { caster.tempBuffs = caster.tempBuffs || {}; caster.tempBuffs.power = (caster.tempBuffs.power || 0) + s.power; caster.power += s.power; logs.push(`🟢 Güç +${s.power}`); }
        if (s.defense) { caster.defense += s.defense; logs.push(`🛡️ Savunma +${s.defense}`); }
        if (s.speed) { caster.speed += s.speed; logs.push(`💨 Hız +${s.speed}`); }
        if (s.healPercent) { const heal = Math.floor(caster.maxHp * s.healPercent); caster.hp = Math.min(caster.maxHp, caster.hp + heal); logs.push(`💚 +${heal} HP yenilendi`); }
        if (s.steal) { const stolen = Math.floor(target.hp * s.steal); target.hp -= stolen; caster.hp = Math.min(caster.maxHp, caster.hp + stolen); logs.push(`🩸 ${stolen} HP çalındı`); }
        if (s.reviveOnce && !caster.hasRevive) { caster.hasRevive = true; logs.push(`✨ Ölümden dönme hazır!`); }
    }

    if (e.enemy) {
        const en = e.enemy;
        if (en.defense) { target.defense = Math.max(0, target.defense + en.defense); logs.push(`🔓 Savunma ${en.defense}`); }
        if (en.speed) { target.speed = Math.max(0, target.speed + en.speed); logs.push(`🐢 Hız ${en.speed}`); }
        if (en.power) { target.power = Math.max(0, target.power + en.power); logs.push(`⬇️ Güç ${en.power}`); }
        if (en.frozen) { if (Math.random() < en.frozen) { target.frozen = 1; logs.push('🧊 Dondu! Bir tur atlayacak.'); } }
        if (en.stun) { if (Math.random() < en.stun) { target.stunned = 1; logs.push('💫 Sersemletildi! Bir tur atlayacak.'); } }
        if (en.skip) { target.skipTurns = (target.skipTurns || 0) + en.skip; logs.push(`⏸️ ${en.skip} tur atlayacak!`); }
        if (en.burn) { target.burn = en.burn; logs.push(`🔥 Yanıyor! ${en.burn.damage} hasar/tur, ${en.burn.duration} tur`); }
        if (en.dot) { target.dot = en.dot; logs.push(`☠️ Zehirlendi! ${en.dot.damage} hasar/tur`); }
        if (en.noHeal) { target.noHeal = en.noHeal; logs.push(`🚫 Heal yasak ${en.noHeal} tur!`); }
        if (en.clearBuffs) { target.tempBuffs = {}; logs.push('🌀 Tüm bufflar silindi!'); }
        if (en.dotPercent) { target.dotPercent = { percent: en.dotPercent, duration: en.duration }; logs.push(`💀 Her tur %${en.dotPercent * 100} HP kaybedecek`); }
    }

    return logs;
}

function processDotsAndStatuses(entity) {
    const logs = [];
    if (entity.burn) {
        entity.hp -= entity.burn.damage;
        entity.burn.duration--;
        logs.push(`🔥 Yanma: -${entity.burn.damage} HP`);
        if (entity.burn.duration <= 0) { entity.burn = null; logs.push('🔥 Yanma bitti.'); }
    }
    if (entity.dot) {
        entity.hp -= entity.dot.damage;
        entity.dot.duration--;
        logs.push(`☠️ Zehir: -${entity.dot.damage} HP`);
        if (entity.dot.duration <= 0) { entity.dot = null; }
    }
    if (entity.dotPercent) {
        const dmg = Math.floor(entity.maxHp * entity.dotPercent.percent);
        entity.hp -= dmg;
        entity.dotPercent.duration--;
        logs.push(`💀 DOT: -${dmg} HP`);
        if (entity.dotPercent.duration <= 0) entity.dotPercent = null;
    }
    if (entity.frozen) { entity.frozen--; logs.push(`🧊 Donmuş: Tur atlandı`); }
    if (entity.stunned) { entity.stunned--; logs.push(`💫 Sersem: Tur atlandı`); }
    if (entity.skipTurns > 0) { entity.skipTurns--; logs.push(`⏸️ Tur atlandı`); }
    return logs;
}

function isSkipping(entity) {
    return entity.frozen > 0 || entity.stunned > 0 || entity.skipTurns > 0;
}

function buildFighterState(player, name) {
    return {
        name: name || player.username,
        hp: player.hp,
        maxHp: player.maxHp,
        power: player.power,
        defense: player.defense,
        speed: player.speed,
        burn: null, dot: null, dotPercent: null, frozen: 0, stunned: 0, skipTurns: 0,
        noHeal: 0, tempBuffs: {}, hasRevive: false,
    };
}

module.exports = { calcDamage, applyEffects, processDotsAndStatuses, isSkipping, buildFighterState };
