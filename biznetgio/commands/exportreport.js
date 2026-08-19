const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { isAdmin } = require('../services/admins');
const { sendMonthlyReport } = require('../services/reportManager');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('exportreport')
		.setDescription('[ADMIN/OWNER] Mengunduh laporan penjualan resmi toko dalam format Excel (.xlsx)')
		.addIntegerOption(option =>
			option.setName('bulan')
				.setDescription('Pilih bulan laporan (1 = Jan, 12 = Des)')
				.setRequired(false)
				.setMinValue(1)
				.setMaxValue(12))
		.addIntegerOption(option =>
			option.setName('tahun')
				.setDescription('Masukkan tahun laporan (cth: 2026)')
				.setRequired(false)
				.setMinValue(2024)
				.setMaxValue(2035)),

	async execute(interaction) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		if (!isAdmin(interaction.user.id)) {
			return interaction.editReply({ content: '❌ **AKSES DITOLAK!** Anda tidak memiliki akses Admin toko.' });
		}

		const now = new Date();
		let targetMonth = interaction.options.getInteger('bulan');
		let targetYear = interaction.options.getInteger('tahun');

		if (!targetMonth) {
			// Jika bulan tidak diisi, ambil bulan berjalan saat ini
			targetMonth = now.getMonth() + 1;
		}

		if (!targetYear) {
			targetYear = now.getFullYear();
		}

		try {
			await interaction.editReply({ content: `⏳ Sedang menyusun file Excel laporan penjualan periode **Bulan ${targetMonth} Tahun ${targetYear}**...` });
			
			// Kirim laporan ke channel interaksi saat ini
			const result = await sendMonthlyReport(interaction.client, interaction.channelId, targetYear, targetMonth);
			
			await interaction.followUp({
				content: `✅ **Laporan Excel Penjualan Periode ${result.monthName} ${result.year} berhasil dibuat & dikirim!**\n` +
					`└ Total: **${result.totalTransactions} Transaksi** | Total Omset: **Rp ${result.totalRevenue.toLocaleString('id-ID')}**`,
				flags: MessageFlags.Ephemeral
			});
		} catch (err) {
			console.error('Error executing /exportreport:', err);
			await interaction.editReply({ content: '❌ Gagal membuat dan mengekspor laporan Excel!' });
		}
	},
};
