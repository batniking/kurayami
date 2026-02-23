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

// Client hata dinleyici
client.on('error', (err) => console.error('❌ Discord client hatası:', err));
client.on('warn', (info) => console.warn('⚠️ Discord uyarı:', info));

// DB sync ve bot başlat
(async () => {
    try {
        console.log('🔄 PostgreSQL bağlantısı test ediliyor...');
        await sequelize.authenticate();
        console.log('✅ PostgreSQL bağlantısı başarılı!');

        console.log('🔄 Veritabanı modelleri senkronize ediliyor...');
        await sequelize.sync(); // alter:true kaldırıldı — free DB'de zaman aşımına neden oluyordu
        console.log('✅ Veritabanı modelleri senkronize edildi!');

        if (!process.env.DISCORD_TOKEN) {
            throw new Error('DISCORD_TOKEN env değişkeni tanımlanmamış!');
        }
        console.log('🔄 Discord\'a giriş yapılıyor...');
        await client.login(process.env.DISCORD_TOKEN);
        console.log('✅ Discord login başarılı!');
    } catch (error) {
        console.error('❌ Başlatma hatası:', error.message || error);
        process.exit(1);
    }
})();

module.exports = client;
