const battleSessions = require('../utils/battleSessions');

// customId prefix -> session type (global handler sadece oturum kontrolü + "süre doldu" mesajı)
const BUTTON_PREFIXES = ['hunt', 'dg', 'bh', 'duel1', 'duel2', 'trade', 'shop', 'evolve', 'raceselect', 'inv', 'craft', 'start'];

function getSessionType(customId) {
    const prefix = customId.split(':')[0];
    return BUTTON_PREFIXES.includes(prefix) ? prefix : null;
}

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

        const customId = interaction.customId || '';
        const sessionType = getSessionType(customId);

        // Global oturum kontrolü: savaş/panel butonları için session yoksa "süre doldu" ver
        if (sessionType) {
            const session = battleSessions.get(interaction.message?.id);
            if (!session) {
                try {
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({
                            content: '⏱️ Bu etkileşim artık geçerli değil. (Süre doldu veya bot yeniden başlatıldı.) Lütfen komutu tekrar kullan.',
                            ephemeral: true,
                        });
                    }
                } catch (_) { /* already replied/deferred */ }
                return;
            }
            if (!battleSessions.isOwner(session, interaction.user.id)) {
                try {
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({ content: '⏳ Bu savaş/panel senin değil.', ephemeral: true });
                    }
                } catch (_) { }
                return;
            }
        }

        // Mevcut handleInteraction (komut kendi butonunu yönetiyorsa)
        const [commandName] = customId.split(':');
        const command = client.commands.get(commandName);
        if (command?.handleInteraction) {
            try {
                await command.handleInteraction(interaction, client);
            } catch (err) {
                console.error(`Interaction hatası [${commandName}]:`, err);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: '❌ Bir hata oluştu!', ephemeral: true }).catch(() => { });
                }
            }
        }
    }
};
