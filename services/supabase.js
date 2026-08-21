require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const useSqlite = process.env.USE_SQLITE === 'true' || !supabaseUrl || !supabaseKey || supabaseUrl.includes('your-project');

let supabase = null;
if (!useSqlite) {
  try {
    const { createClient } = require('@supabase/supabase-js');
    supabase = createClient(supabaseUrl, supabaseKey);
  } catch (e) {
    console.warn('⚠️ Gagal koneksi ke Supabase, otomatis beralih ke database lokal SQLite.');
  }
}

const sqlite = require('./sqlite');

/**
 * Catat pesanan baru (Supabase / SQLite)
 */
async function createPurchase(orderId, robloxUsername, itemName, price, uniqueCode = 0, status = 'pending', discordTag = '') {
  if (useSqlite || !supabase) {
    return sqlite.createPurchase(orderId, robloxUsername, itemName, price, uniqueCode, status, discordTag);
  }

  try {
    const numericPrice = Number(price) || 0;
    const numericUniqueCode = Number(uniqueCode) || 0;
    const totalPrice = numericPrice + numericUniqueCode;
    const cleanDiscordTag = discordTag ? discordTag.trim() : 'Unknown';
    const cleanRobloxUsername = robloxUsername ? robloxUsername.trim() : 'Tidak Perlu';

    let payload = { 
      order_id: orderId, 
      roblox_username: cleanRobloxUsername,
      discord_username: cleanDiscordTag,
      item_name: itemName,
      price: totalPrice,
      status: status
    };

    let { data, error } = await supabase
      .from('purchases')
      .insert([payload]);

    if (error) {
      const hasDiscordUsernameError = error.message && error.message.includes('discord_username');
      const hasPriceError = error.code === 'PGRST204' || (error.message && error.message.includes('price'));

      if (hasDiscordUsernameError) {
        delete payload.discord_username;
        payload.roblox_username = `${cleanDiscordTag} (${cleanRobloxUsername})`;
      }

      if (hasPriceError) {
        delete payload.price;
      }

      const res = await supabase.from('purchases').insert([payload]);
      error = res.error;
    }

    if (error) {
      console.error('Error creating purchase in Supabase, falling back to SQLite:', error);
      return sqlite.createPurchase(orderId, robloxUsername, itemName, price, uniqueCode, status, discordTag);
    }

    console.log(`[SUPABASE] Pesanan dicatat: ${orderId} | Roblox: ${cleanRobloxUsername} | Discord: ${cleanDiscordTag} | Item: ${itemName} | Nominal: Rp ${totalPrice.toLocaleString('id-ID')} | Status: ${status}`);
    return true;
  } catch (err) {
    console.error('Unexpected error during Supabase insert, falling back to SQLite:', err);
    return sqlite.createPurchase(orderId, robloxUsername, itemName, price, uniqueCode, status, discordTag);
  }
}

/**
 * Update status pesanan
 */
async function updatePurchaseStatus(orderId, newStatus) {
  if (useSqlite || !supabase) {
    return sqlite.updatePurchaseStatus(orderId, newStatus);
  }

  try {
    const { data, error } = await supabase
      .from('purchases')
      .update({ status: newStatus })
      .eq('order_id', orderId);

    if (error) {
      console.error('Error updating purchase status in Supabase, falling back to SQLite:', error);
      return sqlite.updatePurchaseStatus(orderId, newStatus);
    }

    console.log(`[SUPABASE] Order ${orderId} diupdate menjadi ${newStatus}`);
    return true;
  } catch (err) {
    console.error('Unexpected error during Supabase update, falling back to SQLite:', err);
    return sqlite.updatePurchaseStatus(orderId, newStatus);
  }
}

/**
 * Ambil Top Spender (Leaderboard Pembeli Terbanyak)
 */
async function getTopSpenders(limit = 10) {
  if (useSqlite || !supabase) {
    return sqlite.getTopSpenders(limit);
  }

  try {
    delete require.cache[require.resolve('../config/items')];
    const catalogItems = require('../config/items');
    const { getPanelLocation } = require('./panelManager');
    const loc = getPanelLocation();
    const resetAt = loc && loc.leaderboardResetAt ? new Date(loc.leaderboardResetAt) : null;

    let { data, error } = await supabase
      .from('purchases')
      .select('discord_username, roblox_username, item_name, price, created_at')
      .eq('status', 'fulfilled');

    if (error) {
      const res = await supabase
        .from('purchases')
        .select('roblox_username, item_name, created_at')
        .eq('status', 'fulfilled');
      data = res.data;
      error = res.error;
    }

    if (error || !data) {
      return sqlite.getTopSpenders(limit);
    }

    if (resetAt) {
      data = data.filter(row => {
        if (!row.created_at) return true;
        return new Date(row.created_at) >= resetAt;
      });
    }

    const spenderMap = {};
    data.forEach(row => {
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
      .map(username => ({ username: username, totalSpent: spenderMap[username] }))
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, limit);

    return sortedSpenders;
  } catch (err) {
    return sqlite.getTopSpenders(limit);
  }
}

/**
 * Ambil seluruh transaksi (untuk Excel Report)
 */
async function getAllPurchases() {
  if (useSqlite || !supabase) {
    return sqlite.getAllPurchases();
  }
  try {
    const { data, error } = await supabase
      .from('purchases')
      .select('*')
      .eq('status', 'fulfilled')
      .order('created_at', { ascending: true });
    if (error || !data) return sqlite.getAllPurchases();
    return data;
  } catch (e) {
    return sqlite.getAllPurchases();
  }
}

async function getPurchaseById(orderId) {
  if (useSqlite || !supabase) {
    return sqlite.getPurchaseById(orderId);
  }
  try {
    const { data, error } = await supabase
      .from('purchases')
      .select('*')
      .eq('order_id', orderId)
      .single();
    if (error || !data) return sqlite.getPurchaseById(orderId);
    return data;
  } catch (e) {
    return sqlite.getPurchaseById(orderId);
  }
}

async function updateRobloxUsername(orderId, robloxUsername) {
  if (useSqlite || !supabase) {
    return sqlite.updateRobloxUsername(orderId, robloxUsername);
  }
  try {
    const { error } = await supabase
      .from('purchases')
      .update({ roblox_username: robloxUsername })
      .eq('order_id', orderId);
    if (error) return sqlite.updateRobloxUsername(orderId, robloxUsername);
    return true;
  } catch (e) {
    return sqlite.updateRobloxUsername(orderId, robloxUsername);
  }
}

async function deletePurchaseById(orderId) {
  if (useSqlite || !supabase) {
    return sqlite.deletePurchaseById(orderId);
  }
  try {
    const { error } = await supabase
      .from('purchases')
      .delete()
      .eq('order_id', orderId);
    if (error) return sqlite.deletePurchaseById(orderId);
    console.log(`[SUPABASE] Row transaksi ${orderId} berhasil dihapus dari Supabase.`);
    return true;
  } catch (e) {
    return sqlite.deletePurchaseById(orderId);
  }
}

module.exports = {
  supabase,
  createPurchase,
  updatePurchaseStatus,
  getTopSpenders,
  getAllPurchases,
  getPurchaseById,
  updateRobloxUsername,
  deletePurchaseById
};
