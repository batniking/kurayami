module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        console.log(`✅ ${client.user.tag} çevrimiçi!`);
        client.user.setActivity('⚡ +start ile başla!', { type: 0 });
    }
};
