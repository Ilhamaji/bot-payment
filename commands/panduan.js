const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require('discord.js');

function buildPanduanEmbed(category = 'semua') {
	const catKey = (category || 'semua').toLowerCase();

	if (catKey === 'robux') {
		return new EmbedBuilder()
			.setTitle('💎  PANDUAN TRANSAKSI: ROBUX VIA USERNAME')
			.setColor(0x00CEC9)
			.setDescription(
				`Prosedur pengisian Robux resmi via **Gamepass** atau **Group Payout**:\n\n` +
				`1️⃣ **Pembayaran & Verifikasi**\n` +
				`   └ Pilih nominal Robux pada katalog toko\n` +
				`   └ Selesaikan pembayaran QRIS dan unggah foto bukti transfer di tiket\n\n` +
				`2️⃣ **Metode Pengiriman**\n` +
				`   └ **Via Gamepass**: Buat Gamepass pada game Roblox kamu sesuai nominal Robux (harga disesuaikan potongan 30% dari Roblox)\n` +
				`   └ **Via Group**: Join ke Group Roblox Bebey Store yang diberikan Admin\n\n` +
				`3️⃣ **Waktu Pending Roblox**\n` +
				`   └ Pembelian via Gamepass memerlukan proses holding **5 hingga 7 hari** dari pihak Roblox\n` +
				`   └ Cek status Robux pending kamu di: \`https://www.roblox.com/my/money\`\n\n` +
				`💡 *Jika membutuhkan bantuan pembuatan Gamepass, silakan tanyakan ke Admin di tiket ini.*`
			)
			.setTimestamp()
			.setFooter({ text: '💖 Bebey Store Official • Panduan Robux' });
	}

	if (catKey === 'fishit_item') {
		return new EmbedBuilder()
			.setTitle('🗡️  PANDUAN TRANSAKSI: ITEM, SKIN & PET FISH IT')
			.setColor(0xE74C3C)
			.setDescription(
				`Prosedur pengambilan item, skin, perahu, atau pet Fish It via **Private World / Trade**:\n\n` +
				`1️⃣ **Pembayaran QRIS**\n` +
				`   └ Lakukan pembayaran sesuai nominal presisi pada kartu transaksi\n` +
				`   └ Unggah foto screenshot bukti transfer di tiket\n\n` +
				`2️⃣ **Menerima Akses Server**\n` +
				`   └ Setelah Admin meng-approve pembayaran, bot akan mengirimkan link Private World atau Username Roblox Admin di tiket ini\n\n` +
				`3️⃣ **Masuk Game & Trade**\n` +
				`   └ Klik tombol **"Masuk Private World"** untuk langsung membuka aplikasi Roblox\n` +
				`   └ Temui Admin di dalam server untuk menerima item/skin/pet pesanan kamu\n\n` +
				`4️⃣ **Penyelesaian**\n` +
				`   └ Admin mengunggah bukti pengiriman item di tiket\n` +
				`   └ Klik tombol **"Selesai (Item Sudah Diterima)"** untuk menutup tiket`
			)
			.setTimestamp()
			.setFooter({ text: '💖 Bebey Store Official • Panduan Item & Skin' });
	}

	if (catKey === 'fishit_gp') {
		return new EmbedBuilder()
			.setTitle('🎟️  PANDUAN TRANSAKSI: GAMEPASS & TOKEN FISH IT')
			.setColor(0xF1C40F)
			.setDescription(
				`Prosedur pengisian Gamepass atau Token in-game Fish It:\n\n` +
				`1️⃣ **Selesaikan Pembayaran**\n` +
				`   └ Transfer QRIS sesuai nominal dan kirimkan bukti transfer di tiket\n\n` +
				`2️⃣ **Kirim Username Roblox**\n` +
				`   └ Berikan **Roblox Username** kamu yang aktif kepada Admin\n\n` +
				`3️⃣ **Proses Inject & Gift**\n` +
				`   └ Admin akan mengirimkan Gift Gamepass atau Token langsung ke akun kamu di dalam game\n\n` +
				`4️⃣ **Konfirmasi**\n` +
				`   └ Buka game Fish It dan periksa inventaris akun kamu\n` +
				`   └ Tekan tombol **"Selesai"** di tiket jika item sudah masuk dengan benar`
			)
			.setTimestamp()
			.setFooter({ text: '💖 Bebey Store Official • Panduan Gamepass & Token' });
	}

	if (catKey === 'fishit_akun') {
		return new EmbedBuilder()
			.setTitle('👤  PANDUAN TRANSAKSI: AKUN FISH IT (AKUN ROBLOX)')
			.setColor(0x9B59B6)
			.setDescription(
				`Prosedur serah terima Akun Roblox (Diamond, Withering, dll):\n\n` +
				`1️⃣ **Cek Spesifikasi**\n` +
				`   └ Lihat foto detail skin & spesifikasi akun di channel <#1538945046106079402>\n\n` +
				`2️⃣ **Pembayaran & Verifikasi**\n` +
				`   └ Selesaikan pembayaran QRIS dan unggah bukti transfer di tiket\n\n` +
				`3️⃣ **Penyerahan Data Login**\n` +
				`   └ Admin akan memberikan **Username & Password** akun Roblox di channel tiket ini\n\n` +
				`4️⃣ **Pengamanan Akun (Wajib)**\n` +
				`   └ Login ke website \`roblox.com\` menggunakan data yang diberikan\n` +
				`   └ Segera ganti Password dan hubungkan Email / Authenticator milik kamu sendiri`
			)
			.setTimestamp()
			.setFooter({ text: '💖 Bebey Store Official • Panduan Akun Roblox' });
	}

	if (catKey === 'joki') {
		return new EmbedBuilder()
			.setTitle('⚡  PANDUAN TRANSAKSI: JOKI FISH IT & PTPT')
			.setColor(0x1ABC9C)
			.setDescription(
				`Prosedur pengerjaan Joki Rod/Quest/Index atau PTPT AFK Mancing:\n\n` +
				`1️⃣ **Pembayaran & Data Akun**\n` +
				`   └ Transfer QRIS sesuai tarif layanan joki/PTPT\n` +
				`   └ Kirimkan Username & Password akun Roblox kamu ke Admin di tiket\n\n` +
				`2️⃣ **Proses Pengerjaan**\n` +
				`   └ Berikan kode 2FA / Verifikasi ke Admin jika akun terlindungi\n` +
				`   └ **Dilarang menabrak (login)** ke akun selama joki berlangsung agar pengerjaan lancar\n\n` +
				`3️⃣ **Serah Terima**\n` +
				`   └ Admin memberikan foto bukti hasil pengerjaan joki di tiket\n` +
				`   └ Kamu dapat login kembali dan mengganti password akun`
			)
			.setTimestamp()
			.setFooter({ text: '💖 Bebey Store Official • Panduan Joki & PTPT' });
	}

	// Default: SEMUA PANDUAN LENGKAP
	return new EmbedBuilder()
		.setTitle('📖  PANDUAN TRANSAKSI & PEMBAYARAN BEBEY STORE')
		.setColor(0x3498DB)
		.setDescription(
			`Selamat datang di **Bebey Store**! 🌟\n` +
			`Berikut adalah ringkasan panduan transaksi resmi untuk setiap jenis produk di toko kami:\n\n` +
			`🔹 **Robux Via Username (Gamepass / Group)**\n` +
			`   1. Pilih nominal & bayar via QRIS\n` +
			`   2. Berikan Roblox Username / buat Gamepass di game kamu\n` +
			`   3. Robux via Gamepass memerlukan waktu pending 5–7 hari dari Roblox\n\n` +
			`🔹 **Item, Skin & Pet Fish It**\n` +
			`   1. Transfer QRIS & kirim bukti pembayaran di tiket\n` +
			`   2. Dapatkan link Private World / Add Akun Roblox Admin\n` +
			`   3. Masuk ke server & lakukan Trade/Give item in-game\n\n` +
			`🔹 **Gamepass & Token Fish It**\n` +
			`   1. Selesaikan pembayaran QRIS\n` +
			`   2. Kirim Username Roblox kamu\n` +
			`   3. Admin akan mengirimkan Gift Gamepass atau Token secara langsung\n\n` +
			`🔹 **Akun Fish It (Akun Roblox)**\n` +
			`   1. Cek review & spesifikasi di <#1538945046106079402>\n` +
			`   2. Bayar QRIS & konfirmasi di tiket\n` +
			`   3. Terima Username & Password dari Admin, lalu segera amankan akun\n\n` +
			`🔹 **Joki Fish It & PTPT**\n` +
			`   1. Bayar QRIS & berikan data login ke Admin secara aman\n` +
			`   2. Tim joki memproses pesanan di game (dilarang menabrak akun)\n` +
			`   3. Terima laporan joki selesai & ganti password akun\n\n` +
			`👇 *Gunakan menu dropdown di bawah untuk membaca panduan lengkap tiap kategori:*`
		)
		.setTimestamp()
		.setFooter({ text: '💖 Bebey Store Official • Pusat Panduan Transaksi' });
}

