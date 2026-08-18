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

module.exports = {
    validateRobloxUsername
};
