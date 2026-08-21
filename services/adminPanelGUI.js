const { 
	EmbedBuilder, 
	ActionRowBuilder, 
	ButtonBuilder, 
	ButtonStyle, 
	StringSelectMenuBuilder, 
	StringSelectMenuOptionBuilder, 
	ModalBuilder, 
	TextInputBuilder, 
	TextInputStyle, 
	MessageFlags, 
	AttachmentBuilder 
} = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const { isAdmin, isOwner, addAdmin, removeAdmin, getAdmins } = require('./admins');
const { 
	setCategoryEmoji, 
	getCategoryEmoji, 
	getItemEmoji, 
	savePanelLocation, 
	saveLeaderboardLocation, 
	updateGlobalPanel,
	getCategoryConfig,
	setCategoryConfig,
	isCategoryQuantityAllowed
} = require('./panelManager');

function getItemsData() {
	const itemsFilePath = path.join(__dirname, '../config/items.js');
	delete require.cache[require.resolve('../config/items')];
	const items = require('../config/items');
	return { items, itemsFilePath };
}

function saveItemsData(items, itemsFilePath) {
	const fileContent = `/**\n * DATAKATALOG ITEM BEBEY STORE\n */\nmodule.exports = ${JSON.stringify(items, null, 4)};\n`;
	fs.writeFileSync(itemsFilePath, fileContent, 'utf8');
	delete require.cache[require.resolve('../config/items')];
}

function buildCategorySettingEmbedAndComponents(catName) {
	const config = getCategoryConfig(catName);
	const catEmoji = config.emoji || '📁';
	const isQtyAllowed = config.allowQuantity === true;

	const embed = new EmbedBuilder()
		.setTitle(`📁  PENGATURAN KATEGORI: ${catName}`)
		.setColor(isQtyAllowed ? 0x2ECC71 : 0x3498DB)
		.setDescription(
			`Kelola pengaturan nama dan mode pembelian (jumlah / keranjang) untuk kategori **${catName}**.\n\n` +
			`💡 *Klik tombol **[ 🛒 Toggle Keranjang ]** di bawah untuk menentukan apakah pembeli dapat membeli beberapa item sekaligus dalam 1 tiket.*`
		)
		.addFields(
			{ name: '📁 Nama Kategori', value: `${catEmoji} \`${catName}\``, inline: true },
			{ name: '🛒 Mode Pembelian', value: isQtyAllowed ? '`🟢 BISA BELI BEBERAPA (Multi-Qty / Keranjang)`' : '`🔴 HANYA 1 PCS (Single Item)`', inline: true }
		)
		.setTimestamp()
		.setFooter({ text: '⚡ Bebey Store Admin Control Center' });

	const renameBtn = new ButtonBuilder()
		.setCustomId(`ap_btn_renamecat_${catName}`)
		.setLabel('✏️ Ubah Nama Kategori')
		.setStyle(ButtonStyle.Primary);

	const toggleQtyBtn = new ButtonBuilder()
		.setCustomId(`ap_btn_toggle_qty_${catName}`)
		.setLabel(isQtyAllowed ? '🛒 Mode Keranjang: ON 🟢' : '🛒 Mode Keranjang: OFF 🔴')
		.setStyle(isQtyAllowed ? ButtonStyle.Success : ButtonStyle.Secondary);

	const doneBtn = new ButtonBuilder()
		.setCustomId('ap_btn_done_cat')
		.setLabel('✅ Selesai Edit')
		.setStyle(ButtonStyle.Secondary);

	const row = new ActionRowBuilder().addComponents(renameBtn, toggleQtyBtn, doneBtn);

	return { embed, components: [row] };
}

function buildItemCategorySelectMenu(item) {
	const { items } = getItemsData();
	const categories = [...new Set(items.map(i => i.category || 'General'))];

	if (item.category && !categories.includes(item.category)) {
		categories.push(item.category);
	}

	const selectMenu = new StringSelectMenuBuilder()
		.setCustomId(`ap_select_item_cat_${item.id}`)
		.setPlaceholder('📁 Klik untuk memilih Kategori Produk');

	categories.slice(0, 24).forEach(cat => {
		const catEmoji = getCategoryEmoji(cat);
		selectMenu.addOptions(
			new StringSelectMenuOptionBuilder()
				.setLabel(cat)
				.setValue(cat)
				.setDescription(`Set kategori produk ini ke ${cat}`)
				.setEmoji(catEmoji || '📁')
				.setDefault(item.category && item.category.toLowerCase() === cat.toLowerCase())
		);
	});

	selectMenu.addOptions(
		new StringSelectMenuOptionBuilder()
			.setLabel('➕ Tambah Kategori Baru...')
			.setValue('NEW_CATEGORY')
			.setDescription('Ketik nama kategori baru secara langsung')
			.setEmoji('➕')
	);

	return new ActionRowBuilder().addComponents(selectMenu);
}

function buildItemCheckboxMenu(item) {
	const isHeld = item.available === false || item.hold === true;
	const usePs = item.usePrivateServer !== false;

	const selectMenu = new StringSelectMenuBuilder()
		.setCustomId(`ap_checkbox_opts_${item.id}`)
		.setPlaceholder('☑️ Centang Opsi Setting (Multi-Select Checkbox)')
		.setMinValues(0)
		.setMaxValues(4)
		.addOptions(
			new StringSelectMenuOptionBuilder()
				.setLabel('Perlu Username Roblox')
				.setValue('req_username')
				.setDescription('Pembeli wajib mengisi Username Roblox saat membuat tiket')
				.setEmoji('👤')
				.setDefault(item.requireUsername !== false),
			new StringSelectMenuOptionBuilder()
				.setLabel('Perlu Cek Limit Roblox')
				.setValue('req_limit')
				.setDescription('Pembeli akan melewati panduan Cek Limit Roblox')
				.setEmoji('🔍')
				.setDefault(item.requireLimitCheck !== false),
			new StringSelectMenuOptionBuilder()
				.setLabel('Gunakan Private World Toko')
				.setValue('req_ps')
				.setDescription('Tampilkan Link Private World Toko saat pembeli membeli produk ini')
				.setEmoji('🌐')
				.setDefault(usePs),
			new StringSelectMenuOptionBuilder()
				.setLabel('Tahan Produk (Non-aktifkan Sementara)')
				.setValue('req_hold')
				.setDescription('Produk tidak akan bisa dibeli oleh pembeli untuk sementara')
				.setEmoji('⛔')
				.setDefault(isHeld)
		);

	return new ActionRowBuilder().addComponents(selectMenu);
}

