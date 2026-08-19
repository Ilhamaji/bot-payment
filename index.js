require('dotenv').config();

// Anti-Crash Process Handlers (Cegah Bot Exit dari Unknown Interaction / Network Lag)
process.on('unhandledRejection', (reason, promise) => {
	console.warn('⚠️ [ANTI-CRASH] Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err, origin) => {
	console.error('⚠️ [ANTI-CRASH] Uncaught Exception:', err);
});

const fs = require('node:fs');
const path = require('node:path');
const { 
    Client, 
    Collection, 
    Events, 
    GatewayIntentBits,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    ChannelType,
    PermissionFlagsBits
} = require('discord.js');
const { v4: uuidv4 } = require('uuid');
const { createPurchase, updatePurchaseStatus } = require('./services/supabase');
const items = require('./config/items');
const { isAdmin } = require('./services/admins');
const { updateGlobalPanel } = require('./services/panelManager');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ] 
});
const userEphemeralInteractions = new Map();
const ticketCreationInteractions = new Map();

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

const pendingAdminDeliveryProof = new Map();

async function executeOrderApproval(clientInstance, orderId, proofUrl, notes = '', adminUser = null, originalMessage = null, interactionToReply = null) {
	await updatePurchaseStatus(orderId, 'fulfilled');

	// Refresh live panel (Leaderboard & Katalog)
	updateGlobalPanel(clientInstance);

	// Update Admin message in Admin Channel if provided
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

	// Cari channel tiket pembeli dan kirim notifikasi approve beserta foto bukti pengiriman dari Admin
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
						`Halo ${buyerMention}! 🎉 **PEMBAYARAN TERVERIFIKASI & ITEM TERKIRIM!** Transaksi \`${orderId}\` Anda telah **disetujui dan dikirimkan oleh Admin**.\n\n` +
						notesText +
						`📸 **Foto Bukti Pengiriman dari Admin:**\n` +
						`(Lihat gambar bukti pengiriman item dari Admin di bawah ini)\n\n` +
						`⚠️ **PERHATIAN PENTING:**\n` +
						`**Silakan tekan tombol di bawah ini HANYA JIKA ITEM SUDAH BENAR-BENAR DITERIMA di akun Roblox Anda!**`
					)
					.setTimestamp()
					.setFooter({ text: '⚠️ Klik tombol di bawah hanya jika item sudah diterima.' });

				if (proofUrl) {
					approvedEmbed.setImage(proofUrl);
				}

				const finishTicketBtn = new ButtonBuilder()
					.setCustomId('finish_ticket_button')
					.setLabel('✅ Selesai (Klik Hanya Jika Item Sudah Diterima)')
					.setStyle(ButtonStyle.Success);

				const saveDmBtn = new ButtonBuilder()
					.setCustomId(`save_dm_proof_${orderId}`)
					.setLabel('📩 Simpan Bukti Transaksi ke DM')
					.setStyle(ButtonStyle.Primary);

				const finishRow = new ActionRowBuilder().addComponents(finishTicketBtn, saveDmBtn);

				await ticketChannel.send({ 
					content: buyerMention ? `🔔 Halo ${buyerMention}, transaksi Anda telah disetujui!` : null, 
					embeds: [approvedEmbed], 
					components: [finishRow] 
				});
			}
		}
	} catch (err) {
		console.warn('⚠️ Tidak dapat mengirim notifikasi approve ke channel tiket pembeli:', err);
	}
}

client.commands = new Collection();

// Load Commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const filePath = path.join(commandsPath, file);
	const command = require(filePath);
	if ('data' in command && 'execute' in command) {
		client.commands.set(command.data.name, command);
	}
}

function buildQrisPaymentEmbed(selectedItem, orderId, totalAmount, qrisImage) {
	const itemEmoji = selectedItem.emoji || '📦';
	const formattedPrice = `Rp ${totalAmount.toLocaleString('id-ID')}`;

	const paymentDescription = 
		`📦 **Produk**\n` +
		`${itemEmoji} **${selectedItem.name}**\n\n` +
		`💰 **Total Bayar**\n` +
		`**${formattedPrice}**\n\n` +
		`🆔 **Order ID**\n` +
		`\`${orderId}\`\n\n` +
		`📌 **Cara Bayar**\n` +
		`1️⃣ Scan QRIS di bawah\n` +
		`2️⃣ Bayar **tepat ${formattedPrice}**\n` +
		`3️⃣ Screenshot bukti transfer\n\n` +
		`‼️ **Screenshot wajib keliatan:**\n` +
		`🔋 Persentase baterai\n` +
		`🕒 Jam HP\n` +
		`📖 Rincian transfer lengkap\n` +
		`❌ Jangan di-crop atau disensor!\n\n` +
		`4️⃣ Kirim bukti di sini\n` +
		`5️⃣ Klik **Saya Sudah Transfer**`;

	const paymentEmbed = new EmbedBuilder()
		.setTitle(`💳  Scan QRIS untuk Membayar`)
		.setColor(0xE67E22)
		.setDescription(paymentDescription.trim())
		.setImage(qrisImage)
		.setTimestamp()
		.setFooter({ text: '🔒 Bebey Store Official • QRIS Payment Gate' });

	const transferredBtn = new ButtonBuilder()
		.setCustomId(`already_transferred_${orderId}`)
		.setLabel('✅ Saya Sudah Transfer')
		.setStyle(ButtonStyle.Success);

	const row = new ActionRowBuilder().addComponents(transferredBtn);

	return { embeds: [paymentEmbed], components: [row] };
}

