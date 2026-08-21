require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Catat pesanan baru ke Supabase
 */
async function createPurchase(orderId, robloxUsername, itemName, price, uniqueCode = 0, status = 'pending', discordTag = '') {
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
      // Smart Fallback jika kolom discord_username atau price belum ada di tabel Supabase
      const hasDiscordUsernameError = error.message && error.message.includes('discord_username');
      const hasPriceError = error.code === 'PGRST204' || (error.message && error.message.includes('price'));

      if (hasDiscordUsernameError) {
        console.warn('⚠️ Kolom `discord_username` belum ada di Supabase, mencoba insert tanpa kolom discord_username...');
        delete payload.discord_username;
        payload.roblox_username = `${cleanDiscordTag} (${cleanRobloxUsername})`;
      }

      if (hasPriceError) {
        console.warn('⚠️ Kolom `price` belum ada di Supabase, mencoba insert tanpa kolom price...');
        delete payload.price;
      }

      const res = await supabase.from('purchases').insert([payload]);
      error = res.error;
    }

    if (error) {
      console.error('Error creating purchase in Supabase:', error);
      return false;
    }

    console.log(`[SUPABASE] Pesanan dicatat: ${orderId} | Roblox: ${cleanRobloxUsername} | Discord: ${cleanDiscordTag} | Item: ${itemName} | Nominal: Rp ${totalPrice.toLocaleString('id-ID')} | Status: ${status}`);
    return true;
  } catch (err) {
    console.error('Unexpected error during Supabase insert:', err);
    return false;
  }
}

/**
 * Update status pesanan (misal: dari pending menjadi fulfilled atau rejected)
 */
async function updatePurchaseStatus(orderId, newStatus) {
  try {
    const { data, error } = await supabase
      .from('purchases')
      .update({ status: newStatus })
      .eq('order_id', orderId);

    if (error) {
      console.error('Error updating purchase status in Supabase:', error);
      return false;
    }

    console.log(`[SUPABASE] Order ${orderId} diupdate menjadi ${newStatus}`);
    return true;
  } catch (err) {
    console.error('Unexpected error during Supabase update:', err);
    return false;
  }
}

/**
 * Ambil Top Spender (Leaderboard Pembeli Terbanyak)
 */
async function getTopSpenders(limit = 10) {
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
      return [];
    }

    // Filter transaksi jika leaderboard pernah di-reset oleh Admin
    if (resetAt) {
      data = data.filter(row => {
        if (!row.created_at) return true;
        return new Date(row.created_at) >= resetAt;
      });
    }

    const spenderMap = {};
    data.forEach(row => {
      // Prioritaskan discord_username jika ada, fallback ke roblox_username
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
        if (foundItem) {
          amount = foundItem.price;
        } else {
          amount = 20000;
        }
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

    return sortedSpenders;
  } catch (err) {
    return [];
  }
}

module.exports = {
  supabase,
  createPurchase,
  updatePurchaseStatus,
  getTopSpenders
};
