const Player = require('../models/Player');
const { profileEmbed, errorEmbed } = require('../utils/embedBuilder');

module.exports = {
    name: 'profile',
    aliases: ['p', 'char'],
    description: 'Karakter profilini görüntüle.',
    cooldown: 5,
    async execute(message, args) {
        const target = message.mentions.users.first() || message.author;
        const player = await Player.findOne({ where: { discordId: target.id } });
        if (!player) {
            return message.reply({ embeds: [errorEmbed(`**${target.displayName}** henüz bir karaktere sahip değil! \`+start\` ile başlayabilir.`)] });
        }

        const member = message.guild.members.cache.get(target.id) || await message.guild.members.fetch(target.id).catch(() => null);
        const displayUser = member || target;

        const embed = profileEmbed(player, displayUser);
        return message.reply({ embeds: [embed] });
    }
};