async function createTicketChannel(interaction, selectedItem, robloxData = 'Tidak Perlu') {
	const robloxUsername = (typeof robloxData === 'object' && robloxData !== null) ? robloxData.username : String(robloxData);
	const robloxDisplayName = (typeof robloxData === 'object' && robloxData !== null) ? (robloxData.displayName || robloxUsername) : robloxUsername;
	const robloxUserId = (typeof robloxData === 'object' && robloxData !== null) ? robloxData.id : null;

	const itemCode = (selectedItem.id || 'ITEM').toUpperCase();
	const randomHash = uuidv4().substring(0, 4).toUpperCase();
	const orderId = `${itemCode}-${randomHash}`;
	const channelName = orderId.toLowerCase();
	const uniqueCode = 0;
	const totalAmount = selectedItem.price;
	const qrisImage = process.env.QRIS_IMAGE_URL || 'https://dummyimage.com/600x600/0984e3/ffffff.png&text=QRIS+BEBEY+STORE';

	try {
		const categoryId = process.env.TICKET_CATEGORY_ID ? process.env.TICKET_CATEGORY_ID.trim() : null;

		// Buat Text Channel Private Baru di dalam Kategori Tersebut
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
					id: client.user.id,
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

		const replyMsg = `✅ Tiket pembayaran berhasil dibuat di channel privat ${ticketChannel}! Silakan buka channel tersebut untuk menyelesaikan pembayaran.`;
		if (interaction.deferred) {
			await interaction.editReply({ content: replyMsg });
		} else {
			await interaction.reply({ content: replyMsg, flags: MessageFlags.Ephemeral });
		}

		ticketCreationInteractions.set(orderId.toUpperCase(), interaction);
		ticketCreationInteractions.set(ticketChannel.id, interaction);

		// 1. Embed Tiket Pembayaran Rincian
		const userLine = (robloxUsername && robloxUsername !== 'Tidak Perlu') 
			? `👤 **Username Roblox:** \`${robloxUsername}\`\n` 
			: '';

		const ticketDescription = 
			`Halo ${interaction.user}! Rincian pesanan Anda telah siap.\n\n` +
			`📦 **Item Dibeli:** ${selectedItem.emoji || '📦'} **${selectedItem.name}**\n` +
			userLine +
			`🆔 **Order ID:** \`${orderId}\`\n` +
			`💰 **Total Transfer:** **Rp ${totalAmount.toLocaleString('id-ID')}**`;

		const ticketEmbed = new EmbedBuilder()
			.setTitle(`🎫  BEBEY STORE — TIKET PEMBAYARAN`)
			.setColor(0x2ECC71)
			.setDescription(ticketDescription.trim())
			.setTimestamp()
			.setFooter({ text: `💖 Bebey Store • ${orderId}` });

		const sosButton = new ButtonBuilder()
			.setCustomId('sos_help_button')
			.setLabel('🆘 Bantuan Admin')
			.setStyle(ButtonStyle.Danger);

		const closeButton = new ButtonBuilder()
			.setCustomId('close_ticket_button')
			.setLabel('🔒 Close Ticket')
			.setStyle(ButtonStyle.Secondary);

		const row = new ActionRowBuilder().addComponents(sosButton, closeButton);

		// Kirim Pesan Pertama: Tiket Rincian
		await ticketChannel.send({
			embeds: [ticketEmbed],
			components: [row]
		});

		// 2. Embed Konfirmasi Akun Roblox (Jika item membutuhkan Username Roblox)
		if (robloxUsername && robloxUsername !== 'Tidak Perlu') {
			const { getRobloxAvatarHeadshot } = require('./services/roblox');
			const avatarUrl = await getRobloxAvatarHeadshot(robloxUserId);

			const confirmEmbed = new EmbedBuilder()
				.setTitle('👤  Konfirmasi Akun Roblox')
				.setColor(0xF1C40F)
				.setDescription(
					`Apakah ini akun kamu?\n\n` +
					`**Username**\n` +
					`\`${robloxUsername}\`\n\n` +
					`**Display Name**\n` +
					`**${robloxDisplayName}**\n\n` +
					`**User ID**\n` +
					`\`${robloxUserId || 'N/A'}\``
				)
				.setFooter({ text: `💖 Bebey Store • ${orderId}` });

			if (avatarUrl) {
				confirmEmbed.setThumbnail(avatarUrl);
			}

			const confirmYesBtn = new ButtonBuilder()
				.setCustomId(`confirm_roblox_${orderId}`)
				.setLabel('✅ Iya, Ini Akun Saya')
				.setStyle(ButtonStyle.Success);

			const changeNoBtn = new ButtonBuilder()
				.setCustomId(`change_roblox_${orderId}`)
				.setLabel('❌ Bukan, Ganti Username')
				.setStyle(ButtonStyle.Danger);

			const confirmRow = new ActionRowBuilder().addComponents(confirmYesBtn, changeNoBtn);

			await ticketChannel.send({
				embeds: [confirmEmbed],
				components: [confirmRow]
			});
		} else {
			// Jika item tidak perlu Username Roblox -> Langsung kirim Pesan QRIS
			const qrisCard = buildQrisPaymentEmbed(selectedItem, orderId, totalAmount, qrisImage);
			await ticketChannel.send({
				embeds: qrisCard.embeds,
				components: qrisCard.components
			});
		}

		// Catat pesanan baru ke Supabase
		await createPurchase(orderId, robloxUsername, selectedItem.name, selectedItem.price, uniqueCode, 'pending', interaction.user.tag);

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

		for (const [id, msg] of fetchedMessages) {
			const msgText = (msg.content || '') + ' ' + (msg.embeds.map(e => (e.title || '') + ' ' + (e.description || '') + ' ' + (e.fields ? e.fields.map(f => f.name + ' ' + f.value).join(' ') : '')).join(' '));

			let isMatch = false;
			if (cleanOrderId && cleanOrderId.length > 2 && msgText.toUpperCase().includes(cleanOrderId)) isMatch = true;
			if (ticketChannelPattern && ticketChannelPattern.length > 2 && msgText.toLowerCase().includes(ticketChannelPattern)) isMatch = true;
			if (targetChanId && targetChanId.length > 4 && msgText.includes(targetChanId)) isMatch = true;

			if (isMatch) {
				try {
					await msg.delete();
					console.log(`[AUTO-CLEANUP ADMIN] Pesan transaksi/SOS di Admin Channel untuk ${orderId || channelId} telah dihapus.`);
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

const { setupMonthlyReportScheduler } = require('./services/reportManager');

client.once(Events.ClientReady, c => {
	console.log(`Ready! Logged in as ${c.user.tag}`);
	console.log('🤖 Bebey Store Payment Bot Aktif!');

	// Auto-update pesan /panel publik saat bot pertama kali nyala
	updateGlobalPanel(c);

	// Cek tiket kadaluarsa saat bot pertama kali nyala
	checkAndCleanupExpiredTickets(c);

	// Inisialisasi scheduler laporan bulanan otomatis ke channel laporan/owner
	setupMonthlyReportScheduler(c);

	// Jalankan pembersihan otomatis setiap 15 menit sekali
	setInterval(() => {
		checkAndCleanupExpiredTickets(client);
	}, 15 * 60 * 1000);
});

// LISTEN FITUR AUTO-DETECT SCREENSHOT BUKTI TRANSFER DARI USER & BUKTI PENGIRIMAN DARI ADMIN
client.on(Events.MessageCreate, async message => {
	if (message.author.bot) return;
	if (!message.guild) return;

	const adminChanId = process.env.ADMIN_CHANNEL_ID ? process.env.ADMIN_CHANNEL_ID.trim() : null;
	const { isAdmin } = require('./services/admins');

	if (adminChanId && message.channelId === adminChanId && isAdmin(message.author.id) && !message.author.bot) {
		const adminImage = message.attachments.find(att => {
			const ct = att.contentType || '';
			const name = att.name || '';
			return ct.startsWith('image/') || /\.(png|jpg|jpeg|webp)$/i.test(name);
		});

		if (adminImage) {
			let matchedOrderId = null;
			let targetMsg = null;

			// A. Jika Admin ME-REPLY (membalas) pesan transaksi
			if (message.reference && message.reference.messageId) {
				try {
					const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
					if (repliedMsg && repliedMsg.embeds.length > 0) {
						targetMsg = repliedMsg;
						const embed = repliedMsg.embeds[0];
						
						// Extract order ID dari fields, footer, atau text
						const orderField = embed.fields?.find(f => f.name.includes('ORDER ID'));
						if (orderField) {
							matchedOrderId = orderField.value.replace(/`/g, '').trim().toUpperCase();
						} else if (embed.footer && embed.footer.text) {
							const match = embed.footer.text.match(/[A-Z0-9]+-[A-Z0-9]+/);
							if (match) matchedOrderId = match[0];
						} else if (embed.description) {
							const match = embed.description.match(/`([A-Z0-9]+-[A-Z0-9]+)`/);
							if (match) matchedOrderId = match[1];
						}
					}
				} catch (e) {}
			}

			// B. Jika tidak me-reply, cari dari pending map atau 10 pesan terdekat
			if (!matchedOrderId) {
				for (const [key, data] of pendingAdminDeliveryProof.entries()) {
					if (data.channelId === message.channelId || message.content.toUpperCase().includes(key)) {
						matchedOrderId = key;
						targetMsg = data.originalMessage;
						break;
					}
				}
			}

			if (!matchedOrderId) {
				const fetched = await message.channel.messages.fetch({ limit: 10 });
				const orderMsg = fetched.find(m => m.embeds.length > 0 && m.embeds[0].title && (m.embeds[0].title.includes('VERIFIKASI BUKTI') || m.embeds[0].title.includes('DI-APPROVE')));
				if (orderMsg) {
					const field = orderMsg.embeds[0].fields?.find(f => f.name.includes('ORDER ID'));
					if (field) {
						matchedOrderId = field.value.replace(/`/g, '').trim().toUpperCase();
						targetMsg = orderMsg;
					}
				}
			}

			if (matchedOrderId) {
				const proofUrl = adminImage.url;
				pendingAdminDeliveryProof.delete(matchedOrderId);

				await executeOrderApproval(client, matchedOrderId, proofUrl, '', message.author, targetMsg, null);

				await message.reply({
					content: `✅ **BUKTI PENGIRIMAN TERKIRIM!** Foto bukti pengiriman item untuk transaksi \`${matchedOrderId}\` telah berhasil dikirimkan ke channel tiket pembeli!`
				});
				return;
			}
		}
	}

	const isTicketChannel = message.channel.name && (
		(process.env.TICKET_CATEGORY_ID && message.channel.parentId === process.env.TICKET_CATEGORY_ID.trim()) ||
		message.channel.name.includes('-bb-') ||
		message.channel.name.includes('-')
	);

	if (!isTicketChannel) return;

	// Cari apakah ada lampiran gambar / screenshot
	const imageAttachment = message.attachments.find(att => {
		const ct = att.contentType || '';
		const name = att.name || '';
		return ct.startsWith('image/') || /\.(png|jpg|jpeg|webp)$/i.test(name);
	});

	if (imageAttachment) {
		const proofUrl = imageAttachment.url;
		const channelName = message.channel.name;
		const orderId = channelName.toUpperCase();

		// 1. EMBED TAMPILAN PEMBELI (Di Channel Tiket) - TANPA TOMBOL APPROVE/REJECT
		const buyerProofEmbed = new EmbedBuilder()
			.setTitle('📸  BEBEY STORE — BUKTI TRANSFER DITERIMA')
			.setColor(0x2ECC71)
			.setDescription(
				`Foto screenshot bukti transfer dari ${message.author} telah berhasil diterima oleh sistem.\n` +
				`Bukti transfer Anda saat ini sedang diverifikasi oleh Tim Admin Bebey Store.`
			)
			.setImage(proofUrl)
			.setTimestamp()
			.setFooter({ text: 'Mohon tunggu sejenak, Admin akan segera memproses transaksi Anda.' });

		await message.channel.send({ embeds: [buyerProofEmbed] });

		// 2. EMBED TAMPILAN ADMIN (Di Admin Channel / DM) - DENGAN TOMBOL APPROVE & REJECT
		const adminProofEmbed = new EmbedBuilder()
			.setTitle('📸  VERIFIKASI BUKTI TRANSFER — ADMIN PANEL')
			.setColor(0xF39C12)
			.setDescription(
				`Bukti pembayaran baru diterima dari pembeli ${message.author}.\n` +
				`Mohon periksa gambar bukti transfer di bawah ini.`
			)
			.addFields(
				{ name: '🆔 ORDER ID', value: `\`${orderId}\``, inline: true },
				{ name: '👤 PEMBELI', value: `${message.author}`, inline: true },
				{ name: '📍 TIKET CHANNEL', value: `<#${message.channelId}>`, inline: true }
			)
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

		// Kirim ke Admin Channel khusus (jika diset dan valid)
		const adminChannelId = process.env.ADMIN_CHANNEL_ID ? process.env.ADMIN_CHANNEL_ID.trim() : null;
		let sentToAdminChannel = false;
		if (adminChannelId) {
			try {
				// Bersihkan bukti transfer lama di Admin Channel (jika pembeli mengirimkan revisi foto)
				await deleteAdminChannelMessagesForOrder(client, orderId);

				const adminChannel = await client.channels.fetch(adminChannelId);
				if (adminChannel) {
					await adminChannel.send({
						content: `@here 🔔 **BUKTI TRANSFER MASUK (REVISI)!** Order \`${orderId}\` dari ${message.author} membutuhkan verifikasi Admin:`,
						embeds: [adminProofEmbed],
						components: [row]
					});
					sentToAdminChannel = true;
				}
			} catch (err) {}
		}

		// Jika Admin Channel belum diset, kirim via DM ke Owner/Admin
		if (!sentToAdminChannel) {
			const { getAdmins } = require('./services/admins');
			const ownerId = process.env.OWNER_DISCORD_ID ? process.env.OWNER_DISCORD_ID.trim() : null;
			const adminList = getAdmins();

			const targetAdminIds = new Set();
			if (ownerId) targetAdminIds.add(ownerId);
			adminList.forEach(a => targetAdminIds.add(a.id));

			for (const adminId of targetAdminIds) {
				try {
					const adminUser = await client.users.fetch(adminId);
					if (adminUser) {
						await adminUser.send({
							embeds: [adminProofEmbed],
							components: [row]
						});
					}
				} catch (err) {}
			}
		}
	}
});

client.on(Events.InteractionCreate, async interaction => {
	// 1. Handle Slash Commands
	if (interaction.isChatInputCommand()) {
		const command = interaction.client.commands.get(interaction.commandName);
		if (!command) return;

		try {
			await command.execute(interaction);
		} catch (error) {
			console.error(error);
			await interaction.reply({ content: 'Terjadi kesalahan saat menjalankan perintah!', flags: MessageFlags.Ephemeral });
		}
		return;
	}

	// 1.5 Handle Autocomplete
	if (interaction.isAutocomplete()) {
		const command = interaction.client.commands.get(interaction.commandName);
		if (!command || !command.autocomplete) return;

		try {
			await command.autocomplete(interaction);
		} catch (error) {
			console.error('Autocomplete error:', error);
		}
		return;
	}

	// 2. Handle Dropdown Select Menu (Pilih Item)
	if (interaction.isStringSelectMenu()) {
		if (interaction.customId === 'select_shop_item') {
			delete require.cache[require.resolve('./config/items')];
			const currentItems = require('./config/items');

			const itemId = interaction.values[0];
			const selectedItem = currentItems.find(i => i.id === itemId);

			if (!selectedItem) {
				return interaction.reply({ content: '❌ Item tidak ditemukan di katalog toko.', flags: MessageFlags.Ephemeral });
			}

			// Cek apakah item memerlukan input username Roblox
			if (selectedItem.requireUsername === false) {
				// Tidak perlu username -> Langsung buat tiket
				await createTicketChannel(interaction, selectedItem, 'Tidak Perlu');

				// Hapus pesan privat sub-menu ephemeral pembeli setelah tiket dibuat
				const prevInteraction = userEphemeralInteractions.get(interaction.user.id);
				if (prevInteraction) {
					try {
						await prevInteraction.deleteReply();
					} catch (e) {}
					userEphemeralInteractions.delete(interaction.user.id);
				}
				return;
			}

			// Memerlukan Username -> Tampilkan Modal Form Input Username
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

			await interaction.showModal(modal);
		}
		return;
	}

	// 3. Handle Form Submit -> MEMBUAT CHANNEL TIKET PRIVATE BARU
	if (interaction.isModalSubmit()) {
		if (interaction.customId.startsWith('modal_buy_')) {
			delete require.cache[require.resolve('./config/items')];
			const currentItems = require('./config/items');

			const itemId = interaction.customId.replace('modal_buy_', '');
			const selectedItem = currentItems.find(i => i.id === itemId);
			let robloxUsername = interaction.fields.getTextInputValue('roblox_username').trim();

			if (!selectedItem) {
				return interaction.reply({ content: '❌ Item tidak ditemukan.', flags: MessageFlags.Ephemeral });
			}

			await interaction.deferReply({ flags: MessageFlags.Ephemeral });

			// Validasi Otomatis ke Database Resmi Roblox API
			const { validateRobloxUsername } = require('./services/roblox');
			const robloxCheck = await validateRobloxUsername(robloxUsername);

			if (!robloxCheck.valid) {
				return interaction.editReply({
					content: `❌ **USERNAME ROBLOX TIDAK DITEMUKAN!**\n` +
						`> Username Roblox \`${robloxUsername}\` tidak terdaftar di database resmi Roblox.\n` +
						`> Silakan periksa ejaan Username Anda dan coba lagi (tanpa menggunakan simbol @).`
				});
			}

			await createTicketChannel(interaction, selectedItem, robloxCheck);

			// Hapus pesan privat sub-menu ephemeral pembeli setelah tiket dibuat
			const prevInteraction = userEphemeralInteractions.get(interaction.user.id);
			if (prevInteraction) {
				try {
					await prevInteraction.deleteReply();
				} catch (e) {}
				userEphemeralInteractions.delete(interaction.user.id);
			}
		}

		// Handle Submit Modal Ganti Username Roblox dari Tiket
		if (interaction.customId.startsWith('modal_rechange_roblox_')) {
			const orderId = interaction.customId.replace('modal_rechange_roblox_', '');
			let newUsername = interaction.fields.getTextInputValue('new_roblox_username').trim();

			const { validateRobloxUsername, getRobloxAvatarHeadshot } = require('./services/roblox');
			const robloxCheck = await validateRobloxUsername(newUsername);

			if (!robloxCheck.valid) {
				return interaction.reply({
					content: `❌ **USERNAME ROBLOX TIDAK DITEMUKAN!**\n> Username Roblox \`${newUsername}\` tidak terdaftar di Roblox.`,
					flags: MessageFlags.Ephemeral
				});
			}

			await interaction.deferUpdate();

			// Update Username Roblox di Supabase
			const { supabase } = require('./services/supabase');
			await supabase.from('purchases').update({ roblox_username: robloxCheck.username }).eq('order_id', orderId);

			// Ambil Gambar Avatar Headshot Baru
			const avatarUrl = await getRobloxAvatarHeadshot(robloxCheck.id);

			// Update Pesan Konfirmasi Akun Roblox di channel tiket ini
			try {
				const fetchedMsgs = await interaction.channel.messages.fetch({ limit: 20 });
				const confirmMsg = fetchedMsgs.find(m => m.embeds.length > 0 && m.embeds[0].title && m.embeds[0].title.includes('Konfirmasi Akun Roblox'));

				if (confirmMsg) {
					const updatedEmbed = new EmbedBuilder()
						.setTitle('👤  Konfirmasi Akun Roblox')
						.setColor(0xF1C40F)
						.setDescription(
							`Apakah ini akun kamu?\n\n` +
							`**Username**\n` +
							`\`${robloxCheck.username}\`\n\n` +
							`**Display Name**\n` +
							`**${robloxCheck.displayName || robloxCheck.username}**\n\n` +
							`**User ID**\n` +
							`\`${robloxCheck.id || 'N/A'}\``
						)
						.setFooter({ text: `💖 Bebey Store • ${orderId}` });

					if (avatarUrl) {
						updatedEmbed.setThumbnail(avatarUrl);
					}

					await confirmMsg.edit({ embeds: [updatedEmbed] });
				}
			} catch (e) {}
			return;
		}

		// Handle Submit Modal Bukti Pengiriman Admin
		if (interaction.customId.startsWith('modal_approve_delivery_')) {
			const orderId = interaction.customId.replace('modal_approve_delivery_', '');
			const proofUrl = interaction.fields.getTextInputValue('delivery_proof_url').trim();
			const deliveryNotes = interaction.fields.getTextInputValue('delivery_notes').trim();

			if (proofUrl && proofUrl.toLowerCase() !== 'upload' && (proofUrl.startsWith('http://') || proofUrl.startsWith('https://'))) {
				await interaction.deferUpdate();
				await executeOrderApproval(client, orderId, proofUrl, deliveryNotes, interaction.user, interaction.message, interaction);
				return;
			}

			// Simpan pending approval untuk menunggu Admin upload foto di Admin Channel
			const originalMsg = interaction.message;
			pendingAdminDeliveryProof.set(orderId.toUpperCase(), {
				adminUser: interaction.user,
				channelId: interaction.channelId,
				originalMessage: originalMsg,
				deliveryNotes: deliveryNotes
			});

			await interaction.reply({
				content: 
					`📸 **HARAP UPLOAD FOTO BUKTI PENGIRIMAN!**\n` +
					`> Silakan **upload foto screenshot bukti pengiriman item** untuk Order \`${orderId}\` di channel ini.\n` +
					`> Bot akan otomatis menangkap foto yang Anda upload dan mengirimkan pesan approve beserta foto bukti tersebut ke pembeli!`,
				flags: MessageFlags.Ephemeral
			});
			return;
		}
		return;
	}

	// 4. Handle Buttons (SOS, Close Ticket, Admin Approval, Category Sub-Menu Filter, Roblox Confirmation)
	if (interaction.isButton()) {
		// AA. Tombol Konfirmasi Akun Roblox ("Iya, Ini Akun Saya")
		if (interaction.customId.startsWith('confirm_roblox_')) {
			const orderId = interaction.customId.replace('confirm_roblox_', '');

			const updatedConfirmEmbed = EmbedBuilder.from(interaction.message.embeds[0])
				.setColor(0x2ECC71)
				.setTitle('✅  AKUN ROBLOX DIKONFIRMASI');

			await interaction.update({ embeds: [updatedConfirmEmbed], components: [] });

			// Kirim Pesan 3: Catatan Penting Via Username Embed Card
			const notesDescription = 
				`Baca catatan ini sebentar sebelum lanjut ke pembayaran.\n\n` +
				`• Pastikan **username** dan **display name** Roblox sudah sesuai dengan akun tujuan.\n` +
				`• Mohon cek umur akun sebelum order. Untuk akun di bawah 18+, pastikan akun sudah terhubung dengan email parent.\n` +
				`• Jika akun sedang terkena limit, gunakan akun lain yang sudah siap menerima Robux.\n` +
				`• Setelah Robux berhasil dikirim ke akun yang sudah kamu konfirmasi, perubahan akun/limit setelah proses selesai berada di luar kendali Bebey Store. Admin tetap akan bantu cek kalau ada kendala.\n` +
				`• Nyalakan verifikasi 2 langkah di setting > keamanan > email agar akun lebih aman.\n` +
				`• Proses Via Username **15 menit – 240 menit** (maksimal 4 jam).\n\n` +
				`Kalau datanya sudah sesuai, klik tombol di bawah untuk lanjut ke konfirmasi pesanan.`;

			const notesEmbed = new EmbedBuilder()
				.setTitle('📌  Catatan Penting Via Username')
				.setColor(0xE91E63)
				.setDescription(notesDescription.trim())
				.setTimestamp()
				.setFooter({ text: `💖 Bebey Store • ${orderId}` });

			const agreeBtn = new ButtonBuilder()
				.setCustomId(`agree_terms_${orderId}`)
				.setLabel('✅ Saya Paham & Setuju')
				.setStyle(ButtonStyle.Success);

			const agreeRow = new ActionRowBuilder().addComponents(agreeBtn);

			await interaction.channel.send({
				embeds: [notesEmbed],
				components: [agreeRow]
			});
			return;
		}

		// AB. Tombol "Saya Paham & Setuju" Catatan Penting
		if (interaction.customId.startsWith('agree_terms_')) {
			const orderId = interaction.customId.replace('agree_terms_', '');

			const updatedNotesEmbed = EmbedBuilder.from(interaction.message.embeds[0])
				.setColor(0x2ECC71)
				.setTitle('✅  CATATAN DISETUJUI');

			await interaction.update({ embeds: [updatedNotesEmbed], components: [] });

			// Kirim Pesan 4: Cek Limit Akun Dulu Yuk!
			const limitDescription = 
				`**${interaction.user}** sebelum lanjut bayar, kakak perlu **cek limit akun** dulu ya. 🙏\n\n` +
				`Ini biar Robux-nya masuk penuh dan gak ada yang nyangkut gara-gara limit.\n\n` +
				`📖 Ada 2 tutorial di tombol bawah: **cara cek limit akun** & **cara cek sisa limit**.\n\n` +
				`Kalau udah dicek, pilih salah satu tombol di bawah 👇`;

			const limitEmbed = new EmbedBuilder()
				.setTitle('🔍  Cek Limit Akun Dulu Yuk!')
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
				.setLabel('📖 Cara Cek Limit Akun')
				.setStyle(ButtonStyle.Secondary);

			const limitRow1 = new ActionRowBuilder().addComponents(notLimitBtn, isLimitBtn);
			const limitRow2 = new ActionRowBuilder().addComponents(guideBtn);

			await interaction.channel.send({
				embeds: [limitEmbed],
				components: [limitRow1, limitRow2]
			});
			return;
		}

		// AC. Tombol "✅ Tidak Limit"
		if (interaction.customId.startsWith('limit_ok_')) {
			const orderId = interaction.customId.replace('limit_ok_', '');

			const updatedLimitEmbed = EmbedBuilder.from(interaction.message.embeds[0])
				.setColor(0x2ECC71)
				.setTitle('✅  AKUN BEBAS LIMIT');

			await interaction.update({ embeds: [updatedLimitEmbed], components: [] });

			// Kirim Pesan 5: Yakin Akunnya Aman Kak?
			const safetyDescription = 
				`Kalau ternyata masih limit, Robux-nya bisa nyangkut dan gak masuk penuh.\n\n` +
				`Robux yang udah kekirim **gak bisa ditarik balik** — jadi yang nyangkut **gak bisa direfund**.\n\n` +
				`Cek sekali lagi ya sebelum bayar 🙏`;

			const safetyEmbed = new EmbedBuilder()
				.setTitle('⚠️  Yakin Akunnya Aman Kak?')
				.setColor(0xF1C40F)
				.setDescription(safetyDescription.trim())
				.setFooter({ text: `💖 Bebey Store • ${orderId}` });

			const confirmSafetyBtn = new ButtonBuilder()
				.setCustomId(`confirm_safety_${orderId}`)
				.setLabel('✅ Yakin, Lanjut Bayar')
				.setStyle(ButtonStyle.Success);

			const checkAgainBtn = new ButtonBuilder()
				.setCustomId(`check_again_${orderId}`)
				.setLabel('❌ Cek Dulu')
				.setStyle(ButtonStyle.Secondary);

			const safetyRow = new ActionRowBuilder().addComponents(confirmSafetyBtn, checkAgainBtn);

			await interaction.channel.send({
				embeds: [safetyEmbed],
				components: [safetyRow]
			});
			return;
		}

		// AD. Tombol "✅ Yakin, Lanjut Bayar"
		if (interaction.customId.startsWith('confirm_safety_')) {
			const orderId = interaction.customId.replace('confirm_safety_', '');

			const updatedSafetyEmbed = EmbedBuilder.from(interaction.message.embeds[0])
				.setColor(0x2ECC71)
				.setTitle('✅  KONFIRMASI KEAMANAN DISETUJUI');

			await interaction.update({ embeds: [updatedSafetyEmbed], components: [] });

			// Ambil Detail Order ID dari Supabase & Items Config
			delete require.cache[require.resolve('./config/items')];
			const catalogItems = require('./config/items');
			const { supabase } = require('./services/supabase');
			const { data: purchase } = await supabase.from('purchases').select('item_name, price').eq('order_id', orderId).single();

			let selectedItem = { name: 'Produk Bebey Store', emoji: '📦' };
			let totalAmount = 20000;

			if (purchase) {
				totalAmount = purchase.price || 20000;
				const foundItem = catalogItems.find(i => i.name && i.name.toLowerCase() === purchase.item_name.toLowerCase());
				if (foundItem) {
					selectedItem = foundItem;
				} else {
					selectedItem = { name: purchase.item_name, emoji: '📦' };
				}
			}

			const qrisImage = process.env.QRIS_IMAGE_URL || 'https://dummyimage.com/600x600/0984e3/ffffff.png&text=QRIS+BEBEY+STORE';
			const qrisCard = buildQrisPaymentEmbed(selectedItem, orderId, totalAmount, qrisImage);

			await interaction.channel.send({
				embeds: qrisCard.embeds,
				components: qrisCard.components
			});
			return;
		}

		// AE. Tombol "✅ Saya Sudah Transfer"
		if (interaction.customId.startsWith('already_transferred_')) {
			await interaction.reply({
				content: 
					`✅ **BUKTI TRANSFER DICATAT!**\n` +
					`> Silakan **upload foto screenshot bukti transfer Anda** di channel ini.\n` +
					`> Pastikan **persentase baterai**, **jam HP**, dan **rincian transfer lengkap** terlihat jelas (jangan di-crop/disensor).\n` +
					`> Tim Admin akan segera memverifikasi dan mengirimkan produk Anda!`,
				flags: MessageFlags.Ephemeral
			});
			return;
		}

		// AE. Tombol "❌ Cek Dulu"
		if (interaction.customId.startsWith('check_again_')) {
			await interaction.reply({
				content: 
					`ℹ️ **SILAKAN CEK AKUN ANDA DULU!**\n` +
					`> Silakan periksa kembali sisa limit akun Roblox Anda di **roblox.com**.\n` +
					`> Jika sudah 100% yakin akun bebas limit, tekan tombol **"✅ Yakin, Lanjut Bayar"** di atas.`,
				flags: MessageFlags.Ephemeral
			});
			return;
		}

		// AD. Tombol "⚠️ Akun Saya Limit"
		if (interaction.customId.startsWith('limit_warning_')) {
			await interaction.reply({
				content: 
					`⚠️ **AKUN TERKENA LIMIT!**\n` +
					`> Mohon gunakan akun Roblox lain yang **belum terkena limit** untuk menerima Robux.\n` +
					`> Silakan scroll ke atas dan tekan tombol **"❌ Bukan, Ganti Username"** pada kartu Konfirmasi Akun Roblox untuk mengganti ke akun lain.`,
				flags: MessageFlags.Ephemeral
			});
			return;
		}

		// AE. Tombol "📖 Cara Cek Limit Akun"
		if (interaction.customId.startsWith('limit_guide_')) {
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

		// AB. Tombol "Bukan, Ganti Username"
		if (interaction.customId.startsWith('change_roblox_')) {
			const orderId = interaction.customId.replace('change_roblox_', '');

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

			await interaction.showModal(modal);
			return;
		}
		// AA. Tombol Sub-Menu Filter Kategori Produk (/panel) - SUB-MENU RINGKAS PER-USER
		if (interaction.customId.startsWith('cat_filter_')) {
			const catName = interaction.customId.replace('cat_filter_', '');
			
			delete require.cache[require.resolve('./config/items')];
			const items = require('./config/items');
			const { buildCategorySubMenuEphemeral } = require('./services/panelManager');

			const subMenuData = buildCategorySubMenuEphemeral(items, catName);
			const userId = interaction.user.id;

			// Bersihkan/Hapus pesan privat lama milik pembeli jika masih ada
			const existingInteraction = userEphemeralInteractions.get(userId);
			if (existingInteraction) {
				try {
					await existingInteraction.deleteReply();
				} catch (err) {}
				userEphemeralInteractions.delete(userId);
			}

			// Selalu tampilkan 1 pesan privat baru di layar pembeli!
			await interaction.reply({
				content: subMenuData.content,
				components: subMenuData.components,
				flags: MessageFlags.Ephemeral
			});

			userEphemeralInteractions.set(userId, interaction);
			return;
		}

		// A. Tombol SOS Bantuan Admin
		if (interaction.customId === 'sos_help_button') {
			const sosUserEmbed = new EmbedBuilder()
				.setTitle('🆘  BEBEY STORE — BANTUAN ADMIN DIPANGGIL')
				.setColor(0xED4245)
				.setDescription(
					`Panggilan bantuan telah diaktifkan.\n` +
					`Tim Admin telah dipanggil untuk membantu di channel tiket ini.`
				)
				.setTimestamp();

			await interaction.reply({ embeds: [sosUserEmbed] });

			// 1. KIRIM EMBED HANYA KE ADMIN CHANNEL KHUSUS (Bukan DM)
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

		// B1. Tombol Selesai Bantuan SOS oleh Admin (Menghapus Notif SOS di Admin Channel)
		if (interaction.customId.startsWith('sos_done_')) {
			if (!isAdmin(interaction.user.id)) {
				return interaction.reply({ content: '❌ **AKSES DITOLAK!** Hanya Admin yang dapat menyelesaikan panggilan SOS.', flags: MessageFlags.Ephemeral });
			}

			const ticketChannelId = interaction.customId.replace('sos_done_', '');

			// Hapus pesan panggilan SOS dari Admin Channel
			try {
				await interaction.message.delete();
			} catch (e) {}

			await interaction.reply({
				content: '✅ **Panggilan bantuan SOS diselesaikan & notifikasi berhasil dihapus dari Admin Channel.**',
				flags: MessageFlags.Ephemeral
			});

			// Kirim notifikasi ke channel tiket pembeli bahwa admin telah membantu
			try {
				const ticketChannel = await client.channels.fetch(ticketChannelId);
				if (ticketChannel) {
					const resolvedEmbed = new EmbedBuilder()
						.setTitle('✅  BEBEY STORE — BANTUAN SELESAI')
						.setColor(0x2ECC71)
						.setDescription(`Admin ${interaction.user} telah menyelesaikan panggilan bantuan Anda. Terima kasih!`)
						.setTimestamp();

					await ticketChannel.send({ embeds: [resolvedEmbed] });
				}
			} catch (e) {}

			return;
		}

		// B2. Tombol Close Ticket
		if (interaction.customId === 'close_ticket_button') {
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

		// B3. Tombol Selesai & Tutup Tiket oleh Pembeli / Admin (Setelah Item Diterima)
		if (interaction.customId === 'finish_ticket_button') {
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

		// B4. Tombol Simpan Bukti Transaksi & Pengiriman ke DM Pembeli
		if (interaction.customId.startsWith('save_dm_proof_')) {
			const orderId = interaction.customId.replace('save_dm_proof_', '');

			const { supabase } = require('./services/supabase');
			const { data: purchase } = await supabase.from('purchases').select('*').eq('order_id', orderId).single();

			// Cari foto bukti pengiriman dari pesan embed di channel ini
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

			// Jika ada foto bukti pengiriman dari Admin, buat embed khusus
			if (deliveryProofUrl) {
				const deliveryEmbed = new EmbedBuilder()
					.setTitle('📸  BUKTI PENGIRIMAN ITEM (ADMIN)')
					.setColor(0x3498DB)
					.setDescription(`Berikut adalah foto screenshot bukti pengiriman item ke akun Roblox \`${robloxUser}\`:`)
					.setImage(deliveryProofUrl)
					.setFooter({ text: `Order ID: ${orderId}` });
				embedsToSend.push(deliveryEmbed);
			}

			// Jika ada foto bukti transfer dari Pembeli, buat embed khusus
			if (paymentProofUrl) {
				const paymentEmbed = new EmbedBuilder()
					.setTitle('📸  BUKTI TRANSFER PEMBAYARAN (PEMBELI)')
					.setColor(0xF1C40F)
					.setDescription(`Berikut adalah foto screenshot bukti pembayaran transfer Anda:`)
					.setImage(paymentProofUrl)
					.setFooter({ text: `Order ID: ${orderId}` });
				embedsToSend.push(paymentEmbed);
			}

			try {
				await interaction.user.send({ embeds: embedsToSend });
				await interaction.reply({
					content: `📩 **BERHASIL!** Struk bukti transaksi dan foto bukti pengiriman telah dikirimkan ke **Direct Message (DM)** Anda! Silakan periksa DM Discord Anda.`,
					flags: MessageFlags.Ephemeral
				});
			} catch (dmErr) {
				await interaction.reply({
					content: `⚠️ **GAGAL MENGIRIM DM!**\n> Mohon buka **Pengaturan Privasi Discord** Anda (Izinkan Direct Messages dari Anggota Server) lalu coba tekan tombol ini lagi.`,
					flags: MessageFlags.Ephemeral
				});
			}
			return;
		}

		// C. Handle Admin Buttons (Approve / Reject)
		if (interaction.customId.startsWith('admin_approve_')) {
			if (!isAdmin(interaction.user.id)) {
				return interaction.reply({ content: '❌ **AKSES DITOLAK!** Hanya Admin toko yang dapat menekan tombol Approve.', flags: MessageFlags.Ephemeral });
			}

			const orderId = interaction.customId.replace('admin_approve_', '');
			await updatePurchaseStatus(orderId, 'fulfilled');

			// Refresh otomatis 2 pesan panel toko (Leaderboard & Katalog) real-time
			updateGlobalPanel(client);

			const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
				.setColor(0x2ECC71)
				.setTitle('✅  TRANSAKSI DI-APPROVE BY ADMIN')
				.setDescription(
					`Transaksi \`${orderId}\` telah disetujui oleh ${interaction.user}.\n\n` +
					`📸 **LANGKAH SELANJUTNYA:**\n` +
					`Silakan **BALAS (REPLY) PESAN INI DENGAN FOTO BUKTI PENGIRIMAN ITEM** agar foto bukti pengiriman dikirimkan ke channel tiket pembeli!`
				);

			await interaction.update({ embeds: [updatedEmbed], components: [] });
			await interaction.followUp({
				content: `✅ Transaksi \`${orderId}\` berhasil di-approve! Silakan **balas (reply) pesan tersebut dengan foto bukti pengiriman item** agar foto terkirim ke pembeli.`
			});
			return;
		}

		if (interaction.customId.startsWith('admin_reject_')) {
			if (!isAdmin(interaction.user.id)) {
				return interaction.reply({ content: '❌ **AKSES DITOLAK!** Hanya Admin toko yang dapat menekan tombol Reject.', flags: MessageFlags.Ephemeral });
			}

			const orderId = interaction.customId.replace('admin_reject_', '');
			await updatePurchaseStatus(orderId, 'rejected');

			const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
				.setColor(0xED4245)
				.setTitle('❌  TRANSAKSI DITOLAK BY ADMIN');

			await interaction.update({ embeds: [updatedEmbed], components: [] });
			await interaction.followUp({ content: `❌ Transaksi \`${orderId}\` telah ditolak oleh ${interaction.user}.` });

			// Cari channel tiket berdasarkan orderId dan kirim notifikasi reject ke pembeli
			const targetChannelName = orderId.toLowerCase();
			try {
				let targetGuild = interaction.guild;
				if (!targetGuild) {
					targetGuild = client.guilds.cache.first();
				}
				if (targetGuild) {
					const channels = await targetGuild.channels.fetch();
					const ticketChannel = channels.find(c => c && c.name === targetChannelName);
					if (ticketChannel) {
						const rejectedEmbed = new EmbedBuilder()
							.setTitle('❌  BEBEY STORE — PEMBAYARAN DITOLAK')
							.setColor(0xED4245)
							.setDescription(
								`> ⚠️ Transaksi \`${orderId}\` Anda **ditolak oleh Admin**.\n` +
								`> Silakan tekan tombol **"🆘 Bantuan Admin"** di atas jika membutuhkan bantuan.`
							)
							.setTimestamp();

						await ticketChannel.send({ embeds: [rejectedEmbed] });
					}
				}
			} catch (err) {
				console.warn('⚠️ Tidak dapat mengirim notifikasi reject ke channel tiket pembeli:', err);
			}
			return;
		}
	}
});

client.login(process.env.DISCORD_TOKEN);
