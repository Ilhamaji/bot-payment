const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { isAdmin } = require('../services/admins');
const { saveCatalogLocation, buildCatalogPanelComponents } = require('../services/panelManager');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('panel')
		.setDescription('[ADMIN] Mengirimkan Pesan Panel Katalog Toko Permanen ke channel ini'),
	async execute(interaction) {
		if (!isAdmin(interaction.user.id)) {
			return interaction.reply({ content: '❌ **AKSES DITOLAK!** Anda tidak memiliki akses Admin toko.', flags: MessageFlags.Ephemeral });
		}

		delete require.cache[require.resolve('../config/items')];
		const items = require('../config/items');

		if (items.length === 0) {
			const emptyEmbed = new EmbedBuilder()
				.setTitle('🏪  BEBEY STORE — KATALOG TOKO')
				.setColor(0x5865F2)
				.setDescription('⚠️ Katalog toko saat ini belum memiliki item.')
				.setTimestamp();
			return interaction.reply({ embeds: [emptyEmbed] });
		}

		// BUAT EMBED MESSAGE KATALOG INTERAKTIF DENGAN TOMBOL KATEGORI
		const panelData = buildCatalogPanelComponents(items, 'ALL');
		const catalogMessage = await interaction.channel.send(panelData);

		// Simpan lokasi pesan katalog toko agar ter-update otomatis real-time
		saveCatalogLocation(interaction.channelId, catalogMessage.id);

		await interaction.reply({
			content: `✅ **Pesan Panel Katalog Toko berhasil dikirim ke #${interaction.channel.name}!** Pesan ini akan ter-update otomatis secara real-time.`,
			flags: MessageFlags.Ephemeral
		});
	},
};
