/**
 * SQLite Database Service for Bebey Store
 * Stores all order transactions locally in purchases.sqlite / SQLite database file
 */
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../purchases.sqlite');

let db = null;
let useNativeSqlite = false;

try {
    const Database = require('better-sqlite3');
    db = new Database(dbPath);
    useNativeSqlite = true;
    db.exec(`
        CREATE TABLE IF NOT EXISTS purchases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id TEXT UNIQUE,
            roblox_username TEXT,
            discord_username TEXT,
            item_name TEXT,
            price INTEGER,
            status TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);
} catch (e) {
    console.log('ℹ️ Using lightweight SQLite JSON storage fallback:', dbPath);
}

// Data store helpers for JSON fallback if native SQLite is not compiled
function loadJsonStore() {
    const jsonPath = path.join(__dirname, '../purchases.json');
    if (!fs.existsSync(jsonPath)) return [];
    try {
        return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    } catch (e) {
        return [];
    }
}

function saveJsonStore(data) {
    const jsonPath = path.join(__dirname, '../purchases.json');
    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Catat pesanan baru ke SQLite
 */
async function createPurchase(orderId, robloxUsername, itemName, price, uniqueCode = 0, status = 'pending', discordTag = '') {
    try {
        const numericPrice = Number(price) || 0;
        const numericUniqueCode = Number(uniqueCode) || 0;
        const totalPrice = numericPrice + numericUniqueCode;
        const cleanDiscordTag = discordTag ? discordTag.trim() : 'Unknown';
        const cleanRobloxUsername = robloxUsername ? robloxUsername.trim() : 'Tidak Perlu';

        if (useNativeSqlite && db) {
            const stmt = db.prepare(`
                INSERT OR REPLACE INTO purchases (order_id, roblox_username, discord_username, item_name, price, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            stmt.run(orderId, cleanRobloxUsername, cleanDiscordTag, itemName, totalPrice, status, new Date().toISOString());
        } else {
            const list = loadJsonStore();
            const existingIdx = list.findIndex(p => p.order_id === orderId);
            const newItem = {
                order_id: orderId,
                roblox_username: cleanRobloxUsername,
                discord_username: cleanDiscordTag,
                item_name: itemName,
                price: totalPrice,
                status: status,
                created_at: new Date().toISOString()
            };
            if (existingIdx >= 0) {
                list[existingIdx] = newItem;
            } else {
                list.push(newItem);
            }
            saveJsonStore(list);
        }

        console.log(`[SQLITE] Pesanan dicatat: ${orderId} | Roblox: ${cleanRobloxUsername} | Discord: ${cleanDiscordTag} | Item: ${itemName} | Nominal: Rp ${totalPrice.toLocaleString('id-ID')} | Status: ${status}`);
        return true;
    } catch (err) {
        console.error('Error creating purchase in SQLite:', err);
        return false;
    }
}

/**
 * Update status pesanan (misal: pending -> fulfilled / rejected)
 */
async function updatePurchaseStatus(orderId, newStatus) {
    try {
        if (!orderId) return false;
        const cleanOrderId = orderId.toUpperCase().trim();
        const cleanStatus = newStatus ? newStatus.toLowerCase().trim() : 'pending';

        if (useNativeSqlite && db) {
            const stmt = db.prepare(`UPDATE purchases SET status = ? WHERE UPPER(order_id) = ?`);
            stmt.run(cleanStatus, cleanOrderId);
        } else {
            const list = loadJsonStore();
            const item = list.find(p => (p.order_id || '').toUpperCase() === cleanOrderId);
            if (item) {
                item.status = cleanStatus;
                saveJsonStore(list);
            }
        }
        console.log(`[SQLITE] Status order ${cleanOrderId} diupdate menjadi ${cleanStatus}`);
        return true;
    } catch (err) {
        console.error('Error updating purchase status in SQLite:', err);
        return false;
    }
}

/**
 * Ambil Top Spender (Leaderboard Pembeli Terbanyak)
 */
