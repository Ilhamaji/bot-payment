const fs = require('node:fs');
const path = require('node:path');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');

const configFile = path.join(__dirname, '../config/panel_config.json');
const categoryConfigFile = path.join(__dirname, '../config/category_emojis.json');
const categorySettingsFile = path.join(__dirname, '../config/category_config.json');

/**
 * Membaca seluruh konfigurasi kategori dari category_config.json
 */
function getAllCategoryConfigs() {
    try {
        if (fs.existsSync(categorySettingsFile)) {
            return JSON.parse(fs.readFileSync(categorySettingsFile, 'utf8'));
        }
        const emojis = getAllCategoryEmojis();
        const configs = {};
        Object.keys(emojis).forEach(cat => {
            configs[cat] = { emoji: emojis[cat], allowQuantity: false };
        });
        return configs;
    } catch (err) {
        return {};
    }
}

/**
 * Membaca detail konfigurasi kategori spesifik (emoji & allowQuantity)
 */
function getCategoryConfig(categoryName) {
    if (!categoryName) return { emoji: '📁', allowQuantity: false, usePrivateServer: false };
    const configs = getAllCategoryConfigs();
    const config = configs[categoryName];
    if (config) {
        if (typeof config === 'string') {
            return { emoji: config, allowQuantity: false, usePrivateServer: false };
        }
        const catLower = categoryName.toLowerCase();
        const defaultPs = !catLower.includes('robux');

        return {
            emoji: config.emoji || '📁',
            allowQuantity: config.allowQuantity === true,
            usePrivateServer: config.usePrivateServer !== undefined ? config.usePrivateServer === true : defaultPs
        };
    }
    const catLower = (categoryName || '').toLowerCase();
    return {
        emoji: '📁',
        allowQuantity: false,
        usePrivateServer: !catLower.includes('robux')
    };
}

/**
 * Menyimpan / memperbarui konfigurasi kategori (emoji & allowQuantity)
 */
function setCategoryConfig(categoryName, newConfig) {
    if (!categoryName) return;
    const configs = getAllCategoryConfigs();
    const current = configs[categoryName] || { emoji: '📁', allowQuantity: false, usePrivateServer: false };

    configs[categoryName] = {
        emoji: newConfig.emoji !== undefined ? newConfig.emoji : (current.emoji || '📁'),
        allowQuantity: newConfig.allowQuantity !== undefined ? newConfig.allowQuantity : current.allowQuantity,
        usePrivateServer: newConfig.usePrivateServer !== undefined ? newConfig.usePrivateServer : (current.usePrivateServer === true)
    };

    try {
        fs.writeFileSync(categorySettingsFile, JSON.stringify(configs, null, 4), 'utf8');
        setCategoryEmoji(categoryName, configs[categoryName].emoji);
    } catch (err) {
        console.error('Error saving category config:', err);
    }
}

/**
 * Cek apakah item dalam kategori ini bisa dibeli beberapa sekaligus (multi quantity / keranjang)
 */
function isCategoryQuantityAllowed(categoryName) {
    const config = getCategoryConfig(categoryName);
    return config.allowQuantity === true;
}

/**
 * Cek apakah item dalam kategori ini bisa menggunakan private server
 */
