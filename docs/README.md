# NovaBot - NovaTix AI Agent

NovaBot adalah AI Agent customer service untuk platform ticketing NovaTix yang dibangun menggunakan LangChain dan Groq LLM.

## Fitur

- Menjawab pertanyaan seputar NovaTix (fitur, pricing, panduan penggunaan)
- Negosiasi pricing otomatis berdasarkan harga tiket dan kapasitas venue
- Conversational memory untuk konteks percakapan
- CLI interface untuk testing
- **Integrasi WhatsApp dengan whatsapp-web.js**
- **Whitelist nomor WA untuk keamanan**
- **Multi-session management per user**
- **Database PostgreSQL + Prisma ORM untuk menyimpan conversations**
- **Internal commands untuk tim (CRM queries)**

## Prerequisites

**⚠️ IMPORTANT: Node.js Version**

NovaBot WhatsApp integration requires **Node.js v18.x atau v20.x (LTS)**.

- ✅ **Recommended**: Node.js v20.x LTS
- ✅ **Also works**: Node.js v18.x
- ❌ **Not compatible**: Node.js v22.x, v23.x

**Check your Node.js version:**
```bash
node --version
```

**If you're using Node.js v22+ or v23+:**
- Download Node.js v20 LTS: https://nodejs.org
- Or use NVM to switch versions: `nvm use 20`
- See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for detailed instructions

## Setup

### 1. Install Dependencies

```bash
cd NovAgent
npm install
```

### 2. Setup Environment Variables

Salin `.env.example` menjadi `.env`:

```bash
cp .env.example .env
```

Edit file `.env` dan masukkan Groq API key Anda:

```env
# Groq API Configuration
GROQ_API_KEY=your_actual_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile

# Agent Configuration
AGENT_NAME=NovaBot
AGENT_TEMPERATURE=0.7
AGENT_MAX_TOKENS=1024

# WhatsApp Configuration (optional - untuk integrasi WA)
WA_WHITELIST=62812345678@c.us,62898765432@c.us
WA_WHITELIST_ENABLED=true
WA_SESSION_NAME=novabot-session
```

**Cara mendapatkan Groq API Key:**
1. Kunjungi https://console.groq.com
2. Sign up / Login
3. Buka menu "API Keys"
4. Generate new API key
5. Copy dan paste ke file `.env`

**Konfigurasi WhatsApp Whitelist:**
- `WA_WHITELIST`: Daftar nomor WA yang diizinkan (pisahkan dengan koma)
- Format nomor: `[country_code][number]@c.us` (contoh: `62812345678@c.us`)
- `WA_WHITELIST_ENABLED`: Set `true` untuk mengaktifkan whitelist, `false` untuk menerima semua nomor
- Kosongkan `WA_WHITELIST` jika ingin menerima dari semua nomor
- `WA_INTERNAL_NUMBERS`: Nomor tim internal yang bisa akses command CRM (format sama)

