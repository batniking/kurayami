const Player = require('../models/Player');
const GuildSettings = require('../models/GuildSettings');
const { checkAchievements } = require('../utils/achievementSystem');
const { getPassiveIncome } = require('../utils/levelSystem');

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        if (message.author.bot || !message.guild) return;

        // Passive income — sessizce, mesaj atmaz
        if (Math.random() < 0.05) {
            Player.findOne({ where: { discordId: message.author.id } }).then(async player => {
                if (!player) return;
                const now = new Date();
                const last = player.passiveIncomeLast ? new Date(player.passiveIncomeLast) : null;
                const hourPassed = !last || (now - last) > 3600000;
                if (hourPassed) {
                    player.gold += getPassiveIncome(player);
                    player.passiveIncomeLast = now;
                    await player.save();
                }
            }).catch(() => { });
        }

        // Guild settings'ten prefix al
        let prefix = '+';
        try {
            const settings = await GuildSettings.findOne({ where: { guildId: message.guild.id } });
            if (settings?.prefix) prefix = settings.prefix;
        } catch { }

        if (!message.content.startsWith(prefix)) return;

        const args = message.content.slice(prefix.length).trim().split(/\s+/);
        const commandName = args.shift().toLowerCase();
        const command = client.commands.get(commandName);
        if (!command) return;

        // Cooldown sistemi
        if (!client.cooldowns.has(commandName)) {
            client.cooldowns.set(commandName, new Map());
        }
        const timestamps = client.cooldowns.get(commandName);
        const cooldown = (command.cooldown || 3) * 1000;
        const now = Date.now();
        if (timestamps.has(message.author.id)) {
            const remaining = (timestamps.get(message.author.id) + cooldown - now) / 1000;
            if (remaining > 0) {
                return message.reply(`⏳ **${remaining.toFixed(1)}sn** beklemelisin.`);
            }
        }
        timestamps.set(message.author.id, now);
        setTimeout(() => timestamps.delete(message.author.id), cooldown);

        try {
            await command.execute(message, args, client);
        } catch (err) {
            console.error(`Komut hatası [${commandName}]:`, err);
            message.reply('❌ Bir hata oluştu!').catch(() => { });
        }
    }
};
