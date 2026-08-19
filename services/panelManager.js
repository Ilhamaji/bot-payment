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

    categories.forEach(cat => {
        // Jika baris saat ini sudah penuh (5 tombol per ActionRow Discord), buat baris ActionRow baru
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

    // Maksimal 4 ActionRows untuk tombol kategori
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

    // Baris 1-4: Tombol Kategori Filter (Sub-Menu Dinamis Auto-Update)
    const categoryRows = buildCategoryButtons(categories, selectedCategory);

    return {
        embeds: [catEmbed],
        components: [...categoryRows]
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
                        .setTitle('🏆  BEBEY STORE — TOP SPENDERS LEADERBOARD')
                        .setColor(0xF1C40F)
                        .setDescription(lbDescription.trim())
                        .setTimestamp()
                        .setFooter({ text: '🏆 Bebey Store Official • Live Leaderboard' });

                    await lbMessage.edit({ embeds: [lbEmbed] });
                }
            } catch (e) {
                console.warn('Leaderboard message not found or fail to edit:', e);
            }
        }

        // 2. UPDATE MESSAGE 2: KATALOG RESMI GROUPED
        const catalogMsgId = loc.catalogMessageId;
        if (catalogMsgId) {
            try {
                const catMessage = await channel.messages.fetch(catalogMsgId);
                if (catMessage) {
                    delete require.cache[require.resolve('../config/items')];
                    const items = require('../config/items');
                    const { embeds, components } = buildCatalogPanelComponents(items, 'ALL');

                    await catMessage.edit({ embeds, components });
                    console.log(`[AUTO-PANEL UPDATE] Dual messages (Leaderboard & Katalog Grouped) di #${channel.name} berhasil di-update real-time!`);
                }
            } catch (e) {
                console.warn('Catalog message not found or fail to edit:', e);
            }
        }
    } catch (err) {
        console.error('Error during global panel auto-update:', err);
    }
}

/**
 * Membuat Sub-Menu Ringkas (Tanpa Embed Duplikat) Khusus Balasan Ephemeral Tombol Kategori
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

    return {
        content: content,
        components: [selectRow]
    };
}

module.exports = {
    savePanelLocation,
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
