const fs = require('node:fs');
const path = require('node:path');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');

const configFile = path.join(__dirname, '../config/panel_config.json');
const categoryConfigFile = path.join(__dirname, '../config/category_emojis.json');

/**
 * Membaca daftar emoji kategori dari config/category_emojis.json
 */
function getAllCategoryEmojis() {
    try {
        if (!fs.existsSync(categoryConfigFile)) {
            return {
                'Robux': '💎',
                'Passes': '🚀',
                'Game Items': '🎣',
                'Services': '⚡',
                'General': '📦'
            };
        }
        return JSON.parse(fs.readFileSync(categoryConfigFile, 'utf8'));
    } catch (err) {
        return {
            'Robux': '💎',
            'Passes': '🚀',
            'Game Items': '🎣',
            'Services': '⚡',
            'General': '📦'
        };
    }
}

/**
 * Mendapatkan emoji kategori (default ke 📁 jika belum diset)
 */
function getCategoryEmoji(categoryName) {
    const emojis = getAllCategoryEmojis();
    if (emojis && categoryName && emojis[categoryName]) {
        return emojis[categoryName];
    }
    return '📁';
}

/**
 * Menyimpan / memperbarui emoji kategori ke config/category_emojis.json
 */
function setCategoryEmoji(categoryName, emoji) {
    if (!categoryName) return;
    const emojis = getAllCategoryEmojis();
    if (emoji && emoji.trim() !== '') {
        emojis[categoryName] = emoji.trim();
    } else if (!emojis[categoryName]) {
        emojis[categoryName] = '📁';
    }
    try {
        fs.writeFileSync(categoryConfigFile, JSON.stringify(emojis, null, 4), 'utf8');
    } catch (err) {
        console.error('Error saving category emojis config:', err);
    }
}

/**
 * Mendapatkan emoji item (jika item tidak punya emoji khusus, mewarisi emoji kategorinya)
 */
function getItemEmoji(item) {
    if (item && item.emoji && item.emoji.trim() !== '') {
        return item.emoji.trim();
    }
    return getCategoryEmoji(item ? item.category : 'General');
}

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
 * Ambil konfigurasi lokasi panel toko & leaderboard
 */
function getPanelLocation() {
    try {
        if (!fs.existsSync(configFile)) return {};
        return JSON.parse(fs.readFileSync(configFile, 'utf8')) || {};
    } catch (err) {
        return {};
    }
}

/**
 * Simpan lokasi pesan panel katalog toko
 */
function saveCatalogLocation(channelId, catalogMessageId) {
    try {
        const current = getPanelLocation();
        current.catalogChannelId = channelId;
        current.catalogMessageId = catalogMessageId;
        fs.writeFileSync(configFile, JSON.stringify(current, null, 4), 'utf8');
    } catch (err) {
        console.error('Error saving catalog panel config:', err);
    }
}

/**
 * Simpan lokasi pesan leaderboard top spender
 */
function saveLeaderboardLocation(channelId, leaderboardMessageId) {
    try {
        const current = getPanelLocation();
        current.leaderboardChannelId = channelId;
        current.leaderboardMessageId = leaderboardMessageId;
        fs.writeFileSync(configFile, JSON.stringify(current, null, 4), 'utf8');
    } catch (err) {
        console.error('Error saving leaderboard panel config:', err);
    }
}

function savePanelLocation(channelId, leaderboardMessageId, catalogMessageId) {
    if (catalogMessageId) saveCatalogLocation(channelId, catalogMessageId);
    if (leaderboardMessageId) saveLeaderboardLocation(channelId, leaderboardMessageId);
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

    // Tombol "Buka / Reset Menu" (Trigger Fix jika balasan privat di-dismiss)
    const refreshBtn = new ButtonBuilder()
        .setCustomId('cat_filter_REFRESH')
        .setLabel('🔄 Buka / Reset Menu')
        .setStyle(ButtonStyle.Success);
    currentRow.addComponents(refreshBtn);

    categories.forEach(cat => {
        if (currentRow.components.length >= 5) {
            rows.push(currentRow);
            currentRow = new ActionRowBuilder();
        }

        const emoji = getCategoryEmoji(cat);
        const btn = new ButtonBuilder()
            .setCustomId(`cat_filter_${cat}`)
            .setLabel(`${emoji} ${cat}`)
            .setStyle(selectedCategory === cat ? ButtonStyle.Primary : ButtonStyle.Secondary);
        currentRow.addComponents(btn);
    });

    if (currentRow.components.length > 0) {
        rows.push(currentRow);
    }

    return rows.slice(0, 4);
}

