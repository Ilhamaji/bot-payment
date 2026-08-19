const fs = require('node:fs');
const path = require('node:path');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');

const configFile = path.join(__dirname, '../config/panel_config.json');

/**
 * Helper untuk parse Emoji Unicode maupun Custom Discord Emoji (<:name:id>)
 */
function parseEmoji(emojiStr) {
    if (!emojiStr) return { embed: '📦', option: '📦' };

    const customMatch = emojiStr.match(/<a?:(\w+):(\d+)>/);
    if (customMatch) {
        return {
            embed: emojiStr,
            option: { id: customMatch[2], name: customMatch[1] }
        };
    }

    return {
        embed: emojiStr,
        option: emojiStr
    };
}

/**
 * Simpan lokasi dua pesan panel toko (Leaderboard & Catalog)
 */
function savePanelLocation(channelId, leaderboardMessageId, catalogMessageId) {
    try {
        fs.writeFileSync(configFile, JSON.stringify({ channelId, leaderboardMessageId, catalogMessageId }, null, 4), 'utf8');
    } catch (err) {
        console.error('Error saving panel config:', err);
    }
}

/**
 * Ambil lokasi pesan panel toko
 */
function getPanelLocation() {
    try {
        if (!fs.existsSync(configFile)) return null;
        return JSON.parse(fs.readFileSync(configFile, 'utf8'));
    } catch (err) {
        return null;
    }
}

/**
 * Mendapatkan daftar kategori unik dari items
 */
function getUniqueCategories(items) {
    const categories = new Set();
    items.forEach(item => {
        if (item.category && item.category.trim() !== '') {
            categories.add(item.category.trim());
        }
    });
    return Array.from(categories);
}

/**
 * Membuat ActionRow Tombol Kategori Sub-Menu (Dynamic Multi-Row Support)
 */
function buildCategoryButtons(categories, selectedCategory = 'ALL') {
    const rows = [];
    let currentRow = new ActionRowBuilder();

    // Tombol "Semua Produk"
    const allBtn = new ButtonBuilder()
        .setCustomId('cat_filter_ALL')
        .setLabel('🌐 Semua Produk')
        .setStyle(selectedCategory === 'ALL' ? ButtonStyle.Primary : ButtonStyle.Secondary);
    currentRow.addComponents(allBtn);

    const categoryEmojis = {
        'Robux': '💎',
        'Passes': '🚀',
        'Game Items': '🎣',
        'Services': '⚡',
        'General': '📦'
    };

    categories.forEach(cat => {
        // Jika baris saat ini sudah penuh (5 tombol per ActionRow Discord), buat baris ActionRow baru
        if (currentRow.components.length >= 5) {
            rows.push(currentRow);
            currentRow = new ActionRowBuilder();
        }

        const emoji = categoryEmojis[cat] || '📁';
        const btn = new ButtonBuilder()
            .setCustomId(`cat_filter_${cat}`)
            .setLabel(`${emoji} ${cat}`)
            .setStyle(selectedCategory === cat ? ButtonStyle.Primary : ButtonStyle.Secondary);
        currentRow.addComponents(btn);
    });

    if (currentRow.components.length > 0) {
        rows.push(currentRow);
    }

    // Maksimal 4 ActionRows untuk tombol kategori agar tersisa 1 ActionRow untuk Dropdown Select Menu
    return rows.slice(0, 4);
}

/**
 * Membuat Embed dan Components Panel Katalog Terelompok Rapi (Static / Ephemeral Compatible)
 */
