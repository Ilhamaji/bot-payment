# 🏪 Bebey Store — Professional Discord Payment & Ticketing Bot

Bot Discord Pembayaran & Manajemen Toko Otomatis 24/7 yang dilengkapi dengan Sistem Tiket Privat, Verifikasi API Roblox Real-Time, Sistem Kode Unik 3 Digit, Ekspor Laporan Penjualan Excel (`.xlsx`) Keseluruhan (*All-Time*) & Bulanan, serta Integrasi Dual Database (Supabase Cloud & Native SQLite).

---

## 🌟 Fitur Utama (Key Features)

- 🎛️ **Admin Control Panel GUI (`/adminpanel`)**: Interactive Dashboard GUI khusus Admin untuk mengelola seluruh aspek toko (Item, Kategori, Panel Toko, Leaderboard, Export Excel All-Time, & Admin) secara visual via Tombol, Dropdown Menu, & Modal Form.
- 📁 **Dropdown Select Menu Kategori & Checkbox Setting**: Pengelolaan kategori produk via dropdown otomatis + opsi centang checkbox (`Perlu Username`, `Cek Limit`, `⛔ Tahan Produk / Non-aktifkan`).
- ⏸️ **Fitur Tahan Produk (Out of Stock / Maintenance)**: Admin dapat menahan produk agar tidak dapat dibeli untuk sementara *(Nama produk tercoret di katalog & otomatis ditolak jika dipilih)*.
- 🛑 **Proteksi Presisi Validasi Roblox**: Memvalidasi Username Roblox pembeli secara langsung ke Database API Resmi Roblox **sebelum channel tiket dibuat**. Pembuatan tiket diblokir jika username tidak terdaftar.
- 🔢 **Sistem Kode Unik 3 Digit Terakhir**: Mengacak 3 digit kode unik (1 - 999) secara otomatis di background pada nominal transfer untuk membedakan transaksi antar pembeli dengan mudah.
- 🏪 **Panel Toko Multi-Kategori Interaktif (`/panel`)**: Tampilan katalog toko publik terelompok rapi per kategori dengan balasan privat (*Ephemeral*) tanpa mengotori channel toko.
- 🚀 **Direct 1-Click Ticket Jump Button**: Pembeli dapat langsung lompat ke channel privat tiketnya hanya dengan 1x klik tombol `🚀 Buka Channel Tiket Kamu`.
- ❌ **Rejection Reason Modal & Revision Workflow**: Admin dapat menginput alasan penolakan bukti transfer spesifik via form modal, dan pembeli dapat meng-upload foto revisi secara langsung di channel tiket.
- 🎫 **Sistem Tiket Privat Otomatis**: Setiap pembeli mendapatkan text channel privat khusus (`#<kode-item>-<hash>`) di bawah Kategori Discord yang telah ditentukan.
- 💳 **Verifikasi Pembayaran QRIS**: Pengiriman gambar QRIS asli toko, verifikasi transfer akurat, dan konfirmasi barang diterima oleh pembeli.
- 📸 **Reply-Based Proof of Delivery**: Admin cukup membalas (*reply*) pesan notifikasi transaksi dengan meng-upload foto bukti pengiriman item untuk meneruskannya ke tiket pembeli.
- 🏆 **Papan Peringkat Live Top Spenders (`/leaderboard`)**: Leaderboard 10 pembeli terbanyak yang ter-update otomatis secara real-time di channel terpisah (`#leaderboard`).
- 📊 **Laporan Excel All-Time & Bulanan Otomatis (`/exportreport`)**: 
  - **All-Time Export**: 1-Klik dari `/adminpanel` untuk mengunduh rekapitulasi seluruh transaksi penjualan toko sejak awal.
  - **Bulanan Otomatis**: Pengiriman otomatis rekap bulanan format Excel (`.xlsx`) setiap tanggal 1 jam 00:05 WIB ke channel `#laporan`.
