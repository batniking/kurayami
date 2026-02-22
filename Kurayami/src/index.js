require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cron = require('node-cron');
const { sequelize } = require('./database');

// Express uptime server (UptimeRobot için)
const app = express();
app.get('/', (req, res) => res.send('Kurayami Bot is alive! ⚡'));
app.listen(process.env.PORT || 3000, () => {
    console.log(`🌐 Uptime server running on port ${process.env.PORT || 3000}`);
});

// Discord Client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ]
});

client.commands = new Collection();
client.cooldowns = new Collection();

// Komutları yükle
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    if (command.name) {
        client.commands.set(command.name, command);
        // Aliasları da kaydet
        if (command.aliases) {
            for (const alias of command.aliases) {
                client.commands.set(alias, command);
            }
        }
    }
}

// Eventleri yükle
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));
for (const file of eventFiles) {
    const event = require(path.join(eventsPath, file));
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
    } else {
        client.on(event.name, (...args) => event.execute(...args, client));
    }
}

// DB sync ve bot başlat
(async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ PostgreSQL bağlantısı başarılı!');
        await sequelize.sync({ alter: true });
        console.log('✅ Veritabanı modelleri senkronize edildi!');
        await client.login(process.env.DISCORD_TOKEN);
    } catch (error) {
        console.error('❌ Başlatma hatası:', error);
        process.exit(1);
    }
})();

module.exports = client;
