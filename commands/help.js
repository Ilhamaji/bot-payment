const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('help')
		.setDescription('Menampilkan daftar perintah publik & panduan belanja di Bebey Store'),
	async execute(interaction) {
		const helpDescription = 
			`Selamat datang di **Bebey Store**! Berikut adalah daftar perintah (*Slash Commands*) publik yang dapat Anda gunakan:\n\n` +
			`🛒 **PERINTAH PUBLIK / PEMBELI:**\n` +
			`• **\`/leaderboard\`** — Menampilkan Papan Peringkat (Leaderboard) 10 Pembeli Terbanyak.\n` +
			`• **\`/help\`** — Menampilkan panduan bantuan pembeli ini.\n\n` +
			`📌 **CARA MEMBELI PRODUK:**\n` +
			`1️⃣ Pergi ke channel resmi toko Bebey Store.\n` +
			`2️⃣ Pilih item produk yang ingin dibeli pada menu dropdown di panel toko.\n` +
			`3️⃣ Buka channel tiket privat yang otomatis dibuatkan oleh bot.\n` +
			`4️⃣ Transfer sesuai nominal QRIS dan **upload screenshot bukti transfer** di channel tiket!`;

		const embed = new EmbedBuilder()
			.setTitle('📜  BEBEY STORE — PANDUAN BELANJA & BANTUAN')
			.setColor(0x5865F2)
			.setDescription(helpDescription.trim())
			.setTimestamp()
			.setFooter({ text: '⚡ Bebey Store Official • Customer Help Center' });

		await interaction.reply({ embeds: [embed] });
	},
};
