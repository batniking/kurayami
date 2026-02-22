module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

        const [commandName] = interaction.customId.split(':');
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
