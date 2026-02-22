/**
 * Merkezi buton oturum deposu.
 * Hunt / dungeon / bosshunt / duel mesajları kaydedilir; interactionCreate buradan bakar.
 * Oturum yoksa "Bu etkileşim artık geçerli değil" döner (süre doldu / bot restart).
 */

const sessions = new Map(); // messageId -> { type, userId | userIds, timeoutHandle }

const SESSION_TTL_MS = {
    hunt: 65 * 1000,
    dungeon: 185 * 1000,
    bosshunt: 125 * 1000,
    duel: 185 * 1000,
    trade: 5 * 60 * 1000,
};

function register(messageId, type, userIdOrIds) {
    const ttl = SESSION_TTL_MS[type] || 65 * 1000;
    const existing = sessions.get(messageId);
    if (existing && existing.timeoutHandle) clearTimeout(existing.timeoutHandle);
    const timeoutHandle = setTimeout(() => sessions.delete(messageId), ttl);
    sessions.set(messageId, {
        type,
        userId: userIdOrIds,
        userIds: Array.isArray(userIdOrIds) ? userIdOrIds : null,
        timeoutHandle,
        createdAt: Date.now(),
    });
}

function get(messageId) {
    return sessions.get(messageId) || null;
}

function unregister(messageId) {
    const s = sessions.get(messageId);
    if (s && s.timeoutHandle) clearTimeout(s.timeoutHandle);
    sessions.delete(messageId);
}

function isOwner(session, userId) {
    if (session.userIds) return session.userIds.includes(userId);
    return session.userId === userId;
}

module.exports = {
    sessions,
    register,
    get,
    unregister,
    isOwner,
    SESSION_TTL_MS,
};
