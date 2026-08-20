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
	disableQrisButtonForOrder, 
	deleteTicketCreationMessage, 
	buildQrisPaymentEmbed, 
	createTicketChannel, 
	deleteAdminChannelMessagesForOrder 
} = require('../services/ticketManager');
const { validateRobloxUsername, getRobloxAvatarHeadshot } = require('../services/roblox');
const { supabase } = require('../services/supabase');
const { isAdmin } = require('../services/admins');
const { buildCategorySubMenuEphemeral } = require('../services/panelManager');

async function handleBuyerInteraction(interaction, client) {
	// 1. Dropdown Select Menu (Pilih Item Produk)
	if (interaction.isStringSelectMenu()) {
		if (interaction.customId === 'select_shop_item') {
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

			if (selectedItem.requireUsername === false) {
				await createTicketChannel(interaction, selectedItem, 'Tidak Perlu', client);

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

			const actionRow = new ActionRowBuilder().addComponents(usernameInput);
			modal.addComponents(actionRow);

			return interaction.showModal(modal);
		}
	}

	// 2. Modal Submissions (Form Beli & Ganti Username)
	if (interaction.isModalSubmit()) {
		if (interaction.customId.startsWith('modal_buy_')) {
			delete require.cache[require.resolve('../config/items')];
			const currentItems = require('../config/items');

			const itemId = interaction.customId.replace('modal_buy_', '');
			const selectedItem = currentItems.find(i => i.id === itemId);
			let robloxUsername = interaction.fields.getTextInputValue('roblox_username').trim();

			if (!selectedItem) {
				return interaction.reply({ content: '❌ Item tidak ditemukan.', flags: MessageFlags.Ephemeral });
			}

			await interaction.deferReply({ flags: MessageFlags.Ephemeral });

			const robloxCheck = await validateRobloxUsername(robloxUsername);

			if (!robloxCheck.valid || !robloxCheck.found) {
				return interaction.editReply({
					content: `❌ **USERNAME ROBLOX TIDAK DITEMUKAN!**\n` +
						`> Username Roblox \`${robloxUsername}\` tidak terdaftar di database resmi Roblox.\n` +
						`> Silakan periksa kembali ejaan Username Anda dan coba pilih produk lagi (langsung username, tanpa simbol @).`
				});
			}

			await createTicketChannel(interaction, selectedItem, robloxCheck, client);

			const prevInteraction = userEphemeralInteractions.get(interaction.user.id);
			if (prevInteraction) {
				try {
					await prevInteraction.deleteReply();
				} catch (e) {}
				userEphemeralInteractions.delete(interaction.user.id);
			}
			return;
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

			await supabase.from('purchases').update({ roblox_username: robloxCheck.username }).eq('order_id', orderId);

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
			const { data: purchase } = await supabase.from('purchases').select('item_name').eq('order_id', orderId).single();

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
			const { data: purchase } = await supabase.from('purchases').select('item_name, price, unique_code').eq('order_id', orderId).single();

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

			const isRobuxCategory = selectedItem.category && selectedItem.category.toLowerCase().includes('robux');
			const requireLimitCheck = selectedItem.requireLimitCheck !== undefined ? selectedItem.requireLimitCheck : isRobuxCategory;

			if (!requireLimitCheck) {
				const qrisImage = process.env.QRIS_IMAGE_URL || 'https://dummyimage.com/600x600/0984e3/ffffff.png&text=QRIS+BEBEY+STORE';
				const qrisCard = buildQrisPaymentEmbed(selectedItem, orderId, totalAmount, qrisImage, uniqueCode);

				const qrisMsg = await interaction.channel.send({
					embeds: qrisCard.embeds,
					components: qrisCard.components
				});
				qrisMessages.set(orderId.toUpperCase(), qrisMsg);
				return;
			}

			const limitDescription = 
				`Halo **${interaction.user}**, sebelum bayar, cek dulu apakah akun Roblox kamu kena limit atau tidak ya. 🙏\n\n` +
				`Ini supaya Robux kamu masuk penuh dan tidak nyangkut.\n\n` +
				`Kalau bingung cara ceknya, klik tombol **Cara Cek Limit** di bawah!`;

			const limitEmbed = new EmbedBuilder()
				.setTitle('🔍  CEK LIMIT AKUN DULU YUK!')
				.setColor(0xF1C40F)
				.setDescription(limitDescription.trim())
				.setFooter({ text: `💖 Bebey Store • ${orderId}` });

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
				.setLabel('📖 Cara Cek Limit')
				.setStyle(ButtonStyle.Secondary);

			const limitRow1 = new ActionRowBuilder().addComponents(notLimitBtn, isLimitBtn);
			const limitRow2 = new ActionRowBuilder().addComponents(guideBtn);

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
				`Pastikan sekali lagi akun kamu tidak limit ya.\n\n` +
				`📌 **Ingat**: Robux yang sudah dikirim tapi nyangkut gara-gara akun kamu limit **tidak bisa dikembalikan / refund**.\n\n` +
				`Yakin mau lanjut bayar sekarang?`;

			const safetyEmbed = new EmbedBuilder()
				.setTitle('⚠️  YAKIN AKUNNYA AMAN KAK?')
				.setColor(0xF1C40F)
				.setDescription(safetyDescription.trim())
				.setFooter({ text: `💖 Bebey Store • ${orderId}` });

			const confirmSafetyBtn = new ButtonBuilder()
				.setCustomId(`confirm_safety_${orderId}`)
				.setLabel('✅ Yakin, Lanjut Bayar')
				.setStyle(ButtonStyle.Success);

			const checkAgainBtn = new ButtonBuilder()
				.setCustomId(`check_again_${orderId}`)
				.setLabel('🔄 Cek Dulu Deh')
				.setStyle(ButtonStyle.Secondary);

			const safetyRow = new ActionRowBuilder().addComponents(confirmSafetyBtn, checkAgainBtn);

			await interaction.channel.send({ embeds: [safetyEmbed], components: [safetyRow] });
			return;
		}

		// Confirm Safety Button
		if (customId.startsWith('confirm_safety_')) {
			const orderId = customId.replace('confirm_safety_', '');

			const updatedSafetyEmbed = EmbedBuilder.from(interaction.message.embeds[0])
				.setColor(0x2ECC71)
				.setTitle('✅  KONFIRMASI KEAMANAN DISETUJUI');

			await interaction.update({ embeds: [updatedSafetyEmbed], components: [] });

			delete require.cache[require.resolve('../config/items')];
			const catalogItems = require('../config/items');
			const { data: purchase } = await supabase.from('purchases').select('item_name, price, unique_code').eq('order_id', orderId).single();

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

			const qrisImage = process.env.QRIS_IMAGE_URL || 'https://dummyimage.com/600x600/0984e3/ffffff.png&text=QRIS+BEBEY+STORE';
			const qrisCard = buildQrisPaymentEmbed(selectedItem, orderId, totalAmount, qrisImage, uniqueCode);

			const qrisMsg = await interaction.channel.send({
				embeds: qrisCard.embeds,
				components: qrisCard.components
			});
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

			const { data: purchase } = await supabase.from('purchases').select('*').eq('order_id', orderId).single();

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

		// Category Sub-Menu Filter
		if (customId.startsWith('cat_filter_')) {
			const catName = customId.replace('cat_filter_', '');
			
			delete require.cache[require.resolve('../config/items')];
			const items = require('../config/items');

			const subMenuData = buildCategorySubMenuEphemeral(items, catName);
			const userId = interaction.user.id;

			const existingInteraction = userEphemeralInteractions.get(userId);
			if (existingInteraction) {
				try {
					await existingInteraction.deleteReply();
				} catch (err) {}
				userEphemeralInteractions.delete(userId);
			}

			await interaction.reply({
				content: subMenuData.content,
				components: subMenuData.components,
				flags: MessageFlags.Ephemeral
			});

			userEphemeralInteractions.set(userId, interaction);
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

			const { data: purchase } = await supabase.from('purchases').select('*').eq('order_id', orderId).single();

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
