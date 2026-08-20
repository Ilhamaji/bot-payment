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
			`2️⃣ Pilih kategori produk yang kamu inginkan.\n` +
			`3️⃣ Pilih produk pada menu dropdown privat yang muncul *(Produk bertanda ⛔ Ditahan tidak dapat dibeli sementara)*.\n` +
			`4️⃣ Tekan tombol **"🚀 Buka Channel Tiket Kamu"** untuk langsung lompat ke channel privat tiket kamu.\n` +
			`5️⃣ Isi Username Roblox & baca panduan Cek Limit jika diperlukan.\n` +
			`6️⃣ Pindai (scan) QRIS, **upload screenshot foto bukti transfer**, lalu tekan tombol **"📸 Konfirmasi Foto Bukti Transfer"** -> **"✅ Saya Sudah Transfer"**.\n` +
			`7️⃣ Jika bukti ditolak oleh Admin, kamu akan menerima pesan alasan penolakan & dapat meng-upload foto bukti baru secara langsung.\n` +
			`8️⃣ Setelah item dikirim oleh Admin, tekan **"✅ Selesai"** dan simpan struk transaksi ke DM lewat tombol **"📩 Simpan Bukti ke DM"**!`;

		const embed = new EmbedBuilder()
			.setTitle('📜  BEBEY STORE — PANDUAN BELANJA & INFORMASI TOKO')
			.setColor(0x5865F2)
			.setDescription(helpDescription.trim())
			.setTimestamp()
			.setFooter({ text: '⚡ Bebey Store Official • Customer Help Center' });

		await interaction.reply({ embeds: [embed] });
	},
};
