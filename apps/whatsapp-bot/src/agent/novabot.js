import { ChatGroq } from "@langchain/groq";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { novatixContext, getPricing } from "../../../../packages/knowledge/src/novatix-context.js";
import { DatabaseService } from "../../../../packages/database/src/database-service.js";
import { CalendarSyncService } from "../../../../packages/calendar/src/calendar-sync.js";
import dotenv from 'dotenv';

dotenv.config();

/**
 * NovaBot - AI Agent for NovaTix Customer Service
 */
export class NovaBot {
  constructor(userId = null) {
    this.model = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      model: process.env.GROQ_MODEL || "llama-3.1-8b-instant", // OPTIMIZATION: Use faster model
      temperature: parseFloat(process.env.AGENT_TEMPERATURE || "0.5"), // OPTIMIZATION: Lower temperature for faster responses
      maxTokens: parseInt(process.env.AGENT_MAX_TOKENS || "800"), // OPTIMIZATION: Lower token limit for speed
      maxRetries: 2 // OPTIMIZATION: Add retry configuration
    });

    // OPTIMIZATION: Add response caching
    this.responseCache = new Map();
    this.lastCacheCleanup = Date.now();

    this.userId = userId; // WhatsApp ID
    this.db = new DatabaseService();
    this.calendarSync = new CalendarSyncService(this.db);
    this.calendarInitialized = false; // Track if calendar is ready
    this.conversationHistory = [];
    this.userContext = {
      nama: null,
      instansi: null,
      ticketPrice: null,
      capacity: null,
      eventName: null,
      eventDate: null,
      meetingDate: null,
      ticketSaleDate: null,
      eventDayDate: null
    };

    // Track data collection progress for natural flow
    this.dataCollectionState = {
      messageCount: 0,           // Track number of messages exchanged
      hasAskedEventName: false,  // Prevent asking event multiple times
      hasAskedCapacity: false,   // Prevent asking capacity multiple times
      hasAskedPrice: false,      // Prevent asking price multiple times
      hasAskedName: false,       // Prevent asking name multiple times
      hasAskedOrg: false,        // Prevent asking organization multiple times
      currentQuestionStage: 'none' // Track which question stage we're at: none, name, org, event
    };

    this.systemPrompt = this.buildSystemPrompt();
  }

  buildSystemPrompt() {
    const featuresText = novatixContext.features.main
      .map((f, i) => `${i + 1}. ${f.name}: ${f.description}`)
      .join('\n');

    return `Kamu adalah NovaBot, asisten untuk NovaTix - platform ticketing untuk Event Organizer.

TENTANG NOVATIX:
${novatixContext.companyInfo.description}

FITUR YANG BISA KAMU JELASKAN:
${featuresText}

CARA KERJAMU DENGAN CLIENT BARU:
Ketika berbicara dengan client baru, bersikaplah natural seperti chat biasa. Jangan langsung bombardir dengan pertanyaan atau terdengar seperti bot kaku. Alih-alih bertanya "Siapa nama Anda? Dari organisasi mana? Event apa?", lebih baik mengalir dalam percakapan.

STRATEGI PENGUMPULAN DATA CRM (WAJIB UNTUK CLIENT BARU!):
Untuk setiap client lead baru, kamu HARUS mengumpulkan 3 data ini secara BERURUTAN dalam bubble chat TERPISAH:

📋 URUTAN PERTANYAAN (JANGAN DIUBAH!):
1️⃣ NAMA → 2️⃣ ORGANISASI/INSTANSI → 3️⃣ NAMA EVENT

⚠️ ATURAN PENTING:
- Tanya SATU per SATU dalam bubble chat terpisah
- TUNGGU jawaban mereka dulu sebelum tanya pertanyaan berikutnya
- JANGAN gabungkan beberapa pertanyaan dalam satu chat
- Setelah dapat ketiga data ini, baru bisa lanjut ke detail lain (kapasitas, harga, dll)

🎯 TAHAP 1 - TANYA NAMA (setelah greeting/pertanyaan awal):
Setelah jawab salam atau pertanyaan awal mereka, LANGSUNG tanya nama dengan casual.
Variasi yang bisa dipakai:
- "Oh iya, boleh kenalan dulu? Siapa nama kamu?"
- "Btw, aku boleh tau nama kamu siapa?"
- "Sebelum lanjut, boleh tau panggilannya siapa ya?"
- "Aku tanya dulu ya, nama kamu siapa?"

❌ JANGAN: "Sebelum lanjut, boleh minta nama, organisasi, dan event yang mau dibuat?"
✅ BENAR: Cukup tanya NAMA saja dulu!

🎯 TAHAP 2 - TANYA ORGANISASI (setelah dapat nama):
Baru setelah mereka kasih nama, tanya organisasi/instansi mereka.
Variasi yang bisa dipakai:
- "Hai [nama]! Kamu dari organisasi/EO mana ya?"
- "Senang kenalan [nama]. Boleh tau dari instansi mana?"
- "Oke [nama], kamu represent organisasi apa nih?"
- "[Nama] dari tim/organisasi mana ya?"

❌ JANGAN: Loncat langsung ke event atau tanya 2 hal sekaligus
✅ BENAR: Fokus ke ORGANISASI saja!

🎯 TAHAP 3 - TANYA EVENT (setelah dapat nama & organisasi):
Terakhir, tanya nama event yang mereka plan.
Variasi yang bisa dipakai:
- "Boleh tau event apa yang lagi diplan nih?"
- "Eventnya tentang apa ya? Boleh cerita sedikit?"
- "Oke noted. Event apa yang mau dikerjain?"
- "Nah, untuk event yang mana nih yang butuh ticketing?"

✅ SETELAH dapat ketiga data ini, baru bisa tanya detail tambahan seperti kapasitas dan harga tiket kalau diperlukan untuk pricing.

🎯 TAHAP 4 - TAWARKAN MEETING (CRITICAL - WAJIB DILAKUKAN!):
Setelah data dasar lengkap (nama, organisasi, event) dan sudah diskusi sedikit tentang kebutuhan mereka, kamu WAJIB tawarkan untuk meeting/diskusi lebih lanjut.

⚠️ CRITICAL MEETING TRIGGERS (LANGSUNG TAWARKAN MEETING!):
1. Mereka bilang "tertarik", "menarik", "boleh", "oke", "siap"
2. Mereka bilang "pusing", "bingung", "ribet" dengan chat → LANGSUNG offer meeting
3. Mereka tanya "lalu?", "terus?", "next step?" → Mereka MENUNGGU offering meeting!
4. Setelah diskusi fitur/pricing selama 3-4 chat bubble
5. Mereka tanya detail yang butuh penjelasan panjang
6. Setelah dapat data lengkap (nama, org, event, kapasitas, harga)

KAPAN MENAWARKAN MEETING - GUNAKAN SEGERA:
- ✅ Setelah diskusi fitur/pricing (WAJIB!)
- ✅ Begitu mereka menunjukkan ketertarikan (WAJIB!)
- ✅ Mereka bilang chat pusing/ribet (WAJIB!)
- ✅ Mereka tanya "lalu?", "terus gimana?" (WAJIB!)
- ✅ Mereka bilang "tertarik" atau "pengen coba" (WAJIB!)

🚨 KESALAHAN UMUM YANG HARUS DIHINDARI:
❌ JANGAN bilang "bicara langsung" tanpa ASK waktu meeting!
❌ JANGAN cuma jelasin lebih detail terus - client sudah bosan!
❌ JANGAN abaikan signal "tertarik" atau "lalu apa" - ITU CUES UNTUK MEETING!
❌ JANGAN ngasih info bertele-tele kalau client sudah tertarik - OFFER MEETING!

CARA MENAWARKAN MEETING (NATURAL & CASUAL):
Variasi yang WAJIB dipakai:
- "Gimana kalau kita diskusi lebih lanjut? Kapan kira-kira ada waktu untuk meeting?"
- "Biar lebih jelas, mau ngobrol langsung gak? Meeting kapan enaknya?"
- "Kalau mau bahas lebih detail, kita bisa meeting nih. Kapan aja boleh asal kasih tau dulu ya"
- "Oke noted! Nanti kita bisa ketemu untuk bahas lebih lanjut. Minggu ini ada waktu?"
- "Yuk kita meeting aja biar lebih gampang! Kapan bisa ketemu?"

⚠️ PENTING TENTANG MEETING:
- JANGAN LANGSUNG kasih tanggal/waktu meeting sendiri
- TUNGGU mereka yang kasih tau kapan mereka available
- Kalau mereka belum kasih tanggal spesifik, tanya lagi dengan casual
- Begitu mereka sebut tanggal/waktu (misalnya "besok", "15 Oktober", "minggu depan jam 2 siang"), sistem akan OTOMATIS simpan dan buat calendar event
- Kamu cukup konfirmasi: "Oke siap! Meeting [tanggal] jam [waktu] ya. Nanti aku remind lagi"

🚨 CONTOH KASUS NYATA YANG SALAH (JANGAN DIULANG!):
❌ WRONG: Client bilang "pusing lewat chat" → Bot langsung kasih solusi tapi TIDAN ASK waktu meeting
✅ CORRECT: Client bilang "pusing lewat chat" → Bot tanya "kapan enaknya meeting?"

❌ WRONG: Client sudah tertarik dan tanya "lalu apa" → Bot lanjut jelasin fitur
✅ CORRECT: Client sudah tertarik dan tanya "lalu apa" → Bot langsung offer meeting

Contoh FLOW yang BENAR dengan Meeting:
1. Client kasih info event → Bot tanggapi + tanya detail (kapasitas/harga)
2. Client kasih detail → Bot beri pricing + offer meeting
3. Client kasih waktu → Bot konfirmasi dan kasih reminder

Contoh pendekatan natural:
- Kalau mereka bertanya tentang pricing atau fitur, jawab dulu pertanyaan mereka
- Sambil menjawab, sisipkan pertanyaan ringan secara bertahap (JANGAN sekaligus!)
- Biarkan mengalir sesuai konteks percakapan - percakapan > data
- Kalau mereka belum ngasih info, gak papa. Santai aja, tanya di kesempatan berikutnya
- Hindari format numbered list atau bullet points saat chat - bicaralah seperti manusia

UNTUK PRICING:
- Ada 2 skema: Persenan (% dari harga tiket) dan Flat (biaya tetap per tiket)
- Pricing tergantung harga tiket dan kapasitas venue
- Kalau bahas pricing, kamu perlu tau harga tiket dan kapasitas dulu
- Tapi JANGAN tanya secara template! Tanyakan sambil ngobrol biasa
- Contoh: "Wah menarik! Tiketnya dijual berapa nih biasanya?" atau "Kapasitasnya kira-kira berapa orang ya?"

ATURAN PRICING (PENTING!):
⚠️ ABSOLUTE RULES - TIDAK BOLEH DILANGGAR:

1. **HANYA Gunakan Pricing dari Sistem**
   - WAJIB tunggu data [INTERNAL] message dari sistem
   - JANGAN pernah buat/tebak/hitung pricing sendiri
   - JANGAN pernah tawarkan harga di luar yang sistem berikan
   - Format: "Untuk skema Persenan: X% dari harga tiket" dan "Skema Flat: Rp X per tiket"

2. **DILARANG Membuat Diskon/Promo Palsu**
   - JANGAN pernah tawarkan diskon (10%, 20%, dll) kecuali ada di sistem
   - JANGAN pernah buat paket bundling yang tidak ada
   - JANGAN pernah janji "harga spesial" tanpa approval
   - JANGAN pernah bilang "kita bisa nego sampai Rp X"

3. **Handling Competitor Pricing**
   Kalau client sebut harga competitor (Yesplis, Loket, dll):

   ❌ JANGAN:
   - Langsung turunkan harga tanpa data
   - Berasumsi competitor pricing model sama dengan kita
   - Hitung matematika perbandingan tanpa clarify dulu
   - Menyerah atau bilang "kita kalah"

   ✅ LAKUKAN:
   - Tanya dulu: "Oh Yesplis Rp 7k itu per tiket atau per order ya?"
   - Clarify model mereka: "Per order itu artinya satu transaksi bisa beli berapa tiket ya?"
   - Highlight value: "Kami punya fitur [sebutkan fitur unique] yang berguna untuk event kamu"
   - Tawarkan meeting: "Gimana kalau kita meeting untuk bahas perbandingan lebih detail?"
   - JANGAN langsung give up!

4. **Matematika & Perbandingan Harga**
   ❌ SALAH: "Yesplis Rp 7k per order, berarti untuk 1500 tiket = 7k x 1500"
   ✅ BENAR: "Tanya dulu: Biasanya rata-rata satu order itu berisi berapa tiket?"

   INGAT:
   - Per order ≠ Per tiket
   - Per transaksi = bisa 1 tiket, bisa 10 tiket
   - JANGAN assume 1 order = 1 tiket

5. **Negosiasi yang Benar**
   Kalau client bilang "terlalu mahal":
   - Jangan langsung drop price 50-90%
   - Tanya: "Budget kamu berapa nih untuk platform ticketing?"
   - Explain value: "Dengan harga ini, kamu dapat fitur X, Y, Z"
   - Propose meeting: "Yuk meeting, kita bisa cari solusi yang pas"
   - Kalau perlu eskalasi: "Biar lebih jelas, aku hubungkan sama tim sales ya"

GAYA PERCAKAPAN:
- Santai tapi tetap profesional - seperti teman yang helpful
- Singkat dan to the point - jangan bertele-tele
- Gunakan bahasa sehari-hari, gak usah terlalu formal
- Boleh pake singkatan umum seperti "gak", "btw", "kira-kira", "gimana"
- Respon cepat dan relevan - langsung jawab poin utamanya
- Kalau client ngobrol di luar topik, dengan halus arahkan balik ke NovaTix

MENGUMPULKAN DATA CRM:
Kamu perlu tau: nama client, organisasi/EO mereka, dan nama event yang diplan. Tapi JANGAN minta semua sekaligus seperti formulir. Kumpulkan secara natural selama percakapan berlangsung.

❌ Contoh SALAH (terlalu kaku/template):
Bot: "Terima kasih sudah menghubungi NovaTix. Mohon berikan informasi berikut:
1. Nama Anda
2. Nama organisasi
3. Nama event"
→ Ini terdengar seperti robot/formulir! JANGAN minta data seperti checklist!

✅ CONTOH ALUR YANG BENAR:

Contoh 1 - Client baru tanya fitur:
1. Bot jawab pertanyaan fitur
2. Bot kenalan: "Oh iya, boleh kenalan dulu? Siapa nama kamu?"
3. Bot tanya organisasi: "Kamu dari organisasi/EO mana ya?"
4. Bot tanya event: "Event apa yang lagi diplan nih?"
5. Setelah dapat 3 data CRM, bot tanya detail event
6. Setelah ada detail, bot offer meeting

Contoh 2 - Client langsung tanya pricing:
1. Bot jelaskan pricing tergantung event + kapasitas
2. Bot kenalan + dapatkan data CRM (nama, org, event)
3. Bot tanya detail (kapasitas, harga)
4. Setelah lengkap, bot offer meeting

KRITIAL: Data CRM WAJIB lengkap sebelum offer meeting!

PRINSIP UTAMA:
✅ Jawab pertanyaan mereka dulu, baru tanya balik
✅ Satu pertanyaan per waktu (jangan bombardir)
✅ Sisipkan pertanyaan saat konteks pas (setelah jawab sesuatu)
✅ Pakai bahasa casual: "btw", "boleh tau", "kira-kira", "nih"
✅ SELALU tawarkan meeting setelah data lengkap dan diskusi awal selesai
❌ JANGAN gunakan numbered list saat tanya-tanya
❌ JANGAN minta "data lengkap" atau "informasi berikut"
❌ JANGAN tanya semuanya di message pertama
❌ JANGAN kasih jadwal meeting tanpa tanya client dulu

🚫 DEAL QUALIFICATION - JANGAN SKIP!
SEBELUM bicara MoU/kontrak, WAJIB ada:

1. **Meeting Terjadwal**
   - HARUS sudah offer meeting dan dapat konfirmasi tanggal
   - Kalau mereka bilang "oke boleh" tapi belum kasih tanggal → TANYA tanggal dulu
   - Jangan langsung lompat ke MoU tanpa meeting terjadwal

2. **Checklist Sebelum MoU**
   ❌ JANGAN bilang "siap untuk sign kontrak?" kalau:
   - Belum ada meeting terjadwal
   - Mereka masih tanya-tanya harga competitor
   - Mereka bilang "mahal" atau "masih mikir"
   - Mereka belum explicit bilang "oke deal" atau "setuju"

   ✅ BARU bisa bahas MoU kalau:
   - Meeting sudah dijadwalkan
   - Mereka sudah agree dengan pricing ("oke boleh", "deal", "setuju")
   - Mereka yang inisiatif tanya "gimana next stepnya?" atau "MoU nya gimana?"

3. **Respon yang Benar**
   Kalau mereka bilang "menarik" atau "oke boleh":
   - JANGAN langsung: "Siap untuk sign kontrak?"
   - LAKUKAN: "Gimana kalau kita meeting dulu untuk bahas detail? Kapan enaknya?"
   - Kalau mereka tanya MoU: "Sure! Nanti pas meeting kita bisa bahas dan finalisasi MoU. Kapan bisa ketemu?"

Ingat: Percakapan yang enak lebih penting daripada cepat-cepat dapet data. Biarkan mengalir natural. Meeting ALWAYS comes before MoU!`;
  }

  /**
   * Build dynamic guidance for sequential data collection
   * Bot will ask questions one by one in separate chat bubbles
   */
  /**
   * Build dynamic guidance for sequential data collection
   * Bot will ask questions one by one in separate chat bubbles
   */
  buildDataCollectionGuidance() {
    let guidance = '\n\n🎯 DATA COLLECTION STRATEGY:\n';
    guidance += 'Kumpulkan data satu per satu dengan natural. Jangan tanya semua dalam satu pesan!\n';
    guidance += 'Fokus pada percakapan yang nyaman dan mengalir, bukan interogasi.\n';

    // Check what data we already have
    const hasBasicInfo = this.userContext.nama && this.userContext.instansi;
    const hasEventInfo = this.userContext.event && this.userContext.capacity && this.userContext.ticketPrice;
    const hasMeetingDate = this.userContext.meetingDate;

    // Stage 1: Basic information collection
    if (!this.userContext.nama) {
      guidance += '\n📝 STAGE 1: Dapatkan Nama & Organisasi';
      guidance += '\n- Tanya: "Nama siapa ya dan dari instansi/organisasi mana?"';
      guidance += '\n- Natural: "Oke, mau tanya dulu nama dan dari organisasi mana ya?"';
      this.dataCollectionState.currentQuestionStage = 'getting_name';
    } else if (!this.userContext.instansi) {
      guidance += '\n📝 STAGE 1: Dapatkan Organisasi';
      guidance += '\n- Tanya: "Dari instansi/organisasi mana ya?"';
      guidance += '\n- Natural: "Dari mana ya?" atau "Instansinya mana?"';
      this.dataCollectionState.currentQuestionStage = 'getting_org';
    }
    // Stage 2: Event information collection
    else if (!this.userContext.event) {
      guidance += '\n🎉 STAGE 2: Dapatkan Info Event';
      guidance += '\n- Setelah dapat nama&org, tanya: "Mau bikin event apa ya?"';
      guidance += '\n- Natural: "Event nya apa ya?" atau "Mau bikin acara apa?"';
      this.dataCollectionState.currentQuestionStage = 'getting_event';
    } else if (!this.userContext.capacity) {
      guidance += '\n👥 STAGE 2: Dapatkan Kapasitas';
      guidance += '\n- Tanya: "Kira-kira kapasitasnya berapa orang?"';
      guidance += '\n- Natural: "Kira-kira berapa orang ya?" atau "Estimasi kapasitas berapa?"';
      this.dataCollectionState.currentQuestionStage = 'getting_capacity';
    } else if (!this.userContext.ticketPrice) {
      guidance += '\n💰 STAGE 2: Dapatkan Harga Tiket';
      guidance += '\n- Tanya: "Tiketnya rencananya dijual berapa?"';
      guidance += '\n- Natural: "Harga tiket berapa ya?" atau "Mau dijual berapa per tiket?"';
      this.dataCollectionState.currentQuestionStage = 'getting_price';
    }
    // Stage 3: Meeting offer stage
    else if (hasEventInfo && !hasMeetingDate) {
      const messageCount = this.dataCollectionState.messageCount || 0;
      
      if (messageCount >= 4 && !this.userContext.meetingDate) {
        guidance += '\n\n📅 SAATNYA TAWARKAN MEETING!';
        guidance += '\nData sudah lengkap dan sudah ada diskusi. Sekarang waktunya tawarkan meeting untuk diskusi lebih lanjut.';
        guidance += '\n\nPILIH SALAH SATU variasi (natural & casual):';
        guidance += '\n- \'Gimana kalau kita diskusi lebih lanjut? Kapan kira-kira ada waktu untuk meeting?\'';
        guidance += '\n- \'Biar lebih jelas, mau ngobrol langsung gak? Meeting kapan enaknya?\'';
        guidance += '\n- \'Kalau mau bahas lebih detail, kita bisa meeting nih. Minggu ini ada waktu?\'';
        guidance += '\n- \'Oke noted! Mau ketemu untuk bahas lebih lanjut? Kapan aja boleh asal kasih tau dulu\'';
        guidance += '\n\n⚠️ PENTING:';
        guidance += '\n- JANGAN kasih tanggal/waktu sendiri, TUNGGU mereka yang kasih tau';
        guidance += '\n- Begitu mereka sebut tanggal (contoh: \'besok\', \'15 Oktober\', \'minggu depan jam 2\'), sistem akan otomatis simpan';
        guidance += '\n- Kamu cukup konfirmasi: \'Oke siap! Meeting [tanggal] jam [waktu] ya. Nanti aku remind lagi\'';
        guidance += '\n\n🚫 CRITICAL: JANGAN bahas MoU/kontrak sebelum meeting dijadwalkan!';

        this.dataCollectionState.currentQuestionStage = 'offering_meeting';
      } else if (this.userContext.meetingDate) {
        guidance += '\n\n✅ MEETING SUDAH DIJADWALKAN!';
        guidance += `\nMeeting date: ${this.userContext.meetingDate}`;
        guidance += '\nFokus membantu client dengan pertanyaan mereka dan persiapan meeting.';
        guidance += '\n\n⚠️ KALAU mereka tanya tentang MoU/kontrak:';
        guidance += '\n- Bilang: \'Nanti kita finalisasi pas meeting ya!\'';
        guidance += '\n- Jangan langsung kirim template MoU atau bilang \'siap sign kontrak\'';
        guidance += '\n- Meeting dulu, BARU MoU!';
      }
    }

    if (!this.dataCollectionState.currentQuestionStage || this.dataCollectionState.currentQuestionStage === 'waiting_event') {
      this.dataCollectionState.currentQuestionStage = 'complete';
    }

    // Add enhanced calendar confirmation guidance if meeting was just scheduled
    if (hasMeetingDate && this.dataCollectionState.justScheduledMeeting) {
      guidance += '\n\n📆 ENHANCED CALENDAR CONFIRMATION NEEDED!';
      guidance += '\nSistem sudah otomatis buat Google Calendar event dengan detail lengkap.';
      guidance += '\n\nBerikan konfirmasi yang RINCI dan BERGUNA:';
      guidance += '\n- ✅ Konfirmasi tanggal & waktu: "Oke siap! Meeting [tanggal] jam [waktu] WIB ya"';
      guidance += '\n- 📋 Berikan agenda meeting: "Kita akan bahas: fitur platform, pricing, dan implementasi"';
      guidance += '\n- 🔔 Berikan info reminder: "Nanti aku remind 30 menit sebelum meeting"';
      guidance += '\n- 📱 Info tambahan: "Detail meeting sudah aku kirim ke Google Calendar kamu"';
      guidance += '\n\nContoh response lengkap:';
      guidance += '\n"🎉 Oke siap! Meeting besok jam 10 pagi WIB ya. Sudah aku buatkan di Google Calendar dengan detail lengkap:"';
      guidance += '\n"📋 Agenda: MoU discussion, platform demo, pricing negotiation"';
      guidance += '\n"🔔 Aku remind 30 menit sebelum meeting. Link meeting akan dikirim H-1"';
      guidance += '\n"Semua info lengkap sudah ada di calendar kamu. Siap untuk diskusi lebih detail!"';
      
      this.dataCollectionState.justScheduledMeeting = false; // Reset flag
    }

    return guidance;
  }

  /**
   * Detect interest signals that should trigger meeting offers
   * Returns urgency level: 'critical', 'high', 'normal', or null
   */
  detectInterestSignals(userMessage) {
    const lowerMessage = userMessage.toLowerCase();

    // CRITICAL signals - user is frustrated or explicitly interested
    const criticalSignals = [
      'pusing', 'bingung', 'ribet', 'susah', 'rumit',
      'tertarik', 'interest', 'menarik',
      'lalu apa', 'lalu?', 'terus?', 'terus gimana', 'next step',
      'oke lalu', 'ya lalu', 'iya terus'
    ];

    // HIGH priority signals - user is engaging positively
    const highSignals = [
      'boleh', 'oke', 'ok', 'siap', 'setuju', 'deal',
      'sip', 'mantap', 'bagus', 'cocok'
    ];

    // Check for critical signals
    for (const signal of criticalSignals) {
      if (lowerMessage.includes(signal)) {
        console.log(`[INTEREST DETECTION] CRITICAL signal detected: "${signal}"`);
        return 'critical';
      }
    }

    // Check for high signals (only if basic data is collected)
    if (this.userContext.nama && this.userContext.instansi && this.userContext.eventName) {
      for (const signal of highSignals) {
        if (lowerMessage.includes(signal)) {
          console.log(`[INTEREST DETECTION] HIGH signal detected: "${signal}"`);
          return 'high';
        }
      }
    }

    return null;
  }

  /**
   * Build meeting offer guidance based on interest signals
   */
  buildMeetingOfferGuidance(urgencyLevel, userMessage) {
    if (!urgencyLevel) return '';

    let guidance = '\n\n🚨🚨🚨 CRITICAL MEETING TRIGGER DETECTED! 🚨🚨🚨\n';

    if (urgencyLevel === 'critical') {
      guidance += '\n⚠️ USER MENUNJUKKAN INTEREST KUAT ATAU FRUSTASI!';
      guidance += `\nUser message: "${userMessage}"`;
      guidance += '\n\n🎯 ACTION REQUIRED (WAJIB!):';
      guidance += '\nKamu HARUS tawarkan meeting SEKARANG dalam response kamu!';
      guidance += '\n\nGunakan salah satu variasi ini (PILIH 1):';
      
      if (userMessage.toLowerCase().includes('pusing') || 
          userMessage.toLowerCase().includes('bingung') ||
          userMessage.toLowerCase().includes('ribet')) {
        guidance += '\n- "Betul banget! Gimana kalau kita meeting aja biar lebih jelas? Kapan kira-kira ada waktu?"';
        guidance += '\n- "Yuk kita meeting aja biar lebih gampang! Kapan bisa ketemu?"';
      } else if (userMessage.toLowerCase().includes('tertarik')) {
        guidance += '\n- "Oke siap! Biar lebih detail, yuk kita meeting. Kapan enaknya?"';
        guidance += '\n- "Wah senang denger itu! Gimana kalau kita meeting untuk bahas lebih lanjut? Minggu ini kapan bisa?"';
      } else if (userMessage.toLowerCase().includes('lalu') || 
                 userMessage.toLowerCase().includes('terus')) {
        guidance += '\n- "Oke siap! Biar lebih detail, yuk kita meeting. Kapan enaknya? Minggu ini available?"';
        guidance += '\n- "Next step-nya kita meeting ya! Kapan kira-kira ada waktu?"';
      }

      guidance += '\n\n❌ JANGAN:';
      guidance += '\n- Jelasin panjang lebar lagi - user sudah bosan!';
      guidance += '\n- Bilang "bicara langsung" tanpa ASK waktu meeting';
      guidance += '\n- Abaikan signal ini!';

    } else if (urgencyLevel === 'high') {
      guidance += '\n⚠️ USER MENUNJUKKAN INTEREST POSITIF!';
      guidance += '\n\n🎯 STRONG RECOMMENDATION:';
      guidance += '\nSangat disarankan untuk tawarkan meeting dalam response kamu.';
      guidance += '\n\nContoh:';
      guidance += '\n- "Gimana kalau kita diskusi lebih lanjut? Kapan kira-kira ada waktu untuk meeting?"';
      guidance += '\n- "Biar lebih jelas, mau ngobrol langsung gak? Meeting kapan enaknya?"';
    }

    guidance += '\n\n⚠️ REMINDER:';
    guidance += '\n- JANGAN kasih tanggal sendiri, TANYA mereka kapan available';
    guidance += '\n- Begitu mereka sebut tanggal, sistem akan otomatis simpan';
    guidance += '\n🚨🚨🚨 END OF CRITICAL TRIGGER 🚨🚨🚨\n';

    return guidance;
  }

  async chat(userMessage) {
    const startTime = Date.now(); // OPTIMIZATION: Track response time

    // Increment message count
    this.dataCollectionState.messageCount++;

    // OPTIMIZATION: Check cache first for common queries
    const cacheKey = this.getCacheKey(userMessage, this.userContext);
    const cachedResponse = this.getCachedResponse(cacheKey);
    if (cachedResponse) {
      console.log(`[CACHE] Cache hit for: "${userMessage.substring(0, 30)}..."`);
      return cachedResponse;
    }

    // OPTIMIZATION: Run non-blocking operations in parallel
    const asyncOperations = [
      this.extractContextFromMessageOptimized(userMessage),
      this.initializeCalendarAsync(),
      this.syncCalendarEventsAsync()
    ];

    // Don't await these - let them run in background
    Promise.all(asyncOperations).catch(error => {
      console.error('[BACKGROUND] Async operations failed:', error.message);
    });

    // Detect interest signals for meeting offer (CRITICAL for conversion!)
    const interestLevel = this.detectInterestSignals(userMessage);
    const meetingOfferGuidance = this.buildMeetingOfferGuidance(interestLevel, userMessage);

    // Build data collection guidance for the bot
    const dataCollectionGuidance = this.buildDataCollectionGuidance();

    // Build conversation history
    const messages = [
      { role: "system", content: this.systemPrompt },
      ...this.conversationHistory,
      { role: "user", content: userMessage }
    ];

    // Track tools used
    const toolsUsed = [];

    // Check if we have pricing info to provide
    let additionalContext = dataCollectionGuidance + meetingOfferGuidance;
    if (this.userContext.ticketPrice && this.userContext.capacity) {
      const pricing = getPricing(this.userContext.ticketPrice, this.userContext.capacity);
      toolsUsed.push('getPricing');

      // Debug logging
      console.log('\n[DEBUG] User Context:', this.userContext);
      console.log('[DEBUG] Pricing Result:', pricing);

      additionalContext = `\n\n[INTERNAL - PENTING! Data pricing yang HARUS digunakan untuk harga tiket Rp ${this.userContext.ticketPrice.toLocaleString('id-ID')} dengan kapasitas ${this.userContext.capacity} pax:
- Skema Persenan: ${pricing.percentage.fee} dari harga tiket
- Skema Flat: ${pricing.flat.fee} per tiket

INSTRUKSI WAJIB:
1. GUNAKAN HANYA angka di atas, JANGAN hitung atau ubah sendiri!
2. Untuk Persenan ${pricing.percentage.fee}: jelaskan sebagai "${pricing.percentage.fee} dari harga tiket"
3. Untuk Flat ${pricing.flat.fee}: jelaskan sebagai "${pricing.flat.fee} per tiket terjual"
4. Berikan kedua opsi dengan penjelasan singkat dan jelas
5. DILARANG KERAS: JANGAN tambahkan perhitungan matematis, contoh nominal, atau hasil perkalian!
6. JANGAN SEKALI-KALI mengalikan persen dengan harga tiket atau kapasitas!
7. JANGAN berikan contoh seperti "2% x 50.000 x 800 = X" - ini DILARANG!
8. Hanya sebutkan persentase atau fee per tiket, tanpa perhitungan apa pun]`;
    }

    try {
      // OPTIMIZATION: Add retry logic for LLM calls
      let response = null;
      let lastError = null;
      const maxRetries = 3;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          // Add timeout to LLM call (increased for reliability)
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('LLM timeout')), 25000)
          );

          const llmPromise = this.model.invoke([
            ...messages,
            ...(additionalContext ? [{ role: "system", content: additionalContext }] : [])
          ]);

          response = await Promise.race([llmPromise, timeoutPromise]);
          break; // Success, exit retry loop
        } catch (error) {
          lastError = error;
          console.error(`[LLM] Attempt ${attempt} failed:`, error.message);

          if (attempt < maxRetries) {
            // Exponential backoff
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
            console.log(`[LLM] Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      if (!response) {
        throw lastError || new Error('LLM failed after retries');
      }

      const botResponse = response.content;

      // Update conversation history (in-memory)
      this.conversationHistory.push(
        { role: "user", content: userMessage },
        { role: "assistant", content: botResponse }
      );

      // Keep only last 10 messages to manage context window
      if (this.conversationHistory.length > 20) {
        this.conversationHistory = this.conversationHistory.slice(-20);
      }

      // OPTIMIZATION: Save to database asynchronously (non-blocking)
      if (this.userId) {
        this.saveConversationAsync(this.userId, userMessage, botResponse, toolsUsed);
      }

      // OPTIMIZATION: Cache the response for future use
      this.setCachedResponse(cacheKey, botResponse);

      // OPTIMIZATION: Log response time
      const responseTime = Date.now() - startTime;
      console.log(`[PERFORMANCE] Response time: ${responseTime}ms for message: "${userMessage.substring(0, 50)}..."`);

      return botResponse;
    } catch (error) {
      console.error("Error calling Groq:", error);

      // OPTIMIZATION: Return a fallback response instead of throwing
      const fallbackResponse = "Maaf, saya sedang mengalami kendala teknis. Silakan coba lagi dalam beberapa saat.";

      // Still cache the fallback to avoid repeated LLM failures
      this.setCachedResponse(cacheKey, fallbackResponse);

      return fallbackResponse;
    }
  }

  async extractContextFromMessage(message) {
    try {
      // OPTIMIZATION: Use regex-based extraction first for faster response
      this.extractContextFromMessageFallback(message);

      // Only use LLM extraction if regex doesn't find enough info
      if (!this.userContext.nama || !this.userContext.instansi || !this.userContext.eventName) {
        const entities = await this.extractEntitiesWithLLM(message);
        this.updateUserContext(entities);
      }

    } catch (error) {
      console.error('[DEBUG] LLM entity extraction failed, using fallback:', error);
      // Fallback to basic regex extraction
      this.extractContextFromMessageFallback(message);
    }
  }

  // OPTIMIZATION: Faster entity extraction method
  async extractContextFromMessageOptimized(message) {
    try {
      // OPTIMIZATION: Prioritize regex extraction for speed
      this.extractContextFromMessageFallback(message);

      // Only use LLM if we're missing critical data and message is complex
      const needsLLMExtraction = (!this.userContext.nama || !this.userContext.instansi || !this.userContext.eventName) &&
                                   message.length > 20 &&
                                   !this.isSimpleGreeting(message);

      if (needsLLMExtraction) {
        const entities = await this.extractEntitiesWithLLM(message);
        this.updateUserContext(entities);
      }

    } catch (error) {
      console.error('[DEBUG] Optimized entity extraction failed, using fallback:', error);
      this.extractContextFromMessageFallback(message);
    }
  }

  // OPTIMIZATION: Check if message is simple greeting
  isSimpleGreeting(message) {
    const greetings = ['halo', 'hai', 'hello', 'hi', 'selamat pagi', 'selamat siang', 'selamat malam', 'assalamualaikum', 'waalaikumsalam'];
    const lowerMessage = message.toLowerCase().trim();
    return greetings.some(greeting => lowerMessage === greeting || lowerMessage.startsWith(greeting + ' '));
  }

  // OPTIMIZATION: Build optimized system prompt to reduce LLM calls
  buildOptimizedSystemPrompt(dataCollectionGuidance, meetingOfferGuidance) {
    const contextInfo = Object.entries(this.userContext)
      .filter(([key, value]) => value !== null && value !== undefined)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');

    return `${this.systemPrompt}

${contextInfo ? `Current Context: ${contextInfo}` : ''}

${dataCollectionGuidance}

${meetingOfferGuidance}

INSTRUCTION: Extract entities from user messages and provide helpful responses about event organization, pricing, and scheduling.`;
  }

  // OPTIMIZATION: Async database operations with timeout
  async saveConversationAsync(userId, userMessage, botResponse, toolsUsed) {
    // Run in background without blocking response
    setImmediate(async () => {
      try {
        // Add timeout to database operations
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Database operation timeout')), 5000)
        );

        const savePromise = this.db.saveConversation(
          userId,
          userMessage,
          botResponse,
          toolsUsed,
          {
            source: 'whatsapp',
            context: this.userContext,
            toolsUsed
          }
        );

        await Promise.race([savePromise, timeoutPromise]);

        // Update user info if we have any context data
        const updateData = {};
        if (this.userContext.nama) updateData.nama = this.userContext.nama;
        if (this.userContext.instansi) updateData.instansi = this.userContext.instansi;
        if (this.userContext.ticketPrice) updateData.ticketPrice = this.userContext.ticketPrice;
        if (this.userContext.capacity) updateData.capacity = this.userContext.capacity;
        if (this.userContext.eventName) updateData.event = this.userContext.eventName;

        if (Object.keys(updateData).length > 0) {
          const updatePromise = this.db.updateUser(userId, updateData);
          await Promise.race([updatePromise, timeoutPromise]);
        }

        // Update session
        const sessionPromise = this.db.updateSession(userId, this.userContext, true);
        await Promise.race([sessionPromise, timeoutPromise]);

      } catch (dbError) {
        console.error('[NovaBot] Database error (non-fatal):', dbError.message);
        // Don't throw - database failures shouldn't break chat flow
      }
    });
  }

  // OPTIMIZATION: Async calendar operations with timeout
  async syncCalendarEventsAsync() {
    if (!this.calendarInitialized) return;

    try {
      // Run in background without blocking
      setImmediate(async () => {
        try {
          // Add timeout to calendar operations
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Calendar operation timeout')), 3000)
          );

          const syncPromise = this.syncCalendarEvents();
          await Promise.race([syncPromise, timeoutPromise]);
        } catch (error) {
          console.error('[NovaBot] Async calendar sync failed:', error.message);
          // Don't throw - calendar failures shouldn't break chat flow
        }
      });
    } catch (error) {
      console.error('[NovaBot] Calendar sync initialization failed:', error.message);
    }
  }

  // OPTIMIZATION: Response caching for common queries
  getCacheKey(message, context) {
    const contextHash = JSON.stringify(context);
    return `${message}_${contextHash}`;
  }

  getCachedResponse(cacheKey) {
    const cached = this.responseCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 300000) { // 5 minutes cache
      return cached.response;
    }
    return null;
  }

  setCachedResponse(cacheKey, response) {
    this.responseCache.set(cacheKey, {
      response,
      timestamp: Date.now()
    });

    // Cleanup old cache entries periodically
    if (Date.now() - this.lastCacheCleanup > 600000) { // 10 minutes
      this.cleanupCache();
      this.lastCacheCleanup = Date.now();
    }
  }

  cleanupCache() {
    const now = Date.now();
    for (const [key, value] of this.responseCache.entries()) {
      if (now - value.timestamp > 600000) { // Remove entries older than 10 minutes
        this.responseCache.delete(key);
      }
    }
  }

  /**
   * Extract entities using LLM with Indonesian language understanding
   * @param {string} message - User message
   * @returns {Object} Extracted entities
   */
  async extractEntitiesWithLLM(message) {
    try {
      // Use direct prompt instead of template to avoid variable errors
      const prompt = `Kamu adalah AI extractor untuk mengidentifikasi informasi dari pesan Bahasa Indonesia yang casual.

EKSTRAK ENTITAS BERDASARKAN CONTOH:
- nama: Nama orang (contoh: "Budi", "John Doe")
- instansi: Nama organisasi/perusahaan (contoh: "PT Maju Jaya", "Acme Corp")
- eventName: Nama event/acara (contoh: "Konser Musik", "Tech Conference 2024")
- ticketPrice: Harga tiket dalam angka (contoh: 50000, 100000)
- capacity: Kapasitas dalam angka (contoh: 1000, 500)
- meetingDate: Tanggal meeting (format: YYYY-MM-DD)
- ticketSaleDate: Tanggal mulai penjualan tiket (format: YYYY-MM-DD)
- eventDayDate: Tanggal pelaksanaan event (format: YYYY-MM-DD)

CONTOH EXTRACTION:
Pesan: "Nama saya Budi dari PT Maju Jaya, mau buat event Konser Musik dengan harga 50k"
Response: {"nama": "Budi", "instansi": "PT Maju Jaya", "eventName": "Konser Musik", "ticketPrice": 50000}

Pesan: "Event kita kapasitasnya 1000 orang, tiket 75rb"
Response: {"capacity": 1000, "ticketPrice": 75000}

Pesan: "Meeting tanggal 15 Desember 2024 jam 10 pagi"
Response: {"meetingDate": "2024-12-15"}

Pesan: "Tiket mulai dijual 1 Januari 2025, eventnya 20 Februari 2025"
Response: {"ticketSaleDate": "2025-01-01", "eventDayDate": "2025-02-20"}

ATURAN:
- Hanya extract entities yang jelas disebutkan dalam pesan
- Untuk harga: konversi "k"/"rb"/"ribu" ke 1000, "juta" ke 1000000
- Untuk tanggal: gunakan format YYYY-MM-DD
- Kosongkan field jika tidak ada informasinya
- Response harus dalam format JSON valid

Sekarang extract dari pesan ini: "${message}"

Response:`;

      const response = await this.model.invoke(prompt);

      // Extract JSON from the response
      const jsonMatch = response.content.match(/\{[^}]+\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Fallback: try to parse entire response as JSON
      try {
        return JSON.parse(response.content);
      } catch (parseError) {
        console.error('[DEBUG] Failed to parse LLM entity response:', parseError);
        console.error('[DEBUG] Raw response:', response.content);
        return {};
      }
    } catch (error) {
      console.error('[DEBUG] LLM entity extraction failed:', error);
      return {};
    }
  }

  /**
   * Update userContext with extracted entities
   * @param {Object} entities - Extracted entities from LLM
   */
  updateUserContext(entities) {
    // Update nama only if not already set
    if (entities.nama && !this.userContext.nama) {
      this.userContext.nama = entities.nama.trim();
      console.log(`[DEBUG] Extracted name: ${entities.nama}`);
    }

    // Update instansi only if not already set
    if (entities.instansi && !this.userContext.instansi) {
      this.userContext.instansi = entities.instansi.trim();
      console.log(`[DEBUG] Extracted instansi: ${entities.instansi}`);
    }

    // Update eventName only if not already set
    if (entities.eventName && !this.userContext.eventName) {
      this.userContext.eventName = entities.eventName.trim();
      console.log(`[DEBUG] Extracted event name: ${entities.eventName}`);
    }

    // Update ticketPrice (allows changes)
    if (entities.ticketPrice) {
      if (this.userContext.ticketPrice && this.userContext.ticketPrice !== entities.ticketPrice) {
        console.log(`[DEBUG] Updating ticket price from ${this.userContext.ticketPrice} to ${entities.ticketPrice}`);
      } else {
        console.log(`[DEBUG] Extracted ticket price: ${entities.ticketPrice}`);
      }
      this.userContext.ticketPrice = entities.ticketPrice;
    }

    // Update capacity (allows changes)
    if (entities.capacity) {
      if (this.userContext.capacity && this.userContext.capacity !== entities.capacity) {
        console.log(`[DEBUG] Updating capacity from ${this.userContext.capacity} to ${entities.capacity}`);
      } else {
        console.log(`[DEBUG] Extracted capacity: ${entities.capacity}`);
      }
      this.userContext.capacity = entities.capacity;
    }

    // Update dates
    if (entities.meetingDate) {
      this.userContext.meetingDate = entities.meetingDate;
      console.log(`[DEBUG] Extracted meeting date: ${entities.meetingDate}`);
    }

    if (entities.ticketSaleDate) {
      this.userContext.ticketSaleDate = entities.ticketSaleDate;
      console.log(`[DEBUG] Extracted ticket sale date: ${entities.ticketSaleDate}`);
    }

    if (entities.eventDayDate) {
      this.userContext.eventDayDate = entities.eventDayDate;
      console.log(`[DEBUG] Extracted event day date: ${entities.eventDayDate}`);
    }
  }

  /**
   * Fallback entity extraction using simple regex patterns
   * @param {string} message - User message
   */
  extractContextFromMessageFallback(message) {
    const lowerMessage = message.toLowerCase();

    // Simple fallback patterns for critical entities
    if (!this.userContext.nama) {
      const nameMatch = message.match(/(?:nama\s+(?:saya|gue|aku|adalah)\s+)([A-Za-z\s]+?)(?:\s+dari|$|,|\.)/i);
      if (nameMatch && nameMatch[1]) {
        this.userContext.nama = nameMatch[1].trim();
        console.log(`[DEBUG] Extracted name (fallback): ${nameMatch[1]}`);
      }
    }

    if (!this.userContext.instansi) {
      const instansiMatch = message.match(/(?:dari\s+)([A-Za-z0-9\s]+?)(?:\s+ingin|\s+mau|\s+namanya|$|,|\.)/i);
      if (instansiMatch && instansiMatch[1]) {
        this.userContext.instansi = instansiMatch[1].trim();
        console.log(`[DEBUG] Extracted instansi (fallback): ${instansiMatch[1]}`);
      }
    }

    // Event name extraction fallback
    if (!this.userContext.event) {
      const eventPatterns = [
        /(?:mau\s+(?:bikin|buat|adain)\s+)(.+?)(?:\s+kapasitas|\s+dengan|\s+kira|\s+harga|$|,|\.)/i,
        /(?:mengadakan\s+)(.+?)(?:\s+dengan|\s+kapasitas|\s+harga|$|,|\.)/i,
        /(?:event\s+)(.+?)(?:\s+dengan|\s+kapasitas|\s+harga|$|,|\.)/i,
        /(?:acara\s+)(.+?)(?:\s+dengan|\s+kapasitas|\s+harga|$|,|\.)/i
      ];
      
      for (const pattern of eventPatterns) {
        const eventMatch = message.match(pattern);
        if (eventMatch && eventMatch[1]) {
          const eventName = eventMatch[1].trim();
          // Clean up common filler words
          const cleanEventName = eventName
            .replace(/^(yang |ini |itu )/i, '')
            .replace(/( ya|yah|dong|nih)$/i, '')
            .trim();
          
          if (cleanEventName.length > 3) { // Minimum length to avoid noise
            this.userContext.event = cleanEventName;
            console.log(`[DEBUG] Extracted event name (fallback): ${cleanEventName}`);
            break;
          }
        }
      }
    }

    // Price extraction fallback
    if (lowerMessage.includes('harga') || lowerMessage.includes('tiket')) {
      const priceMatch = message.match(/(\d+[.,]?\d*)\s?(k|rb|ribu|juta)/i);
      if (priceMatch) {
        let price = parseInt(priceMatch[1].replace(/[.,]/g, ''));
        const unit = priceMatch[2]?.toLowerCase();

        if (unit === 'k' || unit === 'rb' || unit === 'ribu') {
          price *= 1000;
        } else if (unit === 'juta') {
          price *= 1000000;
        }

        if (price > 1000) {
          this.userContext.ticketPrice = price;
          console.log(`[DEBUG] Extracted ticket price (fallback): ${price}`);
        }
      }
    }

    // Capacity extraction fallback - enhanced to handle "tiket" mentions
    if (lowerMessage.includes('kapasitas') || lowerMessage.includes('jumlah') || 
        (lowerMessage.includes('tiket') && /\d+\s*tiket/.test(lowerMessage))) {
      const capacityMatch = message.match(/(\d+[.,]?\d*)/i);
      if (capacityMatch) {
        const capacity = parseInt(capacityMatch[1].replace(/[.,]/g, ''));
        if (capacity >= 10 && capacity <= 100000 && capacity !== this.userContext.ticketPrice) {
          this.userContext.capacity = capacity;
          console.log(`[DEBUG] Extracted capacity (fallback): ${capacity}`);
        }
      }
    }

    // Meeting date extraction - parse Indonesian date/time expressions
    const datePatterns = [
      /(?:meeting|ketemu|janjian)\s+.*?(besok|lusa|minggu\s+depan|bulan\s+depan)/i,
      /(?:besok|lusa|minggu\s+depan|bulan\s+depan).*?(?:meeting|ketemu|janjian)/i,
      /(?:besok|lusa|hari\s+\w+).*?(?:jam\s+\d{1,2}|pagi|siang|sore|malam)/i,
      // Enhanced patterns for natural Indonesian word order
      /(?:besok|lusa).*?(?:sore|pagi|siang|malam).*?(?:jam\s+\d{1,2}|\d{1,2})/i,
      /(?:besok|lusa).*?(?:jam\s+\d{1,2}|\d{1,2}).*?(?:sore|pagi|siang|malam)/i,
      /(?:sore|pagi|siang|malam).*?(?:besok|lusa).*?(?:jam\s+\d{1,2}|\d{1,2})/i,
      /(?:jam\s+\d{1,2}|\d{1,2}).*?(?:besok|lusa).*?(?:sore|pagi|siang|malam)/i
    ];

    for (const pattern of datePatterns) {
      const dateMatch = message.match(pattern);
      if (dateMatch && !this.userContext.meetingDate) {
        const extractedDate = this.parseIndonesianDate(dateMatch[0], message);
        if (extractedDate && !isNaN(extractedDate.getTime())) {
          this.userContext.meetingDate = extractedDate;
          this.dataCollectionState.justScheduledMeeting = true;
          console.log(`[DEBUG] Extracted meeting date (fallback): ${extractedDate.toISOString()}`);
          break;
        }
      }
    }
  }

  /**
   * Parse Indonesian date formats to Date object
   * Supports: DD/MM/YYYY, DD-MM-YYYY, DD Month YYYY, relative dates
   * Also extracts time in WIB (GMT+7) format
   */
  /**
   * Parse Indonesian date formats to Date object
   * Supports: DD/MM/YYYY, DD-MM-YYYY, DD Month YYYY, relative dates
   * Also extracts time in WIB (GMT+7) format with Indonesian time-of-day words
   */
  parseIndonesianDate(dateStr, fullMessage) {
    try {
      const lowerDateStr = dateStr.toLowerCase();
      const lowerMessage = fullMessage.toLowerCase();

      // Extract time from the full message (look for "jam HH:MM", "HH:MM", or time-of-day words)
      let hour = 10; // Default 10 AM WIB
      let minute = 0;

      const timePatterns = [
        /jam\s+(\d{1,2})[:\.](\d{2})/i,        // "jam 10:00" or "jam 10.00"
        /jam\s+(\d{1,2})\s*(?:wib|wit|wita)?/i, // "jam 10 WIB" or just "jam 10"
        /pukul\s+(\d{1,2})[:\.](\d{2})/i,      // "pukul 10:00"
        /pukul\s+(\d{1,2})\s*(?:wib|wit|wita)?/i, // "pukul 10"
        /(\d{1,2})[:\.](\d{2})\s*(?:wib|wit|wita)/i, // "10:00 WIB"
        // Enhanced patterns for natural word order
        /(?:sore|pagi|siang|malam)\s+jam\s+(\d{1,2})/i, // "sore jam 3"
        /(?:sore|pagi|siang|malam)\s+(\d{1,2})/i // "sore 3"
      ];

      // First, extract numeric hour
      let extractedHour = null;
      for (const pattern of timePatterns) {
        const timeMatch = lowerMessage.match(pattern);
        if (timeMatch) {
          extractedHour = parseInt(timeMatch[1]);
          minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;

          // Validate hour and minute
          if (extractedHour >= 0 && extractedHour <= 23 && minute >= 0 && minute <= 59) {
            console.log(`[DEBUG] Extracted base hour: ${extractedHour}:${minute.toString().padStart(2, '0')}`);
            break;
          }
        }
      }

      // Then, adjust for Indonesian time-of-day words if found
      const timeOfDayPatterns = [
        { pattern: /\b(\d{1,2})\s+pagi\b/i, adjustment: 0, maxHour: 11 },     // "10 pagi" = 10:00
        { pattern: /\b(\d{1,2})\s+siang\b/i, adjustment: 0, maxHour: 14 },    // "12 siang" = 12:00, "1 siang" = 13:00
        { pattern: /\b(\d{1,2})\s+sore\b/i, adjustment: 12, maxHour: 11 },    // "5 sore" = 17:00 (5 + 12)
        { pattern: /\b(\d{1,2})\s+malam\b/i, adjustment: 12, maxHour: 11 },    // "10 malam" = 22:00 (10 + 12)
        // Handle "sore jam 3" pattern - this is already handled by timePatterns above
      ];

      for (const { pattern, adjustment, maxHour } of timeOfDayPatterns) {
        const timeMatch = lowerMessage.match(pattern);
        if (timeMatch) {
          let baseHour = parseInt(timeMatch[1]);
          
          // Special cases for "siang"
          if (pattern.toString().includes('siang')) {
            if (baseHour <= 2) {
              // "1 siang" = 13:00, "2 siang" = 14:00
              baseHour += 12;
            }
            // "12 siang" = 12:00, values > 2 treated as 24h format
          } else if (adjustment === 12) {
            // "sore" and "malam" - add 12 hours
            baseHour += 12;
          }
          
          // Validate the converted hour
          if (baseHour >= 0 && baseHour <= 23) {
            hour = baseHour;
            console.log(`[DEBUG] Time-of-day adjustment: ${timeMatch[0]} -> ${hour}:${minute.toString().padStart(2, '0')} WIB`);
            break;
          }
        }
      }

      // If no time-of-day words found but we have extracted hour from patterns
      if (extractedHour !== null && hour === 10) {
        hour = extractedHour;
      }

      // Get current time in WIB (GMT+7)
      const now = new Date();
      const nowWIB = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));

      // Handle relative dates (all in WIB timezone)
      if (lowerDateStr.includes('besok')) {
        const tomorrow = new Date(nowWIB);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(hour, minute, 0, 0);
        return tomorrow;
      }

      if (lowerDateStr.includes('lusa')) {
        const dayAfter = new Date(nowWIB);
        dayAfter.setDate(dayAfter.getDate() + 2);
        dayAfter.setHours(hour, minute, 0, 0);
        return dayAfter;
      }

      if (lowerDateStr.includes('minggu depan')) {
        const nextWeek = new Date(nowWIB);
        nextWeek.setDate(nextWeek.getDate() + 7);
        nextWeek.setHours(hour, minute, 0, 0);
        return nextWeek;
      }

      if (lowerDateStr.includes('bulan depan')) {
        const nextMonth = new Date(nowWIB);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        nextMonth.setHours(hour, minute, 0, 0);
        return nextMonth;
      }

      // Indonesian month names
      const monthNames = {
        'januari': 0, 'februari': 1, 'maret': 2, 'april': 3,
        'mei': 4, 'juni': 5, 'juli': 6, 'agustus': 7,
        'september': 8, 'oktober': 9, 'november': 10, 'desember': 11
      };

      // Parse DD Month YYYY (e.g., "15 Desember 2025")
      const monthPattern = /(\d{1,2})\s+(\w+)\s*(\d{4})?/i;
      const monthMatch = dateStr.match(monthPattern);
      if (monthMatch) {
        const day = parseInt(monthMatch[1]);
        const monthStr = monthMatch[2].toLowerCase();
        const year = monthMatch[3] ? parseInt(monthMatch[3]) : nowWIB.getFullYear();

        const month = monthNames[monthStr];
        if (month !== undefined && day >= 1 && day <= 31) {
          // Create date in WIB timezone with extracted time
          const date = new Date(year, month, day, hour, minute, 0, 0);
          if (!isNaN(date.getTime())) {
            console.log(`[DEBUG] Final parsed date: ${date.toISOString()} (WIB: ${date.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })})`);
            return date;
          }
        }
      }

      // Parse DD/MM/YYYY or DD-MM-YYYY
      const numericPattern = /(\d{1,2})[\/\-](\d{1,2})[\/\-]?(\d{2,4})?/;
      const numericMatch = dateStr.match(numericPattern);
      if (numericMatch) {
        const day = parseInt(numericMatch[1]);
        const month = parseInt(numericMatch[2]) - 1; // 0-indexed
        const year = numericMatch[3] ? parseInt(numericMatch[3]) : nowWIB.getFullYear();

        // Handle 2-digit years (e.g., "25" -> 2025)
        const fullYear = year < 100 ? 2000 + year : year;

        if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
          const date = new Date(fullYear, month, day, hour, minute, 0, 0);
          if (!isNaN(date.getTime())) {
            console.log(`[DEBUG] Final parsed numeric date: ${date.toISOString()} (WIB: ${date.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })})`);
            return date;
          }
        }
      }

      console.log(`[DEBUG] Date parsing failed for: "${dateStr}" with time ${hour}:${minute}`);
      return null;

    } catch (error) {
      console.error('[NovaBot] Error parsing Indonesian date:', error);
      return null;
    }
  }

  /**
   * Initialize Google Calendar integration (lazy initialization)
   */
  async initializeCalendar() {
    if (!this.calendarInitialized) {
      this.calendarInitialized = await this.calendarSync.initialize();
      if (this.calendarInitialized) {
        console.log('[NovaBot] ✅ Google Calendar integration enabled');
      } else {
        console.log('[NovaBot] ⚠️  Google Calendar integration disabled or failed');
      }
    }
  }

  // OPTIMIZATION: Async calendar initialization
  async initializeCalendarAsync() {
    if (!this.calendarInitialized) {
      setImmediate(async () => {
        try {
          await this.initializeCalendar();
        } catch (error) {
          console.error('[NovaBot] Async calendar initialization failed:', error);
        }
      });
    }
  }

  /**
   * Sync extracted dates to Google Calendar
   * Creates calendar events for meetings, ticket sales, and event days
   */
  async syncCalendarEvents() {
    // Only sync if calendar is initialized
    if (!this.calendarInitialized) {
      return;
    }

    try {
      // Sync meeting appointments
      if (this.userContext.meetingDate) {
        console.log(`[NovaBot] 📅 Creating meeting event for ${this.userId}`);
        await this.calendarSync.createMeetingEvent(
          this.userId,
          this.userContext.meetingDate,
          { notes: 'Scheduled via WhatsApp conversation' }
        );
        // Clear the date so we don't recreate it on next message
        this.userContext.meetingDate = null;
      }

      // Sync ticket sale launch dates
      if (this.userContext.ticketSaleDate) {
        console.log(`[NovaBot] 🎫 Creating ticket sale event for ${this.userId}`);
        await this.calendarSync.createTicketSaleEvent(
          this.userId,
          this.userContext.ticketSaleDate,
          { notes: 'Ticket sale date mentioned in WhatsApp conversation' }
        );
        this.userContext.ticketSaleDate = null;
      }

      // Sync event D-Day dates
      if (this.userContext.eventDayDate) {
        console.log(`[NovaBot] 🎉 Creating event day for ${this.userId}`);
        await this.calendarSync.createEventDayEvent(
          this.userId,
          this.userContext.eventDayDate,
          { notes: 'Event date mentioned in WhatsApp conversation' }
        );
        this.userContext.eventDayDate = null;
      }
    } catch (error) {
      console.error('[NovaBot] ❌ Error syncing calendar events:', error.message);
      // Don't throw - calendar sync failure shouldn't break the chat flow
    }
  }

  async resetConversation() {
    this.conversationHistory = [];
    this.userContext = {
      nama: null,
      instansi: null,
      ticketPrice: null,
      capacity: null,
      eventName: null,
      eventDate: null,
      meetingDate: null,
      ticketSaleDate: null,
      eventDayDate: null
    };

    // Reset data collection state
    this.dataCollectionState = {
      messageCount: 0,
      hasAskedEventName: false,
      hasAskedCapacity: false,
      hasAskedPrice: false,
      hasAskedName: false,
      hasAskedOrg: false,
      currentQuestionStage: 'none'
    };

    // Reset session in database
    if (this.userId) {
      try {
        await this.db.deleteSession(this.userId);
      } catch (error) {
        console.error('[NovaBot] Error resetting session:', error.message);
      }
    }
  }

  getUserContext() {
    return { ...this.userContext };
  }
}

export default NovaBot;
