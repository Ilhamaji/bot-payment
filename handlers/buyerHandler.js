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
	MessageFlags 
} = require('discord.js');
const { 
	userEphemeralInteractions, 
	ticketCreationInteractions, 
	buyerPendingProofs, 
	qrisMessages, 
	cartMessages,
	disableQrisButtonForOrder, 
	deleteTicketCreationMessage, 
	buildQrisPaymentEmbed, 
	createTicketChannel, 
	deleteAdminChannelMessagesForOrder,
	getCart,
	addItemToCart,
	buildCartEmbedAndComponents,
	buildQrisPaymentEmbedForCart
} = require('../services/ticketManager');
const { validateRobloxUsername, getRobloxAvatarHeadshot } = require('../services/roblox');
const { supabase, getPurchaseById, updatePurchaseStatus, updateRobloxUsername } = require('../services/supabase');
const { isAdmin } = require('../services/admins');

function getPanelManager() {
	return require('../services/panelManager');
}

const draftCarts = new Map();

function getDraftCart(userId) {
	return draftCarts.get(userId) || null;
}

function initDraftCart(userId, robloxCheck, item, quantity = 1) {
	const itemQty = Math.max(1, parseInt(quantity) || 1);
	const initialItem = {
		id: item.id,
		name: item.name,
		price: Number(item.price || 0),
		emoji: item.emoji || '📦',
		category: item.category,
		quantity: itemQty,
		subtotal: Number(item.price || 0) * itemQty,
		itemObj: item
	};

	const draft = {
		userId: userId,
		robloxData: robloxCheck,
		robloxUsername: (typeof robloxCheck === 'object' && robloxCheck !== null) ? robloxCheck.username : String(robloxCheck),
		items: [initialItem]
	};

	draftCarts.set(userId, draft);
	return draft;
}

function addItemToDraftCart(userId, item, quantity = 1) {
	const draft = draftCarts.get(userId);
	if (!draft) return null;

	const itemQty = Math.max(1, parseInt(quantity) || 1);
	const existingIndex = draft.items.findIndex(i => i.id === item.id);

	if (existingIndex >= 0) {
		draft.items[existingIndex].quantity += itemQty;
		draft.items[existingIndex].subtotal = draft.items[existingIndex].price * draft.items[existingIndex].quantity;
	} else {
		draft.items.push({
			id: item.id,
			name: item.name,
			price: Number(item.price || 0),
			emoji: item.emoji || '📦',
			category: item.category,
			quantity: itemQty,
			subtotal: Number(item.price || 0) * itemQty,
			itemObj: item
		});
	}

	draftCarts.set(userId, draft);
	return draft;
}

function removeItemFromDraftCart(userId, itemId, reduceQty = 1) {
	const draft = draftCarts.get(userId);
	if (!draft) return null;

	const index = draft.items.findIndex(i => i.id === itemId);
	if (index >= 0) {
		const item = draft.items[index];
		if (item.quantity > reduceQty) {
			item.quantity -= reduceQty;
			item.subtotal = item.price * item.quantity;
		} else {
			draft.items.splice(index, 1);
		}
	}

	draftCarts.set(userId, draft);
	return draft;
}

async function sendPsGuideEmbedIfNeeded(interaction, orderId) {
	delete require.cache[require.resolve('../config/items')];
	const catalogItems = require('../config/items');
	const purchase = await getPurchaseById(orderId);

	let selectedItem = null;
	if (purchase) {
		selectedItem = catalogItems.find(i => i.name && i.name.toLowerCase() === purchase.item_name.toLowerCase());
	}

	const { getGlobalPrivateServerUrl } = require('../services/panelManager');
	const globalPsUrl = getGlobalPrivateServerUrl();
	const isPsEnabled = selectedItem && selectedItem.usePrivateServer === true;
	const activePsUrl = (isPsEnabled && globalPsUrl && globalPsUrl.trim() !== '') 
		? globalPsUrl.trim() 
		: (selectedItem && selectedItem.privateServerUrl ? selectedItem.privateServerUrl.trim() : '');

	if (activePsUrl && activePsUrl !== '') {
		const psGuideEmbed = new EmbedBuilder()
			.setTitle('🌐  PANDUAN TRANSAKSI PRIVATE WORLD / SERVER')
			.setColor(0x9B59B6)
			.setDescription(
				`🎮 **CARA BERTRANSAKSI MENGGUNAKAN PRIVATE WORLD TOKO:**\n\n` +
				`1️⃣ **Masuk Ke Server**: Klik tombol **"🌐 Masuk Private World"** di bawah ini.\n` +
				`2️⃣ **Otomatis Ke Game**: Aplikasi Roblox kamu akan langsung membuka Private Server resmi Bebey Store.\n` +
				`3️⃣ **Temu Admin / Trade**: Temui Admin di dalam server atau lakukan proses Trade/Give item sesuai pesanan kamu.\n` +
				`4️⃣ **Selesai**: Setelah transaksi di game selesai, Admin akan memverifikasi dan mengirimkan bukti pengiriman di tiket ini.\n\n` +
				`🔗 **Link Direct Private Server:**\n[🚀 Klik Di Sini Untuk Masuk Ke Private World](${activePsUrl})`
			)
			.setTimestamp()
			.setFooter({ text: `💖 Bebey Store Official • ${orderId}` });

		const psGuideBtn = new ButtonBuilder()
			.setLabel('🌐 Masuk Private World')
			.setStyle(ButtonStyle.Link)
			.setURL(activePsUrl);

		const psGuideRow = new ActionRowBuilder().addComponents(psGuideBtn);

		await interaction.channel.send({ embeds: [psGuideEmbed], components: [psGuideRow] });
	}
}

function buildAddItemCategoryComponents(selectedCatName = null) {
	delete require.cache[require.resolve('../config/items')];
	const currentItems = require('../config/items');

	// Filter HANYA kategori yang mode keranjangnya diaktifkan (allowQuantity === true)
	const allCategories = [...new Set(currentItems.map(i => i.category || 'General'))];
	const allowedCategories = allCategories.filter(cat => getPanelManager().isCategoryQuantityAllowed(cat));

	const targetCategories = allowedCategories.length > 0 ? allowedCategories : allCategories;
	const activeCategory = (selectedCatName && targetCategories.some(c => c.toLowerCase() === selectedCatName.toLowerCase()))
		? selectedCatName
		: (targetCategories[0] || 'General');

	const categoryOptions = targetCategories.map(cat => {
		const catEmoji = getPanelManager().getCategoryEmoji(cat);
		return new StringSelectMenuOptionBuilder()
			.setLabel(`Kategori: ${cat}`)
			.setValue(cat)
			.setEmoji(catEmoji || '📁')
			.setDefault(cat.toLowerCase() === activeCategory.toLowerCase());
	});

	const catSelectMenu = new StringSelectMenuBuilder()
		.setCustomId('preticket_select_category')
		.setPlaceholder(`📁 Pilih Kategori Sub-Menu (${activeCategory})...`)
		.addOptions(categoryOptions.slice(0, 25));

	const filteredItems = currentItems.filter(i => (i.category || 'General').toLowerCase() === activeCategory.toLowerCase());

	const itemOptions = filteredItems.slice(0, 25).map(item => {
		const isHeld = item.available === false || item.hold === true;
		const itemEmoji = item.emoji || '📦';
		return new StringSelectMenuOptionBuilder()
			.setLabel(isHeld ? `⛔ ${item.name} (Ditahan)` : `${item.name}`)
			.setValue(item.id)
			.setDescription(`Rp ${(item.price || 0).toLocaleString('id-ID')} • ${activeCategory}`)
			.setEmoji(itemEmoji);
	});

	const itemSelectMenu = new StringSelectMenuBuilder()
		.setCustomId('preticket_select_added_item')
		.setPlaceholder(`➕ Pilih Item dari Kategori "${activeCategory}"...`)
		.addOptions(itemOptions.length > 0 ? itemOptions : [
			new StringSelectMenuOptionBuilder().setLabel('Tidak ada item di kategori ini').setValue('empty').setDisabled(true)
		]);

	const btnCancelAdd = new ButtonBuilder()
		.setCustomId('preticket_cancel_add_item')
		.setLabel('↩️ Kembali ke Keranjang')
		.setStyle(ButtonStyle.Secondary);

	const row1 = new ActionRowBuilder().addComponents(catSelectMenu);
	const row2 = new ActionRowBuilder().addComponents(itemSelectMenu);
	const row3 = new ActionRowBuilder().addComponents(btnCancelAdd);

	return [row1, row2, row3];
}