function isCategoryPrivateServerAllowed(categoryName) {
    const config = getCategoryConfig(categoryName);
    return config.usePrivateServer === true;
}

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
    if (!categoryName) return '📁';
    try {
        if (fs.existsSync(categorySettingsFile)) {
            const configs = JSON.parse(fs.readFileSync(categorySettingsFile, 'utf8'));
            if (configs && configs[categoryName]) {
                const conf = configs[categoryName];
                if (typeof conf === 'string') return conf;
                if (conf.emoji) return conf.emoji;
            }
        }
    } catch (e) {}

    const emojis = getAllCategoryEmojis();
    if (emojis && emojis[categoryName]) {
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
        const configDir = path.dirname(configFile);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
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
        const configDir = path.dirname(configFile);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
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
 * Reset waktu hitung leaderboard (menyimpan timestamp reset ke config)
 */
function resetLeaderboardTime() {
    try {
        const configDir = path.dirname(configFile);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        const current = getPanelLocation();
        current.leaderboardResetAt = new Date().toISOString();
        fs.writeFileSync(configFile, JSON.stringify(current, null, 4), 'utf8');
        return current.leaderboardResetAt;
    } catch (err) {
        console.error('Error saving leaderboard reset time:', err);
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

    let catalogDescription = 
        `Selamat datang di **Bebey Store**! 🏪\n\n` +
        `Silakan **klik Tombol Kategori** di bawah ini untuk memilih produk & membuka tiket transaksi privat:\n\n`;

    categories.forEach(catName => {
        const emoji = getCategoryEmoji(catName);
        const itemCount = items.filter(i => (i.category || 'General').toLowerCase() === catName.toLowerCase()).length;
        catalogDescription += `> ${emoji} **${catName.toUpperCase()}** • \`${itemCount} Produk\`\n`;
    });

    catalogDescription += `\n📌 *Klik tombol kategori sesuai produk yang ingin kamu beli!*`;

    const catEmbed = new EmbedBuilder()
        .setTitle('🏪  BEBEY STORE — OFFICIAL STORE PANEL')
        .setColor(0x5865F2)
        .setDescription(catalogDescription.trim())
        .setTimestamp()
        .setFooter({ text: '⚡ Bebey Store Official • Automatic 24/7 Ticketing System' });

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
                console.log('ℹ️ Pesan panel leaderboard lama di Discord telah dihapus/tidak ditemukan. Silakan jalankan /leaderboard kembali.');
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
function buildCategorySubMenuEphemeral(items, catName, rangeFilter = null) {
    let filteredItems = catName === 'ALL' 
        ? items 
        : items.filter(i => (i.category || 'General').toLowerCase() === catName.toLowerCase());

    const emoji = getCategoryEmoji(catName);

    // Kategori "Skin Fish It" (44 item) -> Tampilkan Tombol Sub-Kelompok Abjad jika belum memilih range
    if (catName.toLowerCase() === 'skin fish it' && !rangeFilter) {
        const skinEmbed = new EmbedBuilder()
            .setTitle(`🗡️  BEBEY STORE — KATALOG SKIN FISH IT`)
            .setColor(0x3498DB)
            .setDescription(
                `Kategori **Skin Fish It** memiliki total **44 Skin**.\n` +
                `Silakan pilih kelompok abjad di bawah ini untuk melihat daftar lengkap produk & harganya:`
            )
            .setFooter({ text: '💖 Bebey Store Catalog • Skin Fish It' });

        const btnAE = new ButtonBuilder()
            .setCustomId('subrange_Skin_AE')
            .setLabel('🗡️ Skin (A - E)')
            .setStyle(ButtonStyle.Primary);

        const btnFS = new ButtonBuilder()
            .setCustomId('subrange_Skin_FS')
            .setLabel('🗡️ Skin (F - S)')
            .setStyle(ButtonStyle.Primary);

        const btnTZ = new ButtonBuilder()
            .setCustomId('subrange_Skin_TZ')
            .setLabel('🗡️ Skin (T - Z)')
            .setStyle(ButtonStyle.Primary);

        const btnBackMain = new ButtonBuilder()
            .setCustomId('back_to_main_cat')
            .setLabel('⬅️ Kembali')
            .setStyle(ButtonStyle.Secondary);

        const row1 = new ActionRowBuilder().addComponents(btnAE, btnFS, btnTZ);
        const row2 = new ActionRowBuilder().addComponents(btnBackMain);

        return {
            embeds: [skinEmbed],
            components: [row1, row2]
        };
    }

    // Filter berdasarkan range huruf jika ada
    let displayTitle = catName.toUpperCase();
    if (rangeFilter === 'AE') {
        filteredItems = filteredItems.filter(i => i.name.match(/^[a-eA-E]/));
        displayTitle = 'SKIN FISH IT (A - E)';
    } else if (rangeFilter === 'FS') {
        filteredItems = filteredItems.filter(i => i.name.match(/^[f-sF-S]/));
        displayTitle = 'SKIN FISH IT (F - S)';
    } else if (rangeFilter === 'TZ') {
        filteredItems = filteredItems.filter(i => i.name.match(/^[t-zT-Z]/));
        displayTitle = 'SKIN FISH IT (T - Z)';
    }

    let itemsListStr = '';
    filteredItems.forEach((item, index) => {
        const itemEmoji = getItemEmoji(item);
        const isHeld = item.available === false || item.hold === true;
        const priceStr = isHeld ? '`⛔ DITAHAN`' : `\`Rp ${item.price.toLocaleString('id-ID')}\``;
        itemsListStr += `**${index + 1}.** ${itemEmoji} **${item.name}** — ${priceStr}\n`;
    });

    const categoryEmbed = new EmbedBuilder()
        .setTitle(`${emoji}  BEBEY STORE — KATALOG ${displayTitle}`)
        .setColor(0x3498DB)
        .setDescription(
            `Berikut adalah daftar seluruh menu & harga produk untuk kategori **${emoji} ${displayTitle}**:\n\n` +
            itemsListStr + '\n' +
            `📌 **Petunjuk:** Silakan pilih produk dari menu dropdown di bawah untuk dimasukkan ke keranjang belanja:`
        )
        .setTimestamp()
        .setFooter({ text: `💖 Bebey Store Catalog • ${displayTitle}` });

    const selectOptions = filteredItems.map(item => {
        const itemEmoji = getItemEmoji(item);
        const parsed = parseEmoji(itemEmoji);
        const isHeld = item.available === false || item.hold === true;

        const opt = new StringSelectMenuOptionBuilder()
            .setLabel(isHeld ? `⛔ ${item.name} (Ditahan)` : `${item.name}`)
            .setValue(item.id)
            .setDescription(isHeld ? `⛔ Sementara tidak dapat dibeli` : `Rp ${item.price.toLocaleString('id-ID')}`);

        if (isHeld) {
            opt.setEmoji('⛔');
        } else if (parsed.option) {
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
        .setPlaceholder(`🛒 Pilih Produk ${displayTitle}...`)
        .addOptions(selectOptions.slice(0, 25));

    const selectRow = new ActionRowBuilder().addComponents(selectMenu);

    const isSkinCategory = catName.toLowerCase() === 'skin fish it';
    const btnBack = new ButtonBuilder()
        .setCustomId(isSkinCategory ? 'back_to_subcat_Skin Fish It' : 'back_to_main_cat')
        .setLabel(isSkinCategory ? '⬅️ Kembali ke Kelompok Skin' : '⬅️ Kembali')
        .setStyle(ButtonStyle.Secondary);

    const btnRow = new ActionRowBuilder().addComponents(btnBack);

    return {
        embeds: [categoryEmbed],
        components: [selectRow, btnRow]
    };
}

/**
 * Mendapatkan URL Global Private World / Server toko
 */
function getGlobalPrivateServerUrl() {
    const config = getPanelLocation();
    return config.globalPrivateServerUrl || '';
}

/**
 * Menyimpan URL Global Private World / Server toko
 */
function setGlobalPrivateServerUrl(url) {
    try {
        const configDir = path.dirname(configFile);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        const current = getPanelLocation();
        current.globalPrivateServerUrl = url ? url.trim() : '';
        fs.writeFileSync(configFile, JSON.stringify(current, null, 4), 'utf8');
    } catch (err) {
        console.error('Error saving global private server URL:', err);
    }
}

module.exports = {
    savePanelLocation,
    saveCatalogLocation,
    saveLeaderboardLocation,
    resetLeaderboardTime,
    getPanelLocation,
    getGlobalPrivateServerUrl,
    setGlobalPrivateServerUrl,
    updateGlobalPanel,
    buildCatalogPanelComponents,
    buildCategorySubMenuEphemeral,
    getAllCategoryEmojis,
    getCategoryEmoji,
    setCategoryEmoji,
    getAllCategoryConfigs,
    getCategoryConfig,
    setCategoryConfig,
    isCategoryQuantityAllowed,
    isCategoryPrivateServerAllowed,
    getItemEmoji,
    parseEmoji
};
