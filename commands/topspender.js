const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getTopSpenders } = require('../services/supabase');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('topspender')
		.setDescription('Menampilkan Papan Peringkat (Leaderboard) 10 Pembeli Terbanyak'),
	async execute(interaction) {
		await interaction.deferReply();

		const topSpenders = await getTopSpenders(10);

		if (!topSpenders || topSpenders.length === 0) {
			const emptyEmbed = new EmbedBuilder()
				.setTitle('🏆  PAPAN PERINGKAT TOP SPENDER')
				.setColor(0xF1C40F)
				.setDescription('⚠️ Belum ada transaksi yang selesai (fulfilled) untuk ditampilkan.')
				.setTimestamp();
			return interaction.editReply({ embeds: [emptyEmbed] });
		}

		let description = 
			`Berikut adalah daftar **10 Pembeli Terbanyak (Top Spenders)** di **Bebey Store** yang telah berhasil melakukan transaksi:\n\n`;

		const medalEmojis = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

		topSpenders.forEach((spender, index) => {
			const medal = medalEmojis[index] || '🎖️';
			const cleanTag = spender.username.startsWith('@') ? spender.username : `@${spender.username}`;
			description += `> ${medal} **${cleanTag}** — \`Rp ${spender.totalSpent.toLocaleString('id-ID')}\`\n`;
		});

		const embed = new EmbedBuilder()
			.setTitle('🏆  BEBEY STORE — LEADERBOARD TOP SPENDER')
			.setColor(0xF1C40F)
			.setDescription(description.trim())
			.setTimestamp()
			.setFooter({ text: '⚡ Bebey Store Official • Real-Time Leaderboard System' });

		await interaction.editReply({ embeds: [embed] });
	},
};
