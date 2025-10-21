# Internal Commands Documentation

## Overview

NovaBot menyediakan command khusus untuk tim internal NovaTix untuk melakukan query dan analisis data client dari database PostgreSQL. Command ini hanya bisa diakses oleh nomor WhatsApp yang terdaftar di `WA_INTERNAL_NUMBERS`.

## Setup

1. **Tambahkan Nomor Internal ke .env**

   Edit file `.env` dan tambahkan nomor WhatsApp tim internal:

   ```env
   WA_INTERNAL_NUMBERS=628123456789@c.us,628987654321@c.us
   ```

   **Cara mendapatkan format nomor WhatsApp:**
   - Nomor WhatsApp harus dalam format: `[country_code][phone_number]@c.us`
   - Contoh: 0812-3456-7890 → `628123456789@c.us`
   - Hilangkan tanda `+`, `-`, dan spasi

2. **Restart WhatsApp Bot**

   ```bash
   npm run start:wa
   ```

## Command List

### CRM & Lead Management

#### `/clients`
List semua client yang pernah chat dengan bot.

**Output:**
- Nama client
- Instansi
- Status deal
- Jumlah conversation

**Contoh:**
```
/clients
```

---

#### `/client [nomor/nama]`
Melihat detail lengkap satu client.

**Parameter:**
- `nomor` - Nomor WhatsApp client (format: 628xxx)
- `nama` - Nama client (pencarian fuzzy)

**Output:**
- Info lengkap client (nama, instansi, event, harga tiket, kapasitas)
- Deal status
- Total conversations
- 3 conversation terakhir

**Contoh:**
```
/client 628123456789
/client John
```

---

#### `/leads`
Daftar semua client dengan status "prospect" (belum deal).

**Output:**
- Nama dan instansi
- Waktu last conversation

**Contoh:**
```
/leads
```

---

#### `/deals`
Daftar client yang sudah deal atau sedang negotiating.

**Output:**
- **Deals**: Client dengan status "deal"
- **Negotiating**: Client dengan status "negotiating"
- Info event dan harga tiket

**Contoh:**
```
/deals
```

---

### Analytics

#### `/stats`
Statistik keseluruhan database.

**Output:**
- Total clients
- Total conversations
- Clients dengan pricing info
- Breakdown deal status (prospect, negotiating, deal, lost)
- Conversion rate

**Contoh:**
```
/stats
```

---

#### `/today`
Aktivitas hari ini.

**Output:**
- New clients hari ini
- New conversations hari ini

**Contoh:**
```
/today
```

---

#### `/active`
Client yang aktif chat dalam 24 jam terakhir.

**Output:**
- Nama client
- Last active time

**Contoh:**
```
/active
```

---

### Search & Filter

#### `/search [keyword]`
Cari client berdasarkan nama, instansi, atau nama event.

**Parameter:**
- `keyword` - Kata kunci pencarian (case-insensitive)

**Output:**
- Client yang match dengan keyword
- Info lengkap (nama, instansi, event, status, conv count)

**Contoh:**
```
/search Hacker Convention
/search kemarigama
/search John
```

---

#### `/events`
List semua event yang pernah disebutkan client.

**Output:**
- Nama event
- Organizer (nama + instansi)
- Harga tiket dan kapasitas
- Deal status

**Contoh:**
```
/events
```

---

#### `/pricing [min] [max]`
Filter client berdasarkan range harga tiket.

**Parameter:**
- `min` - Harga minimum (angka)
- `max` - Harga maximum (angka)

**Output:**
- Client dengan harga tiket dalam range
- Harga tiket dan kapasitas
- Deal status

**Contoh:**
```
/pricing 50000 100000
/pricing 0 50000
/pricing 250000 1000000
```

---

#### `/history [nomor]`
Lihat riwayat chat lengkap dengan satu client.

**Parameter:**
- `nomor` - Nomor WhatsApp client (format: 628xxx)

**Output:**
- 10 conversation terakhir
- User message dan bot response
- Timestamp

**Contoh:**
```
/history 628123456789
```

---

### Help

#### `/help-internal`
Menampilkan daftar semua command internal.

**Contoh:**
```
/help-internal
```

---

## Database Schema Reference

### User Table
- `id` - WhatsApp ID (primary key)
- `nama` - Nama client
- `instansi` - Nama organisasi/perusahaan
- `event` - Nama event
- `ticketPrice` - Harga tiket (Integer)
- `capacity` - Kapasitas venue (Integer)
- `pricingScheme` - Skema pricing yang dipilih
- `dealStatus` - Status deal (prospect/negotiating/deal/lost)
- `notes` - Catatan tambahan
- `createdAt` - Waktu first chat
- `updatedAt` - Waktu last update

### Conversation Table
- `id` - UUID
- `userId` - Foreign key ke User
- `userMessage` - Pesan dari user
- `agentResponse` - Response dari bot
- `toolsUsed` - Tool yang digunakan (JSON)
- `contextSnapshot` - Snapshot context saat itu (JSON)
- `timestamp` - Waktu conversation

### Session Table
- `id` - UUID
- `userId` - Foreign key ke User (unique)
- `context` - Context conversation (JSON)
- `conversationCount` - Jumlah conversation
- `lastActive` - Waktu last active

## Security Notes

1. **Whitelist Only**: Command internal hanya bisa diakses oleh nomor yang terdaftar di `WA_INTERNAL_NUMBERS`
2. **No Regular Chatbot**: Internal numbers tetap bisa chat dengan bot seperti client biasa, tapi punya akses tambahan ke command CRM
3. **Privacy**: Jangan share command output ke client atau pihak ketiga

## Troubleshooting

### Command Tidak Bekerja

1. **Pastikan nomor sudah terdaftar di .env**
   ```env
   WA_INTERNAL_NUMBERS=628123456789@c.us
   ```

2. **Restart WhatsApp bot**
   ```bash
   npm run start:wa
   ```

3. **Check log di terminal**
   - Log `[WhatsApp Internal] Command from [nama]: [command]` berarti command detected
   - Jika tidak ada log, berarti nomor belum terdaftar

### Format Nomor WhatsApp Salah

**Cara mendapatkan nomor yang benar:**

1. Chat ke bot dari nomor yang ingin didaftarkan
2. Lihat log di terminal:
   ```
   [WhatsApp] Message from John (628123456789@c.us): hello
   ```
3. Copy format `628123456789@c.us` dan masukkan ke `.env`

## Examples

### Scenario 1: Cek Leads Hari Ini

```
/today
/leads
```

### Scenario 2: Follow Up Client Tertentu

```
/client John
/history 628123456789
```

### Scenario 3: Analisis Pricing

```
/stats
/pricing 50000 100000
/pricing 100000 250000
/pricing 250000 999999999
```

### Scenario 4: Monitor Active Sessions

```
/active
/search kemarigama
/client 628987654321
```

## Tips

1. **Gunakan /stats setiap pagi** untuk overview daily performance
2. **Monitor /active** untuk follow up client yang sedang tertarik
3. **Gunakan /leads** untuk prioritize follow up
4. **Filter by /pricing** untuk segment client berdasarkan budget
5. **Gunakan /search** untuk quick lookup berdasarkan nama atau event

---

**Support:** Jika ada pertanyaan atau butuh command tambahan, hubungi developer team.
