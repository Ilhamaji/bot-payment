const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require('discord.js');

function buildPanduanEmbed(category = 'semua') {
	const catKey = (category || 'semua').toLowerCase();

	if (catKey === 'robux') {
		return new EmbedBuilder()
			.setTitle('💎 PANDUAN TRANSAKSI: ROBUX VIA USERNAME')
			.setColor(0x3498DB)
			.setDescription(
				`📌 **METODE TRANSAKSI ROBUX:**\n` +
				`Transaksi Robux di Bebey Store dilakukan via **Gamepass** atau **Group Payout** resmi Roblox.\n\n` +
				`1️⃣ **Selesaikan Pembayaran QRIS**:\n` +
				`   • Pilih paket Robux di menu toko & lakukan pembayaran QRIS sesuai nominal presisi.\n` +
				`   • Upload foto bukti transfer yang jelas di channel tiket.\n\n` +
				`2️⃣ **Metode Pengiriman**:\n` +
				`   • **Via Gamepass**: Buat Gamepass di game Roblox milik kamu dengan harga Robux yang sesuai (sesuaikan pajak Roblox 30% jika ada).\n` +
				`   • **Via Group Payout**: Join Group Roblox Bebey Store yang diberikan Admin.\n\n` +
				`3️⃣ **Estimasi Pending Roblox**:\n` +
				`   • Pembelian Robux via Gamepass memerlukan waktu pending **5 - 7 Hari** sesuai kebijakan resmi sistem Roblox.\n` +
				`   • Kamu bisa mengecek status Robux pending di: \`https://www.roblox.com/my/money\`\n\n` +
				`💬 *Jika ada pertanyaan seputar limit atau setting Gamepass, silakan tanyakan ke Admin di tiket!*`
			)
			.setTimestamp()
			.setFooter({ text: '💖 Bebey Store Official • Panduan Robux' });
	}

	if (catKey === 'fishit_item') {
		return new EmbedBuilder()
			.setTitle('🗡️ PANDUAN TRANSAKSI: ITEM, SKIN & PET FISH IT')
			.setColor(0xE74C3C)
			.setDescription(
				`📌 **METODE TRANSAKSI ITEM / SKIN / PET:**\n` +
				`Transaksi dilakukan via **Private World Toko** atau **Trade In-Game** dengan Admin.\n\n` +
				`1️⃣ **Pembayaran QRIS**:\n` +
				`   • Transfer QRIS sesuai kartu transaksi dan upload bukti foto transfer.\n\n` +
				`2️⃣ **Terima Link Private World / Add Akun**:\n` +
				`   • Setelah Admin meng-approve pembayaran, bot akan otomatis mengirimkan **Link Private World Toko** atau **Username Roblox Admin**.\n\n` +
				`3️⃣ **Masuk Ke Game & Trade**:\n` +
				`   • Klik tombol **"🌐 Masuk Private World"** di tiket untuk langsung membuka game Roblox.\n` +
				`   • Temui Admin di dalam game & lakukan proses Trade/Give item pesanan kamu.\n\n` +
				`4️⃣ **Konfirmasi Selesai**:\n` +
				`   • Admin akan mengunggah foto bukti pengiriman di tiket.\n` +
				`   • Klik tombol **"✅ Selesai (Item Sudah Diterima)"** di tiket!`
			)
			.setTimestamp()
			.setFooter({ text: '💖 Bebey Store Official • Panduan Item & Skin' });
	}

	if (catKey === 'fishit_gp') {
		return new EmbedBuilder()
			.setTitle('🎟️ PANDUAN TRANSAKSI: GAMEPASS & TOKEN FISH IT')
			.setColor(0xF1C40F)
			.setDescription(
				`📌 **METODE TRANSAKSI GAMEPASS & TOKEN:**\n` +
				`Dikirim via **Gift Gamepass In-Game** atau **Direct Top Up Token** ke Username Roblox kamu.\n\n` +
				`1️⃣ **Pembayaran & Username**:\n` +
				`   • Bayar QRIS sesuai nominal presisi & berikan **Username Roblox** kamu ke Admin.\n\n` +
				`2️⃣ **Proses Pengiriman Admin**:\n` +
				`   • Admin akan mengirimkan Gift Gamepass / Token secara langsung ke akun kamu.\n\n` +
				`3️⃣ **Cek Inventaris**:\n` +
				`   • Buka game Fish It dan periksa apakah Gamepass / Token sudah masuk ke akun kamu.\n` +
				`   • Klik tombol **"✅ Selesai"** di tiket jika item sudah masuk!`
			)
			.setTimestamp()
			.setFooter({ text: '💖 Bebey Store Official • Panduan Gamepass & Token' });
	}

	if (catKey === 'fishit_akun') {
		return new EmbedBuilder()
			.setTitle('👤 PANDUAN TRANSAKSI: AKUN FISH IT (AKUN ROBLOX)')
			.setColor(0x9B59B6)
			.setDescription(
				`📌 **METODE TRANSAKSI AKUN FISH IT:**\n` +
				`Penyerahan data login lengkap (Username & Password akun Roblox).\n\n` +
				`1️⃣ **Cek Spesifikasi Akun**:\n` +
				`   • Detail spesifikasi & review skin akun bisa dilihat pada channel <#1538945046106079402>.\n\n` +
				`2️⃣ **Selesaikan Pembayaran**:\n` +
				`   • Transfer QRIS dan upload foto bukti pembayaran di tiket.\n\n` +
				`3️⃣ **Terima Data Login**:\n` +
				`   • Admin akan memberikan **Username & Password** akun Roblox secara aman di channel tiket ini.\n\n` +
				`4️⃣ **Amankan Akun Segera**:\n` +
				`   • Segera login ke akun Roblox tersebut di website \`roblox.com\`.\n` +
				`   • Ganti Password & tautkan Email / Nomor HP / Authenticator milik kamu sendiri!`
			)
			.setTimestamp()
			.setFooter({ text: '💖 Bebey Store Official • Panduan Akun Roblox' });
	}

	if (catKey === 'joki') {
		return new EmbedBuilder()
			.setTitle('⚡ PANDUAN TRANSAKSI: JOKI FISH IT & PTPT')
			.setColor(0x1ABC9C)
			.setDescription(
				`📌 **METODE TRANSAKSI JOKI & PTPT:**\n` +
				`Layanan pengerjaan rod, quest, full index, atau AFK mancing oleh tim joki profesional Bebey Store.\n\n` +
				`1️⃣ **Pembayaran & Format Data**:\n` +
				`   • Transfer QRIS sesuai harga paket joki yang dipilih.\n` +
				`   • Kirimkan data login Roblox (Username & Password) di channel tiket ini.\n\n` +
				`2️⃣ **Proses Pengerjaan**:\n` +
				`   • Joki akan menolak/meminta kode 2FA jika akun terlindungi.\n` +
				`   • Dilarang menabrak / login ke akun selama proses joki berlangsung agar pengerjaan tidak terganggu.\n\n` +
				`3️⃣ **Selesai Joki**:\n` +
				`   • Admin akan memberikan notifikasi & foto bukti saat joki selesai.\n` +
				`   • Kamu dapat login kembali dan mengganti password demi keamanan.`
			)
			.setTimestamp()
			.setFooter({ text: '💖 Bebey Store Official • Panduan Joki & PTPT' });
	}

	// Default: SEMUA PANDUAN LENGKAP
	return new EmbedBuilder()
		.setTitle('📚 PANDUAN TRANSAKSI & CARA PEMBAYARAN BEBEY STORE')
		.setColor(0x2ECC71)
		.setDescription(
			`Halo Kak! Selamat datang di **Bebey Store**! 💖\n` +
			`Berikut adalah panduan lengkap cara pembayaran & transaksi untuk setiap kategori item toko kami:\n\n` +
			`💎 **1. ROBUX VIA USERNAME (GAMEPASS / PAYOUT)**\n` +
			`• Pembayaran QRIS $\\rightarrow$ Kirim Username $\\rightarrow$ Admin kirim via Gamepass/Group (Pending Robux 5-7 hari).\n\n` +
			`🗡️ **2. ITEM, SKIN & PET FISH IT**\n` +
			`• Pembayaran QRIS $\\rightarrow$ Masuk **Private World Toko** $\\rightarrow$ Trade/Give item dengan Admin di game.\n\n` +
			`🎟️ **3. GAMEPASS & TOKEN FISH IT**\n` +
			`• Pembayaran QRIS $\\rightarrow$ Berikan Username Roblox $\\rightarrow$ Gift Gamepass / Token dikirim langsung ke akun.\n\n` +
			`👤 **4. AKUN FISH IT (AKUN ROBLOX)**\n` +
			`• Cek spesifikasi akun di <#1538945046106079402> $\\rightarrow$ Bayar QRIS $\\rightarrow$ Admin berikan Username & Password akun di tiket $\\rightarrow$ Amankan akun.\n\n` +
			`⚡ **5. JOKI FISH IT & PTPT**\n` +
			`• Bayar QRIS $\\rightarrow$ Berikan data login ke Admin $\\rightarrow$ Proses Joki / AFK $\\rightarrow$ Selesai & Amankan akun.\n\n` +
			`👇 *Gunakan menu di bawah untuk melihat panduan detail per kategori:*`
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

		await interaction.reply({
			embeds: [embed],
			components: [selectRow]
		});
	},

	buildPanduanEmbed,
	buildPanduanSelectMenu
};