function buildItemDoneButton(item) {
	const editPriceBtn = new ButtonBuilder()
		.setCustomId(`ap_btn_edit_price_${item.id}`)
		.setLabel('✏️ Edit Detail & Nama')
		.setStyle(ButtonStyle.Primary);

	const delBtn = new ButtonBuilder()
		.setCustomId(`ap_btn_del_single_${item.id}`)
		.setLabel('🗑️ Hapus Produk Ini')
		.setStyle(ButtonStyle.Danger);

	const doneBtn = new ButtonBuilder()
		.setCustomId(`ap_btn_item_done_${item.id}`)
		.setLabel('✅ Selesai Edit')
		.setStyle(ButtonStyle.Success);

	return new ActionRowBuilder().addComponents(editPriceBtn, delBtn, doneBtn);
}

function buildItemDetailEmbed(item, actionTitle = 'DETAIL PRODUK') {
	const catEmoji = getCategoryEmoji(item.category || 'General');
	const effectiveEmoji = getItemEmoji(item);
	const reqUserLabel = item.requireUsername !== false ? '`✅ Ya (Wajib Username)`' : '`❌ Tidak Perlu`';
	const reqLimitLabel = item.requireLimitCheck !== false ? '`✅ Ya (Cek Limit)`' : '`❌ Tidak Perlu`';
	const isHeld = item.available === false || item.hold === true;
	const statusLabel = isHeld ? '`⛔ DITAHAN (Tidak Bisa Dibeli)`' : '`🟢 AKTIF (Bisa Dibeli)`';
	const usePsLabel = item.usePrivateServer !== false ? '`🟢 AKTIF (Tampilkan Link)`' : '`🔴 NON-AKTIF (Sembunyikan)`';
	const notesLabel = item.notes ? item.notes : '*Catatan standar/default*';

	const embed = new EmbedBuilder()
		.setTitle(`📦  ${actionTitle}: ${item.name}`)
		.setColor(isHeld ? 0xED4245 : 0x2ECC71)
		.setDescription(
			`Berikut adalah detail & setting produk **${item.name}**:\n\n` +
			`💡 *Klik **✏️ Edit Detail & Nama** untuk mengubah harga/nama, centang opsi di bawah, lalu tekan **✅ Selesai Edit**!*`
		)
		.addFields(
			{ name: '🆔 ID Item', value: `\`${item.id}\``, inline: true },
			{ name: '💰 Harga', value: `**Rp ${(item.price || 0).toLocaleString('id-ID')}**`, inline: true },
			{ name: '📁 Kategori', value: `${catEmoji} \`${item.category || 'General'}\``, inline: true },
			{ name: '👤 Username Roblox', value: reqUserLabel, inline: true },
			{ name: '🔍 Cek Limit Roblox', value: reqLimitLabel, inline: true },
			{ name: '🌐 Private World Toko', value: usePsLabel, inline: true },
			{ name: '⏸️ Status Pembelian', value: statusLabel, inline: true },
			{ name: '📌 Catatan Tiket', value: `${notesLabel}`, inline: false }
		)
		.setTimestamp()
		.setFooter({ text: 'Tekan "✅ Selesai Edit" untuk menyimpan dan membersihkan tampilan.' });

	return embed;
}

function getItemSettingComponents(item) {
	const catRow = buildItemCategorySelectMenu(item);
	const checkboxRow = buildItemCheckboxMenu(item);
	const doneRow = buildItemDoneButton(item);
	return [catRow, checkboxRow, doneRow];
}