function buildCatalogPanelComponents(items, selectedCategory = 'ALL') {
    const categories = getUniqueCategories(items);
    
    // Grouping item per kategori
    const grouped = {};
    items.forEach(item => {
        const cat = item.category || 'General';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(item);
    });

    let catalogDescription = 
        `Selamat datang di **Bebey Store**! Silakan pilih produk melalui menu dropdown di bawah untuk membuat tiket transaksi privat.\n\n`;

    const categoryEmojis = {
        'Robux': '💎',
        'Passes': '🚀',
        'Game Items': '🎣',
        'Services': '⚡',
        'General': '📦'
    };

    if (selectedCategory === 'ALL') {
        // Tampilkan semua item terelompok per kategori
        Object.keys(grouped).forEach(catName => {
            const emoji = categoryEmojis[catName] || '📁';
            catalogDescription += `> ${emoji} **KATEGORI: ${catName.toUpperCase()}**\n`;
            grouped[catName].forEach(item => {
                const parsed = parseEmoji(item.emoji);
                catalogDescription += `└ ${parsed.embed} **${item.name}** • \`Rp ${item.price.toLocaleString('id-ID')}\`\n`;
            });
            catalogDescription += `\n`;
        });
    } else {
        // Tampilkan item kategori spesifik saja
        const filteredItems = items.filter(i => (i.category || 'General').toLowerCase() === selectedCategory.toLowerCase());
        const emoji = categoryEmojis[selectedCategory] || '📁';
        catalogDescription += `> ${emoji} **KATEGORI TERPILIH: ${selectedCategory.toUpperCase()}**\n\n`;

        if (filteredItems.length === 0) {
            catalogDescription += `*Belum ada produk untuk kategori ini.*\n`;
        } else {
            filteredItems.forEach(item => {
                const parsed = parseEmoji(item.emoji);
                catalogDescription += `${parsed.embed} **${item.name}** • \`Rp ${item.price.toLocaleString('id-ID')}\`\n`;
                if (item.description) {
                    catalogDescription += `└ *${item.description}*\n\n`;
                } else {
                    catalogDescription += `\n`;
                }
            });
        }
    }

    const catEmbed = new EmbedBuilder()
        .setTitle('🏪  BEBEY STORE — OFFICIAL STORE PANEL')
        .setColor(0x5865F2)
        .setDescription(catalogDescription.trim())
        .setTimestamp()
        .setFooter({ text: '⚡ Bebey Store Official • Automatic 24/7 Ticketing System' });

    // Baris 1-4: Tombol Kategori Filter (Sub-Menu Dinamis Auto-Update)
    const categoryRows = buildCategoryButtons(categories, selectedCategory);

    return {
        embeds: [catEmbed],
        components: [...categoryRows] // HANYA TOMBOL KATEGORI (Dropdown pilihan produk dibuka via tombol kategori)
    };
}

/**
 * Auto-update dua pesan panel toko (Leaderboard & Katalog Publik) di Discord secara real-time
 */
