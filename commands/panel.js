const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { isAdmin } = require('../services/admins');
const { savePanelLocation, buildCatalogPanelComponents } = require('../services/panelManager');
const { getTopSpenders } = require('../services/supabase');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('panel')
		.setDescription('[ADMIN] Mengirimkan 2 Embed Panel Permanen (Leaderboard & Katalog Sub-Menu) ke channel ini'),
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

		// 1. BUAT EMBED MESSAGE 1: LEADERBOARD TOP SPENDERS
		const topSpenders = await getTopSpenders(10);
		let lbDescription = `Berikut adalah daftar **10 Pembeli Terbanyak (Top Spenders)** di **Bebey Store** yang telah terverifikasi:\n\n`;

		if (!topSpenders || topSpenders.length === 0) {
			lbDescription += `*Belum ada transaksi terverifikasi (fulfilled).*`;
		} else {
			const medalEmojis = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
			topSpenders.forEach((spender, index) => {
				const medal = medalEmojis[index] || '🎖️';
				const cleanTag = spender.username.startsWith('@') ? spender.username : `@${spender.username}`;
				lbDescription += `> ${medal} **${cleanTag}** — \`Rp ${spender.totalSpent.toLocaleString('id-ID')}\`\n`;
			});
		}

		const lbEmbed = new EmbedBuilder()
			.setTitle('🏆  BEBEY STORE — OFFICIAL LEADERBOARD TOP SPENDERS')
			.setColor(0xF1C40F)
			.setDescription(lbDescription.trim())
			.setTimestamp()
			.setFooter({ text: '⚡ Bebey Store Official • Auto-Refreshed Live Leaderboard' });

		const leaderboardMessage = await interaction.channel.send({ embeds: [lbEmbed] });

		// 2. BUAT EMBED MESSAGE 2: KATALOG INTERAKTIF DENGAN TOMBOL KATEGORI & DROPDOWN MENU
		const panelData = buildCatalogPanelComponents(items, 'ALL');
		const catalogMessage = await interaction.channel.send(panelData);

		// Simpan lokasi 2 pesan (Leaderboard & Catalog) agar keduanya ter-update otomatis real-time
		savePanelLocation(interaction.channelId, leaderboardMessage.id, catalogMessage.id);

		await interaction.reply({
			content: '✅ **2 Pesan Panel Toko (1. Leaderboard & 2. Katalog Sub-Menu Kategori) berhasil dikirim ke channel ini!** Keduanya akan ter-update otomatis secara real-time.',
			flags: MessageFlags.Ephemeral
		});
	},
};
