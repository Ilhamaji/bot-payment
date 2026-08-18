const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const { isAdmin } = require('../services/admins');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('delcategory')
		.setDescription('[ADMIN] Menghapus seluruh kategori produk dan item di dalamnya dari toko')
		.addStringOption(option =>
			option.setName('kategori')
				.setDescription('Pilih kategori yang ingin dihapus')
				.setRequired(true)
				.setAutocomplete(true)),

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

		const categoryToDelete = interaction.options.getString('kategori').trim();
		const itemsFilePath = path.join(__dirname, '../config/items.js');
		delete require.cache[require.resolve('../config/items')];
		let items = require('../config/items');

		const initialCount = items.length;
		// Filter buang semua item yang memiliki kategori tersebut
		items = items.filter(i => (i.category || 'General').toLowerCase() !== categoryToDelete.toLowerCase());
		const deletedCount = initialCount - items.length;

		if (deletedCount === 0) {
			return interaction.editReply({ content: `❌ Kategori **${categoryToDelete}** tidak ditemukan atau tidak memiliki item.` });
		}

		const fileContent = `/**\n * DATAKATALOG ITEM BEBEY STORE\n */\nmodule.exports = ${JSON.stringify(items, null, 4)};\n`;

		try {
			fs.writeFileSync(itemsFilePath, fileContent, 'utf8');
			delete require.cache[require.resolve('../config/items')];

			const embed = new EmbedBuilder()
				.setTitle('🗑️  ADMIN PANEL: HAPUS KATEGORI')
				.setColor(0xED4245)
				.setDescription(`Berhasil menghapus kategori **${categoryToDelete}** dan **${deletedCount} item** di dalamnya dari toko!`)
				.setTimestamp();

			await interaction.editReply({ embeds: [embed] });

			// Auto-update pesan /panel publik jika ada di channel toko
			const { updateGlobalPanel } = require('../services/panelManager');
			updateGlobalPanel(interaction.client);
		} catch (err) {
			console.error('Error deleting category from items.js:', err);
			await interaction.editReply({ content: '❌ Gagal menghapus kategori dari file items.js!' });
		}
	},
};