function buildPreTicketCartEmbed(userId) {
	const draft = draftCarts.get(userId);
	if (!draft || draft.items.length === 0) return null;

	let subtotalAll = 0;
	let itemsListStr = '';

	draft.items.forEach((item, index) => {
		subtotalAll += item.subtotal;
		itemsListStr += `**${index + 1}.** ${item.emoji} **${item.name}**\n` +
						`└ \`${item.quantity} Pcs\` @ Rp ${item.price.toLocaleString('id-ID')} = **Rp ${item.subtotal.toLocaleString('id-ID')}**\n\n`;
	});

	const userLine = (draft.robloxUsername && draft.robloxUsername !== 'Tidak Perlu') 
		? `👤 **Username Roblox:** \`${draft.robloxUsername}\`\n\n` 
		: '';

	const description = 
		`🛍️ **DRAF KERANJANG BELANJA KAMU (SEBELUM BIKIN TIKET):**\n\n` +
		userLine +
		itemsListStr +
		`💰 **Subtotal Produk:** **Rp ${subtotalAll.toLocaleString('id-ID')}**\n\n` +
		`💡 *Ingin memasukkan item lain? Klik **"➕ Tambah Item Lain"**.\n` +
		`Ingin menghapus/mengurangi item? Klik **"🗑️ Hapus/Kurangi Item"**.\n` +
		`Kalau sudah pas, klik **"🚀 Buat Tiket Sekarang"**!*`;

	const embed = new EmbedBuilder()
		.setTitle(`🛒  BEBEY STORE — DRAF KERANJANG BELANJA`)
		.setColor(0x3498DB)
		.setDescription(description.trim())
		.setTimestamp()
		.setFooter({ text: '💖 Bebey Store Pre-Ticket Cart' });

	const btnAddItem = new ButtonBuilder()
		.setCustomId('preticket_add_item')
		.setLabel('➕ Tambah Item Lain')
		.setStyle(ButtonStyle.Primary);

	const btnRemoveItem = new ButtonBuilder()
		.setCustomId('preticket_remove_item')
		.setLabel('🗑️ Hapus / Kurangi Item')
		.setStyle(ButtonStyle.Danger);

	const btnCreateTicket = new ButtonBuilder()
		.setCustomId('preticket_create_ticket')
		.setLabel('🚀 Buat Tiket Sekarang')
		.setStyle(ButtonStyle.Success);

	const btnCancel = new ButtonBuilder()
		.setCustomId('preticket_cancel')
		.setLabel('❌ Batal')
		.setStyle(ButtonStyle.Secondary);

	const row1 = new ActionRowBuilder().addComponents(btnAddItem, btnRemoveItem, btnCreateTicket);
	const row2 = new ActionRowBuilder().addComponents(btnCancel);

	return { embeds: [embed], components: [row1, row2] };
}

async function refreshTicketCartAndQris(orderId) {
	const cleanOrderId = orderId.toUpperCase();
	const cartData = buildCartEmbedAndComponents(cleanOrderId);
	const cartMsg = cartMessages.get(cleanOrderId);

	if (cartMsg && cartData) {
		try {
			await cartMsg.edit(cartData);
		} catch (e) {}
	}

	const qrisData = buildQrisPaymentEmbedForCart(cleanOrderId);
	const qrisMsg = qrisMessages.get(cleanOrderId);

	if (qrisData) {
		try {
			await updatePurchaseStatus(cleanOrderId, 'pending');
		} catch (e) {}

		if (qrisMsg) {
			try {
				await qrisMsg.edit({
					embeds: qrisData.embeds,
					components: qrisData.components,
					files: qrisData.files || []
				});
			} catch (e) {}
		}
	}
}

