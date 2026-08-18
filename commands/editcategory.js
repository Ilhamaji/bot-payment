const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const { isAdmin } = require('../services/admins');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('editcategory')
		.setDescription('[ADMIN] Mengubah nama kategori produk di katalog toko')
		.addStringOption(option =>
			option.setName('kategori_lama')
				.setDescription('Pilih kategori yang ingin diubah namaya')
				.setRequired(true)
				.setAutocomplete(true))
		.addStringOption(option =>
			option.setName('kategori_baru')
				.setDescription('Masukkan nama kategori baru (cth: Premium Passes)')
				.setRequired(true)
				.setMinLength(2)
				.setMaxLength(30)),

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
			filtered.slice(0, 25).map(cat => ({ name: `📁 ${cat}`, value: cat }))
		);
	},

	async execute(interaction) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		if (!isAdmin(interaction.user.id)) {
			return interaction.editReply({ content: '❌ **AKSES DITOLAK!** Anda tidak memiliki akses Admin toko.' });
		}

		const oldCategory = interaction.options.getString('kategori_lama').trim();
		const newCategory = interaction.options.getString('kategori_baru').trim();

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

		const fileContent = `/**\n * DATAKATALOG ITEM BEBEY STORE\n */\nmodule.exports = ${JSON.stringify(items, null, 4)};\n`;

		try {
			fs.writeFileSync(itemsFilePath, fileContent, 'utf8');
			delete require.cache[require.resolve('../config/items')];

			const embed = new EmbedBuilder()
				.setTitle('✏️  ADMIN PANEL: EDIT KATEGORI')
				.setColor(0x3498DB)
				.setDescription(`Berhasil memperbarui nama kategori dari **${oldCategory}** menjadi **${newCategory}** untuk **${updatedCount} item**!`)
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
