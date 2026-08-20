const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { isAdmin } = require('../services/admins');
const { 
	pendingAdminDeliveryProof, 
	executeOrderApproval, 
	buyerPendingProofs, 
	disableQrisButtonForOrder 
} = require('../services/ticketManager');

async function handleProofMessageDetection(message, client) {
	if (message.author.bot) return;
	if (!message.guild) return;

	const imageAttachment = message.attachments.find(a => a.contentType && a.contentType.startsWith('image/'));

	// 1. Deteksi Foto Screenshot Bukti Pengiriman oleh Admin di Admin Channel
	const adminChannelId = process.env.ADMIN_CHANNEL_ID ? process.env.ADMIN_CHANNEL_ID.trim() : null;
	const isAdminChannel = adminChannelId ? (message.channelId === adminChannelId) : true;

	if (imageAttachment && isAdmin(message.author.id) && isAdminChannel) {
		let targetMsg = null;
		let matchedOrderId = null;

		// A. Jika Admin me-reply pesan notifikasi transaksi
		if (message.reference && message.reference.messageId) {
			try {
				const referencedMsg = await message.channel.messages.fetch(message.reference.messageId);
				if (referencedMsg && referencedMsg.embeds.length > 0) {
					targetMsg = referencedMsg;
					const embed = referencedMsg.embeds[0];
					const orderField = embed.fields?.find(f => f.name.includes('ORDER ID'));
					if (orderField) {
						matchedOrderId = orderField.value.replace(/`/g, '').trim().toUpperCase();
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
			const proofUrl = imageAttachment.url;
			pendingAdminDeliveryProof.delete(matchedOrderId);

			await executeOrderApproval(client, matchedOrderId, proofUrl, '', message.author, targetMsg, null);

			await message.reply({
				content: `✅ **BUKTI PENGIRIMAN TERKIRIM!** Foto bukti pengiriman item untuk transaction \`${matchedOrderId}\` telah berhasil dikirimkan ke channel tiket pembeli!`
			});
			return;
		}
	}

	// 2. Deteksi Foto Screenshot Bukti Transfer oleh Pembeli di Ticket Channel
	const isTicketChannel = message.channel.name && (
		(process.env.TICKET_CATEGORY_ID && message.channel.parentId === process.env.TICKET_CATEGORY_ID.trim()) ||
		message.channel.name.includes('-bb-') ||
		message.channel.name.includes('-')
	);

	if (imageAttachment && isTicketChannel) {
		const proofUrl = imageAttachment.url;
		const channelName = message.channel.name;
		const orderId = channelName.toUpperCase();

		await disableQrisButtonForOrder(orderId, message.channel);

		if (buyerPendingProofs.has(orderId)) {
			const prevData = buyerPendingProofs.get(orderId);
			if (prevData && prevData.confirmMsg) {
				try {
					const oldEmbed = EmbedBuilder.from(prevData.confirmMsg.embeds[0])
						.setColor(0x95A5A6)
						.setTitle('📸  FOTO BUKTI TRANSFER LAMA (DIGANTI)');
					await prevData.confirmMsg.edit({
						embeds: [oldEmbed],
						components: []
					});
				} catch (e) {}
			}
		}

		const confirmProofEmbed = new EmbedBuilder()
			.setTitle('📸  KONFIRMASI FOTO BUKTI TRANSFER')
			.setColor(0xF1C40F)
			.setDescription(
				`Halo ${message.author}! Foto screenshot bukti transfer kamu sudah ter-upload.\n\n` +
				`‼️ **Pastikan lagi foto di bawah ya:**\n` +
				`• Persentase baterai & jam HP keliatan jelas\n` +
				`• Rincian transfer & tanggal keliatan jelas\n` +
				`• Foto tidak di-crop atau disensor\n\n` +
				`Kalau kamu sudah yakin foto ini benar, klik tombol **"✅ Saya Sudah Transfer"** di bawah untuk mengirim ke Admin!`
			)
			.setImage(proofUrl)
			.setFooter({ text: `💖 Bebey Store • ${orderId}` });

		const confirmProofBtn = new ButtonBuilder()
			.setCustomId(`confirm_buyer_proof_${orderId}`)
			.setLabel('✅ Saya Sudah Transfer')
			.setStyle(ButtonStyle.Success);

		const changeProofBtn = new ButtonBuilder()
			.setCustomId(`change_buyer_proof_${orderId}`)
			.setLabel('🔄 Ganti Foto Bukti')
			.setStyle(ButtonStyle.Secondary);

		const proofRow = new ActionRowBuilder().addComponents(confirmProofBtn, changeProofBtn);

		const sentConfirmMsg = await message.channel.send({
			embeds: [confirmProofEmbed],
			components: [proofRow]
		});

		buyerPendingProofs.set(orderId, {
			proofUrl: proofUrl,
			author: message.author,
			channelId: message.channelId,
			confirmMsg: sentConfirmMsg
		});
	}
}

module.exports = { handleProofMessageDetection };
