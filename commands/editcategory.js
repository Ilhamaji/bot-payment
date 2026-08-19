const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const { isAdmin } = require('../services/admins');
const { getCategoryEmoji, setCategoryEmoji } = require('../services/panelManager');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('editcategory')
		.setDescription('[ADMIN] Mengubah nama atau emoji kategori produk di katalog toko')
		.addStringOption(option =>
			option.setName('kategori_lama')
				.setDescription('Pilih kategori yang ingin diubah')
				.setRequired(true)
				.setAutocomplete(true))
		.addStringOption(option =>
			option.setName('kategori_baru')
				.setDescription('Nama kategori baru (kosongkan jika hanya ingin mengedit emoji)')
				.setRequired(false)
				.setMinLength(2)
				.setMaxLength(30))
		.addStringOption(option =>
			option.setName('emoji')
				.setDescription('Emoji baru untuk Kategori ini (cth: 👑, 💎, 🚀, 📦)')
				.setRequired(false)),

	async autocomplete(interaction) {
		delete require.cache[require.resolve('../config/items')];
		const items = require('../config/items');
		const focusedValue = interaction.options.getFocused().toLowerCase();

		const categories = new Set();
		items.forEach(item => {
			if (item.category && item.category.trim() !== '') {
				categories.add(item.category.trim());
			}
		});

		const filtered = Array.from(categories).filter(cat => cat.toLowerCase().includes(focusedValue));
		await interaction.respond(
			filtered.slice(0, 25).map(cat => ({ name: `${getCategoryEmoji(cat)} ${cat}`, value: cat }))
		);
	},

	async execute(interaction) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		if (!isAdmin(interaction.user.id)) {
			return interaction.editReply({ content: '❌ **AKSES DITOLAK!** Anda tidak memiliki akses Admin toko.' });
		}

		const oldCategory = interaction.options.getString('kategori_lama').trim();
		const newCategoryInput = interaction.options.getString('kategori_baru');
		const newCategory = newCategoryInput && newCategoryInput.trim() !== '' ? newCategoryInput.trim() : oldCategory;
		const newEmojiInput = interaction.options.getString('emoji');

		const itemsFilePath = path.join(__dirname, '../config/items.js');
		delete require.cache[require.resolve('../config/items')];
		let items = require('../config/items');

		let updatedCount = 0;
		items = items.map(item => {
			if ((item.category || 'General').toLowerCase() === oldCategory.toLowerCase()) {
				updatedCount++;
				return {
					...item,
					category: newCategory
				};
			}
			return item;
		});

		if (updatedCount === 0) {
			return interaction.editReply({ content: `❌ Kategori **${oldCategory}** tidak ditemukan atau tidak memiliki item.` });
		}

		// Update emoji kategori jika diberikan
		const oldEmoji = getCategoryEmoji(oldCategory);
		if (newEmojiInput && newEmojiInput.trim() !== '') {
			const cleanEmoji = newEmojiInput.trim();
			setCategoryEmoji(newCategory, cleanEmoji);
		} else if (newCategory !== oldCategory) {
			// Pindahkan emoji lama ke nama kategori baru jika tidak diubah
			setCategoryEmoji(newCategory, oldEmoji);
		}

		const fileContent = `/**\n * DATAKATALOG ITEM BEBEY STORE\n */\nmodule.exports = ${JSON.stringify(items, null, 4)};\n`;

		try {
			fs.writeFileSync(itemsFilePath, fileContent, 'utf8');
			delete require.cache[require.resolve('../config/items')];

			const finalEmoji = getCategoryEmoji(newCategory);

			const embed = new EmbedBuilder()
				.setTitle('✏️  ADMIN PANEL: EDIT KATEGORI')
				.setColor(0x3498DB)
				.setDescription(
					`Berhasil memperbarui kategori!\n\n` +
					`• **Nama Kategori:** \`${oldCategory}\` ➔ ${finalEmoji} **${newCategory}**\n` +
					`• **Jumlah Item Terpengaruh:** **${updatedCount} Item**`
				)
				.setTimestamp();

			await interaction.editReply({ embeds: [embed] });

			// Auto-update pesan /panel publik jika ada di channel toko
			const { updateGlobalPanel } = require('../services/panelManager');
			updateGlobalPanel(interaction.client);
		} catch (err) {
			console.error('Error editing category in items.js:', err);
			await interaction.editReply({ content: '❌ Gagal memperbarui kategori di file items.js!' });
		}
	},
};
