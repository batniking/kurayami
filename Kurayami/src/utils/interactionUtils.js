async function safeDeferUpdate(interaction) {
    if (interaction.deferred || interaction.replied) return;
    try {
        await interaction.deferUpdate();
    } catch { }
}

async function safeReply(interaction, content) {
    try {
        if (interaction.deferred || interaction.replied) {
            await interaction.followUp({ content, ephemeral: true });
        } else {
            await interaction.reply({ content, ephemeral: true });
        }
    } catch { }
}

module.exports = { safeDeferUpdate, safeReply };
