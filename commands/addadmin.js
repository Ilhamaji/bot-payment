const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { isOwner, addAdmin } = require('../services/admins');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('addadmin')
		.setDescription('[OWNER ONLY] Menambahkan Admin Sekunder baru')
		.addUserOption(option =>
			option.setName('user')
				.setDescription('User yang ingin diangkat sebagai Admin')
				.setRequired(true)),
	async execute(interaction) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		if (!isOwner(interaction.user.id)) {
			return interaction.editReply({ 
				content: '❌ **AKSES DITOLAK!** Hanya Admin Utama (Owner) yang dapat menambah Admin baru.' 
			});
		}

		const targetUser = interaction.options.getUser('user');
		const result = addAdmin(targetUser.id, targetUser.tag);

		if (!result.success) {
			return interaction.editReply({ content: `❌ ${result.message}` });
		}

		const embed = new EmbedBuilder()
			.setTitle('✅  ADMIN PANEL: TAMBAH ADMIN BARU')
			.setColor(0x2ECC71)
			.setDescription(`User ${targetUser} (\`${targetUser.tag}\`) telah berhasil diangkat sebagai **Admin Sekunder** toko.`)
			.setTimestamp();

		await interaction.editReply({ embeds: [embed] });
	},
};
