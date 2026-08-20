const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const path = require('node:path');
const { isAdmin, isOwner, getAdmins } = require('../services/admins');

function getDashboardData() {
	delete require.cache[require.resolve('../config/items')];
	const items = require('../config/items');
	const admins = getAdmins();

	const totalItems = items.length;
	const categories = [...new Set(items.map(i => i.category || 'General'))];
	const totalCategories = categories.length;
	const totalAdmins = admins.length;

	return { items, categories, admins, totalItems, totalCategories, totalAdmins };
}

function buildAdminDashboardEmbed(user) {
	const data = getDashboardData();

	const embed = new EmbedBuilder()
		.setTitle('🎛️  BEBEY STORE — ADMIN DASHBOARD CONTROL PANEL')
		.setColor(0xE74C3C)
		.setDescription(
			`Halo ${user}! Selamat datang di **Interactive Admin GUI Dashboard**.\n` +
			`Gunakan tombol dan menu interaktif di bawah untuk mengelola seluruh aspek toko secara mudah tanpa perlu mengetik command!`
		)
		.addFields(
			{ name: '📦 Total Produk', value: `**${data.totalItems}** Item`, inline: true },
			{ name: '📁 Total Kategori', value: `**${data.totalCategories}** Kategori`, inline: true },
			{ name: '🛡️ Total Admin', value: `**${data.totalAdmins}** Admin`, inline: true }
		)
		.setTimestamp()
		.setFooter({ text: '⚡ Bebey Store Official • Admin GUI Control Center' });

	return embed;
}

function buildAdminDashboardComponents(userId) {
	const userIsOwner = isOwner(userId);

	// Row 1: Kelola Produk
	const btnAddItem = new ButtonBuilder()
		.setCustomId('ap_btn_additem')
		.setLabel('➕ Tambah Item')
		.setStyle(ButtonStyle.Success);

	const btnEditItem = new ButtonBuilder()
		.setCustomId('ap_btn_edititem')
		.setLabel('✏️ Edit Item')
		.setStyle(ButtonStyle.Primary);

	const btnDelItem = new ButtonBuilder()
		.setCustomId('ap_btn_delitem')
		.setLabel('🗑️ Hapus Item')
		.setStyle(ButtonStyle.Danger);

	const row1 = new ActionRowBuilder().addComponents(btnAddItem, btnEditItem, btnDelItem);

	// Row 2: Kelola Kategori & Panel
	const btnEditCat = new ButtonBuilder()
		.setCustomId('ap_btn_editcat')
		.setLabel('✏️ Edit Kategori')
		.setStyle(ButtonStyle.Secondary);

	const btnDelCat = new ButtonBuilder()
		.setCustomId('ap_btn_delcat')
		.setLabel('🗑️ Hapus Kategori')
		.setStyle(ButtonStyle.Danger);

	const btnSendPanel = new ButtonBuilder()
		.setCustomId('ap_btn_sendpanel')
		.setLabel('🛍️ Pasang Panel Katalog')
		.setStyle(ButtonStyle.Primary);

	const btnSendLB = new ButtonBuilder()
		.setCustomId('ap_btn_sendlb')
		.setLabel('🏆 Pasang Leaderboard')
		.setStyle(ButtonStyle.Primary);

	const row2 = new ActionRowBuilder().addComponents(btnEditCat, btnDelCat, btnSendPanel, btnSendLB);

	// Row 3: Laporan & Kelola Admin
	const btnExportReport = new ButtonBuilder()
		.setCustomId('ap_btn_exportreport')
		.setLabel('📊 Export Laporan Excel')
		.setStyle(ButtonStyle.Success);

	const btnManageAdmin = new ButtonBuilder()
		.setCustomId('ap_btn_manageadmin')
		.setLabel('👑 Kelola Admin')
		.setStyle(ButtonStyle.Secondary);

	const btnRefresh = new ButtonBuilder()
		.setCustomId('ap_btn_refresh')
		.setLabel('🔄 Refresh GUI')
		.setStyle(ButtonStyle.Secondary);

	const row3 = new ActionRowBuilder().addComponents(btnExportReport, btnManageAdmin, btnRefresh);

	return [row1, row2, row3];
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('adminpanel')
		.setDescription('[ADMIN] Membuka Interactive Control Panel Dashboard GUI untuk kelola toko'),
	async execute(interaction) {
		if (!isAdmin(interaction.user.id)) {
			return interaction.reply({ 
				content: '❌ **AKSES DITOLAK!** Hanya Admin toko yang dapat membuka Admin Dashboard GUI.', 
				flags: MessageFlags.Ephemeral 
			});
		}

		const embed = buildAdminDashboardEmbed(interaction.user);
		const components = buildAdminDashboardComponents(interaction.user.id);

		await interaction.reply({
			embeds: [embed],
			components: components,
			flags: MessageFlags.Ephemeral
		});
	},
	buildAdminDashboardEmbed,
	buildAdminDashboardComponents,
	getDashboardData
};
