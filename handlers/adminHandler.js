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
const { updatePurchaseStatus, supabase } = require('../services/supabase');
const { executeOrderApproval, pendingAdminDeliveryProof } = require('../services/ticketManager');

async function handleAdminInteraction(interaction, client) {
	// 1. Button Actions (Admin Approve & Reject)
	if (interaction.isButton()) {
		const customId = interaction.customId;

		if (customId.startsWith('admin_approve_')) {
			if (!isAdmin(interaction.user.id)) {
				return interaction.reply({ content: '❌ **AKSES DITOLAK!** Hanya Admin toko yang dapat menekan tombol Approve.', flags: MessageFlags.Ephemeral });
			}

			const orderId = customId.replace('admin_approve_', '');

			const modal = new ModalBuilder()
				.setCustomId(`modal_approve_delivery_${orderId}`)
				.setTitle('BUKTI PENGIRIMAN (ADMIN)');

			const proofInput = new TextInputBuilder()
				.setCustomId('delivery_proof_url')
				.setLabel("URL FOTO BUKTI / KETIK 'UPLOAD' :")
				.setStyle(TextInputStyle.Short)
				.setPlaceholder("Upload foto screenshot di channel ini atau paste URL gambar")
				.setRequired(true)
				.setValue('upload');

			const notesInput = new TextInputBuilder()
				.setCustomId('delivery_notes')
				.setLabel("CATATAN UNTUK PEMBELI (Opsional):")
				.setStyle(TextInputStyle.Paragraph)
				.setPlaceholder("Cth: Robux sudah terkirim ke akun kamu ya!")
				.setRequired(false);

			const row1 = new ActionRowBuilder().addComponents(proofInput);
			const row2 = new ActionRowBuilder().addComponents(notesInput);
			modal.addComponents(row1, row2);

			await interaction.showModal(modal);
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
	}

	// 2. Modal Submissions (Admin Approve & Reject Modal)
	if (interaction.isModalSubmit()) {
		const customId = interaction.customId;

		if (customId.startsWith('modal_approve_delivery_')) {
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
