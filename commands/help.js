const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getPanelLocation } = require('../services/panelManager');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('help')
		.setDescription('Menampilkan panduan belanja & informasi channel resmi di Bebey Store'),
	async execute(interaction) {
		const panelLoc = getPanelLocation();
		const catalogChanId = panelLoc ? (panelLoc.catalogChannelId || panelLoc.channelId) : null;
		const leaderboardChanId = panelLoc ? panelLoc.leaderboardChannelId : null;

		const catalogMention = catalogChanId ? `<#${catalogChanId}>` : 'channel resmi toko';
		const leaderboardMention = leaderboardChanId ? `<#${leaderboardChanId}>` : 'channel leaderboard';

		const helpDescription = 
			`Selamat datang di **Bebey Store**! Berikut adalah panduan resmi belanja & informasi channel toko:\n\n` +
			`🏪 **CHANNEL RESMI TOKO:**\n` +
			`• 🛒 **Katalog Produk:** ${catalogMention}\n` +
			`• 🏆 **Papan Peringkat (Leaderboard):** ${leaderboardMention}\n\n` +
			`📌 **CARA MEMBELI PRODUK:**\n` +
			`1️⃣ Pergi ke channel katalog toko di ${catalogMention}.\n` +
			`2️⃣ Tekan tombol kategori produk yang Anda inginkan.\n` +
			`3️⃣ Pilih produk pada menu dropdown privat yang muncul.\n` +
			`4️⃣ Buka channel tiket privat yang otomatis dibuatkan oleh bot.\n` +
			`5️⃣ Transfer sesuai nominal QRIS dan **upload screenshot bukti transfer** di channel tiket tersebut!`;

		const embed = new EmbedBuilder()
			.setTitle('📜  BEBEY STORE — PANDUAN BELANJA & INFORMASI TOKO')
			.setColor(0x5865F2)
			.setDescription(helpDescription.trim())
			.setTimestamp()
			.setFooter({ text: '⚡ Bebey Store Official • Customer Help Center' });

		await interaction.reply({ embeds: [embed] });
	},
};
