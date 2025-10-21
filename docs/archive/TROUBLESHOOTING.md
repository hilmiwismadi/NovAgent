# Troubleshooting Guide - NovaBot

## WhatsApp Integration Issues

### Error: "Execution context was destroyed, most likely because of a navigation"

**Penyebab:**
Error ini terjadi karena incompatibility antara Node.js v23 dengan `whatsapp-web.js` yang menggunakan Puppeteer versi lama.

**Solusi:**

#### Solusi 1: Downgrade Node.js (Recommended)

Gunakan Node.js versi LTS yang lebih stabil:

**Windows:**
1. Uninstall Node.js v23
2. Download dan install Node.js v20 LTS dari https://nodejs.org
3. Restart terminal
4. Verify: `node --version` (should show v20.x.x)
5. Reinstall dependencies: `npm install`
6. Run bot: `npm run start:wa`

**Menggunakan NVM (Node Version Manager):**

```bash
# Install NVM terlebih dahulu
# Windows: https://github.com/coreybutler/nvm-windows

# Install Node.js v20
nvm install 20

# Use Node.js v20
nvm use 20

# Reinstall dependencies
npm install

# Run WhatsApp bot
npm run start:wa
```

#### Solusi 2: Manual Puppeteer Installation

Jika tidak bisa downgrade Node.js, coba install Puppeteer secara manual:

```bash
npm install puppeteer@latest --save
```

Then modify `src/integrations/whatsapp-client.js`:

```javascript
import puppeteer from 'puppeteer';

// In constructor, add:
puppeteer: {
  executablePath: puppeteer.executablePath(),
  headless: false,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
}
```

#### Solusi 3: Use Docker (Advanced)

Buat `Dockerfile`:

```dockerfile
FROM node:20-slim

# Install Chrome dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    ca-certificates \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

CMD ["npm", "run", "start:wa"]
```

Run:
```bash
docker build -t novabot .
docker run -it novabot
```

---

## Recommended Environment

**Tested & Working:**
- Node.js: v18.x, v20.x (LTS)
- OS: Windows 10/11, Ubuntu 20.04+, macOS 12+
- RAM: Minimum 2GB free

**Known Issues:**
- Node.js v23.x: Puppeteer navigation error ❌
- Node.js v22.x: May have compatibility issues ⚠️
- Node.js v18.x, v20.x: Working fine ✅

---

## Other Common Issues

### Issue: QR Code tidak muncul

**Solution:**
1. Pastikan terminal mendukung rendering QR code
2. Gunakan `headless: false` untuk melihat browser window
3. Check firewall tidak memblokir Chromium

### Issue: Bot tidak merespons pesan

**Solutions:**
1. Check whitelist configuration di `.env`
2. Pastikan `WA_WHITELIST_ENABLED=false` untuk testing
3. Check log di terminal untuk error messages
4. Verify nomor WA format: `628123456789@c.us`

### Issue: Session logout terus-menerus

**Solutions:**
1. Delete folder `.wwebjs_auth`
2. Restart bot dan scan QR code ulang
3. Jangan login WhatsApp Web di browser lain saat bot berjalan

---

## Getting Help

1. Check issues di GitHub: https://github.com/pedroslopez/whatsapp-web.js/issues
2. Baca dokumentasi: https://wwebjs.dev/
3. Contact maintainer

---

## Debug Mode

Enable debug logging:

```bash
# Linux/macOS
DEBUG=* npm run start:wa

# Windows PowerShell
$env:DEBUG="*"; npm run start:wa

# Windows CMD
set DEBUG=* && npm run start:wa
```
