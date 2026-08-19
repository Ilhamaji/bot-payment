const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const { isAdmin } = require('../services/admins');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('delitem')
		.setDescription('[ADMIN] Menghapus item dari katalog toko')
		.addStringOption(option =>
			option.setName('item')
				.setDescription('Pilih item yang ingin dihapus')
				.setRequired(true)
				.setAutocomplete(true)),

	async autocomplete(interaction) {
		delete require.cache[require.resolve('../config/items')];
		const items = require('../config/items');
		const focusedValue = interaction.options.getFocused().toLowerCase();
		const filtered = items.filter(choice => 
			choice.name.toLowerCase().includes(focusedValue) || 
			choice.id.toLowerCase().includes(focusedValue)
		);
		await interaction.respond(
			filtered.slice(0, 25).map(choice => ({ name: `${choice.emoji || '📦'} ${choice.name} (Rp ${choice.price.toLocaleString('id-ID')})`, value: choice.id }))
		);
	},

	async execute(interaction) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		if (!isAdmin(interaction.user.id)) {
			return interaction.editReply({ content: '❌ **AKSES DITOLAK!** Anda tidak memiliki akses Admin toko.' });
		}

		const itemId = interaction.options.getString('item');
		const itemsFilePath = path.join(__dirname, '../config/items.js');
		delete require.cache[require.resolve('../config/items')];
		let items = require('../config/items');

		const itemToDelete = items.find(i => i.id === itemId);
		if (!itemToDelete) {
			return interaction.editReply({ content: '❌ Item tidak ditemukan di katalog!' });
		}

		items = items.filter(i => i.id !== itemId);

		const fileContent = `/**\n * DATAKATALOG ITEM BEBEY STORE\n */\nmodule.exports = ${JSON.stringify(items, null, 4)};\n`;

		try {
			fs.writeFileSync(itemsFilePath, fileContent, 'utf8');
			delete require.cache[require.resolve('../config/items')];

			const embed = new EmbedBuilder()
				.setTitle('🗑️  ADMIN PANEL: HAPUS ITEM')
				.setColor(0xED4245)
				.setDescription(`Berhasil menghapus item **${itemToDelete.name}** dari katalog toko.`)
				.setTimestamp();

			await interaction.editReply({ embeds: [embed] });

			// Auto-update pesan /panel publik jika ada di channel toko
			const { updateGlobalPanel } = require('../services/panelManager');
			updateGlobalPanel(interaction.client);
		} catch (err) {
			console.error('Error deleting item from items.js:', err);
			await interaction.editReply({ content: '❌ Gagal menghapus item dari file items.js!' });
		}
	},
};
