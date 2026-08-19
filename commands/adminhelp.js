const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { isAdmin, isOwner } = require('../services/admins');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('adminhelp')
		.setDescription('[ADMIN] Menampilkan panduan lengkap perintah kelola toko khusus Admin & Owner'),
	async execute(interaction) {
		if (!isAdmin(interaction.user.id)) {
			return interaction.reply({ content: '❌ **AKSES DITOLAK!** Anda tidak memiliki akses Admin toko.', flags: MessageFlags.Ephemeral });
		}

		const userIsOwner = isOwner(interaction.user.id);

		let adminDescription = 
			`Berikut adalah daftar lengkap perintah kelola toko (*Admin Slash Commands*) di **Bebey Store**:\n\n` +
			`⚙️ **PERINTAH KELOLA TOKO & PRODUK:**\n` +
			`• **\`/panel\`** — Mengirimkan Pesan Panel Katalog Toko di channel toko (misal #beli-disini).\n` +
			`• **\`/topspender\`** — Mengirimkan Pesan Panel Live Leaderboard di channel terpisah (misal #leaderboard).\n` +
			`• **\`/edititem\`** \`<item> [nama] [harga] [username] [kategori] [emoji] [deskripsi]\` — Mengubah detail item toko secara keseluruhan.\n` +
			`• **\`/additem\`** \`<id> <nama> <harga> <username> [emoji] [deskripsi] [kategori]\` — Menambah item baru ke katalog toko.\n` +
			`• **\`/delitem\`** \`<item>\` — Menghapus item spesifik dari katalog toko.\n` +
			`• **\`/delcategory\`** \`<kategori>\` — Menghapus seluruh kategori beserta item di dalamnya dari katalog toko.\n` +
			`• **\`/editcategory\`** \`<kategori_lama> <kategori_baru>\` — Mengubah nama kategori produk (Live Update ke Panel).\n` +
			`• **\`/exportreport\`** \`[bulan] [tahun]\` — Mengunduh rekapitulasi laporan penjualan resmi format Excel (.xlsx).\n\n`;

		if (userIsOwner) {
			adminDescription += 
				`👑 **PERINTAH KHUSUS ADMIN UTAMA (OWNER):**\n` +
				`• **\`/addadmin\`** \`<@user>\` — Mengangkat Admin Sekunder baru untuk membantu mengelola toko.\n` +
				`• **\`/deladmin\`** \`<@user>\` — Mencabut hak akses Admin Sekunder.\n` +
				`• **\`/listadmin\`** — Menampilkan daftar Owner & Admin Sekunder yang terdaftar.\n\n`;
		}

		adminDescription += 
			`📌 **TIPS OPERASIONAL ADMIN:**\n` +
			`• Gunakan channel khusus notifikasi pada \`ADMIN_CHANNEL_ID\` di file \`.env\` untuk menerima verifikasi bukti transfer.\n` +
			`• Tekan tombol **"✅ Bantuan Selesai (Hapus Notif)"** di Admin Channel untuk membersihkan pesan notifikasi SOS/Tiket yang sudah diselesaikan.`;

		const embed = new EmbedBuilder()
			.setTitle('⚙️  BEBEY STORE — ADMIN CONTROL PANEL GUIDE')
			.setColor(0xE74C3C)
			.setDescription(adminDescription.trim())
			.setTimestamp()
			.setFooter({ text: '🛡️ Bebey Store Official • Admin Security Guide' });

		await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
	},
};
