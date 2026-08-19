const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getTopSpenders } = require('../services/sqlite');
const { isAdmin } = require('../services/admins');
const { saveLeaderboardLocation } = require('../services/panelManager');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('leaderboard')
		.setDescription('[ADMIN] Mengirimkan & mendaftarkan Panel Live Leaderboard di channel ini'),
	async execute(interaction) {
		if (!isAdmin(interaction.user.id)) {
			return interaction.reply({ content: '❌ **AKSES DITOLAK!** Hanya Admin toko yang dapat memasang panel Leaderboard.', flags: MessageFlags.Ephemeral });
		}

		const topSpenders = await getTopSpenders(10);

		let description = `Berikut adalah daftar **10 Pembeli Terbanyak (Top Spenders)** di **Bebey Store** yang telah terverifikasi:\n\n`;

		if (!topSpenders || topSpenders.length === 0) {
			description += `*Belum ada transaksi terverifikasi (fulfilled).*`;
		} else {
			const medalEmojis = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
			topSpenders.forEach((spender, index) => {
				const medal = medalEmojis[index] || '🎖️';
				const cleanTag = spender.username.startsWith('@') ? spender.username : `@${spender.username}`;
				description += `> ${medal} **${cleanTag}** — \`Rp ${spender.totalSpent.toLocaleString('id-ID')}\`\n`;
			});
		}

		const embed = new EmbedBuilder()
			.setTitle('🏆  BEBEY STORE — OFFICIAL LEADERBOARD TOP SPENDERS')
			.setColor(0xF1C40F)
			.setDescription(description.trim())
			.setTimestamp()
			.setFooter({ text: '⚡ Bebey Store Official • Auto-Refreshed Live Leaderboard' });

		// Admin Mode: Pasang Pesan Live Leaderboard Permanen di Channel Ini
		const lbMessage = await interaction.channel.send({ embeds: [embed] });
		saveLeaderboardLocation(interaction.channelId, lbMessage.id);

		return interaction.reply({
			content: `✅ **Panel Live Leaderboard berhasil dikirim ke #${interaction.channel.name}!** Pesan ini akan otomatis ter-update real-time setiap kali transaksi selesai.`,
			flags: MessageFlags.Ephemeral
		});
	},
};
