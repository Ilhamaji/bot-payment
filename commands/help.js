const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getPanelLocation } = require('../services/panelManager');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('help')
		.setDescription('Menampilkan daftar perintah publik & panduan belanja di Bebey Store'),
	async execute(interaction) {
		const panelLoc = getPanelLocation();
		const catalogChanId = panelLoc ? (panelLoc.catalogChannelId || panelLoc.channelId) : null;
		const channelMention = catalogChanId ? `<#${catalogChanId}>` : 'channel resmi toko';

		const helpDescription = 
			`Selamat datang di **Bebey Store**! Berikut adalah daftar perintah (*Slash Commands*) publik yang dapat Anda gunakan:\n\n` +
			`🛒 **PERINTAH PUBLIK / PEMBELI:**\n` +
			`• **\`/leaderboard\`** — Menampilkan Papan Peringkat (Leaderboard) 10 Pembeli Terbanyak.\n` +
			`• **\`/help\`** — Menampilkan panduan bantuan pembeli ini.\n\n` +
			`📌 **CARA MEMBELI PRODUK:**\n` +
			`1️⃣ Pergi ke channel resmi toko Bebey Store di ${channelMention}.\n` +
			`2️⃣ Tekan tombol kategori produk yang Anda inginkan.\n` +
			`3️⃣ Pilih produk pada menu dropdown privat yang muncul.\n` +
			`4️⃣ Buka channel tiket privat yang otomatis dibuatkan oleh bot.\n` +
			`5️⃣ Transfer sesuai nominal QRIS dan **upload screenshot bukti transfer** di channel tiket tersebut!`;

		const embed = new EmbedBuilder()
			.setTitle('📜  BEBEY STORE — PANDUAN BELANJA & BANTUAN')
			.setColor(0x5865F2)
			.setDescription(helpDescription.trim())
			.setTimestamp()
			.setFooter({ text: '⚡ Bebey Store Official • Customer Help Center' });

		await interaction.reply({ embeds: [embed] });
	},
};