async function handleBuyerInteraction(interaction, client) {
	// 1. Dropdown Select Menu (Pilih Item Produk)
	if (interaction.isStringSelectMenu()) {
		if (interaction.customId.startsWith('select_shop_item')) {
			delete require.cache[require.resolve('../config/items')];
			const currentItems = require('../config/items');

			const itemId = interaction.values[0];
			const selectedItem = currentItems.find(i => i.id === itemId);

			if (!selectedItem) {
				return interaction.reply({ content: '❌ Item tidak ditemukan di katalog toko.', flags: MessageFlags.Ephemeral });
			}

			if (selectedItem.available === false || selectedItem.hold === true) {
				return interaction.reply({
					content: `⛔ **PRODUK SEMENTARA DITAHAN!**\n> Produk **${selectedItem.name}** saat ini sedang ditahan oleh Admin (Stok Kosong / Maintenance) dan tidak dapat dibeli untuk sementara.\n> Silakan cek kembali nanti atau pilih produk lainnya.`,
					flags: MessageFlags.Ephemeral
				});
			}

			const allowQuantity = getPanelManager().isCategoryQuantityAllowed(selectedItem.category);

			if (selectedItem.requireUsername === false) {
				if (allowQuantity) {
					const modal = new ModalBuilder()
						.setCustomId(`modal_buy_${selectedItem.id}`)
						.setTitle(`FORM PEMBELIAN: ${selectedItem.name.substring(0, 25)}`);

					const qtyInput = new TextInputBuilder()
						.setCustomId('item_quantity')
						.setLabel("JUMLAH / QUANTITY (Pcs):")
						.setStyle(TextInputStyle.Short)
						.setPlaceholder("Contoh: 1, 2, 5, 10 (Default: 1)")
						.setValue("1")
						.setRequired(true);

					modal.addComponents(new ActionRowBuilder().addComponents(qtyInput));
					return interaction.showModal(modal);
				}

				await createTicketChannel(interaction, selectedItem, 'Tidak Perlu', client, 1);

				const prevInteraction = userEphemeralInteractions.get(interaction.user.id);
				if (prevInteraction) {
					try {
						await prevInteraction.deleteReply();
					} catch (e) {}
					userEphemeralInteractions.delete(interaction.user.id);
				}
				return;
			}

			const modal = new ModalBuilder()
				.setCustomId(`modal_buy_${selectedItem.id}`)
				.setTitle(`FORM PEMBELIAN: ${selectedItem.name.substring(0, 25)}`);

			const usernameInput = new TextInputBuilder()
				.setCustomId('roblox_username')
				.setLabel("USERNAME ROBLOX (Tanpa Simbol @):")
				.setStyle(TextInputStyle.Short)
				.setPlaceholder("Cth: bebeystore (Langsung username, tanpa @)")
				.setRequired(true)
				.setMinLength(3)
				.setMaxLength(30);

			if (allowQuantity) {
				const qtyInput = new TextInputBuilder()
					.setCustomId('item_quantity')
					.setLabel("JUMLAH / QUANTITY (Pcs):")
					.setStyle(TextInputStyle.Short)
					.setPlaceholder("Contoh: 1, 2, 5, 10 (Default: 1)")
					.setValue("1")
					.setRequired(true);

				modal.addComponents(
					new ActionRowBuilder().addComponents(usernameInput),
					new ActionRowBuilder().addComponents(qtyInput)
				);
			} else {
				modal.addComponents(new ActionRowBuilder().addComponents(usernameInput));
			}

			return interaction.showModal(modal);
		}

		// Dropdown Pilih Item Tambahan Untuk Keranjang Belanja
		if (interaction.customId.startsWith('cart_select_added_item_')) {
			const orderId = interaction.customId.replace('cart_select_added_item_', '');
			const itemId = interaction.values[0];

			delete require.cache[require.resolve('../config/items')];
			const currentItems = require('../config/items');
			const selectedItem = currentItems.find(i => i.id === itemId);

			if (!selectedItem) {
				return interaction.reply({ content: '❌ Item tidak ditemukan.', flags: MessageFlags.Ephemeral });
			}

			const allowQuantity = getPanelManager().isCategoryQuantityAllowed(selectedItem.category);

			if (allowQuantity) {
				const modal = new ModalBuilder()
					.setCustomId(`cart_modal_qty_${orderId}_${selectedItem.id}`)
					.setTitle(`Jumlah: ${selectedItem.name.substring(0, 20)}`);

				const qtyInput = new TextInputBuilder()
					.setCustomId('cart_qty_input')
					.setLabel('JUMLAH / QUANTITY (Pcs)')
					.setStyle(TextInputStyle.Short)
					.setPlaceholder('Contoh: 1, 3, 5...')
					.setValue('1')
					.setRequired(true);

				const firstActionRow = new ActionRowBuilder().addComponents(qtyInput);
				modal.addComponents(firstActionRow);

				await interaction.showModal(modal);
				return;
			} else {
				addItemToCart(orderId, selectedItem, 1);
				await refreshTicketCartAndQris(orderId);

				return interaction.reply({
					content: `✅ **${selectedItem.emoji || '📦'} ${selectedItem.name} (1 Pcs)** berhasil ditambahkan ke keranjang belanja!`,
					flags: MessageFlags.Ephemeral
				});
			}
		}

		// Dropdown Pilih Kategori Sub-Menu Saat Tambah Item ke Pre-Ticket Cart
		if (interaction.customId === 'preticket_select_category') {
			const selectedCategory = interaction.values[0];
			const components = buildAddItemCategoryComponents(selectedCategory);
			const preTicketData = buildPreTicketCartEmbed(interaction.user.id);
			const embeds = preTicketData ? preTicketData.embeds : [];

			return interaction.update({
				content: `🛒 **PILIH PRODUK DARI KATEGORI: \`${selectedCategory}\`**`,
				embeds: embeds,
				components: components
			});
		}

		// Dropdown Pilih Item Tambahan Untuk Pre-Ticket Cart
		if (interaction.customId === 'preticket_select_added_item') {
			const itemId = interaction.values[0];
			delete require.cache[require.resolve('../config/items')];
			const currentItems = require('../config/items');
			const selectedItem = currentItems.find(i => i.id === itemId);

			if (!selectedItem) {
				return interaction.reply({ content: '❌ Item tidak ditemukan.', flags: MessageFlags.Ephemeral });
			}

			const allowQuantity = getPanelManager().isCategoryQuantityAllowed(selectedItem.category);

			if (allowQuantity) {
				const modal = new ModalBuilder()
					.setCustomId(`preticket_modal_qty_${selectedItem.id}`)
					.setTitle(`Jumlah: ${selectedItem.name.substring(0, 20)}`);

				const qtyInput = new TextInputBuilder()
					.setCustomId('preticket_qty_input')
					.setLabel('JUMLAH / QUANTITY (Pcs)')
					.setStyle(TextInputStyle.Short)
					.setPlaceholder('Contoh: 1, 3, 5...')
					.setValue('1')
					.setRequired(true);

				modal.addComponents(new ActionRowBuilder().addComponents(qtyInput));
				return interaction.showModal(modal);
			} else {
				addItemToDraftCart(interaction.user.id, selectedItem, 1);
				const preTicketData = buildPreTicketCartEmbed(interaction.user.id);

				return interaction.update({
					content: null,
					embeds: preTicketData.embeds,
					components: preTicketData.components
				});
			}
		}

		// Dropdown Pilih Item Untuk Dihapus / Dikurangi Dari Pre-Ticket Cart
		if (interaction.customId === 'preticket_select_remove_item') {
			const itemId = interaction.values[0];
			removeItemFromDraftCart(interaction.user.id, itemId, 1);

			const preTicketData = buildPreTicketCartEmbed(interaction.user.id);
			if (preTicketData) {
				return interaction.update({
					content: null,
					embeds: preTicketData.embeds,
					components: preTicketData.components
				});
			} else {
				return interaction.update({
					content: 'ℹ️ Semua item telah dihapus dari keranjang. Draf keranjang kosong.',
					embeds: [],
					components: []
				});
			}
		}
	}

	// 2. Modal Submissions (Form Beli & Ganti Username)
	if (interaction.isModalSubmit()) {
		if (interaction.customId.startsWith('modal_buy_')) {
			delete require.cache[require.resolve('../config/items')];
			const currentItems = require('../config/items');

			const itemId = interaction.customId.replace('modal_buy_', '');
			const selectedItem = currentItems.find(i => i.id === itemId);

			if (!selectedItem) {
				return interaction.reply({ content: '❌ Item tidak ditemukan.', flags: MessageFlags.Ephemeral });
			}

			let robloxUsername = 'Tidak Perlu';
			try {
				robloxUsername = interaction.fields.getTextInputValue('roblox_username').trim();
			} catch (e) {}

			let rawQty = '1';
			try {
				rawQty = interaction.fields.getTextInputValue('item_quantity').trim();
			} catch (e) {}

			const parsedQty = parseInt(rawQty, 10);
			const quantity = (!isNaN(parsedQty) && parsedQty >= 1) ? Math.min(parsedQty, 9999) : 1;

			await interaction.deferReply({ flags: MessageFlags.Ephemeral });

			let robloxCheck = 'Tidak Perlu';
			if (selectedItem.requireUsername !== false && robloxUsername !== 'Tidak Perlu') {
				robloxCheck = await validateRobloxUsername(robloxUsername);

				if (!robloxCheck.valid || !robloxCheck.found) {
					return interaction.editReply({
						content: `❌ **USERNAME ROBLOX TIDAK DITEMUKAN!**\n` +
							`> Username Roblox \`${robloxUsername}\` tidak terdaftar di database resmi Roblox.\n` +
							`> Silakan periksa kembali ejaan Username Anda dan coba pilih produk lagi (langsung username, tanpa simbol @).`
					});
				}
			}

			initDraftCart(interaction.user.id, robloxCheck, selectedItem, quantity);
			const preTicketData = buildPreTicketCartEmbed(interaction.user.id);

			await interaction.editReply(preTicketData);

			const prevInteraction = userEphemeralInteractions.get(interaction.user.id);
			if (prevInteraction) {
				try {
					await prevInteraction.deleteReply();
				} catch (e) {}
				userEphemeralInteractions.delete(interaction.user.id);
			}
			return;
		}

		// Modal Jumlah Item Tambahan Keranjang Belanja
		if (interaction.customId.startsWith('cart_modal_qty_')) {
			const parts = interaction.customId.replace('cart_modal_qty_', '').split('_');
			const orderId = parts[0];
			const itemId = parts.slice(1).join('_');
			const rawQty = interaction.fields.getTextInputValue('cart_qty_input');
			const qty = Math.max(1, parseInt(rawQty) || 1);

			delete require.cache[require.resolve('../config/items')];
			const currentItems = require('../config/items');
			const selectedItem = currentItems.find(i => i.id === itemId);

			if (selectedItem) {
				addItemToCart(orderId, selectedItem, qty);
				await refreshTicketCartAndQris(orderId);

				return interaction.reply({
					content: `✅ **${selectedItem.emoji || '📦'} ${selectedItem.name} (x${qty} Pcs)** berhasil ditambahkan ke keranjang belanja!`,
					flags: MessageFlags.Ephemeral
				});
			}
		}

		// Modal Jumlah Item Tambahan Pre-Ticket Cart
		if (interaction.customId.startsWith('preticket_modal_qty_')) {
			const itemId = interaction.customId.replace('preticket_modal_qty_', '');
			const rawQty = interaction.fields.getTextInputValue('preticket_qty_input');
			const qty = Math.max(1, parseInt(rawQty) || 1);

			delete require.cache[require.resolve('../config/items')];
			const currentItems = require('../config/items');
			const selectedItem = currentItems.find(i => i.id === itemId);

			if (selectedItem) {
				addItemToDraftCart(interaction.user.id, selectedItem, qty);
				const preTicketData = buildPreTicketCartEmbed(interaction.user.id);

				return interaction.update({
					content: null,
					embeds: preTicketData.embeds,
					components: preTicketData.components
				});
			}
		}

		if (interaction.customId.startsWith('modal_rechange_roblox_')) {
			const orderId = interaction.customId.replace('modal_rechange_roblox_', '');
			let newUsername = interaction.fields.getTextInputValue('new_roblox_username').trim();

			const robloxCheck = await validateRobloxUsername(newUsername);

			if (!robloxCheck.valid || !robloxCheck.found) {
				return interaction.reply({
					content: `❌ **USERNAME ROBLOX TIDAK DITEMUKAN!**\n> Username Roblox \`${newUsername}\` tidak terdaftar di database resmi Roblox. Silakan periksa kembali ejaannya.`,
					flags: MessageFlags.Ephemeral
				});
			}

			await interaction.deferUpdate();
			await updateRobloxUsername(orderId, robloxCheck.username);

			const avatarUrl = await getRobloxAvatarHeadshot(robloxCheck.id);

			try {
				const fetchedMsgs = await interaction.channel.messages.fetch({ limit: 20 });
				const confirmMsg = fetchedMsgs.find(m => m.embeds.length > 0 && m.embeds[0].title && m.embeds[0].title.includes('AKUN ROBLOX'));

				const changeNoBtn = new ButtonBuilder()
					.setCustomId(`change_roblox_${orderId}`)
					.setLabel('✏️ Ganti Username')
					.setStyle(ButtonStyle.Danger);

				if (confirmMsg) {
					const updatedEmbed = new EmbedBuilder()
						.setTitle('👤  AKUN ROBLOX KAMU')
						.setColor(0xF1C40F)
						.setDescription(
							`Coba cek, apakah ini akun Roblox kamu?\n\n` +
							`📛 **Username:** \`${robloxCheck.username}\`\n` +
							`✨ **Display Name:** **${robloxCheck.displayName || robloxCheck.username}**\n` +
							`🔢 **User ID:** \`${robloxCheck.id || 'N/A'}\`\n\n` +
							`Kalau benar, klik tombol di bawah ya! 👇`
						)
						.setFooter({ text: `💖 Bebey Store • ${orderId}` });

					if (avatarUrl) {
						updatedEmbed.setThumbnail(avatarUrl);
					}

					const confirmYesBtn = new ButtonBuilder()
						.setCustomId(`confirm_roblox_${orderId}`)
						.setLabel('✅ Iya, Ini Akun Saya')
						.setStyle(ButtonStyle.Success);

					const confirmRow = new ActionRowBuilder().addComponents(confirmYesBtn, changeNoBtn);

					await confirmMsg.edit({ embeds: [updatedEmbed], components: [confirmRow] });
				}
			} catch (e) {
				console.warn('⚠️ Error updating Roblox confirmation embed:', e);
			}
			return;
		}
	}

	// 3. Button Interactions
	if (interaction.isButton()) {
		const customId = interaction.customId;

		// Confirm Roblox Username
		if (customId.startsWith('confirm_roblox_')) {
			const orderId = customId.replace('confirm_roblox_', '');

			const updatedConfirmEmbed = EmbedBuilder.from(interaction.message.embeds[0])
				.setColor(0x2ECC71)
				.setTitle('✅  AKUN ROBLOX DIKONFIRMASI');

			await interaction.update({ embeds: [updatedConfirmEmbed], components: [] });

			delete require.cache[require.resolve('../config/items')];
			const catalogItems = require('../config/items');
			const purchase = await getPurchaseById(orderId);

			let selectedItem = null;
			if (purchase) {
				selectedItem = catalogItems.find(i => i.name && i.name.toLowerCase() === purchase.item_name.toLowerCase());
			}

			let notesDescription = 
				`Baca catatan singkat ini dulu ya sebelum bayar:\n\n` +
				`1️⃣ **Cek Username**: Pastikan username & display name Roblox kamu sudah benar.\n` +
				`2️⃣ **Umur Akun**: Kalau umur akun kamu dibawah 18+, pastikan tidak dikunci email orang tua.\n` +
				`3️⃣ **Status Limit**: Pastikan akun kamu tidak kena limit Robux.\n` +
				`4️⃣ **Proses**: Setelah Robux/item terkirim, pesanan tidak bisa dibatalkan.\n` +
				`5️⃣ **Waktu Proses**: Proses kirim butuh waktu **15 menit – 4 jam** (maksimal 4 jam).\n\n` +
				`Kalau kamu sudah paham, klik **Saya Paham & Setuju**!`;

			if (selectedItem && selectedItem.notes && selectedItem.notes.trim() !== '') {
				notesDescription = 
					`Baca catatan singkat produk ini dulu ya sebelum bayar:\n\n` +
					selectedItem.notes.trim() + `\n\n` +
					`Kalau kamu sudah paham, klik **Saya Paham & Setuju**!`;
			}

			const notesEmbed = new EmbedBuilder()
				.setTitle('📌  CATATAN PENTING')
				.setColor(0xE91E63)
				.setDescription(notesDescription.trim())
				.setTimestamp()
				.setFooter({ text: `💖 Bebey Store • ${orderId}` });

			const agreeBtn = new ButtonBuilder()
				.setCustomId(`agree_terms_${orderId}`)
				.setLabel('✅ Saya Paham & Setuju')
				.setStyle(ButtonStyle.Success);

			const agreeRow = new ActionRowBuilder().addComponents(agreeBtn);

			await interaction.channel.send({ embeds: [notesEmbed], components: [agreeRow] });
			return;
		}

		// Agree Terms Button
		if (customId.startsWith('agree_terms_')) {
			const orderId = customId.replace('agree_terms_', '');

			const updatedNotesEmbed = EmbedBuilder.from(interaction.message.embeds[0])
				.setColor(0x2ECC71)
				.setTitle('✅  CATATAN DISETUJUI');

			await interaction.update({ embeds: [updatedNotesEmbed], components: [] });

			delete require.cache[require.resolve('../config/items')];
			const catalogItems = require('../config/items');
			const purchase = await getPurchaseById(orderId);

			let selectedItem = { name: 'Produk Bebey Store', emoji: '📦' };
			let totalAmount = 20000;
			let uniqueCode = 0;

			if (purchase) {
				totalAmount = purchase.price || 20000;
				uniqueCode = purchase.unique_code || 0;
				const foundItem = catalogItems.find(i => i.name && i.name.toLowerCase() === purchase.item_name.toLowerCase());
				if (foundItem) selectedItem = foundItem;
				else selectedItem = { name: purchase.item_name, emoji: '📦' };
			}

			const cart = getCart(orderId);
			let requireLimitCheck = false;

			if (cart && cart.items && cart.items.length > 0) {
				requireLimitCheck = cart.items.some(item => {
					const cat = (item.category || item.itemObj?.category || '').toLowerCase();
					return item.requireLimitCheck === true || (item.itemObj && item.itemObj.requireLimitCheck === true) || cat.includes('robux');
				});
			} else {
				const isRobuxCategory = selectedItem.category && selectedItem.category.toLowerCase().includes('robux');
				requireLimitCheck = selectedItem.requireLimitCheck !== undefined ? selectedItem.requireLimitCheck : isRobuxCategory;
			}

			if (!requireLimitCheck) {
				// Kirim Panduan Private World terlebih dahulu (jika item memerlukan Private World)
				await sendPsGuideEmbedIfNeeded(interaction, orderId);

				const qrisData = buildQrisPaymentEmbedForCart(orderId);
				let qrisMsg;
				if (qrisData) {
					qrisMsg = await interaction.channel.send({
						embeds: qrisData.embeds,
						components: qrisData.components,
						files: qrisData.files || []
					});
				} else {
					const qrisImage = process.env.QRIS_IMAGE_URL || 'https://dummyimage.com/600x600/0984e3/ffffff.png&text=QRIS+BEBEY+STORE';
					const qrisCard = buildQrisPaymentEmbed(selectedItem, orderId, totalAmount, qrisImage, uniqueCode);
					qrisMsg = await interaction.channel.send(qrisCard);
				}
				qrisMessages.set(orderId.toUpperCase(), qrisMsg);
				return;
			}

			const limitDescription = 
				`${interaction.user} sebelum lanjut bayar, kakak perlu **cek limit akun** dulu ya. 🙏\n\n` +
				`Ini biar Robux-nya masuk penuh dan gak ada yang nyangkut gara-gara limit.\n\n` +
				`📖 Ada 2 tutorial di tombol bawah: **cara cek limit akun** & **cara cek sisa limit**.\n\n` +
				`Kalau udah dicek, pilih salah satu tombol di bawah 👇`;

			const limitEmbed = new EmbedBuilder()
				.setTitle('🔍  Cek Limit Akun Dulu Yuk!')
				.setColor(0xF1C40F)
				.setDescription(limitDescription.trim())
				.setFooter({ text: `💖 BEBEY STORE • ${orderId}` });

			const notLimitBtn = new ButtonBuilder()
				.setCustomId(`limit_ok_${orderId}`)
				.setLabel('✅ Tidak Limit')
				.setStyle(ButtonStyle.Success);

			const isLimitBtn = new ButtonBuilder()
				.setCustomId(`limit_warning_${orderId}`)
				.setLabel('⚠️ Akun Saya Limit')
				.setStyle(ButtonStyle.Danger);

			const guideBtn = new ButtonBuilder()
				.setCustomId(`limit_guide_${orderId}`)
				.setLabel('📖 Cara Cek Limit Akun')
				.setStyle(ButtonStyle.Secondary);

			const remainingGuideBtn = new ButtonBuilder()
				.setCustomId(`remaining_limit_guide_${orderId}`)
				.setLabel('📊 Cara Cek Sisa Limit')
				.setStyle(ButtonStyle.Secondary);

			const limitRow1 = new ActionRowBuilder().addComponents(notLimitBtn, isLimitBtn);
			const limitRow2 = new ActionRowBuilder().addComponents(guideBtn, remainingGuideBtn);

			await interaction.channel.send({ embeds: [limitEmbed], components: [limitRow1, limitRow2] });
			return;
		}

		// Limit OK Button
		if (customId.startsWith('limit_ok_')) {
			const orderId = customId.replace('limit_ok_', '');

			const updatedLimitEmbed = EmbedBuilder.from(interaction.message.embeds[0])
				.setColor(0x2ECC71)
				.setTitle('✅  AKUN BEBAS LIMIT');

			await interaction.update({ embeds: [updatedLimitEmbed], components: [] });

			const safetyDescription = 
				`Kalau ternyata masih limit, Robux-nya bisa nyangkut dan gak masuk penuh.\n\n` +
				`Robux yang udah kekirim **gak bisa ditarik balik** — jadi yang nyangkut **gak bisa direfund**.\n\n` +
				`Cek sekali lagi ya sebelum bayar 🙏`;

			const safetyEmbed = new EmbedBuilder()
				.setTitle('⚠️  Yakin Akunnya Aman Kak?')
				.setColor(0xF1C40F)
				.setDescription(safetyDescription.trim())
				.setFooter({ text: `💖 BEBEY STORE • ${orderId}` });

			const confirmSafetyBtn = new ButtonBuilder()
				.setCustomId(`confirm_safety_${orderId}`)
				.setLabel('✅ Yakin, Lanjut Bayar')
				.setStyle(ButtonStyle.Success);

			const checkAgainBtn = new ButtonBuilder()
				.setCustomId(`check_again_${orderId}`)
				.setLabel('❌ Cek Dulu')
				.setStyle(ButtonStyle.Secondary);

			const safetyRow = new ActionRowBuilder().addComponents(confirmSafetyBtn, checkAgainBtn);

			await interaction.channel.send({ embeds: [safetyEmbed], components: [safetyRow] });
			return;
		}

		// Check Again Button ("❌ Cek Dulu")
		if (customId.startsWith('check_again_')) {
			await interaction.reply({
				content: 
					`🔍 **SILAKAN CEK KEMBALI AKUN ROBLOX KAMU!**\n` +
					`> Pastikan sekali lagi akun kamu tidak limit ya.\n` +
					`> Jika sudah benar-benar yakin bebas limit, tekan tombol **"✅ Yakin, Lanjut Bayar"** pada kartu di atas!`,
				flags: MessageFlags.Ephemeral
			});
			return;
		}

		// Confirm Safety Button ("✅ Yakin, Lanjut Bayar")
		if (customId.startsWith('confirm_safety_')) {
			const orderId = customId.replace('confirm_safety_', '');

			const updatedSafetyEmbed = EmbedBuilder.from(interaction.message.embeds[0])
				.setColor(0x2ECC71)
				.setTitle('✅  KONFIRMASI KEAMANAN DISETUJUI');

			await interaction.update({ embeds: [updatedSafetyEmbed], components: [] });

			delete require.cache[require.resolve('../config/items')];
			const catalogItems = require('../config/items');
			const purchase = await getPurchaseById(orderId);

			let selectedItem = { name: 'Produk Bebey Store', emoji: '📦' };
			let totalAmount = 20000;
			let uniqueCode = 0;

			if (purchase) {
				totalAmount = purchase.price || 20000;
				uniqueCode = purchase.unique_code || 0;
				const foundItem = catalogItems.find(i => i.name && i.name.toLowerCase() === purchase.item_name.toLowerCase());
				if (foundItem) selectedItem = foundItem;
				else selectedItem = { name: purchase.item_name, emoji: '📦' };
			}

			// Kirim Panduan Private World terlebih dahulu (jika item memerlukan Private World)
			await sendPsGuideEmbedIfNeeded(interaction, orderId);

			const qrisData = buildQrisPaymentEmbedForCart(orderId);
			let qrisMsg;
			if (qrisData) {
				qrisMsg = await interaction.channel.send({
					embeds: qrisData.embeds,
					components: qrisData.components,
					files: qrisData.files || []
				});
			} else {
				const qrisImage = process.env.QRIS_IMAGE_URL || 'https://dummyimage.com/600x600/0984e3/ffffff.png&text=QRIS+BEBEY+STORE';
				const qrisCard = buildQrisPaymentEmbed(selectedItem, orderId, totalAmount, qrisImage, uniqueCode);
				qrisMsg = await interaction.channel.send(qrisCard);
			}
			qrisMessages.set(orderId.toUpperCase(), qrisMsg);
			return;
		}

		// Already Transferred Button (QRIS)
		if (customId.startsWith('already_transferred_')) {
			await interaction.reply({
				content: 
					`📸 **HARAP UPLOAD FOTO RESI BUKTI TRANSFER!**\n` +
					`> Silakan **upload foto screenshot resi bukti transfer Anda** di channel ini.\n` +
					`> Setelah ter-upload, periksa kembali gambarnya lalu tekan tombol **"✅ Saya Sudah Transfer"** pada kartu konfirmasi yang muncul!`,
				flags: MessageFlags.Ephemeral
			});
			return;
		}

		// Confirm Buyer Proof Button
		if (customId.startsWith('confirm_buyer_proof_')) {
			const orderId = customId.replace('confirm_buyer_proof_', '');

			await disableQrisButtonForOrder(orderId, interaction.channel);

			const pendingProof = buyerPendingProofs.get(orderId);
			const proofUrl = pendingProof ? pendingProof.proofUrl : (interaction.message.embeds[0]?.image?.url || null);

			if (!proofUrl) {
				return interaction.reply({
					content: '❌ Foto bukti transfer tidak ditemukan. Silakan upload ulang foto bukti transfer Anda.',
					flags: MessageFlags.Ephemeral
				});
			}

			const updatedProofEmbed = EmbedBuilder.from(interaction.message.embeds[0])
				.setColor(0x2ECC71)
				.setTitle('✅  BUKTI TRANSFER DIKONFIRMASI BY PEMBELI')
				.setDescription(
					`Terima kasih ${interaction.user}! Bukti transfer kamu telah dikonfirmasi dan dikirimkan ke Admin Bebey Store.\n` +
					`Mohon tunggu sejenak, Admin sedang memproses transaksi kamu.`
				);

			await interaction.update({ embeds: [updatedProofEmbed], components: [] });

			const purchase = await getPurchaseById(orderId);

			const itemName = purchase ? purchase.item_name : 'N/A';
			const itemPrice = purchase ? `Rp ${purchase.price.toLocaleString('id-ID')}` : 'N/A';
			const robloxUser = purchase ? (purchase.roblox_username || 'Tidak Perlu') : 'Tidak Perlu';

			const adminProofEmbed = new EmbedBuilder()
				.setTitle('📸  VERIFIKASI BUKTI TRANSFER — ADMIN PANEL')
				.setColor(0xF39C12)
				.setDescription(
					`Bukti pembayaran baru telah dikonfirmasi oleh pembeli ${interaction.user}.\n` +
					`Mohon periksa gambar bukti transfer di bawah ini.`
				)
				.addFields(
					{ name: '🆔 ORDER ID', value: `\`${orderId}\``, inline: true },
					{ name: '📦 ITEM DIBELI', value: `**${itemName}**`, inline: true },
					{ name: '💰 NOMINAL TRANSFER', value: `**${itemPrice}**`, inline: true },
					{ name: '👤 PEMBELI', value: `${interaction.user}`, inline: true },
					{ name: '📍 TIKET CHANNEL', value: `<#${interaction.channelId}>`, inline: true }
				);

			if (robloxUser && robloxUser !== 'Tidak Perlu') {
				adminProofEmbed.addFields({ name: '👤 USERNAME ROBLOX', value: `\`${robloxUser}\``, inline: true });
			}

			adminProofEmbed
				.setImage(proofUrl)
				.setTimestamp()
				.setFooter({ text: 'Tekan Approve untuk menyetujui transaksi atau Reject untuk menolak.' });

			const approveBtn = new ButtonBuilder()
				.setCustomId(`admin_approve_${orderId}`)
				.setLabel('✅ Approve & Beri Item')
				.setStyle(ButtonStyle.Success);

			const rejectBtn = new ButtonBuilder()
				.setCustomId(`admin_reject_${orderId}`)
				.setLabel('❌ Reject (Tolak)')
				.setStyle(ButtonStyle.Danger);

			const row = new ActionRowBuilder().addComponents(approveBtn, rejectBtn);

			const adminChannelId = process.env.ADMIN_CHANNEL_ID ? process.env.ADMIN_CHANNEL_ID.trim() : null;
			let sentToAdminChannel = false;

			if (adminChannelId) {
				try {
					await deleteAdminChannelMessagesForOrder(client, orderId);

					const adminChannel = await client.channels.fetch(adminChannelId);
					if (adminChannel) {
						await adminChannel.send({
							content: `@here 🔔 **BUKTI TRANSFER MASUK!** Order \`${orderId}\` dari ${interaction.user} membutuhkan verifikasi Admin:`,
							embeds: [adminProofEmbed],
							components: [row]
						});
						sentToAdminChannel = true;
					}
				} catch (err) {}
			}

			if (!sentToAdminChannel) {
				const { getAdmins } = require('../services/admins');
				const ownerId = process.env.OWNER_DISCORD_ID ? process.env.OWNER_DISCORD_ID.trim() : null;
				const adminList = getAdmins();

				const targetAdminIds = new Set();
				if (ownerId) targetAdminIds.add(ownerId);
				adminList.forEach(a => targetAdminIds.add(a.id));

				for (const adminId of targetAdminIds) {
					try {
						const adminUser = await client.users.fetch(adminId);
						if (adminUser) {
							await adminUser.send({ embeds: [adminProofEmbed], components: [row] });
						}
					} catch (err) {}
				}
			}
			return;
		}

		// Change Buyer Proof
		if (customId.startsWith('change_buyer_proof_')) {
			await interaction.reply({
				content: 
					`📸 **SILAKAN UPLOAD FOTO BUKTI TRANSFER YANG BARU!**\n` +
					`> Silakan upload foto screenshot bukti transfer yang baru di channel ini.`,
				flags: MessageFlags.Ephemeral
			});
			return;
		}

		// Change Roblox Username Button
		if (customId.startsWith('change_roblox_')) {
			const orderId = customId.replace('change_roblox_', '');

			const modal = new ModalBuilder()
				.setCustomId(`modal_rechange_roblox_${orderId}`)
				.setTitle('GANTI USERNAME ROBLOX');

			const usernameInput = new TextInputBuilder()
				.setCustomId('new_roblox_username')
				.setLabel("USERNAME ROBLOX BARU (Tanpa Simbol @):")
				.setStyle(TextInputStyle.Short)
				.setPlaceholder("Cth: Vevalsss (Langsung username, tanpa @)")
				.setRequired(true)
				.setMinLength(3)
				.setMaxLength(30);

			const actionRow = new ActionRowBuilder().addComponents(usernameInput);
			modal.addComponents(actionRow);

			return interaction.showModal(modal);
		}

		// Check Limit Warning Button ("Akun Saya Limit")
		if (customId.startsWith('limit_warning_')) {
			await interaction.reply({
				content: 
					`⚠️ **AKUN TERKENA LIMIT!**\n` +
					`> Mohon gunakan akun Roblox lain yang **belum terkena limit** untuk menerima Robux.\n` +
					`> Silakan scroll ke atas dan tekan tombol **"✏️ Ganti Username"** pada kartu Konfirmasi Akun Roblox untuk mengganti ke akun lain.`,
				flags: MessageFlags.Ephemeral
			});
			return;
		}

		// Limit Guide Button ("Cara Cek Limit")
		if (customId.startsWith('limit_guide_')) {
			const guideEmbed = new EmbedBuilder()
				.setTitle('📖  PANDUAN CEK LIMIT AKUN ROBLOX')
				.setColor(0x5865F2)
				.setDescription(
					`Berikut adalah langkah-langkah mudah untuk mengecek limit akun Roblox Anda:\n\n` +
					`1️⃣ Buka browser dan login ke akun Roblox Anda di **roblox.com**.\n` +
					`2️⃣ Masuk ke menu **Settings / Pengaturan** > **Privacy / Keamanan**.\n` +
					`3️⃣ Cek apakah fitur transaksi/penerimaan Robux Anda masih aktif atau sedang dibatasi oleh sistem Roblox.\n` +
					`4️⃣ Jika sisa limit cukup untuk transaksi ini, tekan tombol **"✅ Tidak Limit"**.`
				)
				.setFooter({ text: '⚡ Bebey Store Official • Tutorial Center' });

			await interaction.reply({
				embeds: [guideEmbed],
				flags: MessageFlags.Ephemeral
			});
			return;
		}

		// Remaining Limit Guide Button ("📊 Cara Cek Sisa Limit")
		if (customId.startsWith('remaining_limit_guide_')) {
			const remainingGuideEmbed = new EmbedBuilder()
				.setTitle('📊  PANDUAN CEK SISA LIMIT ROBUX')
				.setColor(0x5865F2)
				.setDescription(
					`Berikut adalah langkah-langkah mengecek sisa limit Robux akun kamu:\n\n` +
					`1️⃣ Buka browser dan login ke akun Roblox kamu di **roblox.com**.\n` +
					`2️⃣ Masuk ke menu **My Transactions** (Transaksi & Pengeluaran Robux).\n` +
					`3️⃣ Periksa pada bagian **Pending Robux** atau batas transaksi bulanan akun kamu.\n` +
					`4️⃣ Jika kuota penerimaan Robux kamu masih cukup, maka Robux bisa terkirim tanpa kendala!\n\n` +
					`> 💡 *Jika sisa limit masih aman, silakan tekan tombol **"✅ Tidak Limit"** pada kartu di atas!*`
				)
				.setFooter({ text: '⚡ Bebey Store Official • Tutorial Center' });

			await interaction.reply({
				embeds: [remainingGuideEmbed],
				flags: MessageFlags.Ephemeral
			});
			return;
		}

		// Check Again Button ("Cek Dulu Deh")
		if (customId.startsWith('check_again_')) {
			const guideEmbed = new EmbedBuilder()
				.setTitle('📖  PANDUAN CEK LIMIT AKUN ROBLOX')
				.setColor(0x5865F2)
				.setDescription(
					`ℹ️ **SILAKAN CEK AKUN KAMU DULU!**\n\n` +
					`Berikut langkah-langkah mudah untuk mengecek limit akun Roblox kamu:\n\n` +
					`1️⃣ Buka browser dan login ke **roblox.com**.\n` +
					`2️⃣ Masuk ke menu **Settings / Pengaturan** > **Privacy**.\n` +
					`3️⃣ Cek apakah fitur penerimaan Robux kamu masih aktif atau dibatasi.\n` +
					`4️⃣ Jika sisa limit akun aman, silakan kembali ke pesan di atas dan klik **"✅ Yakin, Lanjut Bayar"**!`
				)
				.setFooter({ text: '⚡ Bebey Store Official • Tutorial Center' });

			await interaction.reply({
				embeds: [guideEmbed],
				flags: MessageFlags.Ephemeral
			});
			return;
		}

		// Pre-Ticket Cart Buttons
		if (customId === 'preticket_add_item') {
			const components = buildAddItemCategoryComponents();
			const preTicketData = buildPreTicketCartEmbed(interaction.user.id);
			const embeds = preTicketData ? preTicketData.embeds : [];

			return interaction.update({
				content: `🛒 **PILIH KATEGORI & PRODUK TAMBAHAN UNTUK DRAF KERANJANG:**`,
				embeds: embeds,
				components: components
			});
		}

		if (customId === 'preticket_remove_item') {
			const draft = getDraftCart(interaction.user.id);
			if (!draft || draft.items.length === 0) {
				return interaction.update({
					content: '⚠️ Draf keranjang kamu saat ini kosong.',
					embeds: [],
					components: []
				});
			}

			const selectOptions = draft.items.map((item, idx) => {
				return new StringSelectMenuOptionBuilder()
					.setLabel(`${idx + 1}. ${item.name} (${item.quantity} Pcs)`)
					.setValue(item.id)
					.setDescription(`Klik untuk mengurangi 1 Pcs / menghapus dari keranjang`);
			});

			const selectMenu = new StringSelectMenuBuilder()
				.setCustomId('preticket_select_remove_item')
				.setPlaceholder('🗑️ Pilih Item Yang Ingin Dikurangi / Dihapus...')
				.addOptions(selectOptions);

			const btnCancelRemove = new ButtonBuilder()
				.setCustomId('preticket_cancel_add_item')
				.setLabel('↩️ Kembali ke Keranjang')
				.setStyle(ButtonStyle.Secondary);

			const row1 = new ActionRowBuilder().addComponents(selectMenu);
			const row2 = new ActionRowBuilder().addComponents(btnCancelRemove);

			const preTicketData = buildPreTicketCartEmbed(interaction.user.id);
			const embeds = preTicketData ? preTicketData.embeds : [];

			return interaction.update({
				content: `🗑️ **PILIH ITEM YANG INGIN DIKURANGI / DIHAPUS:**`,
				embeds: embeds,
				components: [row1, row2]
			});
		}

		if (customId === 'preticket_cancel_add_item') {
			const preTicketData = buildPreTicketCartEmbed(interaction.user.id);
			if (preTicketData) {
				return interaction.update({
					content: null,
					embeds: preTicketData.embeds,
					components: preTicketData.components
				});
			} else {
				return interaction.update({
					content: 'ℹ️ Draf keranjang tidak ditemukan.',
					embeds: [],
					components: []
				});
			}
		}

		if (customId === 'preticket_create_ticket') {
			const draft = getDraftCart(interaction.user.id);
			if (!draft || draft.items.length === 0) {
				return interaction.reply({ content: '❌ Draf keranjang tidak ditemukan atau kosong.', flags: MessageFlags.Ephemeral });
			}

			await interaction.deferUpdate();

			const initialItem = draft.items[0];
			const additionalItems = draft.items.slice(1);

			await createTicketChannel(interaction, initialItem.itemObj, draft.robloxData, client, initialItem.quantity, additionalItems);

			draftCarts.delete(interaction.user.id);
			return;
		}

		if (customId === 'preticket_cancel') {
			draftCarts.delete(interaction.user.id);
			try {
				await interaction.update({
					content: 'ℹ️ **Pemesanan dibatalkan.** Silakan pilih produk dari panel katalog jika ingin membeli produk lain!',
					embeds: [],
					components: []
				});
			} catch (e) {}
			return;
		}

		// Category Sub-Menu Filter
		if (customId.startsWith('cat_filter_')) {
			const catName = customId.replace('cat_filter_', '');
			
			delete require.cache[require.resolve('../config/items')];
			const items = require('../config/items');

			const subMenuData = getPanelManager().buildCategorySubMenuEphemeral(items, catName);
			const userId = interaction.user.id;

			const existingInteraction = userEphemeralInteractions.get(userId);
			if (existingInteraction) {
				try {
					await existingInteraction.deleteReply();
				} catch (err) {}
				userEphemeralInteractions.delete(userId);
			}

			await interaction.reply({
				content: subMenuData.content || null,
				embeds: subMenuData.embeds || [],
				components: subMenuData.components,
				flags: MessageFlags.Ephemeral
			});

			userEphemeralInteractions.set(userId, interaction);
			return;
		}

		// Tombol Tambah Item Lain ke Keranjang Belanja
		if (customId.startsWith('cart_add_item_')) {
			const orderId = customId.replace('cart_add_item_', '');
			delete require.cache[require.resolve('../config/items')];
			const currentItems = require('../config/items');

			const selectOptions = currentItems.slice(0, 25).map(item => {
				const isHeld = item.available === false || item.hold === true;
				return new StringSelectMenuOptionBuilder()
					.setLabel(isHeld ? `⛔ ${item.name} (Ditahan)` : `${item.name}`)
					.setValue(item.id)
					.setDescription(`Rp ${item.price.toLocaleString('id-ID')} • ${item.category}`);
			});

			const selectMenu = new StringSelectMenuBuilder()
				.setCustomId(`cart_select_added_item_${orderId}`)
				.setPlaceholder('➕ Pilih Produk Lain Untuk Ditambahkan...')
				.addOptions(selectOptions);

			const row = new ActionRowBuilder().addComponents(selectMenu);

			return interaction.reply({
				content: `🛒 **TAMBAH ITEM KE KERANJANG (${orderId}):**\nSilakan pilih produk tambahan dari menu dropdown di bawah:`,
				components: [row],
				flags: MessageFlags.Ephemeral
			});
		}

		// Tombol Lanjut ke Pembayaran QRIS
		if (customId.startsWith('cart_checkout_')) {
			const orderId = customId.replace('cart_checkout_', '');
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });

			const qrisData = buildQrisPaymentEmbedForCart(orderId);
			if (!qrisData) {
				return interaction.editReply({ content: '❌ Data keranjang tidak ditemukan.' });
			}

			// Update Supabase Purchase record dengan total & rincian barang
			const cart = getCart(orderId);
			if (cart) {
				try {
					await updatePurchaseStatus(orderId, 'pending');
				} catch (e) {}
			}

			const qrisMsg = await interaction.channel.send({
				embeds: qrisData.embeds,
				components: qrisData.components,
				files: qrisData.files || []
			});

			qrisMessages.set(orderId.toUpperCase(), qrisMsg);

			return interaction.editReply({
				content: `✅ **PERINTAH PEMBAYARAN DI-GENERATE!** Silakan selesaikan pembayaran QRIS senilai **Rp ${qrisData.totalAmount.toLocaleString('id-ID')}** di atas.`
			});
		}

		// Tombol Sub-Range Abjad Kategori (misal Skin A-E, F-S, T-Z)
		if (customId.startsWith('subrange_Skin_')) {
			const rangeCode = customId.replace('subrange_Skin_', '');
			delete require.cache[require.resolve('../config/items')];
			const currentItems = require('../config/items');

			const subMenuData = getPanelManager().buildCategorySubMenuEphemeral(currentItems, 'Skin Fish It', rangeCode);
			const userId = interaction.user.id;

			await interaction.update({
				content: subMenuData.content || null,
				embeds: subMenuData.embeds || [],
				components: subMenuData.components
			});
			return;
		}

		// Tombol Kembali ke Kelompok Sub-Kategori (misal Skin A-Z)
		if (customId.startsWith('back_to_subcat_')) {
			const targetCat = customId.replace('back_to_subcat_', '');
			delete require.cache[require.resolve('../config/items')];
			const currentItems = require('../config/items');

			const subMenuData = getPanelManager().buildCategorySubMenuEphemeral(currentItems, targetCat, null);

			await interaction.update({
				content: subMenuData.content || null,
				embeds: subMenuData.embeds || [],
				components: subMenuData.components
			});
			return;
		}

		// Tombol Kembali (Tutup Menu Ephemeral Sub-Kategori)
		if (customId === 'back_to_main_cat') {
			try {
				await interaction.update({
					content: `ℹ️ **Navigasi Ditutup.** Silakan klik tombol kategori pada panel utama di atas jika ingin memilih produk lain!`,
					components: []
				});
				setTimeout(async () => {
					try { await interaction.deleteReply(); } catch (e) {}
				}, 1500);
			} catch (e) {}
			return;
		}

		// SOS Help Button
		if (customId === 'sos_help_button') {
			const sosUserEmbed = new EmbedBuilder()
				.setTitle('🆘  BEBEY STORE — BANTUAN ADMIN DIPANGGIL')
				.setColor(0xED4245)
				.setDescription(
					`Panggilan bantuan telah diaktifkan.\n` +
					`Tim Admin telah dipanggil untuk membantu di channel tiket ini.`
				)
				.setTimestamp();

			await interaction.reply({ embeds: [sosUserEmbed] });

			const adminChannelId = process.env.ADMIN_CHANNEL_ID ? process.env.ADMIN_CHANNEL_ID.trim() : null;
			if (adminChannelId) {
				try {
					const adminChannel = await client.channels.fetch(adminChannelId);
					if (adminChannel) {
						const orderId = interaction.channel.name ? interaction.channel.name.toUpperCase() : '';
						const sosAdminEmbed = new EmbedBuilder()
							.setTitle('🚨  BEBEY STORE — PANGGILAN DARURAT ADMIN (SOS)')
							.setColor(0xED4245)
							.setDescription(
								`Halo Admin! Pembeli **${interaction.user.tag}** membutuhkan bantuan Anda di channel tiket.`
							)
							.addFields(
								{ name: '🆔  ORDER ID', value: `\`${orderId}\``, inline: true },
								{ name: '👤  PEMANGGIL', value: `${interaction.user} (\`${interaction.user.tag}\`)`, inline: true },
								{ name: '📍  CHANNEL TIKET', value: `<#${interaction.channelId}> (\`${interaction.channelId}\`)`, inline: true }
							)
							.setTimestamp()
							.setFooter({ text: 'Klik link channel tiket di atas untuk membuka & merespon pembeli.' });

						const doneBtn = new ButtonBuilder()
							.setCustomId(`sos_done_${interaction.channelId}`)
							.setLabel('✅ Bantuan Selesai (Hapus Notif)')
							.setStyle(ButtonStyle.Success);

						const sosRow = new ActionRowBuilder().addComponents(doneBtn);

						await adminChannel.send({
							content: `@here 🚨 **SOS BANTUAN ADMIN!** User ${interaction.user} membutuhkan bantuan di <#${interaction.channelId}>!`,
							embeds: [sosAdminEmbed],
							components: [sosRow]
						});
					}
				} catch (err) {
					console.warn('⚠️ Gagal mengirim notifikasi SOS ke Admin Channel:', err);
				}
			}
			return;
		}

		// Close Ticket Button
		if (customId === 'close_ticket_button') {
			const ticketChan = interaction.channel;
			const orderId = ticketChan.name ? ticketChan.name.toUpperCase() : '';

			const closeEmbed = new EmbedBuilder()
				.setTitle('🔒  BEBEY STORE — TIKET DITUTUP')
				.setColor(0x7F8C8D)
				.setDescription('Channel tiket privat ini akan ditutup dan dihapus dalam **5 detik**...')
				.setTimestamp();

			try {
				if (!interaction.replied && !interaction.deferred) {
					await interaction.reply({ embeds: [closeEmbed] });
				}
			} catch (e) {}

			if (orderId) {
				deleteAdminChannelMessagesForOrder(client, orderId).catch(err => console.warn('Cleanup warning:', err));
			}
			deleteTicketCreationMessage(orderId, ticketChan.id);

			setTimeout(async () => {
				try {
					if (ticketChan) await ticketChan.delete();
				} catch (err) {
					if (err.code !== 10003 && err.status !== 404) {
						console.error('Error deleting ticket channel:', err);
					}
				}
			}, 5000);
			return;
		}

		// Finish Ticket Button
		if (customId === 'finish_ticket_button') {
			const ticketChan = interaction.channel;
			const orderId = ticketChan.name ? ticketChan.name.toUpperCase() : '';

			const finishEmbed = new EmbedBuilder()
				.setTitle('🎉  BEBEY STORE — TRANSAKSI SELESAI')
				.setColor(0x2ECC71)
				.setDescription(
					`**Terima kasih telah berbelanja di Bebey Store!**\n` +
					`Transaksi Anda telah selesai. Channel tiket privat ini akan ditutup dan dihapus otomatis dalam **5 detik**...`
				)
				.setTimestamp();

			try {
				if (!interaction.replied && !interaction.deferred) {
					await interaction.reply({ embeds: [finishEmbed] });
				}
			} catch (e) {}

			if (orderId) {
				deleteAdminChannelMessagesForOrder(client, orderId).catch(err => console.warn('Cleanup warning:', err));
			}
			deleteTicketCreationMessage(orderId, ticketChan.id);

			setTimeout(async () => {
				try {
					if (ticketChan) await ticketChan.delete();
				} catch (err) {
					if (err.code !== 10003 && err.status !== 404) {
						console.error('Error deleting finished ticket channel:', err);
					}
				}
			}, 5000);
			return;
		}

		// Save DM Receipt Proof
		if (customId.startsWith('save_dm_proof_')) {
			const orderId = customId.replace('save_dm_proof_', '');

			try {
				await interaction.deferReply({ flags: MessageFlags.Ephemeral });
			} catch (e) {}

			const purchase = await getPurchaseById(orderId);

			let deliveryProofUrl = null;
			let paymentProofUrl = null;

			try {
				const msgs = await interaction.channel.messages.fetch({ limit: 50 });
				for (const [id, msg] of msgs) {
					if (msg.embeds.length > 0) {
						const title = msg.embeds[0].title || '';
						if (title.includes('PEMBAYARAN DI-APPROVE') && msg.embeds[0].image) {
							deliveryProofUrl = msg.embeds[0].image.url;
						}
						if (title.includes('BUKTI TRANSFER DITERIMA') && msg.embeds[0].image) {
							paymentProofUrl = msg.embeds[0].image.url;
						}
					}
				}
			} catch (e) {}

			const itemName = purchase ? purchase.item_name : 'Produk Bebey Store';
			const itemPrice = purchase ? purchase.price : 0;
			const robloxUser = purchase ? (purchase.roblox_username || 'N/A') : 'N/A';
			const formattedPrice = `Rp ${itemPrice.toLocaleString('id-ID')}`;

			const receiptEmbed = new EmbedBuilder()
				.setTitle('🧾  BEBEY STORE — STRUK BUKTI TRANSAKSI & PENGIRIMAN')
				.setColor(0x2ECC71)
				.setDescription(
					`Halo ${interaction.user}! Berikut adalah **Struk Bukti Resmi Transaksi & Pengiriman** dari toko Bebey Store.\n` +
					`Simpan pesan ini sebagai bukti sah transaksi Anda.`
				)
				.addFields(
					{ name: '🆔 ORDER ID', value: `\`${orderId}\``, inline: true },
					{ name: '📦 ITEM DIBELI', value: `**${itemName}**`, inline: true },
					{ name: '💰 TOTAL BAYAR', value: `**${formattedPrice}**`, inline: true },
					{ name: '👤 USERNAME ROBLOX', value: `\`${robloxUser}\``, inline: true },
					{ name: '📅 TANGGAL', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
					{ name: '🔒 STATUS', value: '`✅ SELESAI & TERVERIFIKASI`', inline: true }
				)
				.setTimestamp()
				.setFooter({ text: '💖 Bebey Store Official • Terima kasih telah berbelanja di Bebey Store!' });

			const embedsToSend = [receiptEmbed];

			if (deliveryProofUrl) {
				const deliveryEmbed = new EmbedBuilder()
					.setTitle('📸  BUKTI PENGIRIMAN ITEM (ADMIN)')
					.setColor(0x3498DB)
					.setImage(deliveryProofUrl);
				embedsToSend.push(deliveryEmbed);
			}

			try {
				await interaction.user.send({ embeds: embedsToSend });
				return interaction.editReply({
					content: `📩 **Struk bukti transaksi berhasil dikirimkan ke DM Anda!** Silakan periksa pesan masuk (Direct Message) dari Bot.`
				});
			} catch (err) {
				return interaction.editReply({
					content: `⚠️ Gagal mengirim bukti ke DM. Pastikan akun Discord Anda mengizinkan Direct Message (DM) dari anggota server!`
				});
			}
		}
	}
}

module.exports = { handleBuyerInteraction };