**Database Configuration:**
```env
DATABASE_URL="postgresql://user:password@localhost:5432/novagent"
```
Lihat [Database Setup](#4-setup-database-postgresql) untuk instruksi lengkap.

### 3. Setup Database (PostgreSQL)

NovaBot menggunakan PostgreSQL + Prisma ORM untuk menyimpan conversation history dan user data.

#### A. Install PostgreSQL

Download dan install PostgreSQL dari https://www.postgresql.org/download/

#### B. Setup Database

1. **Create database:**
   ```bash
   # Login ke PostgreSQL
   psql -U postgres

   # Create database
   CREATE DATABASE novagent;
   ```

2. **Run initialization script:**
   ```bash
   # Copy SQL dari database/init.sql dan jalankan di pgAdmin atau psql
   psql -U postgres -d novagent -f database/init.sql
   ```

   Atau buka `database/init.sql` di pgAdmin dan execute.

#### C. Setup Prisma

```bash
# Generate Prisma Client
npx prisma generate

# (Optional) Sync schema dengan database
npx prisma db push
```

#### D. Verify Connection

```bash
# Test database connection
node -e "import('./src/database/prisma.js').then(({prisma}) => prisma.\$queryRaw\`SELECT 1\`.then(r => console.log('DB OK', r)))"
```

**Database Schema:**
- **User**: Menyimpan info client (nama, instansi, event, ticketPrice, capacity, dealStatus)
- **Conversation**: Menyimpan riwayat chat lengkap
- **Session**: Menyimpan active sessions dan context

### 4. Run Bot

#### A. CLI Mode (untuk testing)

```bash
npm start
```

atau

```bash
npm run dev
```

#### B. WhatsApp Mode (untuk production)

```bash
npm run start:wa
```

Atau untuk development:

```bash
npm run dev:wa
```

Saat pertama kali dijalankan, akan muncul QR code. Scan QR code dengan WhatsApp Anda:
1. Buka WhatsApp di HP
2. Pilih menu **Linked Devices** (atau **Perangkat Tertaut**)
3. Pilih **Link a Device** (atau **Tautkan Perangkat**)
4. Scan QR code yang muncul di terminal

Setelah tersambung, bot akan otomatis menerima dan membalas pesan dari nomor yang ada di whitelist.

## Penggunaan

### CLI Mode

Setelah menjalankan `npm start`, Anda bisa langsung chat dengan NovaBot.

**Perintah Khusus:**
- `/reset` - Reset percakapan dan context
- `/context` - Lihat context user saat ini (harga tiket, kapasitas, dll)
- `/exit` - Keluar dari program

**Contoh Percakapan:**

```
Anda: Halo
NovaBot: Halo! Saya NovaBot, asisten virtual NovaTix...

Anda: Apa fitur NovaTix?
NovaBot: NovaTix memiliki 4 fitur utama...

Anda: Berapa harga untuk tiket 100rb?
NovaBot: Baik, untuk membantu menghitung pricing...

Anda: Kapasitasnya 500 orang
NovaBot: Berdasarkan harga tiket Rp 100.000 dan kapasitas 500 orang...
```

### WhatsApp Mode

Setelah bot tersambung dengan WhatsApp, cukup kirim pesan dari nomor yang sudah di-whitelist.

**Perintah Khusus di WhatsApp:**
- `/reset` - Reset percakapan (per user)
- `/help` - Tampilkan bantuan

**Internal Team Commands:**

Jika nomor Anda terdaftar di `WA_INTERNAL_NUMBERS`, Anda dapat mengakses command tambahan untuk CRM queries:
- `/clients` - List semua client
- `/leads` - Daftar prospects
- `/deals` - Daftar deals & negotiating
- `/stats` - Statistik keseluruhan
- `/search [keyword]` - Cari client
- `/client [nomor/nama]` - Detail client
- Dan banyak lagi...

📖 **Lihat dokumentasi lengkap di [INTERNAL_COMMANDS.md](./INTERNAL_COMMANDS.md)**

**Cara mendapatkan WhatsApp ID untuk whitelist:**
1. Kirim pesan ke bot dari nomor yang ingin di-whitelist
2. Lihat log di terminal, akan muncul: `Message from NamaKontak (628123456789@c.us)`
3. Copy ID tersebut (contoh: `628123456789@c.us`) ke `.env`:
   ```env
   WA_WHITELIST=628123456789@c.us,628987654321@c.us
   WA_WHITELIST_ENABLED=true
   ```
4. Restart bot

**Catatan:**
- Setiap nomor WA memiliki session terpisah (conversational memory per user)
- Bot hanya merespons pesan dari nomor yang ada di whitelist (jika diaktifkan)
- Bot tidak merespons pesan grup

## Struktur Project

```
NovAgent/
├── src/
│   ├── agent/
│   │   └── novabot.js              # Core AI Agent
│   ├── integrations/
│   │   └── whatsapp-client.js      # WhatsApp integration
│   ├── database/
│   │   ├── database-service.js     # Database operations
│   │   └── prisma.js               # Prisma client
│   ├── knowledge/
│   │   └── novatix-context.js      # Knowledge base NovaTix
│   ├── cli.js                      # CLI Interface
│   └── wa-bot.js                   # WhatsApp Bot Entry Point
├── prisma/
│   └── schema.prisma               # Database schema
├── database/
│   └── init.sql                    # DB initialization script
├── tests/                          # Unit tests (coming soon)
├── logs/                           # Application logs
├── .wwebjs_auth/                   # WhatsApp session (auto-generated)
├── .env.example                    # Environment template
├── INTERNAL_COMMANDS.md            # Internal team commands docs
├── TROUBLESHOOTING.md              # Troubleshooting guide
├── .gitignore
├── package.json
└── README.md
```

## Tech Stack

- **LLM Model**: Groq (llama-3.3-70b-versatile / llama-3.1-8b-instant)
- **Orchestration**: LangChain
- **WhatsApp Integration**: whatsapp-web.js
- **Database**: PostgreSQL + Prisma ORM
- **Runtime**: Node.js v18/v20 (ES Modules)
- **Language**: JavaScript

## Development

### Testing
```bash
npm test
```

### Linting
```bash
npm run lint
```

## Roadmap

- [x] Core agent dengan Groq integration
- [x] CLI interface untuk testing
- [x] WhatsApp integration (whatsapp-web.js)
- [x] Multi-session management per user
- [x] Whitelist security untuk WhatsApp
- [x] Database integration (PostgreSQL + Prisma)
- [x] Auto-extract context (nama, instansi, event, pricing)
- [x] Internal commands untuk CRM queries
- [x] Unit tests (minimum 6 test cases)
- [x] CRM integration (external)
- [x] Google Calendar integration

## License

MIT

## Author

Wolfs of Novatix