async function updateGlobalPanel(client) {
    const loc = getPanelLocation();
    if (!loc || !loc.channelId) return;

    try {
        const channel = await client.channels.fetch(loc.channelId);
        if (!channel) return;

        // 1. UPDATE MESSAGE 1: LEADERBOARD TOP SPENDERS
        const leaderboardMsgId = loc.leaderboardMessageId;
        if (leaderboardMsgId) {
            try {
                const lbMessage = await channel.messages.fetch(leaderboardMsgId);
                if (lbMessage) {
                    const { getTopSpenders } = require('./supabase');
                    const topSpenders = await getTopSpenders(10);
                    let lbDescription = `Berikut adalah daftar **10 Pembeli Terbanyak (Top Spenders)** di **Bebey Store** yang telah terverifikasi:\n\n`;

                    if (!topSpenders || topSpenders.length === 0) {
                        lbDescription += `*Belum ada transaksi terverifikasi (fulfilled).*`;
                    } else {
                        const medalEmojis = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
                        topSpenders.forEach((spender, index) => {
                            const medal = medalEmojis[index] || '🎖️';
                            const cleanTag = spender.username.startsWith('@') ? spender.username : `@${spender.username}`;
                            lbDescription += `> ${medal} **${cleanTag}** — \`Rp ${spender.totalSpent.toLocaleString('id-ID')}\`\n`;
                        });
                    }

                    const lbEmbed = new EmbedBuilder()
                        .setTitle('🏆  BEBEY STORE — OFFICIAL LEADERBOARD TOP SPENDERS')
                        .setColor(0xF1C40F)
                        .setDescription(lbDescription.trim())
                        .setTimestamp()
                        .setFooter({ text: '⚡ Bebey Store Official • Auto-Refreshed Live Leaderboard' });

                    await lbMessage.edit({ embeds: [lbEmbed] });
                }
            } catch (err) {}
        }

        // 2. UPDATE MESSAGE 2: KATALOG PUBLIK (SELALU STABIL 'ALL')
        const catalogMsgId = loc.catalogMessageId || loc.messageId;
        if (catalogMsgId) {
            try {
                const catMessage = await channel.messages.fetch(catalogMsgId);
                if (catMessage) {
                    delete require.cache[require.resolve('../config/items')];
                    const items = require('../config/items');

                    if (items.length === 0) {
                        const emptyEmbed = new EmbedBuilder()
                            .setTitle('🏪  BEBEY STORE — KATALOG TOKO')
                            .setColor(0x5865F2)
                            .setDescription('⚠️ Katalog toko saat ini belum memiliki item.')
                            .setTimestamp();
                        await catMessage.edit({ embeds: [emptyEmbed], components: [] });
                        return;
                    }

                    // Pesan publik di channel toko selalu stabil menampilkan tampilan ALL (Semua Kategori terelompok rapi)
                    const panelData = buildCatalogPanelComponents(items, 'ALL');
                    await catMessage.edit(panelData);
                }
            } catch (err) {}
        }

        console.log(`[AUTO-PANEL UPDATE] Dual messages (Leaderboard & Katalog Grouped) di #${channel.name} berhasil di-update real-time!`);
    } catch (err) {
        console.warn('⚠️ Tidak dapat me-refresh pesan panel toko.');
    }
}

/**
 * Membuat Sub-Menu Ringkas (Tanpa Embed Duplikat) Khusus Balasan Ephemeral Tombol Kategori
 */
function buildCategorySubMenuEphemeral(items, catName) {
    const categories = getUniqueCategories(items);
    const categoryRows = buildCategoryButtons(categories, catName);

    const categoryEmojis = {
        'Robux': '💎',
        'Passes': '🚀',
        'Game Items': '🎣',
        'Services': '⚡',
        'General': '📦'
    };

    const filteredItems = catName === 'ALL' 
        ? items 
        : items.filter(i => (i.category || 'General').toLowerCase() === catName.toLowerCase());

    const emoji = categoryEmojis[catName] || '📁';
    const content = `📁 **KATEGORI TERPILIH: ${emoji} ${catName === 'ALL' ? 'SEMUA PRODUK' : catName.toUpperCase()}**\nSilakan pilih produk dari menu dropdown di bawah untuk membuat tiket transaksi:`;

    const selectItemsList = filteredItems.length > 0 ? filteredItems : items;

    const selectOptions = selectItemsList.map(item => {
        const parsed = parseEmoji(item.emoji);
        const opt = new StringSelectMenuOptionBuilder()
            .setLabel(`${item.name}`)
            .setValue(item.id)
            .setDescription(`Rp ${item.price.toLocaleString('id-ID')}`);

        if (parsed.option) {
            try {
                opt.setEmoji(parsed.option);
            } catch (e) {
                opt.setEmoji('📦');
            }
        }
        return opt;
    });

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_shop_item')
        .setPlaceholder(`🛒 Pilih Produk ${catName === 'ALL' ? 'Semua Produk' : catName}...`)
        .addOptions(selectOptions);

    const selectRow = new ActionRowBuilder().addComponents(selectMenu);

    return {
        content: content,
        components: [selectRow] // HANYA DROPDOWN MENU (Tanpa tombol kategori di balasan privat!)
    };
}

module.exports = {
    savePanelLocation,
    getPanelLocation,
    updateGlobalPanel,
    buildCatalogPanelComponents,
    buildCategorySubMenuEphemeral,
    parseEmoji
};