- 🗄️ **Dukungan Dual Database (Supabase Cloud & Local SQLite)**: Modul Supabase Cloud untuk produksi utama + folder `biznetgio/` native SQLite untuk deployment Biznet GIO VPS.
- 🏗️ **Arsitektur Modular & Ringkas**: `index.js` dirancang ringan (~110 baris) dengan handler terpisah (`buyerHandler.js`, `adminHandler.js`, `proofDetector.js`, `ticketManager.js`).

---

## 📂 Struktur Proyek (Directory Structure)

```text
payment-bot/
├── 📁 .github/workflows/   # GitHub Actions Keep-Alive Supabase Workflow
│   └── keep-alive-supabase.yml
├── 📁 commands/            # 14 Slash Commands Terstruktur
│   ├── addadmin.js
│   ├── additem.js
│   ├── adminhelp.js
│   ├── adminpanel.js
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
├── 📁 handlers/            # [BARU] Handler Spesifik Interaksi Discord
│   ├── adminHandler.js     # Handler Approve, Reject Modal, & Reply Admin
│   ├── buyerHandler.js     # Handler Select Menu Toko, Modals, QRIS, & SOS
│   └── proofDetector.js    # Auto-Detector Screenshot Bukti Transfer & Bukti Kirim
├── 📁 services/            # Modul Backend Utama
│   ├── adminPanelGUI.js    # Handler Dashboard GUI Admin (/adminpanel)
│   ├── admins.js           # Pengelolaan Hak Akses Admin
│   ├── panelManager.js     # Pengelolaan Embed Katalog & Leaderboard
│   ├── reportManager.js    # Generator Laporan Penjualan Excel (.xlsx)
│   ├── roblox.js           # Integrasi API Resmi Roblox
│   ├── supabase.js         # Client Supabase PostgreSQL Cloud
│   └── ticketManager.js    # Pengelolaan Siklus Hidup Tiket & Approval
├── 📁 biznetgio/           # Sub-Folder Deployment Biznet GIO (Native SQLite Engine)
├── .env                    # Variabel Rahasia Bot (Token & API Keys)
├── .env.example            # Template Konfigurasi untuk Client
├── .gitignore              # Proteksi File Rahasia & Modul Berat
├── Procfile                # Konfigurasi Hosting Cloud Server (Railway/Heroku)
├── deploy-commands.js      # Skrip Pendaftaran Slash Commands ke Discord API
├── index.js                # Main Bot Gateway Gateway (~110 baris)
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
- Project Supabase (Free / Paid Tier) atau SQLite untuk Biznet GIO.

### 2. Langkah Instalasi

1. Clone repositori:
   ```bash
   git clone https://github.com/Ilhamaji/bot-payment.git
   cd bot-payment
   ```

2. Install dependensi Node.js:
   ```bash
   npm install
   ```

3. Daftarkan Perintah Slash Command:
   ```bash
   node deploy-commands.js
   ```

4. Jalankan Bot:
   ```bash
   npm run start
   ```

---

## 📊 Manajemen Laporan Penjualan Excel

Bot menyediakan 3 skenario ekspor laporan penjualan yang fleksibel:

1. **All-Time Sales Export (Seluruh Data)**:
   - Akses via **`/adminpanel`** -> tekan **`📊 Export Laporan Excel`**. File `.xlsx` berisi seluruh riwayat transaksi sukses sejak awal toko berdiri akan langsung terbuat.
2. **Laporan Otomatis Bulanan**:
   - Setiap tanggal 1 jam 00:05 WIB, bot secara otomatis mengirimkan rekap bulan sebelumnya ke channel `#laporan`.
3. **Laporan Spesifik Bulan/Tahun**:
   - Gunakan perintah **`/exportreport bulan:X tahun:YYYY`** untuk mengambil rekap penjualan bulan tertentu.

---

## 📄 Lisensi

Hak Cipta © 2026 **Bebey Store Official**. Seluruh Hak Cipta Dilindungi.
