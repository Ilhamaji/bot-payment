/**
 * Verifikasi apakah Username Roblox benar-benar terdaftar di database resmi Roblox API
 */
async function validateRobloxUsername(username) {
    if (!username || username.trim() === '' || username === 'Tidak Perlu') {
        return { valid: true, username: 'Tidak Perlu', id: null, displayName: 'Tidak Perlu' };
    }

    const cleanUsername = username.trim().replace(/^@/, '');

    try {
        const response = await fetch('https://users.roblox.com/v1/usernames/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                usernames: [cleanUsername],
                excludeBannedUsers: true
            })
        });

        if (!response.ok) {
            // Jika Roblox API error/rate-limited, anggap valid agar transaksi pembeli tidak terhambat
            return { valid: true, username: cleanUsername, id: null, displayName: cleanUsername };
        }

        const json = await response.json();
        if (json.data && json.data.length > 0) {
            const userData = json.data[0];
            return {
                valid: true,
                username: userData.name,
                displayName: userData.displayName,
                id: userData.id
            };
        } else {
            return {
                valid: false,
                username: cleanUsername,
                error: `Username Roblox \`${cleanUsername}\` tidak ditemukan di Roblox.`
            };
        }
    } catch (err) {
        console.warn('⚠️ Gagal menghubungi Roblox API, bypass validasi:', err);
        return { valid: true, username: cleanUsername, id: null, displayName: cleanUsername };
    }
}

/**
 * Ambil URL Gambar Avatar Headshot dari Roblox API
 */
async function getRobloxAvatarHeadshot(userId) {
    if (!userId) return null;
    try {
        const response = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`);
        if (!response.ok) return null;
        const json = await response.json();
        if (json.data && json.data.length > 0 && json.data[0].imageUrl) {
            return json.data[0].imageUrl;
        }
    } catch (e) {
        console.warn('⚠️ Gagal mengambil avatar headshot Roblox:', e);
    }
    return null;
}

module.exports = {
    validateRobloxUsername,
    getRobloxAvatarHeadshot
};
