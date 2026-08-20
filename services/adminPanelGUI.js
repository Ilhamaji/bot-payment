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
const { setCategoryEmoji, getCategoryEmoji, getItemEmoji, savePanelLocation, saveLeaderboardLocation, updateGlobalPanel } = require('./panelManager');

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

function buildItemCheckboxMenu(item) {
	const selectMenu = new StringSelectMenuBuilder()
		.setCustomId(`ap_checkbox_opts_${item.id}`)
		.setPlaceholder('☑️ Centang Opsi Setting (Bisa pilih lebih dari 1)')
		.setMinValues(0)
		.setMaxValues(2)
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
				.setDefault(item.requireLimitCheck !== false)
		);

	return new ActionRowBuilder().addComponents(selectMenu);
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

			const categoryInput = new TextInputBuilder()
				.setCustomId('add_category')
				.setLabel('KATEGORI (cth: Robux, Gamepass):')
				.setStyle(TextInputStyle.Short)
				.setValue('Robux')
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
				new ActionRowBuilder().addComponents(categoryInput),
				new ActionRowBuilder().addComponents(notesInput)
			);

			return interaction.showModal(modal);
		}

		// Select Menu Edit Item
		if (customId === 'ap_btn_edititem') {
			const { items } = getItemsData();
			if (items.length === 0) {
				return interaction.reply({ content: '❌ Belum ada item di katalog toko.', flags: MessageFlags.Ephemeral });
			}

			const selectMenu = new StringSelectMenuBuilder()
				.setCustomId('ap_select_edititem')
				.setPlaceholder('-- Pilih Item Yang Ingin Diedit --');

			items.slice(0, 25).forEach(item => {
				selectMenu.addOptions(
					new StringSelectMenuOptionBuilder()
						.setLabel(`${item.name}`.substring(0, 50))
						.setValue(item.id)
						.setDescription(`Rp ${(item.price || 0).toLocaleString('id-ID')} • ${item.category || 'General'}`)
						.setEmoji(getItemEmoji(item) || '📦')
				);
			});

			const row = new ActionRowBuilder().addComponents(selectMenu);
			return interaction.reply({ 
				content: '✏️ **Pilih produk yang ingin Anda ubah/edit dari katalog:**', 
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

		// Modal Export Laporan
		if (customId === 'ap_btn_exportreport') {
			const modal = new ModalBuilder()
				.setCustomId('ap_modal_exportreport')
				.setTitle('📊 EXPORT LAPORAN PENJUALAN EXCEL');

			const now = new Date();
			const currentMonth = String(now.getMonth() + 1);
			const currentYear = String(now.getFullYear());

			const monthInput = new TextInputBuilder()
				.setCustomId('report_month')
				.setLabel('BULAN (1 - 12):')
				.setStyle(TextInputStyle.Short)
				.setValue(currentMonth)
				.setRequired(true);

			const yearInput = new TextInputBuilder()
				.setCustomId('report_year')
				.setLabel('TAHUN (YYYY):')
				.setStyle(TextInputStyle.Short)
				.setValue(currentYear)
				.setRequired(true);

			modal.addComponents(
				new ActionRowBuilder().addComponents(monthInput),
				new ActionRowBuilder().addComponents(yearInput)
			);

			return interaction.showModal(modal);
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
		// Checkbox Select Menu Options Handler
		if (customId.startsWith('ap_checkbox_opts_')) {
			const itemId = customId.replace('ap_checkbox_opts_', '');
			const selectedValues = interaction.values;

			const { items, itemsFilePath } = getItemsData();
			const item = items.find(i => i.id === itemId);

			if (!item) {
				return interaction.reply({ content: '❌ Item tidak ditemukan.', flags: MessageFlags.Ephemeral });
			}

			item.requireUsername = selectedValues.includes('req_username');
			item.requireLimitCheck = selectedValues.includes('req_limit');

			saveItemsData(items, itemsFilePath);
			updateGlobalPanel(client);

			const reqUserLabel = item.requireUsername ? '`✅ Ya (Wajib Username)`' : '`❌ Tidak Perlu`';
			const reqLimitLabel = item.requireLimitCheck ? '`✅ Ya (Cek Limit)`' : '`❌ Tidak Perlu`';

			const updatedEmbed = new EmbedBuilder()
				.setTitle('⚙️  SETTING CHECKBOX ITEM DIPERBARUI')
				.setColor(0x2ECC71)
				.setDescription(`Berhasil memperbarui opsi centang (checkbox) untuk item **${item.name}**!`)
				.addFields(
					{ name: '👤 Username Roblox', value: reqUserLabel, inline: true },
					{ name: '🔍 Cek Limit Roblox', value: reqLimitLabel, inline: true }
				)
				.setTimestamp();

			const newCheckboxRow = buildItemCheckboxMenu(item);
			return interaction.update({ embeds: [updatedEmbed], components: [newCheckboxRow] });
		}

		// Edit Item Modal Launcher
		if (customId === 'ap_select_edititem') {
			const selectedItemId = interaction.values[0];
			const { items } = getItemsData();
			const item = items.find(i => i.id === selectedItemId);

			if (!item) {
				return interaction.reply({ content: '❌ Item tidak ditemukan.', flags: MessageFlags.Ephemeral });
			}

			const modal = new ModalBuilder()
				.setCustomId(`ap_modal_edititem_${item.id}`)
				.setTitle(`EDIT ITEM: ${item.name.substring(0, 20)}`);

			const nameInput = new TextInputBuilder()
				.setCustomId('edit_name')
				.setLabel('NAMA ITEM:')
				.setStyle(TextInputStyle.Short)
				.setValue(item.name || '')
				.setRequired(true);

			const priceInput = new TextInputBuilder()
				.setCustomId('edit_price')
				.setLabel('HARGA (RUPIAH):')
				.setStyle(TextInputStyle.Short)
				.setValue(String(item.price || 0))
				.setRequired(true);

			const categoryInput = new TextInputBuilder()
				.setCustomId('edit_category')
				.setLabel('KATEGORI:')
				.setStyle(TextInputStyle.Short)
				.setValue(item.category || 'General')
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
				new ActionRowBuilder().addComponents(categoryInput),
				new ActionRowBuilder().addComponents(notesInput)
			);

			return interaction.showModal(modal);
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

		// Edit Kategori Modal Launcher
		if (customId === 'ap_select_editcat') {
			const oldCategory = interaction.values[0];
			const modal = new ModalBuilder()
				.setCustomId(`ap_modal_editcat_${oldCategory}`)
				.setTitle(`EDIT KATEGORI: ${oldCategory.substring(0, 20)}`);

			const newCatInput = new TextInputBuilder()
				.setCustomId('new_cat_name')
				.setLabel('NAMA KATEGORI BARU:')
				.setStyle(TextInputStyle.Short)
				.setValue(oldCategory)
				.setRequired(true);

			modal.addComponents(new ActionRowBuilder().addComponents(newCatInput));
			return interaction.showModal(modal);
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
		// Submit Tambah Item
		if (customId === 'ap_modal_additem') {
			const id = interaction.fields.getTextInputValue('add_id').trim().toLowerCase().replace(/\s+/g, '_');
			const name = interaction.fields.getTextInputValue('add_name').trim();
			const price = parseInt(interaction.fields.getTextInputValue('add_price').trim(), 10) || 0;
			const category = interaction.fields.getTextInputValue('add_category').trim() || 'Robux';
			const notes = interaction.fields.getTextInputValue('add_notes').trim();

			const { items, itemsFilePath } = getItemsData();
			if (items.some(i => i.id === id)) {
				return interaction.reply({ content: `❌ ID Item \`${id}\` sudah ada. Gunakan ID lain.`, flags: MessageFlags.Ephemeral });
			}

			const isRobuxCategory = category.toLowerCase().includes('robux');
			const newItem = {
				id: id,
				name: name,
				price: price,
				category: category,
				description: 'Produk Bebey Store',
				emoji: '',
				requireUsername: true,
				requireLimitCheck: isRobuxCategory
			};
			if (notes) newItem.notes = notes;

			items.push(newItem);
			saveItemsData(items, itemsFilePath);
			updateGlobalPanel(client);

			const embed = new EmbedBuilder()
				.setTitle('➕  ITEM DITAMBAHKAN — SILAKAN ATUR CHECKBOX OPSI')
				.setColor(0x2ECC71)
				.setDescription(
					`Berhasil menambahkan **${name}** ke katalog toko!\n\n` +
					`👇 **Gunakan Menu Centang (Checkbox) di bawah untuk memilih setting item:**`
				)
				.addFields(
					{ name: 'ID Item', value: `\`${id}\``, inline: true },
					{ name: 'Harga', value: `**Rp ${price.toLocaleString('id-ID')}**`, inline: true },
					{ name: 'Kategori', value: `\`${category}\``, inline: true }
				)
				.setTimestamp();

			const checkboxRow = buildItemCheckboxMenu(newItem);
			return interaction.reply({ embeds: [embed], components: [checkboxRow], flags: MessageFlags.Ephemeral });
		}

		// Submit Edit Item
		if (customId.startsWith('ap_modal_edititem_')) {
			const itemId = customId.replace('ap_modal_edititem_', '');
			const name = interaction.fields.getTextInputValue('edit_name').trim();
			const price = parseInt(interaction.fields.getTextInputValue('edit_price').trim(), 10) || 0;
			const category = interaction.fields.getTextInputValue('edit_category').trim() || 'General';
			const notes = interaction.fields.getTextInputValue('edit_notes').trim();

			const { items, itemsFilePath } = getItemsData();
			const item = items.find(i => i.id === itemId);

			if (!item) {
				return interaction.reply({ content: '❌ Item tidak ditemukan.', flags: MessageFlags.Ephemeral });
			}

			item.name = name;
			item.price = price;
			item.category = category;

			if (notes) {
				item.notes = notes;
			} else {
				delete item.notes;
			}

			saveItemsData(items, itemsFilePath);
			updateGlobalPanel(client);

			const embed = new EmbedBuilder()
				.setTitle('✏️  DETAIL ITEM DISIMPAN — SILAKAN ATUR CHECKBOX OPSI')
				.setColor(0x2ECC71)
				.setDescription(
					`Berhasil menyimpan perubahan nama & harga item **${name}**!\n\n` +
					`👇 **Gunakan Menu Centang (Checkbox) di bawah untuk mengubah setting item:**`
				)
				.setTimestamp();

			const checkboxRow = buildItemCheckboxMenu(item);
			return interaction.reply({ embeds: [embed], components: [checkboxRow], flags: MessageFlags.Ephemeral });
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

			const { fetchMonthlyTransactions, generateExcelBuffer, buildReportEmbedSummary } = require('./reportManager');
			const transactions = await fetchMonthlyTransactions(year, month);

			if (!transactions || transactions.length === 0) {
				return interaction.editReply({ content: `⚠️ Tidak ada data transaksi terverifikasi (fulfilled) untuk bulan **${month}/${year}**.` });
			}

			const excelBuffer = await generateExcelBuffer(year, month, transactions);
			const summaryEmbed = buildReportEmbedSummary(year, month, transactions);

			const fileName = `Laporan_Penjualan_BebeyStore_${year}_${String(month).padStart(2, '0')}.xlsx`;
			const attachment = new AttachmentBuilder(excelBuffer, { name: fileName });

			return interaction.editReply({
				content: `✅ **Laporan Penjualan Excel Berhasil Dibuat!**`,
				embeds: [summaryEmbed],
				files: [attachment]
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
				return interaction.reply({ content: '❌ Gagal menemukan User Discord dengan ID/mention meggunakan ID/mention tersebut.', flags: MessageFlags.Ephemeral });
			}
		}
	}
}

module.exports = {
	handleAdminPanelInteraction,
	buildItemCheckboxMenu
};