async function getTopSpenders(limit = 10) {
    try {
        let purchases = [];
        if (useNativeSqlite && db) {
            const stmt = db.prepare(`SELECT * FROM purchases WHERE status = 'fulfilled'`);
            purchases = stmt.all();
        } else {
            purchases = loadJsonStore().filter(p => p.status === 'fulfilled');
        }

        delete require.cache[require.resolve('../config/items')];
        const catalogItems = require('../config/items');
        const { getPanelLocation } = require('./panelManager');
        const loc = getPanelLocation();
        const resetAt = loc && loc.leaderboardResetAt ? new Date(loc.leaderboardResetAt) : null;

        if (resetAt) {
            purchases = purchases.filter(row => {
                if (!row.created_at) return true;
                return new Date(row.created_at) >= resetAt;
            });
        }

        const spenderMap = {};
        purchases.forEach(row => {
            const username = (row.discord_username && row.discord_username.trim() !== '') 
                ? row.discord_username.trim() 
                : (row.roblox_username || 'Unknown');

            let amount = Number(row.price) || 0;
            if (amount <= 0) {
                const foundItem = catalogItems.find(i => 
                    (i.name && row.item_name && i.name.toLowerCase() === row.item_name.toLowerCase()) ||
                    (i.id && row.item_name && i.id.toLowerCase() === row.item_name.toLowerCase())
                );
                amount = foundItem ? foundItem.price : 20000;
            }
            spenderMap[username] = (spenderMap[username] || 0) + amount;
        });

        const sortedSpenders = Object.keys(spenderMap)
            .map(username => ({ username: username, totalSpent: spenderMap[username] }))
            .sort((a, b) => b.totalSpent - a.totalSpent)
            .slice(0, limit);

        return sortedSpenders;
    } catch (err) {
        console.error('Error fetching top spenders from SQLite:', err);
        return [];
    }
}

/**
 * Ambil seluruh transaksi (untuk Laporan Excel All-Time)
 */
async function getAllPurchases() {
    try {
        if (useNativeSqlite && db) {
            const stmt = db.prepare(`SELECT * FROM purchases WHERE LOWER(status) = 'fulfilled' ORDER BY created_at ASC`);
            return stmt.all();
        } else {
            return loadJsonStore()
                .filter(p => (p.status || '').toLowerCase() === 'fulfilled')
                .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        }
    } catch (err) {
        console.error('Error fetching all purchases from SQLite:', err);
        return [];
    }
}

/**
 * Ambil data pesanan spesifik berdasarkan Order ID
 */
async function getPurchaseById(orderId) {
    try {
        if (!orderId) return null;
        const cleanOrderId = orderId.toUpperCase();
        if (useNativeSqlite && db) {
            const stmt = db.prepare(`SELECT * FROM purchases WHERE UPPER(order_id) = ?`);
            return stmt.get(cleanOrderId) || null;
        } else {
            const list = loadJsonStore();
            return list.find(p => (p.order_id || '').toUpperCase() === cleanOrderId) || null;
        }
    } catch (err) {
        console.error('Error fetching purchase by ID from SQLite:', err);
        return null;
    }
}

/**
 * Update username roblox pesanan
 */
async function updateRobloxUsername(orderId, robloxUsername) {
    try {
        if (!orderId) return false;
        const cleanOrderId = orderId.toUpperCase();
        if (useNativeSqlite && db) {
            const stmt = db.prepare(`UPDATE purchases SET roblox_username = ? WHERE UPPER(order_id) = ?`);
            stmt.run(robloxUsername, cleanOrderId);
        } else {
            const list = loadJsonStore();
            const item = list.find(p => (p.order_id || '').toUpperCase() === cleanOrderId);
            if (item) {
                item.roblox_username = robloxUsername;
                saveJsonStore(list);
            }
        }
        return true;
    } catch (err) {
        console.error('Error updating roblox username in SQLite:', err);
        return false;
    }
}

/**
 * Hapus data transaksi dari SQLite berdasarkan Order ID
 */
async function deletePurchaseById(orderId) {
    try {
        if (!orderId) return false;
        const cleanOrderId = orderId.trim().toUpperCase();
        if (useNativeSqlite && db) {
            const stmt = db.prepare(`DELETE FROM purchases WHERE UPPER(order_id) = ?`);
            const info = stmt.run(cleanOrderId);
            console.log(`[SQLITE] Row transaksi ${cleanOrderId} berhasil dihapus dari database.`);
            return info.changes > 0;
        } else {
            const list = loadJsonStore();
            const newList = list.filter(p => (p.order_id || '').toUpperCase() !== cleanOrderId);
            if (newList.length < list.length) {
                saveJsonStore(newList);
                console.log(`[SQLITE JSON] Row transaksi ${cleanOrderId} berhasil dihapus dari JSON store.`);
                return true;
            }
            return false;
        }
    } catch (err) {
        console.error('Error deleting purchase by ID from SQLite:', err);
        return false;
    }
}

module.exports = {
    createPurchase,
    updatePurchaseStatus,
    getTopSpenders,
    getAllPurchases,
    getPurchaseById,
    updateRobloxUsername,
    deletePurchaseById
};