/**
 * Membuat Embed dan Components Panel Katalog Terelompok Rapi
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

    if (selectedCategory === 'ALL') {
        // Tampilkan semua item terelompok per kategori
        Object.keys(grouped).forEach(catName => {
            const emoji = getCategoryEmoji(catName);
            catalogDescription += `> ${emoji} **KATEGORI: ${catName.toUpperCase()}**\n`;
            grouped[catName].forEach(item => {
                const itemEmoji = getItemEmoji(item);
                const parsed = parseEmoji(itemEmoji);
                catalogDescription += `└ ${parsed.embed} **${item.name}** • \`Rp ${item.price.toLocaleString('id-ID')}\`\n`;
            });
            catalogDescription += `\n`;
        });
    } else {
        // Tampilkan item kategori spesifik saja
        const filteredItems = items.filter(i => (i.category || 'General').toLowerCase() === selectedCategory.toLowerCase());
        const emoji = getCategoryEmoji(selectedCategory);
        catalogDescription += `> ${emoji} **KATEGORI TERPILIH: ${selectedCategory.toUpperCase()}**\n\n`;

        if (filteredItems.length === 0) {
            catalogDescription += `*Belum ada produk untuk kategori ini.*\n`;
        } else {
            filteredItems.forEach(item => {
                const itemEmoji = getItemEmoji(item);
                const parsed = parseEmoji(itemEmoji);
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

    // Baris 1-4: Tombol Kategori Filter
    const categoryRows = buildCategoryButtons(categories, selectedCategory);

    return {
        embeds: [catEmbed],
        components: [...categoryRows]
    };
}

/**
 * Auto-update pesan panel toko & leaderboard di Discord secara real-time di channel masing-masing
 */
async function updateGlobalPanel(client) {
    const loc = getPanelLocation();
    if (!loc) return;

    // 1. UPDATE KATALOG PANEL TOKO (#beli-disini)
    const catChanId = loc.catalogChannelId || loc.channelId;
    const catMsgId = loc.catalogMessageId;

    if (catChanId && catMsgId) {
        try {
            const catChannel = await client.channels.fetch(catChanId);
            if (catChannel) {
                const catMessage = await catChannel.messages.fetch(catMsgId);
                if (catMessage) {
                    delete require.cache[require.resolve('../config/items')];
                    const items = require('../config/items');
                    const { embeds, components } = buildCatalogPanelComponents(items, 'ALL');

                    await catMessage.edit({ embeds, components });
                    console.log(`[AUTO-PANEL UPDATE] Katalog toko di #${catChannel.name} berhasil di-update real-time!`);
                }
            }
        } catch (e) {
            if (e.code === 10008 || e.status === 404) {
                console.log('ℹ️ Pesan panel katalog lama di Discord telah dihapus/tidak ditemukan. Silakan jalankan /panel kembali.');
                saveCatalogLocation(catChanId, null);
            } else {
                console.warn('Catalog message update notice:', e.message || e);
            }
        }
    }

    // 2. UPDATE LEADERBOARD TOP SPENDERS (#leaderboard)
    const lbChanId = loc.leaderboardChannelId || loc.channelId;
    const lbMsgId = loc.leaderboardMessageId;

    if (lbChanId && lbMsgId) {
        try {
            const lbChannel = await client.channels.fetch(lbChanId);
            if (lbChannel) {
                const lbMessage = await lbChannel.messages.fetch(lbMsgId);
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
                        .setTitle('🏆  BEBEY STORE — TOP SPENDERS LEADERBOARD')
                        .setColor(0xF1C40F)
                        .setDescription(lbDescription.trim())
                        .setTimestamp()
                        .setFooter({ text: '🏆 Bebey Store Official • Live Leaderboard' });

                    await lbMessage.edit({ embeds: [lbEmbed] });
                    console.log(`[AUTO-PANEL UPDATE] Leaderboard di #${lbChannel.name} berhasil di-update real-time!`);
                }
            }
        } catch (e) {
            if (e.code === 10008 || e.status === 404) {
                console.log('ℹ️ Pesan panel leaderboard lama di Discord telah dihapus/tidak ditemukan. Silakan jalankan /topspender kembali.');
                saveLeaderboardLocation(lbChanId, null);
            } else {
                console.warn('Leaderboard message update notice:', e.message || e);
            }
        }
    }
}

/**
 * Membuat Sub-Menu Ringkas Khusus Balasan Ephemeral Tombol Kategori
 */
function buildCategorySubMenuEphemeral(items, catName) {
    const filteredItems = catName === 'ALL' 
        ? items 
        : items.filter(i => (i.category || 'General').toLowerCase() === catName.toLowerCase());

    const emoji = getCategoryEmoji(catName);
    const content = `📁 **KATEGORI TERPILIH: ${emoji} ${catName === 'ALL' ? 'SEMUA PRODUK' : catName.toUpperCase()}**\nSilakan pilih produk dari menu dropdown di bawah untuk membuat tiket transaksi:`;

    const selectItemsList = filteredItems.length > 0 ? filteredItems : items;

    const selectOptions = selectItemsList.map(item => {
        const itemEmoji = getItemEmoji(item);
        const parsed = parseEmoji(itemEmoji);
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
    const closeBtnRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('close_ephemeral_menu')
            .setLabel('❌ Tutup Menu')
            .setStyle(ButtonStyle.Danger)
    );

    return {
        content: content,
        components: [selectRow, closeBtnRow]
    };
}

module.exports = {
    savePanelLocation,
    saveCatalogLocation,
    saveLeaderboardLocation,
    getPanelLocation,
    updateGlobalPanel,
    buildCatalogPanelComponents,
    buildCategorySubMenuEphemeral,
    getAllCategoryEmojis,
    getCategoryEmoji,
    setCategoryEmoji,
    getItemEmoji,
    parseEmoji
};
