const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getAdmins } = require('../services/admins');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('listadmin')
		.setDescription('Menampilkan daftar Admin toko yang terdaftar'),
	async execute(interaction) {
		const ownerId = process.env.OWNER_DISCORD_ID ? process.env.OWNER_DISCORD_ID.trim() : null;
		const adminList = getAdmins();

		let description = `Berikut adalah daftar Administrator **Bebey Store**:\n\n`;

		// Owner Section
		description += `👑 **ADMIN UTAMA (OWNER):**\n`;
		if (ownerId) {
			description += `• <@${ownerId}> (\`ID: ${ownerId}\`)\n\n`;
		} else {
			description += `• *Belum diset di file .env (OWNER_DISCORD_ID)*\n\n`;
		}

		// Secondary Admin Section
		description += `⚙️ **ADMIN SEKUNDER (${adminList.length}):**\n`;
		if (adminList.length === 0) {
			description += `• *Belum ada Admin Sekunder yang ditambahkan (Gunakan /addadmin untuk menambah).*`;
		} else {
			adminList.forEach((a, idx) => {
				description += `• <@${a.id}> (\`${a.tag}\`)\n`;
			});
		}

		const embed = new EmbedBuilder()
			.setTitle('🛡️  BEBEY STORE — DAFTAR ADMIN TOKO')
			.setColor(0x5865F2)
			.setDescription(description.trim())
			.setTimestamp()
			.setFooter({ text: '⚡ Bebey Store Official • Security Management' });

		await interaction.reply({ embeds: [embed] });
	},
};