function buildPanduanSelectMenu(selectedCategory = 'semua') {
	const selectMenu = new StringSelectMenuBuilder()
		.setCustomId('select_panduan_category')
		.setPlaceholder('📌 Pilih Kategori Untuk Melihat Panduan Detail...')
		.addOptions([
			{
				label: '📚 Semua Panduan (Ringkasan)',
				description: 'Tampilkan panduan transaksi seluruh kategori item',
				value: 'semua',
				emoji: '📚',
				default: selectedCategory === 'semua'
			},
			{
				label: '💎 Robux Via Username (Gamepass/Payout)',
				description: 'Panduan beli Robux, setting Gamepass & pending 5-7 hari',
				value: 'robux',
				emoji: '💎',
				default: selectedCategory === 'robux'
			},
			{
				label: '🗡️ Item, Skin & Pet Fish It',
				description: 'Panduan transaksi Private World & Trade in-game',
				value: 'fishit_item',
				emoji: '🗡️',
				default: selectedCategory === 'fishit_item'
			},
			{
				label: '🎟️ Gamepass & Token Fish It',
				description: 'Panduan Gift Gamepass & Inject Token',
				value: 'fishit_gp',
				emoji: '🎟️',
				default: selectedCategory === 'fishit_gp'
			},
			{
				label: '👤 Akun Fish It (Akun Roblox)',
				description: 'Panduan terima data login Username/Pass & amankan akun',
				value: 'fishit_akun',
				emoji: '👤',
				default: selectedCategory === 'fishit_akun'
			},
			{
				label: '⚡ Joki Fish It & PTPT',
				description: 'Panduan joki rod, quest, full index & AFK',
				value: 'joki',
				emoji: '⚡',
				default: selectedCategory === 'joki'
			}
		]);

	return new ActionRowBuilder().addComponents(selectMenu);
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('panduan')
		.setDescription('[PEMBELI/ADMIN] Lihat panduan cara pembayaran & transaksi lengkap semua kategori Bebey Store')
		.addStringOption(option =>
			option.setName('kategori')
				.setDescription('Pilih kategori spesifik yang ingin dilihat panduannya')
				.setRequired(false)
				.addChoices(
					{ name: '📚 Semua Panduan', value: 'semua' },
					{ name: '💎 Robux Via Username', value: 'robux' },
					{ name: '🗡️ Item, Skin & Pet Fish It', value: 'fishit_item' },
					{ name: '🎟️ Gamepass & Token Fish It', value: 'fishit_gp' },
					{ name: '👤 Akun Fish It (Akun Roblox)', value: 'fishit_akun' },
					{ name: '⚡ Joki Fish It & PTPT', value: 'joki' }
				)),

	async execute(interaction) {
		const chosenCat = interaction.options.getString('kategori') || 'semua';
		const embed = buildPanduanEmbed(chosenCat);
		const selectRow = buildPanduanSelectMenu(chosenCat);

		try {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });
			await interaction.channel.send({
				embeds: [embed],
				components: [selectRow]
			});
			await interaction.deleteReply();
		} catch (e) {
			console.error('Error sending panduan channel message:', e);
		}
	},

	buildPanduanEmbed,
	buildPanduanSelectMenu
};
