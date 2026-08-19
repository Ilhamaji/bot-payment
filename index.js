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

async function createTicketChannel(interaction, selectedItem, robloxUsername = 'Tidak Perlu') {
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

		// Embed Tiket (Single-Card Clean Aesthetic - 100% Non-Recursive)
		const userLine = (robloxUsername && robloxUsername !== 'Tidak Perlu') 
			? `👤 **Username Roblox:** \`${robloxUsername}\`\n` 
			: '';

		const ticketDescription = 
			`Halo ${interaction.user}! Rincian pesanan Anda telah siap.\n` +
			`Silakan lakukan transfer ke gambar QRIS Bebey Store di bawah ini.\n\n` +
			`📦 **Item Dibeli:** ${selectedItem.emoji || '📦'} **${selectedItem.name}**\n` +
			userLine +
			`🆔 **Order ID:** \`${orderId}\`\n` +
			`💰 **Total Transfer:** **Rp ${totalAmount.toLocaleString('id-ID')}**\n\n` +
			`📌 **INSTRUKSI PEMBAYARAN:**\n` +
			`1️⃣ Transfer **Rp ${totalAmount.toLocaleString('id-ID')}** ke QRIS di bawah ini.\n` +
			`2️⃣ Upload foto screenshot bukti transfer Anda di channel ini.\n` +
			`3️⃣ Tim Admin akan memverifikasi dan mengirimkan produk Anda.`;

		const embed = new EmbedBuilder()
			.setTitle(`🎫  BEBEY STORE — TIKET PEMBAYARAN`)
			.setColor(0x2ECC71)
			.setDescription(ticketDescription.trim())
			.setImage(qrisImage)
			.setTimestamp()
			.setFooter({ text: '🔒 Bebey Store Official • Private Ticket Channel' });

		const sosButton = new ButtonBuilder()
			.setCustomId('sos_help_button')
			.setLabel('🆘 Bantuan Admin')
			.setStyle(ButtonStyle.Danger);

		const closeButton = new ButtonBuilder()
			.setCustomId('close_ticket_button')
			.setLabel('🔒 Close Ticket')
			.setStyle(ButtonStyle.Secondary);

		const row = new ActionRowBuilder().addComponents(sosButton, closeButton);

		// Kirim HANYA 1 Embed Card (tanpa pesan teks berulang di luar embed)
		await ticketChannel.send({
			embeds: [embed],
			components: [row]
		});

		// Catat pesanan baru ke Supabase dengan Discord User Tag agar Leaderboard menampilkan Username Discord
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

// LISTEN FITUR AUTO-DETECT SCREENSHOT BUKTI TRANSFER DARI USER
client.on(Events.MessageCreate, async message => {
	if (message.author.bot) return;
	if (!message.guild) return;

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
				const adminChannel = await client.channels.fetch(adminChannelId);
				if (adminChannel) {
					await adminChannel.send({
						content: `@here 🔔 **BUKTI TRANSFER MASUK!** Order \`${orderId}\` dari ${message.author} membutuhkan verifikasi Admin:`,
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

			await createTicketChannel(interaction, selectedItem, robloxCheck.username);

			// Hapus pesan privat sub-menu ephemeral pembeli setelah tiket dibuat
			const prevInteraction = userEphemeralInteractions.get(interaction.user.id);
			if (prevInteraction) {
				try {
					await prevInteraction.deleteReply();
				} catch (e) {}
				userEphemeralInteractions.delete(interaction.user.id);
			}
		}
		return;
	}

	// 4. Handle Buttons (SOS, Close Ticket, Admin Approval, Category Sub-Menu Filter)
	if (interaction.isButton()) {
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
					console.error('Error deleting ticket channel:', err);
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
					console.error('Error deleting finished ticket channel:', err);
				}
			}, 5000);
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
				.setTitle('✅  TRANSAKSI DI-APPROVE BY ADMIN');

			await interaction.update({ embeds: [updatedEmbed], components: [] });
			await interaction.followUp({ content: `✅ Transaksi \`${orderId}\` telah berhasil disetujui oleh ${interaction.user}! Item akan otomatis diproses ke akun Roblox pembeli.` });

			// Cari channel tiket berdasarkan orderId dan kirim notifikasi ke pembeli
			const targetChannelName = orderId.toLowerCase();
			try {
				let targetGuild = interaction.guild;
				if (!targetGuild) {
					// Jika diklik via DM Admin, cari guild tempat bot berada
					targetGuild = client.guilds.cache.first();
				}
				if (targetGuild) {
					const channels = await targetGuild.channels.fetch();
					const ticketChannel = channels.find(c => c && c.name === targetChannelName);
					if (ticketChannel) {
						let buyerMention = '';
						const buyerField = interaction.message.embeds[0]?.fields?.find(f => f.name.includes('PEMBELI'));
						if (buyerField) {
							buyerMention = buyerField.value;
						}

						const approvedEmbed = new EmbedBuilder()
							.setTitle('✅  BEBEY STORE — PEMBAYARAN DI-APPROVE!')
							.setColor(0x2ECC71)
							.setDescription(
								`Halo ${buyerMention}! 🎉 **PEMBAYARAN TERVERIFIKASI!** Transaksi \`${orderId}\` Anda telah **disetujui oleh Admin**.\n` +
								`Item Roblox Anda sedang diproses / telah dikirimkan ke akun Anda.\n\n` +
								`⚠️ **PERHATIAN PENTING:**\n` +
								`**Silakan tekan tombol di bawah ini HANYA JIKA ITEM SUDAH BENAR-BENAR DITERIMA di akun Roblox Anda!**`
							)
							.setTimestamp()
							.setFooter({ text: '⚠️ Klik tombol di bawah hanya jika item sudah diterima.' });

						const finishTicketBtn = new ButtonBuilder()
							.setCustomId('finish_ticket_button')
							.setLabel('✅ Selesai (Klik Hanya Jika Item Sudah Diterima)')
							.setStyle(ButtonStyle.Success);

						const finishRow = new ActionRowBuilder().addComponents(finishTicketBtn);

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
