# 🔐 Whitelist Management - Setup Guide

## ✅ Yang Sudah Dikonfigurasi

### 1. .env File
- ✅ `WA_WHITELIST` dikosongkan (tidak digunakan lagi)
- ✅ `WA_INTERNAL_NUMBERS` dikosongkan (tidak digunakan lagi)
- ✅ Whitelist sekarang 100% dikelola dari **database**

### 2. Database
- ✅ Tabel `Whitelist` sudah dibuat di PostgreSQL
- ✅ Schema sudah di-push ke database

### 3. UI/UX
- ✅ **Tab CRM**: Form untuk tambah client whitelist (di bagian atas, warna ungu)
- ✅ **Tab Whitelist**: Khusus untuk manage tim internal

---

## 🚀 Cara Menggunakan (Step by Step)

### Step 1: Restart Services

**Stop semua services yang sedang running**, lalu restart:

```bash
# Terminal 1 - Dashboard API
cd D:\Hilmi\Coding\wolfs_of_novatix\NovAgent
npm run start:dashboard

# Terminal 2 - WhatsApp Bot
cd D:\Hilmi\Coding\wolfs_of_novatix\NovAgent
npm run start:wa
```

### Step 2: Scan QR Code WhatsApp

Saat WhatsApp bot start, scan QR code yang muncul di terminal.

Bot akan menampilkan:
```
✅ NovaBot WhatsApp Client is Ready!
📋 Whitelist Enabled (from database):
  Client whitelist: 0 numbers
  Internal whitelist: 0 numbers
```

### Step 3: Tambah Client ke Whitelist

1. Buka dashboard di browser: `http://localhost:5173`
2. Di **tab CRM**, lihat section ungu di atas dengan judul **"➕ Tambah Client ke Whitelist"**
3. Masukkan nomor WhatsApp client (contoh: `6281717407674` atau `081717407674`)
4. Masukkan nama (opsional)
5. Klik **"✅ Tambah ke Whitelist"**
6. ✅ Bot akan otomatis refresh whitelist dan mulai menerima chat dari nomor tersebut

### Step 4: Tambah Tim Internal ke Whitelist

1. Klik **tab "📋 Whitelist"**
2. Masukkan nomor WhatsApp tim internal
3. Masukkan nama (opsional)
4. Klik **"➕ Tambah Tim Internal"**
5. ✅ Nomor ini bisa gunakan internal commands (`/clients`, `/stats`, dll)

---

## 🔄 Auto-Refresh System

Bot akan auto-refresh whitelist dari database:
- ✅ Saat bot pertama kali start
- ✅ Setiap **5 menit** sekali (otomatis)
- ✅ Tidak perlu restart bot saat tambah/hapus nomor di dashboard

---

## 📱 Format Nomor WhatsApp

Sistem akan auto-convert format apapun ke format WhatsApp yang benar:

| Input Format | Output Format |
|--------------|---------------|
| `08123456789` | `628123456789@c.us` |
| `628123456789` | `628123456789@c.us` |
| `+628123456789` | `628123456789@c.us` |
| `081717407674` | `6281717407674@c.us` |

---

## 🧪 Testing Whitelist

### Test 1: Tambah Nomor Sendiri
1. Tambah nomor WhatsApp Anda ke whitelist via dashboard
2. Kirim chat ke bot dari nomor tersebut
3. ✅ Bot harus merespon

### Test 2: Nomor Tidak di Whitelist
1. Kirim chat dari nomor yang TIDAK ada di whitelist
2. ❌ Bot tidak akan merespon (ignored)
3. Check terminal bot, akan ada log:
   ```
   [WhatsApp] Message from <nama> (<nomor>) - NOT WHITELISTED
   ```

### Test 3: Hapus Nomor
1. Klik tombol "🗑️ Delete" di dashboard
2. Tunggu maksimal 5 menit (auto-refresh) atau restart bot
3. ❌ Nomor tersebut tidak akan direspon lagi

---

## 🐛 Troubleshooting

### Bot tidak merespon nomor yang sudah di whitelist?

**Cek 1: Apakah nomor benar-benar ada di database?**
```bash
# Masuk ke PostgreSQL
psql -U postgres -d novagent

# Check whitelist
SELECT * FROM "Whitelist" WHERE type = 'client';
```

**Cek 2: Apakah bot sudah refresh whitelist?**
- Lihat log di terminal bot:
  ```
  [WhatsApp] 🔄 Refreshing whitelist from database...
  [WhatsApp] ✅ Whitelist loaded from database:
    - 1 client numbers
    - 0 internal numbers
  ```

**Cek 3: Apakah format nomor benar?**
- Nomor harus format: `628xxx@c.us`
- Check di database apakah formatnya benar

**Solusi Cepat:**
```bash
# Restart WhatsApp bot
# Bot akan auto-load whitelist terbaru saat startup
```

### Error "DATABASE_URL not found"?

**Solusi:**
```bash
# Pastikan .env ada di root folder
cd D:\Hilmi\Coding\wolfs_of_novatix\NovAgent
cat .env

# Harus ada baris:
# DATABASE_URL="postgresql://postgres:postgres@localhost:5432/novagent"
```

---

## 📊 Monitoring Whitelist

### Via Dashboard
- Tab CRM: Lihat semua client yang ada di whitelist
- Tab Whitelist: Lihat semua tim internal

### Via Database
```sql
-- Total whitelist
SELECT type, COUNT(*) FROM "Whitelist" GROUP BY type;

-- List semua client
SELECT phoneNumber, nama, createdAt FROM "Whitelist" WHERE type = 'client';

-- List semua internal
SELECT phoneNumber, nama, createdAt FROM "Whitelist" WHERE type = 'internal';
```

### Via WhatsApp Bot Log
Lihat terminal bot untuk log real-time:
```
[WhatsApp] Message from Ahmad (6281717407674@c.us): Halo
[WhatsApp] Response sent to Ahmad
```

---

## 🎯 Next Steps

1. ✅ Restart dashboard dan WhatsApp bot
2. ✅ Tambah nomor `6281717407674` via dashboard (tab CRM)
3. ✅ Test chat dari nomor tersebut
4. ✅ Jika tidak direspon, check troubleshooting guide di atas

---

**Catatan Penting:**
- Jangan edit whitelist di .env lagi - gunakan dashboard
- Bot auto-refresh setiap 5 menit, tidak perlu restart
- Semua perubahan langsung tersimpan di database PostgreSQL
