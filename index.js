require('dotenv').config();

// Anti-Crash Process Handlers (Cegah Bot Exit dari Unknown Interaction / Network Lag)
process.on('unhandledRejection', (reason, promise) => {
	if (reason && (reason.code === 10062 || reason.code === 10003 || reason.status === 404)) return;
	console.warn('⚠️ [ANTI-CRASH] Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err, origin) => {
	if (err && (err.code === 10062 || err.code === 10003 || err.status === 404)) return;
	console.error('⚠️ [ANTI-CRASH] Uncaught Exception:', err);
});

const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits } = require('discord.js');

const { updateGlobalPanel } = require('./services/panelManager');
const { setupMonthlyReportScheduler } = require('./services/reportManager');
const { checkAndCleanupExpiredTickets } = require('./services/ticketManager');
const { handleAdminPanelInteraction } = require('./services/adminPanelGUI');
const { handleAdminInteraction } = require('./handlers/adminHandler');
const { handleBuyerInteraction } = require('./handlers/buyerHandler');
const { handleProofMessageDetection } = require('./handlers/proofDetector');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ] 
});

client.commands = new Collection();

// Load Slash Commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const filePath = path.join(commandsPath, file);
	const command = require(filePath);
	if ('data' in command && 'execute' in command) {
		client.commands.set(command.data.name, command);
	}
}

// Event: Client Ready
client.once(Events.ClientReady, c => {
	console.log(`Ready! Logged in as ${c.user.tag}`);
	console.log('🤖 Bebey Store Payment Bot Aktif!');

	updateGlobalPanel(c);
	checkAndCleanupExpiredTickets(c);
	setupMonthlyReportScheduler(c);

	setInterval(() => {
		checkAndCleanupExpiredTickets(client);
	}, 15 * 60 * 1000);
});

// Event: Message Create (Proof Photo Auto-Detectors)
client.on(Events.MessageCreate, async message => {
	await handleProofMessageDetection(message, client);
});

// Event: Interaction Create (Slash Commands, Admin GUI, Buyer Actions)
client.on(Events.InteractionCreate, async interaction => {
	// 0. Handle Admin Control Panel Dashboard GUI (ap_)
	if (interaction.customId && interaction.customId.startsWith('ap_')) {
		await handleAdminPanelInteraction(interaction, client);
		return;
	}

	// 1. Handle Slash Commands
	if (interaction.isChatInputCommand()) {
		const command = interaction.client.commands.get(interaction.commandName);
		if (!command) {
			console.error(`No command matching ${interaction.commandName} was found.`);
			return;
		}

		try {
			await command.execute(interaction);
		} catch (error) {
			console.error(error);
			const errorMsg = { content: '❌ Terjadi kesalahan saat menjalankan perintah ini!', flags: 64 };
			if (interaction.replied || interaction.deferred) {
				await interaction.followUp(errorMsg);
			} else {
				await interaction.reply(errorMsg);
			}
		}
		return;
	}

	// 2. Handle Autocomplete
	if (interaction.isAutocomplete()) {
		const command = interaction.client.commands.get(interaction.commandName);
		if (!command) return;

		try {
			await command.autocomplete(interaction);
		} catch (error) {
			console.error('Autocomplete error:', error);
		}
		return;
	}

	// 3. Handle Admin Actions (Approve / Reject)
	const handledByAdmin = await handleAdminInteraction(interaction, client);
	if (handledByAdmin) return;

	// 4. Handle Buyer Actions (Shop Dropdown, Modals, Buttons)
	await handleBuyerInteraction(interaction, client);
});

client.login(process.env.DISCORD_TOKEN);
