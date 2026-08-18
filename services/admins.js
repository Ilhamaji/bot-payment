require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');

const adminsFilePath = path.join(__dirname, '../config/admins.json');

// Inisialisasi file admins.json jika belum ada
if (!fs.existsSync(adminsFilePath)) {
    fs.writeFileSync(adminsFilePath, JSON.stringify([], null, 4), 'utf8');
}

/**
 * Cek apakah user adalah Owner / Admin Utama (HANYA DARI OWNER_DISCORD_ID DI .ENV)
 */
function isOwner(userId) {
    const ownerId = process.env.OWNER_DISCORD_ID ? process.env.OWNER_DISCORD_ID.trim() : '';
    return ownerId !== '' && userId === ownerId;
}

/**
 * Cek apakah user adalah Admin (Admin Utama dari .env ATAU Admin Sekunder dari admins.json)
 */
function isAdmin(userId) {
    if (isOwner(userId)) return true;

    try {
        const data = fs.readFileSync(adminsFilePath, 'utf8');
        const adminList = JSON.parse(data);
        return adminList.some(a => a.id === userId);
    } catch (err) {
        console.error('Error reading admins.json:', err);
        return false;
    }
}

/**
 * Tambah Admin Sekunder Baru (Hanya Admin Utama yang bisa menambah)
 */
function addAdmin(userId, userTag) {
    try {
        const data = fs.readFileSync(adminsFilePath, 'utf8');
        let adminList = JSON.parse(data);

        if (adminList.some(a => a.id === userId)) {
            return { success: false, message: 'User tersebut sudah menjadi Admin.' };
        }

        adminList.push({
            id: userId,
            tag: userTag,
            addedAt: new Date().toISOString()
        });

        fs.writeFileSync(adminsFilePath, JSON.stringify(adminList, null, 4), 'utf8');
        return { success: true, message: `Berhasil menambahkan ${userTag} sebagai Admin.` };
    } catch (err) {
        console.error('Error adding admin:', err);
        return { success: false, message: 'Gagal menyimpan data Admin.' };
    }
}

/**
 * Hapus Admin Sekunder (Admin Utama dari .env tidak bisa dihapus)
 */
function removeAdmin(userId) {
    if (isOwner(userId)) {
        return { success: false, message: '❌ DILARANG! Admin Utama (Owner) tidak dapat dihapus!' };
    }

    try {
        const data = fs.readFileSync(adminsFilePath, 'utf8');
        let adminList = JSON.parse(data);

        const initialLength = adminList.length;
        adminList = adminList.filter(a => a.id !== userId);

        if (adminList.length === initialLength) {
            return { success: false, message: 'User tersebut tidak ditemukan di daftar Admin.' };
        }

        fs.writeFileSync(adminsFilePath, JSON.stringify(adminList, null, 4), 'utf8');
        return { success: true, message: 'Berhasil menghapus Admin tersebut.' };
    } catch (err) {
        console.error('Error removing admin:', err);
        return { success: false, message: 'Gagal mengupdate data Admin.' };
    }
}

/**
 * Ambil daftar semua Admin
 */
function getAdmins() {
    try {
        const data = fs.readFileSync(adminsFilePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
}

module.exports = {
    isOwner,
    isAdmin,
    addAdmin,
    removeAdmin,
    getAdmins
};