async function handleAdminPanelInteraction(interaction, client) {
	if (!isAdmin(interaction.user.id)) {
		return interaction.reply({ 
			content: '❌ **AKSES DITOLAK!** Hanya Admin toko yang dapat menggunakan Admin Control Panel.', 
			flags: MessageFlags.Ephemeral 
		});
	}

	const { buildAdminDashboardEmbed, buildAdminDashboardComponents } = require('../commands/adminpanel');
	const customId = interaction.customId;

	// ==========================================
	// 1. BUTTON INTERACTIONS (ap_btn_...)
	// ==========================================
	if (interaction.isButton()) {
		// Tombol Konfirmasi & Selesai Edit Item (Clean UI Cleanup Engine)
		if (customId.startsWith('ap_btn_item_done_')) {
			const itemId = customId.replace('ap_btn_item_done_', '');
			const { items } = getItemsData();
			const item = items.find(i => i.id === itemId);
			const itemName = item ? item.name : 'Produk';

			updateGlobalPanel(client);

			try {
				await interaction.update({
					content: `✅ **Pengeditan item "${itemName}" telah selesai & disimpan secara permanen!**\n> *Tampilan edit ini akan otomatis hilang dalam 3 detik...*`,
					embeds: [],
					components: []
				});

				setTimeout(async () => {
					try {
						await interaction.deleteReply();
					} catch (e) {}
				}, 3000);
			} catch (err) {
				try {
					await interaction.reply({
						content: `✅ **Pengeditan item "${itemName}" telah selesai & disimpan!**`,
						flags: MessageFlags.Ephemeral
					});
				} catch (e) {}
			}
			return;
		}

		// Tombol Launch Modal Edit Harga & Nama Item
		if (customId.startsWith('ap_btn_edit_price_')) {
			const itemId = customId.replace('ap_btn_edit_price_', '');
			const { items } = getItemsData();
			const item = items.find(i => i.id === itemId);

			if (!item) {
				return interaction.reply({ content: '❌ Item tidak ditemukan.', flags: MessageFlags.Ephemeral });
			}

			const modal = new ModalBuilder()
				.setCustomId(`ap_modal_edititem_${item.id}`)
				.setTitle(`EDIT: ${item.name.substring(0, 20)}`);

			const nameInput = new TextInputBuilder()
				.setCustomId('edit_name')
				.setLabel('NAMA ITEM / MENU:')
				.setStyle(TextInputStyle.Short)
				.setValue(item.name || '')
				.setRequired(true);

			const priceInput = new TextInputBuilder()
				.setCustomId('edit_price')
				.setLabel('HARGA (RUPIAH):')
				.setStyle(TextInputStyle.Short)
				.setValue(String(item.price || 0))
				.setRequired(true);

			const notesInput = new TextInputBuilder()
				.setCustomId('edit_notes')
				.setLabel('CATATAN KHUSUS TIKET (Opsional):')
				.setStyle(TextInputStyle.Paragraph)
				.setValue(item.notes || '')
				.setRequired(false);

			modal.addComponents(
				new ActionRowBuilder().addComponents(nameInput),
				new ActionRowBuilder().addComponents(priceInput),
				new ActionRowBuilder().addComponents(notesInput)
			);

			return interaction.showModal(modal);
		}

		// Tombol Launch Modal Edit Link Private Server / World
		if (customId.startsWith('ap_btn_edit_ps_')) {
			const itemId = customId.replace('ap_btn_edit_ps_', '');
			const { items } = getItemsData();
			const item = items.find(i => i.id === itemId);

			if (!item) {
				return interaction.reply({ content: '❌ Item tidak ditemukan.', flags: MessageFlags.Ephemeral });
			}

			const modal = new ModalBuilder()
				.setCustomId(`ap_modal_edit_ps_${item.id}`)
				.setTitle(`PRIVATE WORLD: ${item.name.substring(0, 15)}`);

			const psInput = new TextInputBuilder()
				.setCustomId('edit_ps_url')
				.setLabel('URL LINK PRIVATE WORLD / SERVER:')
				.setStyle(TextInputStyle.Paragraph)
				.setPlaceholder('Cth: https://www.roblox.com/games/share?... (kosongkan jika tidak ada)')
				.setValue(item.privateServerUrl || '')
				.setRequired(false);

			modal.addComponents(new ActionRowBuilder().addComponents(psInput));
			return interaction.showModal(modal);
		}

		// Tombol Hapus Produk Tunggal
		if (customId.startsWith('ap_btn_del_single_')) {
			const itemId = customId.replace('ap_btn_del_single_', '');
			const { items, itemsFilePath } = getItemsData();
			const itemIndex = items.findIndex(i => i.id === itemId);

			if (itemIndex >= 0) {
				const deletedName = items[itemIndex].name;
				items.splice(itemIndex, 1);
				saveItemsData(items, itemsFilePath);
				updateGlobalPanel(client);

				return interaction.update({
					content: `✅ **Produk "${deletedName}" telah berhasil dihapus secara permanen dari katalog toko!**`,
					embeds: [],
					components: []
				});
			} else {
				return interaction.reply({ content: '❌ Item tidak ditemukan.', flags: MessageFlags.Ephemeral });
			}
		}

		// Refresh Dashboard
		if (customId === 'ap_btn_refresh') {
			const embed = buildAdminDashboardEmbed(interaction.user);
			const components = buildAdminDashboardComponents(interaction.user.id);
			return interaction.update({ embeds: [embed], components: components });
		}

		// Pasang Panel Katalog Toko
		if (customId === 'ap_btn_sendpanel') {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });
			const { buildPanelPayload } = require('./panelManager');
			const payload = buildPanelPayload();
			const msg = await interaction.channel.send(payload);
			savePanelLocation(interaction.channelId, msg.id);
			updateGlobalPanel(client);
			return interaction.editReply({ 
				content: `✅ **Panel Katalog Toko berhasil dikirim dan dipasang di #${interaction.channel.name}!** Pesan ini akan otomatis ter-update real-time.` 
			});
		}

		// Pasang Leaderboard
		if (customId === 'ap_btn_sendlb') {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });
			const { getTopSpenders } = require('./supabase');
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

			const lbMsg = await interaction.channel.send({ embeds: [embed] });
			saveLeaderboardLocation(interaction.channelId, lbMsg.id);
			return interaction.editReply({ 
				content: `✅ **Panel Live Leaderboard berhasil dikirim ke #${interaction.channel.name}!**` 
			});
		}

		// Tombol Minta Konfirmasi Reset Leaderboard
		if (customId === 'ap_btn_resetlb') {
			const confirmEmbed = new EmbedBuilder()
				.setTitle('🏆  KONFIRMASI RESET LEADERBOARD TOP SPENDERS')
				.setColor(0xED4245)
				.setDescription(
					`Apakah Anda yakin ingin **mereset data Leaderboard Top Spenders**?\n\n` +
					`📌 **Catatan Penting:**\n` +
					`• Peringkat Top Spenders pada channel **#leaderboard** akan dihitung ulang dari awal (0) mulai dari waktu reset.\n` +
					`• Data histori transaksi & Laporan Penjualan Excel **TIDAK AKAN DIHAPUS** (tetap aman).\n\n` +
					`Klik tombol **"✅ Ya, Reset Leaderboard"** di bawah untuk konfirmasi.`
				)
				.setTimestamp()
				.setFooter({ text: 'Bebey Store Admin Control Center' });

			const confirmBtn = new ButtonBuilder()
				.setCustomId('ap_btn_confirm_resetlb')
				.setLabel('✅ Ya, Reset Leaderboard')
				.setStyle(ButtonStyle.Danger);

			const cancelBtn = new ButtonBuilder()
				.setCustomId('ap_btn_cancel_resetlb')
				.setLabel('❌ Batal')
				.setStyle(ButtonStyle.Secondary);

			const confirmRow = new ActionRowBuilder().addComponents(confirmBtn, cancelBtn);

			return interaction.reply({
				embeds: [confirmEmbed],
				components: [confirmRow],
				flags: MessageFlags.Ephemeral
			});
		}

		// Tombol Eksekusi Reset Leaderboard
		if (customId === 'ap_btn_confirm_resetlb') {
			const { resetLeaderboardTime, updateGlobalPanel } = require('./panelManager');
			const resetTimeStr = resetLeaderboardTime();

			await updateGlobalPanel(client);

			return interaction.update({
				content: `✅ **LEADERBOARD BERHASIL DI-RESET!**\n> Seluruh data peringkat Top Spenders telah di-reset per **${new Date().toLocaleString('id-ID')}**.\n> Panel Live Leaderboard di channel **#leaderboard** telah di-update otomatis!`,
				embeds: [],
				components: []
			});
		}

		// Tombol Batal Reset Leaderboard
		if (customId === 'ap_btn_cancel_resetlb') {
			const embed = buildAdminDashboardEmbed(interaction.user);
			const components = buildAdminDashboardComponents(interaction.user.id);
			return interaction.update({ content: '❌ Reset Leaderboard dibatalkan.', embeds: [embed], components: components });
		}

		// Toggle Mode Keranjang / Multi Quantity Kategori
		if (customId.startsWith('ap_btn_toggle_qty_')) {
			const catName = customId.replace('ap_btn_toggle_qty_', '');
			const currentConfig = getCategoryConfig(catName);
			const newAllowQty = !currentConfig.allowQuantity;

			setCategoryConfig(catName, { allowQuantity: newAllowQty });
			updateGlobalPanel(client);

			const { embed, components } = buildCategorySettingEmbedAndComponents(catName);
			return interaction.update({ embeds: [embed], components: components });
		}

		// Modal Rename Kategori Launcher
		if (customId.startsWith('ap_btn_renamecat_')) {
			const catName = customId.replace('ap_btn_renamecat_', '');
			const modal = new ModalBuilder()
				.setCustomId(`ap_modal_editcat_${catName}`)
				.setTitle(`EDIT KATEGORI: ${catName.substring(0, 20)}`);

			const newCatInput = new TextInputBuilder()
				.setCustomId('new_cat_name')
				.setLabel('NAMA KATEGORI BARU:')
				.setStyle(TextInputStyle.Short)
				.setValue(catName)
				.setRequired(true);

			modal.addComponents(new ActionRowBuilder().addComponents(newCatInput));
			return interaction.showModal(modal);
		}

		// Tombol Selesai Edit Kategori
		if (customId === 'ap_btn_done_cat') {
			try {
				await interaction.update({
					content: `✅ **Pengaturan kategori telah selesai & disimpan!**\n> *Tampilan ini akan otomatis hilang dalam 2 detik...*`,
					embeds: [],
					components: []
				});
				setTimeout(async () => {
					try { await interaction.deleteReply(); } catch (e) {}
				}, 2000);
			} catch (e) {}
			return;
		}

		// Modal Tambah Item
		if (customId === 'ap_btn_additem') {
			const modal = new ModalBuilder()
				.setCustomId('ap_modal_additem')
				.setTitle('➕ TAMBAH ITEM BARU');

			const idInput = new TextInputBuilder()
				.setCustomId('add_id')
				.setLabel('ID UNIK ITEM (cth: robux_1000):')
				.setStyle(TextInputStyle.Short)
				.setRequired(true);

			const nameInput = new TextInputBuilder()
				.setCustomId('add_name')
				.setLabel('NAMA ITEM (cth: Robux 1000 R$):')
				.setStyle(TextInputStyle.Short)
				.setRequired(true);

			const priceInput = new TextInputBuilder()
				.setCustomId('add_price')
				.setLabel('HARGA DALAM RUPIAH (cth: 130000):')
				.setStyle(TextInputStyle.Short)
				.setRequired(true);

			const notesInput = new TextInputBuilder()
				.setCustomId('add_notes')
				.setLabel('CATATAN KHUSUS TIKET (Opsional):')
				.setStyle(TextInputStyle.Paragraph)
				.setPlaceholder('Tulis catatan khusus untuk produk ini di tiket...')
				.setRequired(false);

			modal.addComponents(
				new ActionRowBuilder().addComponents(idInput),
				new ActionRowBuilder().addComponents(nameInput),
				new ActionRowBuilder().addComponents(priceInput),
				new ActionRowBuilder().addComponents(notesInput)
			);

			return interaction.showModal(modal);
		}

		// Select Menu Edit Item / Menu: Step 1 Pilih Kategori
		if (customId === 'ap_btn_edititem') {
			const { items } = getItemsData();
			if (items.length === 0) {
				return interaction.reply({ content: '❌ Belum ada item di katalog toko.', flags: MessageFlags.Ephemeral });
			}

			const categories = [...new Set(items.map(i => i.category || 'General'))];

			const selectMenu = new StringSelectMenuBuilder()
				.setCustomId('ap_select_cat_for_edit')
				.setPlaceholder('-- Langkah 1: Pilih Kategori Produk --');

			selectMenu.addOptions(
				new StringSelectMenuOptionBuilder()
					.setLabel('🌐 SELURUH MENU (TAMPILKAN SEMUA)')
					.setValue('CAT_ALL')
					.setDescription(`Tampilkan seluruh item di katalog toko (${items.length} Menu)`)
					.setEmoji('🌐')
			);

			categories.forEach(cat => {
				const catEmoji = getCategoryEmoji(cat);
				const catCount = items.filter(i => (i.category || 'General').toLowerCase() === cat.toLowerCase()).length;
				selectMenu.addOptions(
					new StringSelectMenuOptionBuilder()
						.setLabel(`${cat} (${catCount} Menu)`)
						.setValue(`CAT_${cat}`)
						.setDescription(`Kelola & edit produk di kategori ${cat}`)
						.setEmoji(catEmoji || '📁')
				);
			});

			const row = new ActionRowBuilder().addComponents(selectMenu);
			return interaction.reply({ 
				content: '✏️ **EDIT MENU / ITEM (LANGKAH 1):**\nSilakan pilih **Kategori Produk** di bawah untuk melihat daftar menu yang ada:', 
				components: [row], 
				flags: MessageFlags.Ephemeral 
			});
		}

		// Select Menu Hapus Item
		if (customId === 'ap_btn_delitem') {
			const { items } = getItemsData();
			if (items.length === 0) {
				return interaction.reply({ content: '❌ Belum ada item di katalog toko.', flags: MessageFlags.Ephemeral });
			}

			const selectMenu = new StringSelectMenuBuilder()
				.setCustomId('ap_select_delitem')
				.setPlaceholder('-- Pilih Item Yang Ingin Dihapus --');

			items.slice(0, 25).forEach(item => {
				selectMenu.addOptions(
					new StringSelectMenuOptionBuilder()
						.setLabel(`${item.name}`.substring(0, 50))
						.setValue(item.id)
						.setDescription(`Rp ${(item.price || 0).toLocaleString('id-ID')} • ${item.category || 'General'}`)
						.setEmoji('🗑️')
				);
			});

			const row = new ActionRowBuilder().addComponents(selectMenu);
			return interaction.reply({ 
				content: '🗑️ **Pilih produk yang ingin Anda HAPUS secara permanen:**', 
				components: [row], 
				flags: MessageFlags.Ephemeral 
			});
		}

		// Select Menu Edit Kategori
		if (customId === 'ap_btn_editcat') {
			const { items } = getItemsData();
			const categories = [...new Set(items.map(i => i.category || 'General'))];

			if (categories.length === 0) {
				return interaction.reply({ content: '❌ Belum ada kategori di katalog toko.', flags: MessageFlags.Ephemeral });
			}

			const selectMenu = new StringSelectMenuBuilder()
				.setCustomId('ap_select_editcat')
				.setPlaceholder('-- Pilih Kategori Yang Ingin Diedit --');

			categories.slice(0, 25).forEach(cat => {
				const catEmoji = getCategoryEmoji(cat);
				selectMenu.addOptions(
					new StringSelectMenuOptionBuilder()
						.setLabel(cat)
						.setValue(cat)
						.setEmoji(catEmoji || '📁')
				);
			});

			const row = new ActionRowBuilder().addComponents(selectMenu);
			return interaction.reply({ 
				content: '✏️ **Pilih kategori yang ingin Anda ubah namanya:**', 
				components: [row], 
				flags: MessageFlags.Ephemeral 
			});
		}

		// Select Menu Hapus Kategori
		if (customId === 'ap_btn_delcat') {
			const { items } = getItemsData();
			const categories = [...new Set(items.map(i => i.category || 'General'))];

			if (categories.length === 0) {
				return interaction.reply({ content: '❌ Belum ada kategori di katalog toko.', flags: MessageFlags.Ephemeral });
			}

			const selectMenu = new StringSelectMenuBuilder()
				.setCustomId('ap_select_delcat')
				.setPlaceholder('-- Pilih Kategori Yang Ingin Dihapus --');

			categories.slice(0, 25).forEach(cat => {
				selectMenu.addOptions(
					new StringSelectMenuOptionBuilder()
						.setLabel(cat)
						.setValue(cat)
						.setEmoji('🗑️')
				);
			});

			const row = new ActionRowBuilder().addComponents(selectMenu);
			return interaction.reply({ 
				content: '⚠️ **Pilih kategori yang ingin Anda HAPUS (beserta seluruh item di dalamnya):**', 
				components: [row], 
				flags: MessageFlags.Ephemeral 
			});
		}

		// Export Laporan Excel Seluruh Data (All-Time)
		if (customId === 'ap_btn_exportreport') {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });

			const { sendAllTimeReport } = require('./reportManager');
			const result = await sendAllTimeReport(client, interaction.channelId);

			if (!result || result.totalTransactions === 0) {
				return interaction.editReply({ content: '⚠️ Belum ada data transaksi terverifikasi (fulfilled) di database toko.' });
			}

			return interaction.editReply({
				content: `✅ **Laporan Excel Seluruh Data Penjualan (All-Time) Berhasil Dibuat!**`,
				embeds: [result.embed],
				files: [result.attachment]
			});
		}

		// Tombol Launch Modal Global Link Private World / Server (ap_btn_global_ps)
		if (customId === 'ap_btn_global_ps') {
			if (!isAdmin(interaction.user.id)) {
				return interaction.reply({ content: '❌ **AKSES DITOLAK!** Hanya Admin yang dapat mengedit Link Private World.', flags: MessageFlags.Ephemeral });
			}

			const { getGlobalPrivateServerUrl } = require('./panelManager');
			const currentPsUrl = getGlobalPrivateServerUrl();

			const modal = new ModalBuilder()
				.setCustomId('ap_modal_global_ps')
				.setTitle('LINK PRIVATE WORLD / SERVER TOKO');

			const psInput = new TextInputBuilder()
				.setCustomId('global_ps_url')
				.setLabel('URL LINK PRIVATE WORLD / SERVER (ROBLOX):')
				.setStyle(TextInputStyle.Paragraph)
				.setPlaceholder('Cth: https://www.roblox.com/games/share?code=... (kosongkan jika tidak ada)')
				.setValue(currentPsUrl || '')
				.setRequired(false);

			modal.addComponents(new ActionRowBuilder().addComponents(psInput));
			await interaction.showModal(modal);
			return true;
		}

		// Hapus Row Database Transaksi (ap_btn_deletedb_row)
		if (customId === 'ap_btn_deletedb_row') {
			if (!isAdmin(interaction.user.id)) {
				return interaction.reply({ content: '❌ **AKSES DITOLAK!** Hanya Admin yang dapat menghapus row database.', flags: MessageFlags.Ephemeral });
			}

			const modal = new ModalBuilder()
				.setCustomId('modal_delete_db_row')
				.setTitle('HAPUS ROW DATABASE TRANSAKSI');

			const orderIdInput = new TextInputBuilder()
				.setCustomId('target_order_id')
				.setLabel("MASUKKAN ORDER ID KHUSUS:")
				.setStyle(TextInputStyle.Short)
				.setPlaceholder("Cth: RBX_100-1546 atau SKIN_ENLIGHTENED-1AE2")
				.setRequired(true);

			const row = new ActionRowBuilder().addComponents(orderIdInput);
			modal.addComponents(row);

			await interaction.showModal(modal);
			return true;
		}

		// Kelola Admin GUI (Khusus Owner)
		if (customId === 'ap_btn_manageadmin') {
			if (!isOwner(interaction.user.id)) {
				return interaction.reply({ 
					content: '❌ **AKSES DITOLAK!** Hanya Owner Utama yang dapat mengelola Admin toko.', 
					flags: MessageFlags.Ephemeral 
				});
			}

			const btnAddAdmin = new ButtonBuilder()
				.setCustomId('ap_btn_addadmin_modal')
				.setLabel('➕ Angkat Admin Baru')
				.setStyle(ButtonStyle.Success);

			const btnDelAdmin = new ButtonBuilder()
				.setCustomId('ap_btn_deladmin_select')
				.setLabel('➖ Hapus Admin')
				.setStyle(ButtonStyle.Danger);

			const btnListAdmin = new ButtonBuilder()
				.setCustomId('ap_btn_listadmin')
				.setLabel('📋 Daftar Admin')
				.setStyle(ButtonStyle.Secondary);

			const row = new ActionRowBuilder().addComponents(btnAddAdmin, btnDelAdmin, btnListAdmin);

			return interaction.reply({
				content: '👑 **KELOLA HAK AKSES ADMIN TOKO:**\nPilih tindakan di bawah:',
				components: [row],
				flags: MessageFlags.Ephemeral
			});
		}

		// Modal Tambah Admin
		if (customId === 'ap_btn_addadmin_modal') {
			const modal = new ModalBuilder()
				.setCustomId('ap_modal_addadmin')
				.setTitle('➕ ANGKAT ADMIN SEKUNDER BARU');

			const userInput = new TextInputBuilder()
				.setCustomId('admin_user_input')
				.setLabel('DISCORD USER ID ATAU MENTION (@user):')
				.setStyle(TextInputStyle.Short)
				.setPlaceholder('Cth: 123456789012345678')
				.setRequired(true);

			modal.addComponents(new ActionRowBuilder().addComponents(userInput));
			return interaction.showModal(modal);
		}

		// Select Menu Hapus Admin
		if (customId === 'ap_btn_deladmin_select') {
			const admins = getAdmins();
			if (admins.length === 0) {
				return interaction.reply({ content: '❌ Belum ada Admin Sekunder yang terdaftar.', flags: MessageFlags.Ephemeral });
			}

			const selectMenu = new StringSelectMenuBuilder()
				.setCustomId('ap_select_deladmin')
				.setPlaceholder('-- Pilih Admin Yang Ingin Dicabut Aksesnya --');

			admins.forEach(admin => {
				selectMenu.addOptions(
					new StringSelectMenuOptionBuilder()
						.setLabel(admin.tag || admin.id)
						.setValue(admin.id)
						.setDescription(`ID: ${admin.id}`)
						.setEmoji('🚫')
				);
			});

			const row = new ActionRowBuilder().addComponents(selectMenu);
			return interaction.reply({ 
				content: '➖ **Pilih Admin yang ingin Anda cabut hak aksesnya:**', 
				components: [row], 
				flags: MessageFlags.Ephemeral 
			});
		}

		// List Admin
		if (customId === 'ap_btn_listadmin') {
			const ownerId = process.env.OWNER_DISCORD_ID ? process.env.OWNER_DISCORD_ID.trim() : null;
			const admins = getAdmins();

			let listText = `👑 **OWNER UTAMA:**\n> <@${ownerId || 'N/A'}>\n\n🛡️ **ADMIN SEKUNDER (${admins.length}):**\n`;
			if (admins.length === 0) {
				listText += `> *Belum ada Admin sekunder.*`;
			} else {
				admins.forEach((admin, i) => {
					listText += `> ${i + 1}. <@${admin.id}> (\`${admin.id}\`)\n`;
				});
			}

			return interaction.reply({ content: listText, flags: MessageFlags.Ephemeral });
		}
	}

	// ==========================================
	// 2. SELECT MENU INTERACTIONS (ap_select_... & ap_checkbox_...)
	// ==========================================
	if (interaction.isStringSelectMenu()) {
		// Select Menu Pilih Kategori Item
		if (customId.startsWith('ap_select_item_cat_')) {
			const itemId = customId.replace('ap_select_item_cat_', '');
			const selectedCategory = interaction.values[0];

			const { items, itemsFilePath } = getItemsData();
			const item = items.find(i => i.id === itemId);

			if (!item) {
				return interaction.reply({ content: '❌ Item tidak ditemukan.', flags: MessageFlags.Ephemeral });
			}

			if (selectedCategory === 'NEW_CATEGORY') {
				const modal = new ModalBuilder()
					.setCustomId(`ap_modal_newcat_${item.id}`)
					.setTitle('➕ NAMA KATEGORI BARU');

				const newCatInput = new TextInputBuilder()
					.setCustomId('new_cat_name')
					.setLabel('NAMA KATEGORI BARU (cth: Gamepass, Items):')
					.setStyle(TextInputStyle.Short)
					.setRequired(true);

				modal.addComponents(new ActionRowBuilder().addComponents(newCatInput));
				return interaction.showModal(modal);
			}

			item.category = selectedCategory;
			saveItemsData(items, itemsFilePath);
			updateGlobalPanel(client);

			const embed = buildItemDetailEmbed(item, 'SETTING KATEGORI DIPERBARUI');
			const components = getItemSettingComponents(item);

			return interaction.update({ embeds: [embed], components: components });
		}

		// Checkbox Select Menu Options Handler
		if (customId.startsWith('ap_checkbox_opts_')) {
			const itemId = customId.replace('ap_checkbox_opts_', '');
			const selectedValues = interaction.values;

			const { items, itemsFilePath } = getItemsData();
			const item = items.find(i => i.id === itemId);

			if (!item) {
				return interaction.reply({ content: '❌ Item tidak ditemukan.', flags: MessageFlags.Ephemeral });
			}

			const isHeld = selectedValues.includes('req_hold');
			item.requireUsername = selectedValues.includes('req_username');
			item.requireLimitCheck = selectedValues.includes('req_limit');
			item.usePrivateServer = selectedValues.includes('req_ps');
			item.available = !isHeld;
			item.hold = isHeld;

			saveItemsData(items, itemsFilePath);
			updateGlobalPanel(client);

			const embed = buildItemDetailEmbed(item, 'SETTING CHECKBOX DIPERBARUI');
			const components = getItemSettingComponents(item);

			return interaction.update({ embeds: [embed], components: components });
		}

		// Step 2: Tampilkan Dropdown Produk Dalam Kategori Terpilih
		if (customId === 'ap_select_cat_for_edit') {
			const selectedVal = interaction.values[0];
			const { items } = getItemsData();

			let filteredItems = items;
			let catTitle = 'SELURUH MENU';

			if (selectedVal !== 'CAT_ALL') {
				const targetCat = selectedVal.replace('CAT_', '');
				filteredItems = items.filter(i => (i.category || 'General').toLowerCase() === targetCat.toLowerCase());
				catTitle = targetCat.toUpperCase();
			}

			if (filteredItems.length === 0) {
				return interaction.update({ content: `❌ Tidak ada produk di kategori ${catTitle}.`, components: [] });
			}

			const selectMenu = new StringSelectMenuBuilder()
				.setCustomId('ap_select_edititem')
				.setPlaceholder(`-- Langkah 2: Pilih Produk ${catTitle} --`);

			filteredItems.slice(0, 25).forEach(item => {
				const isHeld = item.available === false || item.hold === true;
				selectMenu.addOptions(
					new StringSelectMenuOptionBuilder()
						.setLabel(`${item.name}`.substring(0, 50))
						.setValue(item.id)
						.setDescription(`${isHeld ? '⛔ DITAHAN • ' : ''}Rp ${(item.price || 0).toLocaleString('id-ID')} • ${item.category || 'General'}`)
						.setEmoji(getItemEmoji(item) || '📦')
				);
			});

			const row = new ActionRowBuilder().addComponents(selectMenu);
			return interaction.update({
				content: `📁 **KATEGORI TERPILIH: ${catTitle}** (${filteredItems.length} Produk)\nSilakan pilih **Produk / Menu** yang ingin Anda ubah/edit dari menu dropdown di bawah:`,
				components: [row]
			});
		}

		// Step 3: Tampilkan Control Panel Detail Item Yang Dipilih
		if (customId === 'ap_select_edititem') {
			const selectedItemId = interaction.values[0];
			const { items } = getItemsData();
			const item = items.find(i => i.id === selectedItemId);

			if (!item) {
				return interaction.reply({ content: '❌ Item tidak ditemukan.', flags: MessageFlags.Ephemeral });
			}

			const embed = buildItemDetailEmbed(item, 'EDIT PRODUK');
			const components = getItemSettingComponents(item);

			return interaction.update({
				content: null,
				embeds: [embed],
				components: components
			});
		}

		// Hapus Item Action
		if (customId === 'ap_select_delitem') {
			const selectedItemId = interaction.values[0];
			const { items, itemsFilePath } = getItemsData();
			const itemIndex = items.findIndex(i => i.id === selectedItemId);

			if (itemIndex === -1) {
				return interaction.reply({ content: '❌ Item tidak ditemukan.', flags: MessageFlags.Ephemeral });
			}

			const deletedItem = items.splice(itemIndex, 1)[0];
			saveItemsData(items, itemsFilePath);
			updateGlobalPanel(client);

			const embed = new EmbedBuilder()
				.setTitle('🗑️  ITEM BERHASIL DIHAPUS')
				.setColor(0xED4245)
				.setDescription(`Berhasil menghapus item **${deletedItem.name}** (\`${deletedItem.id}\`) dari katalog toko!`)
				.setTimestamp();

			return interaction.update({ content: null, embeds: [embed], components: [] });
		}

		// Select Menu Edit Kategori (Tampilkan Card GUI Pengaturan Kategori)
		if (customId === 'ap_select_editcat') {
			const catName = interaction.values[0];
			const { embed, components } = buildCategorySettingEmbedAndComponents(catName);
			return interaction.reply({ embeds: [embed], components: components, flags: MessageFlags.Ephemeral });
		}

		// Hapus Kategori Action
		if (customId === 'ap_select_delcat') {
			const targetCategory = interaction.values[0];
			const { items, itemsFilePath } = getItemsData();

			const remainingItems = items.filter(i => (i.category || 'General').toLowerCase() !== targetCategory.toLowerCase());
			const deletedCount = items.length - remainingItems.length;

			saveItemsData(remainingItems, itemsFilePath);
			updateGlobalPanel(client);

			const embed = new EmbedBuilder()
				.setTitle('🗑️  KATEGORI BERHASIL DIHAPUS')
				.setColor(0xED4245)
				.setDescription(`Berhasil menghapus kategori **${targetCategory}** beserta **${deletedCount} item** di dalamnya dari katalog toko!`)
				.setTimestamp();

			return interaction.update({ content: null, embeds: [embed], components: [] });
		}

		// Hapus Admin Action
		if (customId === 'ap_select_deladmin') {
			const adminId = interaction.values[0];
			const result = removeAdmin(adminId);

			if (result.success) {
				return interaction.update({ content: `✅ Beri akses Admin untuk <@${adminId}> (\`${adminId}\`) **berhasil dicabut!**`, components: [] });
			} else {
				return interaction.update({ content: `❌ Gagal mencabut akses admin: ${result.message}`, components: [] });
			}
		}
	}

	// ==========================================
	// 3. MODAL SUBMISSIONS (ap_modal_...)
	// ==========================================
	if (interaction.isModalSubmit()) {
		// Submit Tambah Kategori Baru untuk Item
		if (customId.startsWith('ap_modal_newcat_')) {
			const itemId = customId.replace('ap_modal_newcat_', '');
			const newCatName = interaction.fields.getTextInputValue('new_cat_name').trim() || 'General';

			const { items, itemsFilePath } = getItemsData();
			const item = items.find(i => i.id === itemId);

			if (!item) {
				return interaction.reply({ content: '❌ Item tidak ditemukan.', flags: MessageFlags.Ephemeral });
			}

			item.category = newCatName;
			saveItemsData(items, itemsFilePath);
			updateGlobalPanel(client);

			const embed = buildItemDetailEmbed(item, 'KATEGORI BARU DITAMBAHKAN');
			const components = getItemSettingComponents(item);

			return interaction.reply({ embeds: [embed], components: components, flags: MessageFlags.Ephemeral });
		}

		// Modal Submit Hapus Row Database
		if (customId === 'modal_delete_db_row') {
			if (!isAdmin(interaction.user.id)) {
				return interaction.reply({ content: '❌ **AKSES DITOLAK!** Hanya Admin yang dapat menghapus row database.', flags: MessageFlags.Ephemeral });
			}

			const targetOrderId = interaction.fields.getTextInputValue('target_order_id').trim().toUpperCase();
			const { getPurchaseById, deletePurchaseById } = require('./supabase');
			const purchase = await getPurchaseById(targetOrderId);

			if (!purchase) {
				return interaction.reply({
					content: `❌ **ORDER ID TIDAK DITEMUKAN!** Data transaksi dengan Order ID \`${targetOrderId}\` tidak terdaftar di database.`,
					flags: MessageFlags.Ephemeral
				});
			}

			const success = await deletePurchaseById(targetOrderId);

			if (success) {
				updateGlobalPanel(client);

				return interaction.reply({
					content: 
						`✅ **ROW TRANSAKSI BERHASIL DIHAPUS DARI DATABASE!**\n\n` +
						`🆔 **Order ID:** \`${targetOrderId}\`\n` +
						`👤 **Roblox / Buyer:** \`${purchase.roblox_username || purchase.discord_username || 'N/A'}\`\n` +
						`📦 **Item:** \`${purchase.item_name}\`\n` +
						`💰 **Harga:** Rp ${(purchase.price || 0).toLocaleString('id-ID')}\n` +
						`📌 **Status:** \`${purchase.status}\`\n\n` +
						`Data transaksi ini telah terhapus permanen dari database (SQLite/Supabase).`,
					flags: MessageFlags.Ephemeral
				});
			} else {
				return interaction.reply({
					content: `❌ **GAGAL MENGHAPUS!** Terjadi kesalahan saat menghapus data \`${targetOrderId}\` dari database.`,
					flags: MessageFlags.Ephemeral
				});
			}
		}

		// Submit Global Link Private World / Server
		if (customId === 'ap_modal_global_ps') {
			if (!isAdmin(interaction.user.id)) {
				return interaction.reply({ content: '❌ **AKSES DITOLAK!** Hanya Admin yang dapat mengedit Link Private World.', flags: MessageFlags.Ephemeral });
			}

			const psUrl = interaction.fields.getTextInputValue('global_ps_url').trim();
			const { setGlobalPrivateServerUrl } = require('./panelManager');

			setGlobalPrivateServerUrl(psUrl);

			const displayStatus = psUrl !== '' 
				? `\n\n🌐 **URL Aktif saat ini:**\n\`${psUrl}\`` 
				: '\n\n⚠️ **URL saat ini dikosongkan.**';

			return interaction.reply({
				content: `✅ **LINK PRIVATE WORLD TOKO BERHASIL DIPERBARUI!**${displayStatus}\n\n*Produk yang dicentang "🌐 Gunakan Private World Toko" akan menampilkan link ini ke pembeli.*`,
				flags: MessageFlags.Ephemeral
			});
		}

		// Submit Tambah Item
		if (customId === 'ap_modal_additem') {
			const id = interaction.fields.getTextInputValue('add_id').trim().toLowerCase().replace(/\s+/g, '_');
			const name = interaction.fields.getTextInputValue('add_name').trim();
			const price = parseInt(interaction.fields.getTextInputValue('add_price').trim(), 10) || 0;
			const notes = interaction.fields.getTextInputValue('add_notes').trim();

			const { items, itemsFilePath } = getItemsData();
			if (items.some(i => i.id === id)) {
				return interaction.reply({ content: `❌ ID Item \`${id}\` sudah ada. Gunakan ID lain.`, flags: MessageFlags.Ephemeral });
			}

			const existingCategories = [...new Set(items.map(i => i.category || 'General'))];
			const defaultCategory = existingCategories[0] || 'Robux';

			const isRobuxCategory = defaultCategory.toLowerCase().includes('robux');
			const newItem = {
				id: id,
				name: name,
				price: price,
				category: defaultCategory,
				description: 'Produk Bebey Store',
				emoji: '',
				requireUsername: true,
				requireLimitCheck: isRobuxCategory
			};
			if (notes) newItem.notes = notes;

			items.push(newItem);
			saveItemsData(items, itemsFilePath);
			updateGlobalPanel(client);

			const embed = buildItemDetailEmbed(newItem, 'ITEM BARU DITAMBAHKAN');
			const components = getItemSettingComponents(newItem);

			return interaction.reply({ embeds: [embed], components: components, flags: MessageFlags.Ephemeral });
		}

		// Submit Edit Item
		if (customId.startsWith('ap_modal_edititem_')) {
			const itemId = customId.replace('ap_modal_edititem_', '');
			const name = interaction.fields.getTextInputValue('edit_name').trim();
			const price = parseInt(interaction.fields.getTextInputValue('edit_price').trim(), 10) || 0;
			const notes = interaction.fields.getTextInputValue('edit_notes').trim();

			const { items, itemsFilePath } = getItemsData();
			const item = items.find(i => i.id === itemId);

			if (!item) {
				return interaction.reply({ content: '❌ Item tidak ditemukan.', flags: MessageFlags.Ephemeral });
			}

			item.name = name;
			item.price = price;

			if (notes) {
				item.notes = notes;
			} else {
				delete item.notes;
			}

			saveItemsData(items, itemsFilePath);
			updateGlobalPanel(client);

			const embed = buildItemDetailEmbed(item, 'DETAIL ITEM DIPERBARUI');
			const components = getItemSettingComponents(item);

			return interaction.reply({ embeds: [embed], components: components, flags: MessageFlags.Ephemeral });
		}

		// Submit Edit Link Private World / Server
		if (customId.startsWith('ap_modal_edit_ps_')) {
			const itemId = customId.replace('ap_modal_edit_ps_', '');
			const psUrl = interaction.fields.getTextInputValue('edit_ps_url').trim();

			const { items, itemsFilePath } = getItemsData();
			const item = items.find(i => i.id === itemId);

			if (!item) {
				return interaction.reply({ content: '❌ Item tidak ditemukan.', flags: MessageFlags.Ephemeral });
			}

			if (psUrl !== '') {
				item.privateServerUrl = psUrl;
			} else {
				delete item.privateServerUrl;
			}

			saveItemsData(items, itemsFilePath);
			updateGlobalPanel(client);

			const embed = buildItemDetailEmbed(item, 'LINK PRIVATE WORLD DIPERBARUI');
			const components = getItemSettingComponents(item);

			return interaction.update({ embeds: [embed], components: components });
		}

		// Submit Edit Kategori
		if (customId.startsWith('ap_modal_editcat_')) {
			const oldCat = customId.replace('ap_modal_editcat_', '');
			const newCat = interaction.fields.getTextInputValue('new_cat_name').trim();

			const { items, itemsFilePath } = getItemsData();
			let count = 0;
			items.forEach(i => {
				if ((i.category || 'General').toLowerCase() === oldCat.toLowerCase()) {
					i.category = newCat;
					count++;
				}
			});

			saveItemsData(items, itemsFilePath);
			updateGlobalPanel(client);

			const embed = new EmbedBuilder()
				.setTitle('✏️  NAMA KATEGORI BERHASIL DIUBAH')
				.setColor(0x2ECC71)
				.setDescription(`Berhasil mengubah nama kategori **${oldCat}** menjadi **${newCat}** (${count} item ter-update)!`)
				.setTimestamp();

			return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
		}

		// Submit Export Laporan Excel
		if (customId === 'ap_modal_exportreport') {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });

			const month = parseInt(interaction.fields.getTextInputValue('report_month').trim(), 10);
			const year = parseInt(interaction.fields.getTextInputValue('report_year').trim(), 10);

			if (isNaN(month) || month < 1 || month > 12 || isNaN(year) || year < 2000) {
				return interaction.editReply({ content: '❌ Bulan harus berupa angka 1-12 dan Tahun berupa 4 digit (cth: 2026).' });
			}

			const { sendMonthlyReport } = require('./reportManager');
			const result = await sendMonthlyReport(client, interaction.channelId, year, month);

			if (!result || result.totalTransactions === 0) {
				return interaction.editReply({ content: `⚠️ Tidak ada data transaksi terverifikasi (fulfilled) untuk bulan **${month}/${year}**.` });
			}

			return interaction.editReply({
				content: `✅ **Laporan Excel Penjualan Periode ${result.monthName} ${result.year} berhasil dibuat & dikirim ke channel ini!**\n` +
					`└ Total: **${result.totalTransactions} Transaksi** | Total Omset: **Rp ${result.totalRevenue.toLocaleString('id-ID')}**`
			});
		}

		// Submit Tambah Admin
		if (customId === 'ap_modal_addadmin') {
			const userInput = interaction.fields.getTextInputValue('admin_user_input').trim();
			const userId = userInput.replace(/[<@!>]/g, '');

			try {
				const user = await client.users.fetch(userId);
				if (!user) {
					return interaction.reply({ content: '❌ User Discord tidak ditemukan.', flags: MessageFlags.Ephemeral });
				}

				const result = addAdmin(user.id, user.tag);
				if (result.success) {
					return interaction.reply({ 
						content: `✅ User ${user} (\`${user.id}\`) **berhasil diangkat menjadi Admin Sekunder Bebey Store!**`, 
						flags: MessageFlags.Ephemeral 
					});
				} else {
					return interaction.reply({ content: `⚠️ ${result.message}`, flags: MessageFlags.Ephemeral });
				}
			} catch (err) {
				return interaction.reply({ content: '❌ Gagal menemukan User Discord dengan ID/mention tersebut.', flags: MessageFlags.Ephemeral });
			}
		}
	}
}

module.exports = {
	handleAdminPanelInteraction,
	buildItemCategorySelectMenu,
	buildItemCheckboxMenu,
	buildItemDoneButton,
	buildItemDetailEmbed,
	getItemSettingComponents
};
