const { 
	EmbedBuilder, 
	ActionRowBuilder, 
	ButtonBuilder, 
	ButtonStyle, 
	ModalBuilder, 
	TextInputBuilder, 
	TextInputStyle, 
	MessageFlags 
} = require('discord.js');
const { isAdmin } = require('../services/admins');
const { updatePurchaseStatus, getPurchaseById, deletePurchaseById, supabase } = require('../services/supabase');
const { executeOrderApproval, pendingAdminDeliveryProof, adminInstructionInteractions } = require('../services/ticketManager');

async function handleAdminInteraction(interaction, client) {
	// 1. Button Actions (Admin Approve & Reject)
	if (interaction.isButton()) {
		const customId = interaction.customId;

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

		if (customId.startsWith('admin_approve_')) {
			if (!isAdmin(interaction.user.id)) {
				return interaction.reply({ content: '❌ **AKSES DITOLAK!** Hanya Admin toko yang dapat menekan tombol Approve.', flags: MessageFlags.Ephemeral });
			}

			const orderId = customId.replace('admin_approve_', '');

			await interaction.reply({
				content: 
					`📸 **CARA KIRIM BUKTI PENGIRIMAN (ORDER: \`${orderId}\`):**\n\n` +
					`1. **Tekan Balas (Reply)** pada pesan notifikasi transaksi di atas.\n` +
					`2. **Lampirkan / Upload Foto (Attachment Gambar)** bukti pengiriman item (screenshot pengiriman).\n` +
					`3. Tekan Kirim. Bot akan otomatis mengirimkan foto bukti tersebut ke channel tiket pembeli!`,
				flags: MessageFlags.Ephemeral
			});

			adminInstructionInteractions.set(orderId.toUpperCase(), interaction);
			return true;
		}

		if (customId.startsWith('admin_reject_')) {
			if (!isAdmin(interaction.user.id)) {
				return interaction.reply({ content: '❌ **AKSES DITOLAK!** Hanya Admin toko yang dapat menekan tombol Reject.', flags: MessageFlags.Ephemeral });
			}

			const orderId = customId.replace('admin_reject_', '');

			const modal = new ModalBuilder()
				.setCustomId(`modal_reject_${orderId}`)
				.setTitle('ALASAN PENOLAKAN (ADMIN)');

			const reasonInput = new TextInputBuilder()
				.setCustomId('reject_reason')
				.setLabel("ALASAN PENOLAKAN (Opsional):")
				.setStyle(TextInputStyle.Paragraph)
				.setPlaceholder("Cth: Foto resi blur, nominal transfer kurang, atau salah foto resi")
				.setRequired(false);

			const row = new ActionRowBuilder().addComponents(reasonInput);
			modal.addComponents(row);

			await interaction.showModal(modal);
			return true;
		}

		if (customId.startsWith('sos_done_')) {
			if (!isAdmin(interaction.user.id)) {
				await interaction.reply({ 
					content: '❌ **AKSES DITOLAK!** Hanya Admin yang dapat menyelesaikan panggilan SOS.', 
					flags: MessageFlags.Ephemeral 
				});
				return true;
			}

			const ticketChannelId = customId.replace('sos_done_', '');

			const { clearSosForChannel } = require('../services/ticketManager');
			clearSosForChannel(ticketChannelId);

			try {
				await interaction.message.delete();
			} catch (e) {}

			await interaction.reply({
				content: '✅ **Panggilan bantuan SOS diselesaikan & notifikasi berhasil dihapus dari Admin Channel.**\n> *Pembeli sekarang dapat memanggil bantuan Admin kembali jika diperlukan.*',
				flags: MessageFlags.Ephemeral
			});

			try {
				const ticketChannel = await client.channels.fetch(ticketChannelId);
				if (ticketChannel) {
					const resolvedEmbed = new EmbedBuilder()
						.setTitle('✅  BEBEY STORE — BANTUAN SELESAI')
						.setColor(0x2ECC71)
						.setDescription(`Admin ${interaction.user} telah menyelesaikan panggilan bantuan Anda. Tombol Bantuan Admin telah di-reset dan dapat digunakan kembali jika diperlukan. Terima kasih!`)
						.setTimestamp();

					await ticketChannel.send({ embeds: [resolvedEmbed] });
				}
			} catch (e) {}

			return true;
		}
	}

	// 2. Modal Submissions (Admin Approve & Reject Modal & Delete DB Row)
	if (interaction.isModalSubmit()) {
		const customId = interaction.customId;

		if (customId === 'modal_delete_db_row') {
			if (!isAdmin(interaction.user.id)) {
				return interaction.reply({ content: '❌ **AKSES DITOLAK!** Hanya Admin yang dapat menghapus row database.', flags: MessageFlags.Ephemeral });
			}

			const targetOrderId = interaction.fields.getTextInputValue('target_order_id').trim().toUpperCase();
			const purchase = await getPurchaseById(targetOrderId);

			if (!purchase) {
				return interaction.reply({
					content: `❌ **ORDER ID TIDAK DITEMUKAN!** Data transaksi dengan Order ID \`${targetOrderId}\` tidak terdaftar di database.`,
					flags: MessageFlags.Ephemeral
				});
			}

			const success = await deletePurchaseById(targetOrderId);

			if (success) {
				const { updateGlobalPanel } = require('../services/panelManager');
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

		if (customId.startsWith('modal_approve_delivery_')) {
			if (!isAdmin(interaction.user.id)) {
				return interaction.reply({ content: '❌ **AKSES DITOLAK!** Hanya Admin yang dapat memproses pengiriman pesanan.', flags: MessageFlags.Ephemeral });
			}

			const orderId = customId.replace('modal_approve_delivery_', '');
			const proofUrl = interaction.fields.getTextInputValue('delivery_proof_url').trim();
			const deliveryNotes = interaction.fields.getTextInputValue('delivery_notes').trim();

			if (proofUrl && proofUrl.toLowerCase() !== 'upload' && (proofUrl.startsWith('http://') || proofUrl.startsWith('https://'))) {
				await interaction.deferUpdate();
				await executeOrderApproval(client, orderId, proofUrl, deliveryNotes, interaction.user, interaction.message, interaction);
				return true;
			}

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
			return true;
		}

		if (customId.startsWith('modal_reject_')) {
			if (!isAdmin(interaction.user.id)) {
				return interaction.reply({ content: '❌ **AKSES DITOLAK!** Hanya Admin yang dapat memproses penolakan pesanan.', flags: MessageFlags.Ephemeral });
			}

			const orderId = customId.replace('modal_reject_', '');
			const reasonInput = interaction.fields.getTextInputValue('reject_reason').trim();
			const rejectReason = reasonInput !== '' ? reasonInput : 'Foto resi transfer kurang jelas / tidak sesuai ketentuan.';

			await updatePurchaseStatus(orderId, 'rejected');

			const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
				.setColor(0xED4245)
				.setTitle('❌  TRANSAKSI DITOLAK BY ADMIN')
				.setDescription(
					`Transaksi \`${orderId}\` telah ditolak oleh ${interaction.user}.\n\n` +
					`📌 **Alasan Penolakan:** ${rejectReason}`
				);

			await interaction.update({ embeds: [updatedEmbed], components: [] });

			const targetChannelName = orderId.toLowerCase();
			try {
				let targetGuild = interaction.guild || client.guilds.cache.first();
				if (targetGuild) {
					const channels = await targetGuild.channels.fetch();
					const ticketChannel = channels.find(c => c && c.name === targetChannelName);
					if (ticketChannel) {
						let buyerMention = '';
						if (interaction.message.embeds[0]?.fields) {
							const buyerField = interaction.message.embeds[0].fields.find(f => f.name.includes('PEMBELI'));
							if (buyerField) buyerMention = buyerField.value;
						}

						const rejectedEmbed = new EmbedBuilder()
							.setTitle('❌  BEBEY STORE — PEMBAYARAN DITOLAK')
							.setColor(0xED4245)
							.setDescription(
								`Halo ${buyerMention || 'Pembeli'}! ⚠️ Pembayaran kamu untuk order \`${orderId}\` **ditolak oleh Admin**.\n\n` +
								`📌 **Alasan Penolakan:**\n` +
								`> *${rejectReason}*\n\n` +
								`💡 **Apa yang harus dilakukan?**\n` +
								`• Kamu bisa **upload foto screenshot bukti transfer baru yang benar** di channel tiket ini.\n` +
								`• Jika butuh bantuan Admin, silakan tekan tombol **"🆘 Bantuan Admin"** di atas.`
							)
							.setTimestamp()
							.setFooter({ text: 'Bebey Store Official • Silakan upload ulang foto resi transfer yang benar.' });

						await ticketChannel.send({ 
							content: buyerMention ? `🔔 Halo ${buyerMention}, bukti transfer kamu ditolak/perlu direvisi!` : null,
							embeds: [rejectedEmbed] 
						});
					}
				}
			} catch (err) {
				console.warn('⚠️ Tidak dapat mengirim notifikasi reject ke channel tiket pembeli:', err);
			}

			await interaction.followUp({
				content: `❌ Transaksi \`${orderId}\` telah ditolak dengan alasan: "${rejectReason}".`
			});
			return true;
		}
	}

	return false;
}

module.exports = { handleAdminInteraction };
