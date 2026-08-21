const { 
	EmbedBuilder, 
	ActionRowBuilder, 
	ButtonBuilder, 
	ButtonStyle, 
	MessageFlags, 
	ChannelType, 
	PermissionFlagsBits,
	AttachmentBuilder
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { createPurchase, updatePurchaseStatus } = require('./supabase');
const { updateGlobalPanel } = require('./panelManager');

const userEphemeralInteractions = new Map();
const ticketCreationInteractions = new Map();
const buyerPendingProofs = new Map();
const qrisMessages = new Map();
const pendingAdminDeliveryProof = new Map();
const adminInstructionInteractions = new Map();

async function disableQrisButtonForOrder(orderId, channel) {
	const cleanOrderId = orderId ? orderId.toUpperCase() : null;
	if (cleanOrderId && qrisMessages.has(cleanOrderId)) {
		const qrisMsg = qrisMessages.get(cleanOrderId);
		try {
			await qrisMsg.edit({ components: [] });
		} catch (e) {}
	}
	if (channel) {
		try {
			const msgs = await channel.messages.fetch({ limit: 25 });
			for (const [id, msg] of msgs) {
				if (msg.embeds.length > 0 && msg.components.length > 0) {
					const title = msg.embeds[0].title || '';
					if (title.includes('INSTRUKSI PEMBAYARAN QRIS') || title.includes('CARA BAYAR VIA QRIS')) {
						await msg.edit({ components: [] });
					}
				}
			}
		} catch (e) {}
	}
}

async function deleteTicketCreationMessage(orderId, channelId) {
	const cleanOrderId = orderId ? orderId.toUpperCase() : null;
	const chanId = channelId ? String(channelId) : null;

	let targetInteraction = null;
	if (cleanOrderId && ticketCreationInteractions.has(cleanOrderId)) {
		targetInteraction = ticketCreationInteractions.get(cleanOrderId);
	} else if (chanId && ticketCreationInteractions.has(chanId)) {
		targetInteraction = ticketCreationInteractions.get(chanId);
	}

	if (targetInteraction) {
		try {
			await targetInteraction.deleteReply();
		} catch (err) {}
		if (cleanOrderId) ticketCreationInteractions.delete(cleanOrderId);
		if (chanId) ticketCreationInteractions.delete(chanId);
	}
}

async function executeOrderApproval(clientInstance, orderId, proofUrl, notes = '', adminUser = null, originalMessage = null, interactionToReply = null) {
	await updatePurchaseStatus(orderId, 'fulfilled');
	updateGlobalPanel(clientInstance);

	const cleanOrderId = orderId.toUpperCase();

	// 1. Hapus pesan instruksi cara kirim bukti pengiriman jika ada
	if (adminInstructionInteractions.has(cleanOrderId)) {
		try {
			const instInteraction = adminInstructionInteractions.get(cleanOrderId);
			await instInteraction.deleteReply();
		} catch (e) {}
		adminInstructionInteractions.delete(cleanOrderId);
	}

	// 2. Cari dan hapus pesan instruksi di Admin Channel jika berbentuk pesan biasa
	const adminChannelId = process.env.ADMIN_CHANNEL_ID ? process.env.ADMIN_CHANNEL_ID.trim() : null;
	if (adminChannelId) {
		try {
			const adminChannel = await clientInstance.channels.fetch(adminChannelId);
			if (adminChannel) {
				const recentMsgs = await adminChannel.messages.fetch({ limit: 50 });
				for (const [id, msg] of recentMsgs) {
					if (msg.content && msg.content.includes('CARA KIRIM BUKTI PENGIRIMAN') && msg.content.includes(cleanOrderId)) {
						try { await msg.delete(); } catch (e) {}
					}
				}
			}
		} catch (e) {}
	}

	if (originalMessage) {
		try {
			const updatedEmbed = EmbedBuilder.from(originalMessage.embeds[0])
				.setColor(0x2ECC71)
				.setTitle('✅  TRANSAKSI DI-APPROVE BY ADMIN');

			if (proofUrl) {
				updatedEmbed.setImage(proofUrl);
			}

			await originalMessage.edit({ embeds: [updatedEmbed], components: [] });
		} catch (e) {}
	}

	if (interactionToReply && !interactionToReply.replied && !interactionToReply.deferred) {
		try {
			await interactionToReply.reply({
				content: `✅ **TRANSAKSI DI-APPROVE!** Bukti pengiriman item untuk order \`${orderId}\` telah berhasil dikirimkan ke pembeli.`,
				flags: MessageFlags.Ephemeral
			});
		} catch (e) {}
	}

	const targetChannelName = orderId.toLowerCase();
	try {
		let targetGuild = clientInstance.guilds.cache.first();
		if (targetGuild) {
			const channels = await targetGuild.channels.fetch();
			const ticketChannel = channels.find(c => c && c.name === targetChannelName);
			if (ticketChannel) {
				let buyerMention = '';
				if (originalMessage && originalMessage.embeds.length > 0) {
					const buyerField = originalMessage.embeds[0].fields?.find(f => f.name.includes('PEMBELI'));
					if (buyerField) buyerMention = buyerField.value;
				}

				const notesText = notes ? `📝 **Catatan Admin:** ${notes}\n\n` : '';

				const approvedEmbed = new EmbedBuilder()
					.setTitle('✅  BEBEY STORE — PEMBAYARAN DI-APPROVE!')
					.setColor(0x2ECC71)
					.setDescription(
						`Hore ${buyerMention}! 🎉 Pembayaran kamu untuk order \`${orderId}\` **sudah diterima & item telah dikirim oleh Admin**.\n\n` +
						notesText +
						`📸 **Foto Bukti Pengiriman Admin:**\n` +
						`(Foto screenshot pengiriman dari Admin bisa kamu lihat pada gambar di bawah ini)\n\n` +
						`⚠️ **PENTING:**\n` +
						`Silakan cek akun Roblox kamu dulu. Klik tombol **Selesai** di bawah KALAU item sudah benar-benar masuk ya!`
					)
					.setTimestamp()
					.setFooter({ text: '💖 Bebey Store Official' });

				if (proofUrl) {
					approvedEmbed.setImage(proofUrl);
				}

				const finishTicketBtn = new ButtonBuilder()
					.setCustomId('finish_ticket_button')
					.setLabel('✅ Selesai (Item Sudah Diterima)')
					.setStyle(ButtonStyle.Success);

				const saveDmBtn = new ButtonBuilder()
					.setCustomId(`save_dm_proof_${orderId}`)
					.setLabel('📩 Simpan Bukti ke DM')
					.setStyle(ButtonStyle.Primary);

				const finishRow = new ActionRowBuilder().addComponents(finishTicketBtn, saveDmBtn);

				// Cek apakah pesan approve sudah pernah dikirim di channel tiket ini (untuk fitur ganti bukti pengiriman)
				const ticketMsgs = await ticketChannel.messages.fetch({ limit: 50 });
				const existingApprovedMsg = ticketMsgs.find(m => 
					m.embeds.length > 0 && 
					m.embeds[0].title && 
					m.embeds[0].title.includes('PEMBAYARAN DI-APPROVE')
				);

				if (existingApprovedMsg) {
					await existingApprovedMsg.edit({
						embeds: [approvedEmbed],
						components: [finishRow]
					});
					console.log(`[PROOF UPDATE] Bukti pengiriman untuk ${orderId} berhasil diperbarui di channel tiket.`);
				} else {
					await ticketChannel.send({ 
						content: buyerMention ? `🔔 Halo ${buyerMention}, transaksi Anda telah disetujui!` : null, 
						embeds: [approvedEmbed], 
						components: [finishRow] 
					});
				}
			}
		}
	} catch (err) {
		console.warn('⚠️ Tidak dapat mengirim notifikasi approve ke channel tiket pembeli:', err);
	}
}

function buildQrisPaymentEmbed(selectedItem, orderId, totalAmount, qrisImage, uniqueCode = 0, quantity = 1) {
	const itemEmoji = selectedItem.emoji || '📦';
	const formattedPrice = `Rp ${totalAmount.toLocaleString('id-ID')}`;
	const itemQty = Math.max(1, parseInt(quantity) || 1);

	const qtyLabel = itemQty > 1 ? ` (x${itemQty})` : '';
	const qtyDetailLine = itemQty > 1 
		? `🔢 **Jumlah:** **${itemQty} Pcs** (@ Rp ${Number(selectedItem.price || 0).toLocaleString('id-ID')})\n` 
		: '';

	const paymentDescription = 
		`📦 **Produk:** ${itemEmoji} **${selectedItem.name}**${qtyLabel}\n` +
		qtyDetailLine +
		`💰 **Total Bayar:** **${formattedPrice}**\n` +
		`🆔 **Order ID:** \`${orderId}\`\n\n` +
		`📌 **CARA BAYAR:**\n` +
		`1️⃣ Scan QRIS di bawah pakai E-Wallet / M-Banking kamu.\n` +
		`2️⃣ Bayar **tepat ${formattedPrice}**.\n` +
		`3️⃣ Screenshot resi bukti transfernya.\n\n` +
		`‼️ **SYARAT FOTO BUKTI:**\n` +
		`• Jam HP & persentase baterai wajib keliatan\n` +
		`• Status transfer sukses & tanggal wajib jelas\n` +
		`• Jangan di-crop atau disensor ya!\n\n` +
		`4️⃣ Kirim foto bukti di channel tiket ini.\n` +
		`5️⃣ Klik tombol **Saya Sudah Transfer** di bawah.`;

	const paymentEmbed = new EmbedBuilder()
		.setTitle(`💳  CARA BAYAR VIA QRIS`)
		.setColor(0x3498DB)
		.setDescription(paymentDescription.trim())
		.setTimestamp()
		.setFooter({ text: '💖 Bebey Store Official' });

	const files = [];
	const imageTarget = qrisImage || process.env.QRIS_IMAGE_URL || './assets/qris.jpg';

	if (imageTarget.startsWith('http://') || imageTarget.startsWith('https://')) {
		paymentEmbed.setImage(imageTarget);
	} else {
		const resolvedPath = path.isAbsolute(imageTarget) 
			? imageTarget 
			: path.join(__dirname, '..', imageTarget);

		if (fs.existsSync(resolvedPath)) {
			const filename = path.basename(resolvedPath);
			const attachment = new AttachmentBuilder(resolvedPath, { name: filename });
			files.push(attachment);
			paymentEmbed.setImage(`attachment://${filename}`);
		} else {
			paymentEmbed.setImage('https://dummyimage.com/600x600/0984e3/ffffff.png&text=QRIS+BEBEY+STORE');
		}
	}

	const transferredBtn = new ButtonBuilder()
		.setCustomId(`already_transferred_${orderId}`)
		.setLabel('✅ Saya Sudah Transfer')
		.setStyle(ButtonStyle.Success);

	const row = new ActionRowBuilder().addComponents(transferredBtn);

	const result = { embeds: [paymentEmbed], components: [row] };
	if (files.length > 0) {
		result.files = files;
	}

	return result;
}

const activeCarts = new Map();
const cartMessages = new Map();

function getCart(orderId) {
	if (!orderId) return null;
	return activeCarts.get(orderId.toUpperCase()) || null;
}

function initCart(orderId, userId, robloxUsername, selectedItem, quantity, uniqueCode) {
	const cleanOrderId = orderId.toUpperCase();
	const itemQty = Math.max(1, parseInt(quantity) || 1);

	const initialItem = {
		id: selectedItem.id,
		name: selectedItem.name,
		price: Number(selectedItem.price || 0),
		emoji: selectedItem.emoji || '📦',
		category: selectedItem.category,
		quantity: itemQty,
		subtotal: Number(selectedItem.price || 0) * itemQty
	};

	const cart = {
		orderId: cleanOrderId,
		userId: userId,
		robloxUsername: robloxUsername,
		uniqueCode: uniqueCode,
		items: [initialItem],
		isCheckedOut: false
	};

	activeCarts.set(cleanOrderId, cart);
	return cart;
}

function addItemToCart(orderId, item, quantity = 1) {
	const cleanOrderId = orderId.toUpperCase();
	const cart = activeCarts.get(cleanOrderId);
	if (!cart) return null;

	const itemQty = Math.max(1, parseInt(quantity) || 1);
	const existingIndex = cart.items.findIndex(i => i.id === item.id);

	if (existingIndex >= 0) {
		cart.items[existingIndex].quantity += itemQty;
		cart.items[existingIndex].subtotal = cart.items[existingIndex].price * cart.items[existingIndex].quantity;
	} else {
		cart.items.push({
			id: item.id,
			name: item.name,
			price: Number(item.price || 0),
			emoji: item.emoji || '📦',
			category: item.category,
			quantity: itemQty,
			subtotal: Number(item.price || 0) * itemQty
		});
	}

	activeCarts.set(cleanOrderId, cart);
	return cart;
}

function buildCartEmbedAndComponents(orderId) {
	const cleanOrderId = orderId.toUpperCase();
	const cart = activeCarts.get(cleanOrderId);
	if (!cart) return null;

	let subtotalAll = 0;
	let itemsListStr = '';

	cart.items.forEach((item, index) => {
		subtotalAll += item.subtotal;
		itemsListStr += `**${index + 1}.** ${item.emoji} **${item.name}**\n` +
						`└ \`${item.quantity} Pcs\` @ Rp ${item.price.toLocaleString('id-ID')} = **Rp ${item.subtotal.toLocaleString('id-ID')}**\n\n`;
	});

	const userLine = (cart.robloxUsername && cart.robloxUsername !== 'Tidak Perlu') 
		? `👤 **Username Roblox:** \`${cart.robloxUsername}\`\n\n` 
		: '';

	const cartDescription = 
		`Halo <@${cart.userId}>! Berikut adalah **Detail Pesanan** kamu:\n\n` +
		userLine +
		`📦 **DAFTAR PRODUK PESANAN:**\n` +
		itemsListStr +
		`🆔 **Order ID:** \`${cart.orderId}\`\n` +
		`💰 **Subtotal Produk:** **Rp ${subtotalAll.toLocaleString('id-ID')}**`;

	const cartEmbed = new EmbedBuilder()
		.setTitle(`🎫  BEBEY STORE — DETAIL PESANAN`)
		.setColor(0x3498DB)
		.setDescription(cartDescription.trim())
		.setTimestamp()
		.setFooter({ text: `💖 Bebey Store Official • ${cart.orderId}` });

	const btnSos = new ButtonBuilder()
		.setCustomId('sos_help_button')
		.setLabel('🆘 Bantuan Admin')
		.setStyle(ButtonStyle.Danger);

	const btnClose = new ButtonBuilder()
		.setCustomId('close_ticket_button')
		.setLabel('🔒 Batal / Tutup Tiket')
		.setStyle(ButtonStyle.Secondary);

	const row = new ActionRowBuilder().addComponents(btnSos, btnClose);

	return { embeds: [cartEmbed], components: [row] };
}

function buildQrisPaymentEmbedForCart(orderId, qrisImageOverride = null) {
	const cleanOrderId = orderId.toUpperCase();
	const cart = activeCarts.get(cleanOrderId);
	if (!cart) return null;

	let subtotalAll = 0;
	let itemsDetailStr = '';

	cart.items.forEach((item, index) => {
		subtotalAll += item.subtotal;
		itemsDetailStr += `${item.emoji} **${item.name}** (x${item.quantity}) • \`Rp ${item.subtotal.toLocaleString('id-ID')}\`\n`;
	});

	const totalAmount = subtotalAll + cart.uniqueCode;
	const qrisImage = qrisImageOverride || process.env.QRIS_IMAGE_URL || './assets/qris.jpg';

	const itemSummaryName = cart.items.map(i => `${i.name} (x${i.quantity})`).join(', ');

	const robloxLine = (cart.robloxUsername && cart.robloxUsername !== 'Tidak Perlu') 
		? `👤 **Username Roblox:** \`${cart.robloxUsername}\`\n\n` 
		: '\n';

	const paymentEmbed = new EmbedBuilder()
		.setTitle('💳  BEBEY STORE — PEMBAYARAN QRIS')
		.setColor(0xF1C40F)
		.setDescription(
			`Silakan selesaikan pembayaran untuk **${cart.items.length} jenis item** di keranjang kamu:\n\n` +
			itemsDetailStr + `\n` +
			`🆔 **Order ID:** \`${cart.orderId}\`\n` +
			robloxLine +
			`⚠️ **JUMLAH PERSIS YANG WAJIB DITRANSFER:**\n` +
			`# 💰 **Rp ${totalAmount.toLocaleString('id-ID')}**\n\n` +
			`📌 **Petunjuk Pembayaran:**\n` +
			`1. Scan QRIS di atas menggunakan E-Wallet (Gopay, OVO, Dana, ShopeePay, LinkAja) atau Mobile Banking (BCA, Mandiri, BRI, BNI).\n` +
			`2. Pastikan nominal transfer **SANGAT PERSIS Rp ${totalAmount.toLocaleString('id-ID')}** *(Termasuk kode unik 3 digit terakhir)*.\n` +
			`3. Setelah transfer berhasil, klik tombol **"✅ Saya Sudah Transfer"** atau upload foto/screenshot bukti transfer di channel ini.`
		)
		.setTimestamp()
		.setFooter({ text: `⚡ Bebey Store Official • ${cart.orderId}` });

	const files = [];
	const imageTarget = qrisImage;

	if (imageTarget.startsWith('http://') || imageTarget.startsWith('https://')) {
		paymentEmbed.setImage(imageTarget);
	} else {
		const resolvedPath = path.isAbsolute(imageTarget) 
			? imageTarget 
			: path.join(__dirname, '..', imageTarget);

		if (fs.existsSync(resolvedPath)) {
			const filename = path.basename(resolvedPath);
			const attachment = new AttachmentBuilder(resolvedPath, { name: filename });
			files.push(attachment);
			paymentEmbed.setImage(`attachment://${filename}`);
		} else {
			paymentEmbed.setImage('https://dummyimage.com/600x600/0984e3/ffffff.png&text=QRIS+BEBEY+STORE');
		}
	}

	const transferredBtn = new ButtonBuilder()
		.setCustomId(`already_transferred_${cart.orderId}`)
		.setLabel('✅ Saya Sudah Transfer')
		.setStyle(ButtonStyle.Success);

	const row = new ActionRowBuilder().addComponents(transferredBtn);

	const result = { embeds: [paymentEmbed], components: [row], totalAmount, itemSummaryName };
	if (files.length > 0) result.files = files;
	return result;
}

async function createTicketChannel(interaction, selectedItem, robloxData = 'Tidak Perlu', client, quantity = 1, additionalItems = []) {
	const robloxUsername = (typeof robloxData === 'object' && robloxData !== null) ? robloxData.username : String(robloxData);
	const robloxDisplayName = (typeof robloxData === 'object' && robloxData !== null) ? (robloxData.displayName || robloxUsername) : robloxUsername;
	const robloxUserId = (typeof robloxData === 'object' && robloxData !== null) ? robloxData.id : null;

	const itemQty = Math.max(1, parseInt(quantity) || 1);

	const itemCode = (selectedItem.id || 'ITEM').toUpperCase();
	const randomHash = uuidv4().substring(0, 4).toUpperCase();
	const orderId = `${itemCode}-${randomHash}`;
	const channelName = orderId.toLowerCase();

	// Generate Kode Unik 3 Digit Terakhir (1 - 999) di Background
	const uniqueCode = Math.floor(Math.random() * 999) + 1;
	const basePrice = Number(selectedItem.price || 0) * itemQty;
	const totalAmount = basePrice + uniqueCode;

	const qrisImage = process.env.QRIS_IMAGE_URL || 'https://dummyimage.com/600x600/0984e3/ffffff.png&text=QRIS+BEBEY+STORE';

	try {
		const categoryId = process.env.TICKET_CATEGORY_ID ? process.env.TICKET_CATEGORY_ID.trim() : null;

		const channelData = {
			name: channelName,
			type: ChannelType.GuildText,
			permissionOverwrites: [
				{
					id: interaction.guild.id,
					deny: [PermissionFlagsBits.ViewChannel],
				},
				{
					id: interaction.user.id,
					allow: [
						PermissionFlagsBits.ViewChannel, 
						PermissionFlagsBits.SendMessages, 
						PermissionFlagsBits.ReadMessageHistory,
						PermissionFlagsBits.AttachFiles
					],
				},
				{
					id: interaction.client.user.id,
					allow: [
						PermissionFlagsBits.ViewChannel, 
						PermissionFlagsBits.SendMessages, 
						PermissionFlagsBits.ManageChannels,
						PermissionFlagsBits.EmbedLinks
					],
				},
			],
		};

		if (categoryId) {
			channelData.parent = categoryId;
		}

		const ticketChannel = await interaction.guild.channels.create(channelData);

		const channelUrl = `https://discord.com/channels/${interaction.guild.id}/${ticketChannel.id}`;
		const openTicketBtn = new ButtonBuilder()
			.setLabel('🚀 Buka Channel Tiket Kamu')
			.setStyle(ButtonStyle.Link)
			.setURL(channelUrl);

		const openRow = new ActionRowBuilder().addComponents(openTicketBtn);

		const replyMsg = `✅ **TIKET BERHASIL DIBUAT!** Klik tombol **"🚀 Buka Channel Tiket Kamu"** di bawah atau tekan ${ticketChannel} untuk langsung masuk ke channel tiket privat kamu!`;
		if (interaction.deferred) {
			await interaction.editReply({ content: replyMsg, embeds: [], components: [openRow] });
		} else {
			await interaction.reply({ content: replyMsg, embeds: [], components: [openRow], flags: MessageFlags.Ephemeral });
		}

		ticketCreationInteractions.set(orderId.toUpperCase(), interaction);
		ticketCreationInteractions.set(ticketChannel.id, interaction);

		// Inisialisasi Keranjang Belanja untuk pesanan ini
		initCart(orderId, interaction.user.id, robloxUsername, selectedItem, itemQty, uniqueCode);

		if (additionalItems && Array.isArray(additionalItems) && additionalItems.length > 0) {
			additionalItems.forEach(item => {
				const itemObj = item.itemObj || item;
				const qty = item.quantity || 1;
				addItemToCart(orderId, itemObj, qty);
			});
		}

		const cartData = buildCartEmbedAndComponents(orderId);
		const cartMsg = await ticketChannel.send(cartData);
		cartMessages.set(orderId.toUpperCase(), cartMsg);

		if (robloxUsername && robloxUsername !== 'Tidak Perlu') {
			const isFound = robloxUserId !== null && robloxData?.found !== false;
			const { getRobloxAvatarHeadshot } = require('./roblox');
			const avatarUrl = isFound ? await getRobloxAvatarHeadshot(robloxUserId) : null;

			const changeNoBtn = new ButtonBuilder()
				.setCustomId(`change_roblox_${orderId}`)
				.setLabel('✏️ Ganti Username')
				.setStyle(ButtonStyle.Danger);

			if (isFound) {
				const confirmEmbed = new EmbedBuilder()
					.setTitle('👤  AKUN ROBLOX KAMU')
					.setColor(0xF1C40F)
					.setDescription(
						`Coba cek, apakah ini akun Roblox kamu?\n\n` +
						`📛 **Username:** \`${robloxUsername}\`\n` +
						`✨ **Display Name:** **${robloxDisplayName}**\n` +
						`🔢 **User ID:** \`${robloxUserId || 'N/A'}\`\n\n` +
						`Jika data akun di atas sudah benar, silakan tekan tombol **"✅ Iya, Ini Akun Saya"** di bawah untuk melanjutkan ke pembayaran QRIS!`
					)
					.setFooter({ text: `💖 Bebey Store • ${orderId}` });

				if (avatarUrl) {
					confirmEmbed.setThumbnail(avatarUrl);
				}

				const confirmYesBtn = new ButtonBuilder()
					.setCustomId(`confirm_roblox_${orderId}`)
					.setLabel('✅ Iya, Ini Akun Saya')
					.setStyle(ButtonStyle.Success);

				const confirmRow = new ActionRowBuilder().addComponents(confirmYesBtn, changeNoBtn);

				await ticketChannel.send({
					embeds: [confirmEmbed],
					components: [confirmRow]
				});
			} else {
				const notFoundEmbed = new EmbedBuilder()
					.setTitle('❌  AKUN ROBLOX TIDAK DITEMUKAN')
					.setColor(0xED4245)
					.setDescription(
						`⚠️ **USERNAME ROBLOX TIDAK DITEMUKAN!**\n\n` +
						`> Username Roblox \`${robloxUsername}\` tidak terdaftar di database resmi Roblox.\n` +
						`> Silakan periksa kembali ejaan Username kamu (tanpa menggunakan simbol @).\n` +
						`> Tekan tombol **✏️ Ganti Username** di bawah untuk memasukkan Username Roblox yang benar!`
					)
					.setFooter({ text: `💖 Bebey Store • ${orderId}` });

				const notFoundRow = new ActionRowBuilder().addComponents(changeNoBtn);

				await ticketChannel.send({
					embeds: [notFoundEmbed],
					components: [notFoundRow]
				});
			}
		}

		const recordItemName = itemQty > 1 ? `${selectedItem.name} (x${itemQty})` : selectedItem.name;
		await createPurchase(orderId, robloxUsername, recordItemName, totalAmount, uniqueCode, 'pending', interaction.user.tag);

		if (!robloxUsername || robloxUsername === 'Tidak Perlu') {
			const qrisData = buildQrisPaymentEmbedForCart(orderId);
			if (qrisData) {
				const qrisMsg = await ticketChannel.send({
					embeds: qrisData.embeds,
					components: qrisData.components,
					files: qrisData.files || []
				});
				qrisMessages.set(orderId.toUpperCase(), qrisMsg);
			}
		}

	} catch (err) {
		console.error('Error creating ticket channel:', err);
		if (interaction.deferred) {
			await interaction.editReply({ content: '❌ Gagal membuat channel tiket. Pastikan Bot memiliki izin `Manage Channels`!' });
		} else {
			await interaction.reply({ content: '❌ Gagal membuat channel tiket. Pastikan Bot memiliki izin `Manage Channels`!', flags: MessageFlags.Ephemeral });
		}
	}
}

async function deleteAdminChannelMessagesForOrder(clientInstance, orderId, channelId) {
	const adminChannelId = process.env.ADMIN_CHANNEL_ID ? process.env.ADMIN_CHANNEL_ID.trim() : null;
	if (!adminChannelId) return;

	try {
		const adminChannel = await clientInstance.channels.fetch(adminChannelId);
		if (!adminChannel) return;

		const fetchedMessages = await adminChannel.messages.fetch({ limit: 100 });
		const cleanOrderId = orderId ? orderId.toUpperCase() : null;
		const ticketChannelPattern = orderId ? orderId.toLowerCase() : null;
		const targetChanId = channelId ? String(channelId) : null;

		const deletedMsgIds = new Set();

		for (const [id, msg] of fetchedMessages) {
			const msgText = (msg.content || '') + ' ' + (msg.embeds.map(e => (e.title || '') + ' ' + (e.description || '') + ' ' + (e.fields ? e.fields.map(f => f.name + ' ' + f.value).join(' ') : '')).join(' '));

			let isMatch = false;
			if (cleanOrderId && cleanOrderId.length > 2 && msgText.toUpperCase().includes(cleanOrderId)) isMatch = true;
			if (ticketChannelPattern && ticketChannelPattern.length > 2 && msgText.toLowerCase().includes(ticketChannelPattern)) isMatch = true;
			if (targetChanId && targetChanId.length > 4 && msgText.includes(targetChanId)) isMatch = true;

			if (isMatch) {
				deletedMsgIds.add(msg.id);
				try {
					await msg.delete();
					console.log(`[AUTO-CLEANUP ADMIN] Pesan transaksi/SOS di Admin Channel untuk ${orderId || channelId} telah dihapus.`);
				} catch (e) {}
			}
		}

		for (const [id, msg] of fetchedMessages) {
			if (msg.reference && msg.reference.messageId && deletedMsgIds.has(msg.reference.messageId)) {
				try {
					await msg.delete();
					console.log(`[AUTO-CLEANUP ADMIN] Pesan balasan (reply) foto bukti pengiriman di Admin Channel untuk ${orderId || channelId} telah dihapus.`);
				} catch (e) {}
			}
		}
	} catch (err) {
		console.warn('⚠️ Gagal menghapus pesan transaksi di Admin Channel:', err);
	}
}

async function checkAndCleanupExpiredTickets(clientInstance) {
	const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
	const now = Date.now();

	try {
		const guilds = clientInstance.guilds.cache;
		for (const [guildId, guild] of guilds) {
			const channels = await guild.channels.fetch();
			for (const [channelId, channel] of channels) {
				const isTicketChannel = channel && channel.name && (
					channel.name.includes('-bb-') || 
					(process.env.TICKET_CATEGORY_ID && channel.parentId === process.env.TICKET_CATEGORY_ID.trim())
				);

				if (isTicketChannel) {
					const channelAge = now - channel.createdTimestamp;
					if (channelAge >= TWENTY_FOUR_HOURS_MS) {
						console.log(`[AUTO-CLEANUP] Menutup tiket kadaluarsa (>24 Jam): #${channel.name}`);
						const orderId = channel.name.toUpperCase();
						await deleteAdminChannelMessagesForOrder(clientInstance, orderId);
						await deleteTicketCreationMessage(orderId, channel.id);
						try {
							const timeoutEmbed = new EmbedBuilder()
								.setTitle('⏰  BEBEY STORE — TIKET KADALUARSA (24 JAM)')
								.setColor(0x7F8C8D)
								.setDescription(
									`> ⚠️ Tiket ini telah dibuka >24 jam tanpa transaksi.\n` +
									`> Channel ini akan ditutup dan dihapus otomatis dalam **5 detik**.`
								)
								.setTimestamp();

							await channel.send({ embeds: [timeoutEmbed] });
							setTimeout(async () => {
								try { if (channel) await channel.delete(); } catch (e) {}
							}, 5000);
						} catch (err) {
							try { if (channel) await channel.delete(); } catch (e) {}
						}
					}
				}
			}
		}
	} catch (err) {
		console.error('Error during ticket cleanup scan:', err);
	}
}

module.exports = {
	userEphemeralInteractions,
	ticketCreationInteractions,
	buyerPendingProofs,
	qrisMessages,
	cartMessages,
	pendingAdminDeliveryProof,
	adminInstructionInteractions,
	disableQrisButtonForOrder,
	deleteTicketCreationMessage,
	executeOrderApproval,
	buildQrisPaymentEmbed,
	createTicketChannel,
	deleteAdminChannelMessagesForOrder,
	checkAndCleanupExpiredTickets,
	getCart,
	initCart,
	addItemToCart,
	buildCartEmbedAndComponents,
	buildQrisPaymentEmbedForCart
};
