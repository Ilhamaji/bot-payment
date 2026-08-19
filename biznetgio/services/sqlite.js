require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
	if (err) {
		console.error('❌ Gagal membuka database SQLite:', err.message);
	} else {
		console.log(`⚡ [SQLITE BIZNETGIO] Database SQLite terhubung: ${dbPath}`);
	}
});

// Inisialisasi Tabel Purchases
db.serialize(() => {
	db.run(`
		CREATE TABLE IF NOT EXISTS purchases (
			order_id TEXT PRIMARY KEY,
			roblox_username TEXT,
			discord_username TEXT,
			item_name TEXT,
			price INTEGER,
			status TEXT DEFAULT 'pending',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)
	`, (err) => {
		if (err) {
			console.error('❌ Gagal membuat tabel purchases di SQLite:', err.message);
		} else {
			console.log('✅ [SQLITE BIZNETGIO] Tabel `purchases` siap digunakan!');
		}
	});
});

/**
 * Catat pesanan baru ke SQLite
 */
function createPurchase(orderId, robloxUsername, itemName, price, uniqueCode = 0, status = 'pending', discordTag = '') {
	return new Promise((resolve) => {
		const numericPrice = Number(price) || 0;
		const numericUniqueCode = Number(uniqueCode) || 0;
		const totalPrice = numericPrice + numericUniqueCode;
		const cleanDiscordTag = discordTag ? discordTag.trim() : 'Unknown';
		const cleanRobloxUsername = robloxUsername ? robloxUsername.trim() : 'Tidak Perlu';

		const sql = `
			INSERT OR REPLACE INTO purchases (order_id, roblox_username, discord_username, item_name, price, status)
			VALUES (?, ?, ?, ?, ?, ?)
		`;

		db.run(sql, [orderId, cleanRobloxUsername, cleanDiscordTag, itemName, totalPrice, status], function (err) {
			if (err) {
				console.error('❌ Error createPurchase SQLite:', err.message);
				return resolve(false);
			}
			console.log(`[SQLITE BIZNETGIO] Pesanan dicatat: ${orderId} | Roblox: ${cleanRobloxUsername} | Discord: ${cleanDiscordTag} | Item: ${itemName} | Nominal: Rp ${totalPrice.toLocaleString('id-ID')} | Status: ${status}`);
			resolve(true);
		});
	});
}

/**
 * Update status pesanan (pending, fulfilled, rejected)
 */
function updatePurchaseStatus(orderId, newStatus) {
	return new Promise((resolve) => {
		const sql = `UPDATE purchases SET status = ? WHERE order_id = ?`;
		db.run(sql, [newStatus, orderId], function (err) {
			if (err) {
				console.error('❌ Error updatePurchaseStatus SQLite:', err.message);
				return resolve(false);
			}
			console.log(`[SQLITE BIZNETGIO] Order ${orderId} diupdate menjadi ${newStatus}`);
			resolve(true);
		});
	});
}

/**
 * Ambil Top Spender (Leaderboard Pembeli Terbanyak)
 */
function getTopSpenders(limit = 10) {
	return new Promise((resolve) => {
		try {
			delete require.cache[require.resolve('../config/items')];
			const catalogItems = require('../config/items');

			const sql = `SELECT discord_username, roblox_username, item_name, price FROM purchases WHERE status = 'fulfilled'`;
			db.all(sql, [], (err, rows) => {
				if (err || !rows) {
					console.error('❌ Error getTopSpenders SQLite:', err ? err.message : 'No rows');
					return resolve([]);
				}

				const spenderMap = {};
				rows.forEach(row => {
					const username = (row.discord_username && row.discord_username.trim() !== '') 
						? row.discord_username.trim() 
						: (row.roblox_username || 'Unknown');

					let amount = 0;
					if (row.price !== undefined && row.price !== null && Number(row.price) > 0) {
						amount = Number(row.price);
					} else {
						const foundItem = catalogItems.find(i => 
							(i.name && row.item_name && i.name.toLowerCase() === row.item_name.toLowerCase()) || 
							(i.id && row.item_name && i.id.toLowerCase() === row.item_name.toLowerCase())
						);
						amount = foundItem ? foundItem.price : 20000;
					}

					spenderMap[username] = (spenderMap[username] || 0) + amount;
				});

				const sortedSpenders = Object.keys(spenderMap)
					.map(username => ({
						username: username,
						totalSpent: spenderMap[username]
					}))
					.sort((a, b) => b.totalSpent - a.totalSpent)
					.slice(0, limit);

				resolve(sortedSpenders);
			});
		} catch (err) {
			resolve([]);
		}
	});
}

/**
 * Mengambil transaksi bulanan untuk laporan Excel (.xlsx)
 */
function fetchMonthlyTransactions(year, month) {
	return new Promise((resolve) => {
		const monthPadded = String(month).padStart(2, '0');
		const prefix = `${year}-${monthPadded}`;

		const sql = `
			SELECT * FROM purchases 
			WHERE status = 'fulfilled' 
			  AND (strftime('%Y-%m', created_at) = ? OR created_at LIKE ?)
			ORDER BY created_at ASC
		`;

		db.all(sql, [prefix, `${prefix}%`], (err, rows) => {
			if (err) {
				console.error('❌ Error fetchMonthlyTransactions SQLite:', err.message);
				return resolve([]);
			}
			resolve(rows || []);
		});
	});
}

/**
 * Helper untuk query 1 data purchase berdasarkan orderId (Mock Supabase Interface)
 */
const supabase = {
	from: function (tableName) {
		return {
			select: function (columns) {
				return {
					eq: function (field, value) {
						return {
							single: function () {
								return new Promise((resolve) => {
									const sql = `SELECT ${columns === '*' ? '*' : columns} FROM ${tableName} WHERE ${field} = ? LIMIT 1`;
									db.get(sql, [value], (err, row) => {
										if (err || !row) return resolve({ data: null, error: err });
										resolve({ data: row, error: null });
									});
								});
							}
						};
					}
				};
			}
		};
	}
};

module.exports = {
	db,
	supabase,
	createPurchase,
	updatePurchaseStatus,
	getTopSpenders,
	fetchMonthlyTransactions
};
