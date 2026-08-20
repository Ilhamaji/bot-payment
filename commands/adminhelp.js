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
			`🎛️ **ADMIN CONTROL PANEL GUI (UTAMA):**\n` +
			`• **\`/adminpanel\`** — Membuka Dashboard GUI Interaktif khusus Admin untuk mengelola Item, Kategori, Panel Toko, Live Leaderboard, Export Excel, & Hak Akses Admin secara visual via Tombol, Dropdown, & Modal Form!\n\n` +
			`⚙️ **PERINTAH KELOLA TOKO & PRODUK (MANUAL):**\n` +
			`• **\`/panel\`** — Mengirimkan Pesan Panel Katalog Toko di channel toko (misal #beli-disini).\n` +
			`• **\`/leaderboard\`** — Mengirimkan Pesan Panel Live Leaderboard di channel terpisah (misal #leaderboard).\n` +
			`• **\`/additem\`** \`<id> <nama> <harga> ...\` — Menambah item baru dengan opsi catatan tiket & Cek Limit.\n` +
			`• **\`/edititem\`** \`<item> ...\` — Mengubah detail item, catatan tiket, Cek Limit, & status Tahan Produk.\n` +
			`• **\`/delitem\`** \`<item>\` — Menghapus item spesifik dari katalog toko.\n` +
			`• **\`/delcategory\`** \`<kategori>\` — Menghapus seluruh kategori beserta item di dalamnya.\n` +
			`• **\`/editcategory\`** \`<kategori_lama> <kategori_baru>\` — Mengubah nama kategori produk.\n` +
			`• **\`/exportreport\`** \`[bulan] [tahun]\` — Mengunduh rekapitulasi laporan penjualan format Excel (.xlsx).\n` +
			`• **\`/listadmin\`** — Menampilkan daftar Owner & Admin Sekunder yang terdaftar.\n\n`;

		if (userIsOwner) {
			adminDescription += 
				`👑 **PERINTAH KHUSUS ADMIN UTAMA (OWNER):**\n` +
				`• **\`/addadmin\`** \`<@user>\` — Mengangkat Admin Sekunder baru.\n` +
				`• **\`/deladmin\`** \`<@user>\` — Mencabut hak akses Admin Sekunder.\n\n`;
		}

		adminDescription += 
			`📌 **TIPS OPERASIONAL & CARA ACC/REJECT TRANSAKSI:**\n` +
			`1️⃣ Verifikasi bukti transfer pembeli di Admin Channel.\n` +
			`2️⃣ **APPROVE:** Tekan **"✅ Approve & Beri Item"** -> **BALAS (REPLY)** pesan tersebut dengan meng-upload **foto bukti pengiriman item**.\n` +
			`3️⃣ **REJECT:** Tekan **"❌ Reject / Tolak"** -> Isi alasan penolakan pada Form Modal (cth: resi blur/nominal kurang). Pembeli dapat meng-upload foto bukti baru!\n` +
			`4️⃣ **TAHAN ITEM:** Di \`/adminpanel\` -> \`✏️ Edit Item\` -> Centang \`⛔ Tahan Produk (Nonaktifkan Sementara)\` agar item tidak bisa dibeli sementara!`;

		const embed = new EmbedBuilder()
			.setTitle('⚙️  BEBEY STORE — ADMIN CONTROL PANEL GUIDE')
			.setColor(0xE74C3C)
			.setDescription(adminDescription.trim())
			.setTimestamp()
			.setFooter({ text: '🛡️ Bebey Store Official • Admin Security Guide' });

		await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
	},
};
