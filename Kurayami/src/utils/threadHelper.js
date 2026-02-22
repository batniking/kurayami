/**
 * Savaş / trade mesajlarını thread içinde açmak için yardımcı.
 * Yetki yoksa ana kanala döner.
 */

async function getOrCreateBattleThread(parentMessage, threadName) {
    const channel = parentMessage.channel;
    if (channel.isThread()) return channel;
    try {
        const thread = await parentMessage.startThread({
            name: threadName.slice(0, 100),
            autoArchiveDuration: 60,
            reason: 'Kurayami battle/trade',
        });
        return thread;
    } catch (err) {
        console.warn('Thread açılamadı, ana kanal kullanılıyor:', err.message);
        return channel;
    }
}

module.exports = { getOrCreateBattleThread };
