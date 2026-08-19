const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const { isAdmin } = require('../services/admins');
const { setCategoryEmoji, getCategoryEmoji, getItemEmoji } = require('../services/panelManager');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('edititem')
		.setDescription('[ADMIN] Mengubah detail item toko (nama, harga, kategori, username, emoji, deskripsi)')
		.addStringOption(option =>
			option.setName('item')
				.setDescription('Pilih item yang ingin diubah')
				.setRequired(true)
				.setAutocomplete(true))
		.addStringOption(option =>
			option.setName('nama')
				.setDescription('Nama produk baru (kosongkan jika tidak diubah)')
				.setRequired(false))
		.addIntegerOption(option =>
			option.setName('harga')
				.setDescription('Harga baru dalam Rupiah (kosongkan jika tidak diubah)')
				.setRequired(false)
				.setMinValue(100))
		.addBooleanOption(option =>
			option.setName('username')
				.setDescription('Apakah butuh input username Roblox? (True = Butuh, False = Tidak)')
				.setRequired(false))
		.addStringOption(option =>
			option.setName('kategori')
				.setDescription('Kategori produk baru (kosongkan jika tidak diubah)')
				.setRequired(false))
		.addStringOption(option =>
			option.setName('emoji')
				.setDescription('Emoji khusus produk (Ketik RESET jika ingin mengikuti emoji kategori)')
				.setRequired(false))
		.addStringOption(option =>
			option.setName('emoji_kategori')
				.setDescription('Set/Ubah Emoji untuk Kategori dari item ini (cth: 👑, 💎)')
				.setRequired(false))
		.addStringOption(option =>
			option.setName('deskripsi')
				.setDescription('Deskripsi singkat produk baru')
				.setRequired(false)),

	async autocomplete(interaction) {
		delete require.cache[require.resolve('../config/items')];
		const items = require('../config/items');
		const focusedValue = interaction.options.getFocused().toLowerCase();
		const filtered = items.filter(choice => 
			choice.name.toLowerCase().includes(focusedValue) || 
			choice.id.toLowerCase().includes(focusedValue)
		);
		await interaction.respond(
			filtered.slice(0, 25).map(choice => ({ name: `${getItemEmoji(choice)} ${choice.name} (Rp ${choice.price.toLocaleString('id-ID')})`, value: choice.id }))
		);
	},

	async execute(interaction) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		if (!isAdmin(interaction.user.id)) {
			return interaction.editReply({ content: '❌ **AKSES DITOLAK!** Anda tidak memiliki akses Admin toko.' });
		}

		const itemId = interaction.options.getString('item');
		const newName = interaction.options.getString('nama');
		const newPrice = interaction.options.getInteger('harga');
		const newUsernameReq = interaction.options.getBoolean('username');
		const newCategory = interaction.options.getString('kategori');
		const newEmoji = interaction.options.getString('emoji');
		const newCategoryEmoji = interaction.options.getString('emoji_kategori');
		const newDesc = interaction.options.getString('deskripsi');

		const itemsFilePath = path.join(__dirname, '../config/items.js');
		delete require.cache[require.resolve('../config/items')];
		let items = require('../config/items');

		const targetItem = items.find(i => i.id === itemId);
		if (!targetItem) {
			return interaction.editReply({ content: '❌ Item tidak ditemukan di katalog!' });
		}

		const changes = [];

		if (newName && newName.trim() !== '') {
			changes.push(`• **Nama:** \`${targetItem.name}\` ➔ **${newName.trim()}**`);
			targetItem.name = newName.trim();
		}

		if (newPrice !== null && newPrice !== undefined) {
			changes.push(`• **Harga:** \`Rp ${targetItem.price.toLocaleString('id-ID')}\` ➔ **Rp ${newPrice.toLocaleString('id-ID')}**`);
			targetItem.price = newPrice;
		}

		if (newUsernameReq !== null && newUsernameReq !== undefined) {
			changes.push(`• **Butuh Username Roblox:** \`${targetItem.requireUsername !== false ? 'Ya' : 'Tidak'}\` ➔ **${newUsernameReq ? 'Ya' : 'Tidak'}**`);
			targetItem.requireUsername = newUsernameReq;
		}

		if (newCategory && newCategory.trim() !== '') {
			changes.push(`• **Kategori:** \`${targetItem.category || 'General'}\` ➔ **${newCategory.trim()}**`);
			targetItem.category = newCategory.trim();
		}

		if (newEmoji !== null && newEmoji !== undefined) {
			const cleanEmoji = newEmoji.trim();
			if (cleanEmoji.toUpperCase() === 'RESET' || cleanEmoji.toUpperCase() === 'DELETE') {
				changes.push(`• **Emoji Item:** Reset ke emoji kategori (${getCategoryEmoji(targetItem.category)})`);
				targetItem.emoji = '';
			} else if (cleanEmoji !== '') {
				changes.push(`• **Emoji Item:** \`${targetItem.emoji || 'Mewarisi'}\` ➔ ${cleanEmoji}`);
				targetItem.emoji = cleanEmoji;
			}
		}

		if (newCategoryEmoji && newCategoryEmoji.trim() !== '') {
			const cat = targetItem.category || 'General';
			setCategoryEmoji(cat, newCategoryEmoji.trim());
			changes.push(`• **Emoji Kategori (${cat}):** ➔ ${newCategoryEmoji.trim()}`);
		}

		if (newDesc && newDesc.trim() !== '') {
			changes.push(`• **Deskripsi:** *${newDesc.trim()}*`);
			targetItem.description = newDesc.trim();
		}

		if (changes.length === 0) {
			return interaction.editReply({ content: '⚠️ Tidak ada perubahan yang diisi. Masukkan setidaknya 1 opsi yang ingin diubah!' });
		}

		const fileContent = `/**\n * DATAKATALOG ITEM BEBEY STORE\n */\nmodule.exports = ${JSON.stringify(items, null, 4)};\n`;

		try {
			fs.writeFileSync(itemsFilePath, fileContent, 'utf8');
			delete require.cache[require.resolve('../config/items')];

			const embed = new EmbedBuilder()
				.setTitle('✏️  ADMIN PANEL: EDIT DETAIL ITEM')
				.setColor(0x3498DB)
				.setDescription(`Detail item **${targetItem.name}** berhasil diperbarui!\n\n` + changes.join('\n'))
				.setTimestamp();

			await interaction.editReply({ embeds: [embed] });

			// Auto-update pesan /panel publik jika ada di channel toko
			const { updateGlobalPanel } = require('../services/panelManager');
			updateGlobalPanel(interaction.client);
		} catch (err) {
			console.error('Error editing item in items.js:', err);
			await interaction.editReply({ content: '❌ Gagal memperbarui item di file items.js!' });
		}
	},
};
