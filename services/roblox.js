/**
 * Verifikasi & Autodeteksi Username Roblox dari Database Resmi Roblox API
 */
async function validateRobloxUsername(username) {
    if (!username || username.trim() === '' || username === 'Tidak Perlu') {
        return { valid: true, username: 'Tidak Perlu', id: null, displayName: 'Tidak Perlu' };
    }

    // Bersihkan username dari karakter @ dan spasi
    const cleanUsername = username.trim().replace(/^@/, '').trim();

    try {
        const response = await fetch('https://users.roblox.com/v1/usernames/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            body: JSON.stringify({
                usernames: [cleanUsername],
                excludeBannedUsers: false
            })
        });

        if (response.ok) {
            const json = await response.json();
            if (json.data && json.data.length > 0) {
                const userData = json.data[0];
                return {
                    valid: true,
                    username: userData.name,
                    displayName: userData.displayName || userData.name,
                    id: userData.id
                };
            }
        }
    } catch (err) {
        console.warn('⚠️ Gagal menghubungi Roblox API, mengaktifkan auto-bypass:', err);
    }

    // SMART FALLBACK: Jika username tidak terindeks atau Roblox API rate limited,
    // TETAP ANGGAP VALID agar Pembeli tidak terhambat membuat tiket!
    // Pembeli bisa mengonfirmasi/mengedit username di channel tiket privat.
    return {
        valid: true,
        username: cleanUsername,
        displayName: cleanUsername,
        id: null,
        fallback: true
    };
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
