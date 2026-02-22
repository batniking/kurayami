/**
 * Aktif takas oturumları (messageId -> state).
 * Trade komutu ve interaction handler buradan okur/yazar.
 */

const trades = new Map();

function set(messageId, state) {
    trades.set(messageId, state);
}

function get(messageId) {
    return trades.get(messageId) || null;
}

function remove(messageId) {
    trades.delete(messageId);
}

module.exports = { set, get, remove };
