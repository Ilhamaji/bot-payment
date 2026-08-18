const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { isOwner, removeAdmin } = require('../services/admins');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('deladmin')
		.setDescription('[OWNER ONLY] Menghapus Admin Sekunder')
		.addUserOption(option =>
			option.setName('user')
				.setDescription('User Admin yang ingin dicabut aksesnya')
				.setRequired(true)),
	async execute(interaction) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		if (!isOwner(interaction.user.id)) {
			return interaction.editReply({ 
				content: '❌ **AKSES DITOLAK!** Hanya Admin Utama (Owner) yang dapat menghapus Admin.' 
			});
		}

		const targetUser = interaction.options.getUser('user');
		const result = removeAdmin(targetUser.id);

		if (!result.success) {
			return interaction.editReply({ content: `❌ ${result.message}` });
		}

		const embed = new EmbedBuilder()
			.setTitle('🗑️  ADMIN PANEL: HAPUS ADMIN')
			.setColor(0xED4245)
			.setDescription(`Hak akses Admin untuk ${targetUser} (\`${targetUser.tag}\`) telah berhasil dicabut.`)
			.setTimestamp();

		await interaction.editReply({ embeds: [embed] });
	},
};
