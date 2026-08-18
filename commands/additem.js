const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const { isAdmin } = require('../services/admins');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('additem')
		.setDescription('[ADMIN] Menambah item/menu toko baru secara langsung dari Discord')
		.addStringOption(option =>
			option.setName('id')
				.setDescription('ID Unik Item (tanpa spasi, cth: robux_1000, skin_vip)')
				.setRequired(true))
		.addStringOption(option =>
			option.setName('nama')
				.setDescription('Nama Item (cth: Robux 1000 R$)')
				.setRequired(true))
		.addIntegerOption(option =>
			option.setName('harga')
				.setDescription('Harga dalam Rupiah (cth: 130000)')
				.setRequired(true)
				.setMinValue(100))
		.addBooleanOption(option =>
			option.setName('username')
				.setDescription('Apakah memerlukan input Username Roblox? (True = Ya, False = Tidak)')
				.setRequired(true))
		.addStringOption(option =>
			option.setName('kategori')
				.setDescription('Kategori produk (cth: Robux, Gamepass, Items, Service)')
				.setRequired(false))
		.addStringOption(option =>
			option.setName('emoji')
				.setDescription('Emoji untuk item (cth: 💎, ⚔️, 🚀)')
				.setRequired(false))
		.addStringOption(option =>
			option.setName('deskripsi')
				.setDescription('Deskripsi singkat / keterangan item')
				.setRequired(false)),

	async execute(interaction) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		if (!isAdmin(interaction.user.id)) {
			return interaction.editReply({ content: '❌ **AKSES DITOLAK!** Anda tidak memiliki akses Admin toko.' });
		}

		const id = interaction.options.getString('id').trim().toLowerCase().replace(/\s+/g, '_');
		const nama = interaction.options.getString('nama').trim();
		const harga = interaction.options.getInteger('harga');
		const requireUsername = interaction.options.getBoolean('username');
		const categoryInput = interaction.options.getString('kategori');
		const kategori = categoryInput && categoryInput.trim() !== '' ? categoryInput.trim() : 'General';
		const emoji = interaction.options.getString('emoji') || '📦';
		const deskripsi = interaction.options.getString('deskripsi') || 'Produk Bebey Store';

		// Load items segar tanpa cache
		const itemsFilePath = path.join(__dirname, '../config/items.js');
		delete require.cache[require.resolve('../config/items')];
		let items = require('../config/items');

		// Cek jika ID sudah dipakai
		const existingItem = items.find(i => i.id === id);
		if (existingItem) {
			return interaction.editReply({ 
				content: `❌ ID Item \`${id}\` sudah digunakan oleh item **${existingItem.name}**! Silakan gunakan ID lain.` 
			});
		}

		// Buat objek item baru
		const newItem = {
			id: id,
			name: nama,
			price: harga,
			category: kategori,
			description: deskripsi,
			emoji: emoji,
			requireUsername: requireUsername
		};

		items.push(newItem);

		// Simpan perubahan secara permanen ke file items.js
		const fileContent = `/**\n * DATAKATALOG ITEM BEBEY STORE\n */\nmodule.exports = ${JSON.stringify(items, null, 4)};\n`;

		try {
			fs.writeFileSync(itemsFilePath, fileContent, 'utf8');

			// Clear cache lagi
			delete require.cache[require.resolve('../config/items')];

			const embed = new EmbedBuilder()
				.setTitle('➕  ADMIN PANEL: TAMBAH ITEM BARU')
				.setColor(0x00FF00)
				.setDescription(`Berhasil menambahkan item baru ke katalog toko!`)
				.addFields(
					{ name: 'Nama Item', value: `${emoji} **${nama}**`, inline: true },
					{ name: 'Harga', value: `**Rp ${harga.toLocaleString('id-ID')}**`, inline: true },
					{ name: 'ID Item', value: `\`${id}\``, inline: true },
					{ name: 'Kategori', value: `📁 \`${kategori}\``, inline: true },
					{ name: 'Input Username', value: requireUsername ? '`✅ Ya (Diperlukan)`' : '`❌ Tidak Perlu`', inline: true },
					{ name: 'Deskripsi / Keterangan', value: `${deskripsi}`, inline: false }
				)
				.setTimestamp()
				.setFooter({ text: 'Item baru ini langsung aktif di panel toko.' });

			await interaction.editReply({ embeds: [embed] });

			// Auto-update pesan /panel publik jika ada di channel toko
			const { updateGlobalPanel } = require('../services/panelManager');
			updateGlobalPanel(interaction.client);
		} catch (err) {
			console.error('Error adding item to items.js:', err);
			await interaction.editReply({ content: '❌ Gagal menyimpan item baru ke file items.js!' });
		}
	},
};
