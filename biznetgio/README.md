# 🏪 Bebey Store — Professional Discord Payment & Ticketing Bot

Bot Discord Pembayaran & Manajemen Toko Otomatis 24/7 yang dilengkapi dengan Sistem Tiket Privat, Verifikasi API Roblox Real-Time, Integrasi Database Supabase, Papan Peringkat Live, dan Laporan Rekapitulasi Penjualan Bulanan Otomatis dalam Format Excel (`.xlsx`).

---

## 🌟 Fitur Utama (Key Features)

- 🏪 **Panel Toko Multi-Kategori Interaktif (`/panel`)**: Tampilan katalog toko publik terelompok rapi per kategori dengan balasan privat (*Ephemeral*) tanpa mengotori channel toko.
- 🎮 **Verifikasi API Roblox Real-Time**: Memvalidasi Username Roblox pembeli secara langsung ke Database API Resmi Roblox sebelum tiket dibuat.
- 🎫 **Sistem Tiket Privat Otomatis**: Setiap pembeli mendapatkan text channel privat khusus (`#<kode-item>-<hash>`) di bawah Kategori Discord yang telah ditentukan.
- 💳 **Verifikasi Pembayaran QRIS (Metode 1)**: Pengiriman gambar QRIS asli toko, verifikasi transfer akurat, dan konfirmasi barang diterima oleh pembeli.
- 🚨 **Sistem Panggilan Darurat Admin (SOS)**: Tombol panggil Admin cepat untuk pembeli yang membutuhkan bantuan langsung di channel tiket.
- 🏆 **Papan Peringkat Live Top Spenders (`/leaderboard`)**: Leaderboard 10 pembeli terbanyak yang ter-update otomatis secara real-time di channel terpisah (`#leaderboard`).
- 📊 **Laporan Excel Bulanan Otomatis (`/exportreport`)**: Pengiriman otomatis laporan rekapitulasi penjualan bulanan format Excel (`nama_bulan-tahun.xlsx`) setiap tanggal 1 jam 00:05 WIB ke channel `#laporan`.
- 🎨 **Sistem Pewarisan Ikon (Emoji) Produk & Kategori**: Item otomatis mewarisi emoji kategorinya jika tidak diberi emoji khusus.
- 🛡️ **Keamanan Kunci & Proteksi Admin**: Sistem autentikasi bertingkat (Owner & Secondary Admin) dengan proteksi pembajakan akses.
- ⚡ **Supabase PostgreSQL & Keep-Alive Workflow**: Integrasi database cloud Supabase lengkap dengan GitHub Actions Cron untuk membypass 7-day auto-suspend Supabase.

---

## 📂 Struktur Proyek (Directory Structure)

```text
payment-bot/
├── 📁 .github/workflows/   # GitHub Actions Keep-Alive Supabase Workflow
│   └── keep-alive-supabase.yml
├── 📁 commands/            # 12 Slash Commands Terstruktur
│   ├── addadmin.js
│   ├── additem.js
│   ├── adminhelp.js
│   ├── deladmin.js
│   ├── delcategory.js
│   ├── delitem.js
│   ├── editcategory.js
│   ├── edititem.js
│   ├── exportreport.js
│   ├── help.js
│   ├── leaderboard.js
│   ├── listadmin.js
│   └── panel.js
├── 📁 config/              # Konfigurasi Data Toko & Admin
│   ├── admins.json
│   ├── category_emojis.json
│   ├── items.js
│   └── panel_config.json
├── 📁 services/            # Modul Backend Utama
│   ├── admins.js
│   ├── panelManager.js
│   ├── reportManager.js
│   ├── roblox.js
│   └── supabase.js
├── .env                    # Variabel Rahasia Bot (Token & API Keys)
├── .env.example            # Template Konfigurasi untuk Client
├── .gitignore              # Proteksi File Rahasia & Modul Berat
├── Procfile                # Konfigurasi Hosting Cloud Server (Railway/Heroku)
├── deploy-commands.js      # Skrip Pendaftaran Slash Commands ke Discord API
├── index.js                # Main Bot Gateway & Event Listener
└── package.json            # Manifest Dependensi Node.js
```

---

## ⚙️ Konfigurasi Variabel Lingkungan (`.env`)

Buat file `.env` di root direktori dan isi variabel berikut:

```env
# Credentials Bot Discord
DISCORD_TOKEN=your_discord_bot_token_here
DISCORD_CLIENT_ID=your_discord_client_id_here
DISCORD_GUILD_ID=your_discord_guild_id_here
OWNER_DISCORD_ID=your_discord_owner_id_here

# Channel & Category IDs Server Discord
TICKET_CATEGORY_ID=your_ticket_category_id_here
ADMIN_CHANNEL_ID=your_admin_channel_id_here
REPORT_CHANNEL_ID=your_report_channel_id_here

# URL Gambar QRIS Toko
QRIS_IMAGE_URL=https://your-domain.com/qris-image.jpg

# Credentials Database Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_service_role_key_here
```

---

## 🚀 Panduan Instalasi & Memulai (Quick Start)

### 1. Prasyarat System
- Node.js versi 18.x atau yang lebih baru.
- Akun Bot Discord dari Discord Developer Portal.
- Project Supabase (Free / Paid Tier).

### 2. Instalasi Dependensi
```bash
npm install
```

### 3. Pendaftaran Perintah Slash (Deploy Commands)
Jalankan skrip ini setiap kali ada penambahan/perubahan Slash Commands:
```bash
npm run deploy
```

### 4. Menjalankan Bot
- **Mode Development / Uji Coba**:
  ```bash
  npm start
  ```
- **Mode Production 24/7 (PM2 di VPS)**:
  ```bash
  npm install -g pm2
  pm2 start index.js --name "bebey-bot"
  pm2 save
  pm2 startup
  ```

---

## 📜 Daftar Perintah Slash (Slash Commands Reference)

### 👥 Perintah Pembeli (Public Commands)
| Perintah | Deskripsi |
| :--- | :--- |
| `/help` | Menampilkan panduan cara berbelanja & meng-tag channel katalog toko dan leaderboard. |

### ⚙️ Perintah Admin Toko (Admin Commands)
| Perintah | Deskripsi |
| :--- | :--- |
| `/panel` | Mengirimkan Pesan Panel Katalog Toko di channel toko (cth: `#beli-disini`). |
| `/leaderboard` | Mengirimkan & mendaftarkan Panel Live Leaderboard di channel terpisah (cth: `#leaderboard`). |
| `/additem` | Menambah item baru ke katalog toko (nama, harga, username, kategori, emoji, deskripsi). |
| `/edititem` | Mengubah detail item toko secara keseluruhan (dukungan reset emoji). |
| `/delitem` | Menghapus item spesifik dari katalog toko. |
| `/editcategory` | Mengubah nama atau emoji ikon kategori produk. |
| `/delcategory` | Menghapus kategori beserta seluruh item di dalamnya. |
| `/exportreport` | Mengunduh rekapitulasi laporan penjualan resmi format Excel (`nama_bulan-tahun.xlsx`). |
| `/adminhelp` | Menampilkan panduan lengkap perintah kelola toko khusus Admin & Owner. |

### 👑 Perintah Admin Utama / Owner (Owner Commands)
| Perintah | Deskripsi |
| :--- | :--- |
| `/addadmin` | Mengangkat Admin Sekunder baru untuk membantu mengelola toko. |
| `/deladmin` | Mencabut hak akses Admin Sekunder. |
| `/listadmin` | Menampilkan daftar Owner & Admin Sekunder yang terdaftar. |

---

## ☁️ Panduan Deployment (Deployment Guide)

### A. Deployment di Cloud Platform (Railway.app)
1. Push source code ke GitHub.
2. Buka **Railway.app** -> New Project -> Deploy from GitHub Repo.
3. Masukkan variabel rahasia dari `.env` ke menu **Variables** di Railway.
4. Railway akan otomatis mendeteksi file `Procfile` (`worker: node index.js`) dan menjalankan bot 24/7.

### B. Deployment di VPS Linux (Biznet Gio / Hostinger / DigitalOcean)
1. Sewa VPS Ubuntu 22.04 LTS (Paket 1 vCPU, 1 GB RAM).
2. SSH ke VPS dan jalankan perintah:
   ```bash
   sudo apt update && sudo apt install -y nodejs git
   sudo npm install -g pm2
   git clone https://github.com/Ilhamaji/bot-payment.git
   cd bot-payment
   npm install
   nano .env # Tempel konfigurasi .env Anda
   npm run deploy
   pm2 start index.js --name "bebey-bot"
   pm2 save && pm2 startup
   ```

---

## 🛡️ Lisensi & Keamanan (Security & License)

- **Lisensi**: ISC License
- **Keamanan**: File `.env` dan `panel_config.json` di-ignore secara otomatis dari versi produksi GitHub untuk menjamin rahasia toko dan token bot tetap aman 100%.

---

*Dikembangkan secara profesional untuk **Bebey Store Official**.* 🚀✨
