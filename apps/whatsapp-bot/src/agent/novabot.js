import { ChatGroq } from "@langchain/groq";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { novatixContext, getPricing } from "../knowledge/novatix-context.js";
import { DatabaseService } from "../database/database-service.js";
import { CalendarSyncService } from "../../packages/calendar/src/calendar-sync.js";
import dotenv from 'dotenv';

dotenv.config();

/**
 * NovaBot - AI Agent for NovaTix Customer Service
 */
export class NovaBot {
  constructor(userId = null) {
    this.model = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      temperature: parseFloat(process.env.AGENT_TEMPERATURE || "0.7"),
      maxTokens: parseInt(process.env.AGENT_MAX_TOKENS || "1024")
    });

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

🎯 TAHAP 4 - TAWARKAN MEETING (setelah semua data lengkap):
Setelah data dasar lengkap (nama, organisasi, event) dan sudah diskusi sedikit tentang kebutuhan mereka, SELALU tawarkan untuk meeting/diskusi lebih lanjut.

KAPAN MENAWARKAN MEETING:
- Setelah diskusi fitur/pricing
- Setelah mereka menunjukkan ketertarikan
- Ketika ada pertanyaan yang perlu penjelasan lebih detail
- Ketika mereka bilang "tertarik" atau "pengen coba"

CARA MENAWARKAN MEETING (NATURAL & CASUAL):
Variasi yang bisa dipakai:
- "Gimana kalau kita diskusi lebih lanjut? Kapan kira-kira ada waktu untuk meeting?"
- "Biar lebih jelas, mau ngobrol langsung gak? Meeting kapan enaknya?"
- "Kalau mau bahas lebih detail, kita bisa meeting nih. Kapan aja boleh asal kasih tau dulu ya"
- "Oke noted! Nanti kita bisa ketemu untuk bahas lebih lanjut. Minggu ini ada waktu?"

⚠️ PENTING TENTANG MEETING:
- JANGAN LANGSUNG kasih tanggal/waktu meeting sendiri
- TUNGGU mereka yang kasih tau kapan mereka available
- Kalau mereka belum kasih tanggal spesifik, tanya lagi dengan casual
- Begitu mereka sebut tanggal/waktu (misalnya "besok", "15 Oktober", "minggu depan jam 2 siang"), sistem akan OTOMATIS simpan dan buat calendar event
- Kamu cukup konfirmasi: "Oke siap! Meeting [tanggal] jam [waktu] ya. Nanti aku remind lagi"

Contoh FLOW LENGKAP dengan Meeting:
Client: "Mau bikin musik festival"
Bot: "Wah seru! Musik festival pasti rame. Kira-kira kapasitasnya berapa orang ya? Sama tiketnya mau dijual berapa?"

Client: "Kapasitas 1000 orang, tiket 150rb"
Bot: "Oke noted! Kapasitas 1000 pax dengan harga tiket 150rb. Untuk pricing NovaTix ada 2 skema: Persenan atau Flat. Gimana kalau kita diskusi lebih lanjut? Kapan kira-kira ada waktu untuk meeting?"

Client: "Besok jam 2 siang bisa?"
Bot: "Oke siap! Meeting besok jam 2 siang ya. Nanti aku remind lagi. Kita bisa diskusi lebih detail tentang fitur-fitur yang cocok untuk musik festival kamu"

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
Client: "Halo, mau tanya tentang NovaTix"
Bot: "Terima kasih sudah menghubungi NovaTix. Mohon berikan informasi berikut:
1. Nama Anda
2. Nama organisasi
3. Nama event"
→ Ini terdengar seperti robot/formulir! JANGAN seperti ini!

✅ Contoh BENAR 1 (Alur lengkap dari awal):
Client: "Halo, mau tanya tentang NovaTix"
Bot: "Hai! Ada yang bisa aku bantu tentang NovaTix?"

Client: "Iya, mau tau fiturnya apa aja"
Bot: "Siap! NovaTix ini platform ticketing untuk event yang punya fitur kelola tiket, payment gateway, analitik penjualan, dll. Oh iya, boleh kenalan dulu? Siapa nama kamu?"

Client: "Nama aku Budi"
Bot: "Hai Budi! Kamu dari organisasi/EO mana ya?"

Client: "Dari Citraland Event Organizer"
Bot: "Oke noted, Citraland EO. Boleh tau event apa yang lagi diplan nih?"

Client: "Mau bikin musik festival"
Bot: "Wah seru! Musik festival pasti rame. Kira-kira kapasitasnya berapa orang ya? Sama tiketnya mau dijual berapa?"

Client: "1000 orang, tiket 150rb"
Bot: "Noted! Gimana kalau kita meeting untuk bahas lebih detail? Kapan aja boleh asal kasih tau dulu"
[Data CRM sudah lengkap: Nama, Organisasi, Event. Sudah tanya detail kapasitas/harga. Sekarang tawarkan meeting]

✅ Contoh BENAR 2 (Client langsung tanya pricing):
Client: "Harganya berapa ya untuk pakai NovaTix?"
Bot: "Hai! Senang bisa bantu. Untuk pricing tergantung dari event dan kapasitas. Btw, boleh kenalan dulu? Nama kamu siapa?"

Client: "Sinta"
Bot: "Hai Sinta! Dari organisasi mana nih?"

Client: "Dari kampus, BEM UI"
Bot: "Oke BEM UI. Eventnya apa yang mau pakai ticketing?"

Client: "Event seminar teknologi"
Bot: "Noted! Untuk seminar teknologi, kira-kira tiketnya dijual berapa dan kapasitasnya berapa orang? Biar aku bisa kasih pricing yang sesuai"

Client: "500 orang, tiket 50rb"
Bot: "Oke siap! Untuk event dengan kapasitas 500 pax dan harga 50rb, ada 2 skema pricing. Kalau mau bahas lebih detail, kita bisa meeting nih. Kapan enaknya?"
[URUTAN: Nama → Org → Event → Detail → Tawarkan Meeting]

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
  buildDataCollectionGuidance() {
    const { messageCount, currentQuestionStage } = this.dataCollectionState;
    let guidance = "\n\n[PANDUAN DATA COLLECTION - SEQUENTIAL QUESTIONING]";

    // For new leads, we need to collect: Nama -> Instansi -> Event (in that order)
    // Each question should be in a separate chat bubble for natural flow

    // Stage 1: Ask for Name (after initial greeting/inquiry - around message 2-3)
    if (messageCount >= 2 && !this.userContext.nama && currentQuestionStage !== 'waiting_name') {
      guidance += "\n\n🎯 PERTANYAAN BERIKUTNYA: NAMA CLIENT";
      guidance += "\nSetelah jawab pertanyaan awal mereka, sekarang waktunya kenalan dengan tanya nama.";
      guidance += "\n\nPILIH SALAH SATU variasi (jangan pakai yang sama terus):";
      guidance += "\n- 'Oh iya, boleh kenalan dulu? Siapa nama kamu?'";
      guidance += "\n- 'Btw, aku boleh tau nama kamu siapa?'";
      guidance += "\n- 'Sebelum lanjut, boleh tau panggilannya siapa ya?'";
      guidance += "\n- 'Aku tanya dulu ya, nama kamu siapa?'";
      guidance += "\n\n⚠️ PENTING: HANYA tanya nama saja di bubble chat ini. JANGAN tanya yang lain!";
      guidance += "\n⚠️ Tunggu mereka jawab dulu sebelum lanjut ke pertanyaan berikutnya.";

      this.dataCollectionState.currentQuestionStage = 'waiting_name';
      return guidance;
    }

    // Stage 2: Ask for Organization (after we got the name)
    if (this.userContext.nama && !this.userContext.instansi && currentQuestionStage !== 'waiting_org') {
      guidance += "\n\n🎯 PERTANYAAN BERIKUTNYA: ORGANISASI/INSTANSI";
      guidance += `\nOke sudah dapat nama: ${this.userContext.nama}. Sekarang tanya instansi mereka.`;
      guidance += "\n\nPILIH SALAH SATU variasi:";
      guidance += `\n- 'Hai ${this.userContext.nama}! Kamu dari organisasi/EO mana ya?'`;
      guidance += `\n- 'Senang kenalan ${this.userContext.nama}. Boleh tau dari instansi mana?'`;
      guidance += `\n- 'Oke ${this.userContext.nama}, kamu represent organisasi apa nih?'`;
      guidance += `\n- '${this.userContext.nama} dari tim/organisasi mana ya?'`;
      guidance += "\n\n⚠️ PENTING: HANYA tanya organisasi/instansi di bubble chat ini. JANGAN tanya yang lain!";
      guidance += "\n⚠️ Tunggu mereka jawab dulu sebelum lanjut ke pertanyaan berikutnya.";

      this.dataCollectionState.currentQuestionStage = 'waiting_org';
      return guidance;
    }

    // Stage 3: Ask for Event Name (after we got name and organization)
    if (this.userContext.nama && this.userContext.instansi && !this.userContext.eventName && currentQuestionStage !== 'waiting_event') {
      guidance += "\n\n🎯 PERTANYAAN BERIKUTNYA: NAMA EVENT";
      guidance += `\nSudah dapat: Nama (${this.userContext.nama}) dan Organisasi (${this.userContext.instansi}).`;
      guidance += "\nSekarang tanya event yang mereka plan.";
      guidance += "\n\nPILIH SALAH SATU variasi:";
      guidance += "\n- 'Boleh tau event apa yang lagi diplan nih?'";
      guidance += "\n- 'Eventnya tentang apa ya? Boleh cerita sedikit?'";
      guidance += "\n- 'Oke noted. Event apa yang mau dikerjain?'";
      guidance += "\n- 'Nah, untuk event yang mana nih yang butuh ticketing?'";
      guidance += "\n\n⚠️ PENTING: HANYA tanya nama event di bubble chat ini. JANGAN tanya yang lain!";
      guidance += "\n⚠️ Kalau mereka juga kasih info kapasitas/harga, bagus! Tapi fokus dulu ke event name.";

      this.dataCollectionState.currentQuestionStage = 'waiting_event';
      return guidance;
    }

    // All basic data collected - now can ask optional details if needed
    if (this.userContext.nama && this.userContext.instansi && this.userContext.eventName) {
      guidance += "\n\n✅ DATA DASAR SUDAH LENGKAP!";
      guidance += `\n- Nama: ${this.userContext.nama}`;
      guidance += `\n- Organisasi: ${this.userContext.instansi}`;
      guidance += `\n- Event: ${this.userContext.eventName}`;

      // Check if we need capacity/price for pricing discussion
      const missingOptional = [];
      if (!this.userContext.capacity) missingOptional.push("kapasitas");
      if (!this.userContext.ticketPrice) missingOptional.push("harga tiket");

      if (missingOptional.length > 0) {
        guidance += `\n\nData optional yang masih bisa ditanya (kalau konteks pas): ${missingOptional.join(', ')}`;
        guidance += "\nContoh: Kalau mereka nanya pricing, baru tanya 'Untuk pricing, kira-kira kapasitas venue berapa dan tiketnya mau dijual berapa?'";
      } else {
        guidance += "\n\n🎉 SEMUA DATA LENGKAP! Sekarang fokus bantu client dengan kebutuhan mereka.";
      }

      // ⭐ NEW: Suggest offering a meeting after data is complete and some discussion has happened
      // Changed from messageCount >= 6 to >= 4 to offer meeting sooner
      if (messageCount >= 4 && !this.userContext.meetingDate) {
        guidance += "\n\n📅 SAATNYA TAWARKAN MEETING!";
        guidance += "\nData sudah lengkap dan sudah ada diskusi. Sekarang waktunya tawarkan meeting untuk diskusi lebih lanjut.";
        guidance += "\n\nPILIH SALAH SATU variasi (natural & casual):";
        guidance += "\n- 'Gimana kalau kita diskusi lebih lanjut? Kapan kira-kira ada waktu untuk meeting?'";
        guidance += "\n- 'Biar lebih jelas, mau ngobrol langsung gak? Meeting kapan enaknya?'";
        guidance += "\n- 'Kalau mau bahas lebih detail, kita bisa meeting nih. Minggu ini ada waktu?'";
        guidance += "\n- 'Oke noted! Mau ketemu untuk bahas lebih lanjut? Kapan aja boleh asal kasih tau dulu'";
        guidance += "\n\n⚠️ PENTING:";
        guidance += "\n- JANGAN kasih tanggal/waktu sendiri, TUNGGU mereka yang kasih tau";
        guidance += "\n- Begitu mereka sebut tanggal (contoh: 'besok', '15 Oktober', 'minggu depan jam 2'), sistem akan otomatis simpan";
        guidance += "\n- Kamu cukup konfirmasi: 'Oke siap! Meeting [tanggal] jam [waktu] ya'";
        guidance += "\n\n🚫 CRITICAL: JANGAN bahas MoU/kontrak sebelum meeting dijadwalkan!";

        this.dataCollectionState.currentQuestionStage = 'offering_meeting';
      } else if (this.userContext.meetingDate) {
        guidance += "\n\n✅ MEETING SUDAH DIJADWALKAN!";
        guidance += `\nMeeting date: ${this.userContext.meetingDate}`;
        guidance += "\nFokus membantu client dengan pertanyaan mereka dan persiapan meeting.";
        guidance += "\n\n⚠️ KALAU mereka tanya tentang MoU/kontrak:";
        guidance += "\n- Bilang: 'Nanti kita finalisasi pas meeting ya!'";
        guidance += "\n- Jangan langsung kirim template MoU atau bilang 'siap sign kontrak'";
        guidance += "\n- Meeting dulu, BARU MoU!";
      }

      if (!this.dataCollectionState.currentQuestionStage || this.dataCollectionState.currentQuestionStage === 'waiting_event') {
        this.dataCollectionState.currentQuestionStage = 'complete';
      }
    }

    guidance += `\n\nMessage count: ${messageCount} | Current stage: ${currentQuestionStage}`;

    return guidance;
  }

  async chat(userMessage) {
    // Increment message count
    this.dataCollectionState.messageCount++;

    // Extract price and capacity from message if available
    this.extractContextFromMessage(userMessage);

    // Initialize calendar if not already done (lazy initialization)
    await this.initializeCalendar();

    // Sync calendar events if dates were extracted
    await this.syncCalendarEvents();

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
    let additionalContext = dataCollectionGuidance;
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
5. JANGAN tambahkan perhitungan matematis atau contoh nominal]`;
    }

    try {
      // Call Groq model
      const response = await this.model.invoke([
        ...messages,
        ...(additionalContext ? [{ role: "system", content: additionalContext }] : [])
      ]);

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

      // Save to database if userId is set
      if (this.userId) {
        try {
          await this.db.saveConversation(
            this.userId,
            userMessage,
            botResponse,
            toolsUsed,
            { ...this.userContext }
          );

          // Update user info if we have any context data
          const updateData = {};
          if (this.userContext.nama) updateData.nama = this.userContext.nama;
          if (this.userContext.instansi) updateData.instansi = this.userContext.instansi;
          if (this.userContext.ticketPrice) updateData.ticketPrice = this.userContext.ticketPrice;
          if (this.userContext.capacity) updateData.capacity = this.userContext.capacity;
          if (this.userContext.eventName) updateData.event = this.userContext.eventName;

          if (Object.keys(updateData).length > 0) {
            await this.db.updateUser(this.userId, updateData);
          }

          // Update session
          await this.db.updateSession(this.userId, this.userContext, true);
        } catch (dbError) {
          console.error('[NovaBot] Database error (non-fatal):', dbError.message);
          // Don't throw - let conversation continue even if DB fails
        }
      }

      return botResponse;
    } catch (error) {
      console.error("Error calling Groq:", error);
      throw new Error("Maaf, saya mengalami kendala teknis. Silakan coba lagi.");
    }
  }

  extractContextFromMessage(message) {
    const lowerMessage = message.toLowerCase();

    // Extract name (nama saya X, nama gue X, namaku X, perkenalkan X)
    // IMPORTANT: Only extract if we don't have a name yet
    if (!this.userContext.nama) {
      const namePatterns = [
        // Explicit name introduction patterns
        /(?:nama saya|nama gue|nama aku|namaku|nama ku)\s+(?:adalah\s+)?([A-Za-z\s]+?)(?:\s+dari|\s+nih|\s|$|,|\.)/i,
        /(?:perkenalkan|perkenalkan nama saya|perkenalkan aku)\s+([A-Za-z\s]+?)(?:\s+dari|\s|$|,|\.)/i,
        /(?:saya|aku|gue|gw)\s+([A-Za-z]+)(?:\s+dari|\s+nih)(?:\s|$)/i,
        // Pattern: "halo <name> disini" or "<name> dari <org>"
        /^(?:halo|hai)?\s*([A-Za-z]+)\s+(?:dari|disini|here)/i
      ];

      for (const pattern of namePatterns) {
        const nameMatch = message.match(pattern);
        if (nameMatch && nameMatch[1]) {
          const nama = nameMatch[1].trim();
          // Filter out common words that might be mistakenly captured
          const excludeWords = ['mau', 'ingin', 'butuh', 'perlu', 'tanya', 'adalah', 'dari', 'di', 'ke', 'bisa', 'pusing', 'senang'];
          if (nama.length > 2 && !excludeWords.includes(nama.toLowerCase())) {
            this.userContext.nama = nama;
            console.log(`[DEBUG] Extracted name: ${nama}`);
            break;
          }
        }
      }
    }

    // Extract instansi/perusahaan
    if (!this.userContext.instansi) {
      const instansiPatterns = [
        /(?:organisasi|instansi|perusahaan)\s+([A-Za-z0-9\s]+?)(?:\s+ingin|\s+mau|\s+butuh|\s+yang|$|,|\.)/i,
        /(?:dari|bekerja di)\s+(?:organisasi|instansi|perusahaan)?\s*([A-Za-z0-9\s]+?)(?:\s+ingin|\s+mau|\s+butuh|\s+yang|$|,|\.)/i,
        /(?:saya dari)\s+([A-Za-z0-9\s]+?)(?:\s+ingin|\s+mau|\s+butuh|\s+yang|$|,|\.)/i
      ];

      for (const pattern of instansiPatterns) {
        const instansiMatch = message.match(pattern);
        if (instansiMatch && instansiMatch[1]) {
          let instansi = instansiMatch[1].trim();

          // Clean up common trailing words
          const cleanWords = ['saya', 'kami', 'kita', 'ini', 'itu'];
          const words = instansi.split(' ');
          const filteredWords = words.filter(w => !cleanWords.includes(w.toLowerCase()));
          instansi = filteredWords.join(' ');

          if (instansi.length > 2) {
            this.userContext.instansi = instansi;
            console.log(`[DEBUG] Extracted instansi: ${instansi}`);
            break;
          }
        }
      }
    }

    // Extract event name
    if (!this.userContext.eventName) {
      const eventPatterns = [
        // Explicit event patterns with keywords
        /(?:event|acara|kegiatan)\s+(?:bernama|dengan nama|namanya)?\s*([A-Za-z0-9\s]+?)(?:\s+dengan|\s+harga|\s+untuk|\s+yang|$|,|\.)/i,
        /(?:mengadakan|menyelenggarakan|membuat)\s+(?:event|acara)?\s*([A-Za-z0-9\s]+?)(?:\s+dengan|\s+harga|\s+untuk|\s+yang|$|,|\.)/i,
        /(?:untuk|buat)\s+(?:event|acara)\s+([A-Za-z0-9\s]+?)(?:\s+dengan|\s+harga|\s+untuk|\s+yang|$|,|\.)/i
      ];

      for (const pattern of eventPatterns) {
        const eventMatch = message.match(pattern);
        if (eventMatch && eventMatch[1]) {
          let eventName = eventMatch[1].trim();

          // Clean up common trailing words
          const cleanWords = ['saya', 'kami', 'kita', 'ini', 'itu', 'yang', 'dengan'];
          const words = eventName.split(' ');
          const filteredWords = words.filter(w => !cleanWords.includes(w.toLowerCase()));
          eventName = filteredWords.join(' ');

          if (eventName.length > 3) {
            this.userContext.eventName = eventName;
            console.log(`[DEBUG] Extracted event name: ${eventName}`);
            break;
          }
        }
      }

      // FALLBACK: If bot just asked about event and user responds with just a name
      // Detect standalone event names (capitalized words/numbers suggesting an event title)
      // Only if message is short (< 50 chars) and we have name+org already
      if (!this.userContext.eventName && this.userContext.nama && this.userContext.instansi) {
        const trimmed = message.trim();
        // Check if message looks like an event name (has capital letters or numbers, not too long)
        if (trimmed.length < 50 && trimmed.length > 3 && /[A-Z0-9]/.test(trimmed)) {
          // Exclude common words that might be mistaken as event names
          const excludePhrases = ['oke', 'baik', 'boleh', 'ya', 'tidak', 'nggak', 'belum', 'sudah', 'siap', 'ok'];
          const isExcluded = excludePhrases.some(phrase => lowerMessage.includes(phrase));

          if (!isExcluded) {
            this.userContext.eventName = trimmed;
            console.log(`[DEBUG] Extracted event name (fallback): ${trimmed}`);
          }
        }
      }
    }

    // Extract price with support for "k", "rb", "ribu", "juta"
    // Look for price near keywords: harga, tiket, biaya, rp
    // Always try to extract if message contains price-related keywords
    if (lowerMessage.includes('harga') || lowerMessage.includes('tiket') || lowerMessage.includes('biaya') || lowerMessage.includes('rp')) {
      const pricePatterns = [
        /(?:harga|tiket|biaya|rp)[^\d]*(\d+[.,]?\d*)\s?(k|rb|ribu|juta|rupiah)?/i,
        /(\d+[.,]?\d*)\s?(k|rb|ribu|juta|rupiah)(?=.*(?:harga|tiket|biaya))/i
      ];

      for (const pattern of pricePatterns) {
        const priceMatch = message.match(pattern);
        if (priceMatch) {
          let price = parseInt(priceMatch[1].replace(/[.,]/g, ''));
          const unit = priceMatch[2]?.toLowerCase();

          // Convert to actual value
          if (unit === 'k' || unit === 'rb' || unit === 'ribu') {
            price = price * 1000;
          } else if (unit === 'juta') {
            price = price * 1000000;
          }

          // Only set if it looks like a reasonable ticket price (> 1000)
          if (price > 1000) {
            // Update price even if already set (allows user to change their mind)
            if (this.userContext.ticketPrice && this.userContext.ticketPrice !== price) {
              console.log(`[DEBUG] Updating ticket price from ${this.userContext.ticketPrice} to ${price}`);
            } else {
              console.log(`[DEBUG] Extracted ticket price: ${price}`);
            }
            this.userContext.ticketPrice = price;
            break;
          }
        }
      }
    }

    // Extract capacity - look for numbers near capacity-related keywords
    // Always try to extract if message contains capacity-related keywords
    if (lowerMessage.includes('kapasitas') || lowerMessage.includes('orang') || lowerMessage.includes('penonton') || lowerMessage.includes('pax') || lowerMessage.includes('kursi') || lowerMessage.includes('jumlah')) {
      const capacityPatterns = [
        /(?:kapasitas|jumlah)[^\d]*(\d+[.,]?\d*)\s?(?:orang|pax|penonton|kursi)?/i,
        /(?:ditonton|dihadiri)[^\d]*(\d+[.,]?\d*)\s?(?:orang|pax|penonton)?/i,
        /(\d+[.,]?\d*)\s?(?:orang|pax|penonton|kursi)/i
      ];

      for (const pattern of capacityPatterns) {
        const capacityMatch = message.match(pattern);
        if (capacityMatch) {
          const capacity = parseInt(capacityMatch[1].replace(/[.,]/g, ''));

          // Only set if it looks like a reasonable capacity (between 10 and 100000)
          // AND it's different from the ticket price (to avoid confusion)
          if (capacity >= 10 && capacity <= 100000 && capacity !== this.userContext.ticketPrice) {
            // Update capacity even if already set (allows user to change their mind)
            if (this.userContext.capacity && this.userContext.capacity !== capacity) {
              console.log(`[DEBUG] Updating capacity from ${this.userContext.capacity} to ${capacity}`);
            } else {
              console.log(`[DEBUG] Extracted capacity: ${capacity}`);
            }
            this.userContext.capacity = capacity;
            break;
          }
        }
      }
    }

    // FALLBACK: Extract standalone numbers as capacity after event name is known
    // This handles responses like "1500" when bot asks about capacity
    if (!this.userContext.capacity && this.userContext.eventName) {
      const standaloneNumberMatch = message.match(/^(\d+[.,]?\d*)$/);
      if (standaloneNumberMatch) {
        const capacity = parseInt(standaloneNumberMatch[1].replace(/[.,]/g, ''));

        // Reasonable capacity range and different from ticket price
        if (capacity >= 10 && capacity <= 100000 && capacity !== this.userContext.ticketPrice) {
          this.userContext.capacity = capacity;
          console.log(`[DEBUG] Extracted capacity (fallback): ${capacity}`);
        }
      }
    }

    // Extract dates for calendar events (3 flows)
    // Flow 1: Meeting appointment dates
    const meetingPatterns = [
      /(?:meeting|rapat|bertemu|diskusi|consultation)\s+(?:tanggal|pada|di)?\s*(\d{1,2})[\/\-\s](\d{1,2})[\/\-\s]?(\d{2,4})?/i,
      /(?:meeting|rapat|bertemu)\s+(?:besok|lusa|minggu depan|bulan depan)/i,
      /(?:meeting|rapat|bertemu)(?:nya)?\s+(?:besok|lusa|minggu depan|bulan depan)/i,
      /(?:jadwal|schedule)\s+(?:meeting|rapat)\s+(\d{1,2})\s+(\w+)/i
    ];

    for (const pattern of meetingPatterns) {
      const match = message.match(pattern);
      if (match) {
        const dateStr = match[0];
        const parsedDate = this.parseIndonesianDate(dateStr, message);
        if (parsedDate) {
          this.userContext.meetingDate = parsedDate;
          console.log(`[DEBUG] Extracted meeting date: ${parsedDate}`);
          break;
        }
      }
    }

    // Flow 2: Ticket sale start dates
    const ticketSalePatterns = [
      /(?:tiket|ticket)\s+(?:sale|mulai dijual|dibuka|launching)\s+(?:tanggal|pada|di)?\s*(\d{1,2})[\/\-\s](\d{1,2})[\/\-\s]?(\d{2,4})?/i,
      /(?:penjualan tiket|ticket sale)\s+(?:tanggal|pada|di)?\s*(\d{1,2})[\/\-\s](\d{1,2})[\/\-\s]?(\d{2,4})?/i,
      /(?:open sale|pre sale|early bird)\s+(\d{1,2})\s+(\w+)/i
    ];

    for (const pattern of ticketSalePatterns) {
      const match = message.match(pattern);
      if (match) {
        const dateStr = match[0];
        const parsedDate = this.parseIndonesianDate(dateStr, message);
        if (parsedDate) {
          this.userContext.ticketSaleDate = parsedDate;
          console.log(`[DEBUG] Extracted ticket sale date: ${parsedDate}`);
          break;
        }
      }
    }

    // Flow 3: Event D-Day dates
    const eventDayPatterns = [
      /(?:event|acara|konser|festival)\s+(?:tanggal|pada|di)?\s*(\d{1,2})[\/\-\s](\d{1,2})[\/\-\s]?(\d{2,4})?/i,
      /(?:d-day|hari H|pelaksanaan)\s+(?:tanggal|pada|di)?\s*(\d{1,2})[\/\-\s](\d{1,2})[\/\-\s]?(\d{2,4})?/i,
      /(?:tanggal|jadwal)\s+(\d{1,2})\s+(\w+)\s+(\d{4})/i
    ];

    for (const pattern of eventDayPatterns) {
      const match = message.match(pattern);
      if (match) {
        const dateStr = match[0];
        const parsedDate = this.parseIndonesianDate(dateStr, message);
        if (parsedDate) {
          this.userContext.eventDayDate = parsedDate;
          console.log(`[DEBUG] Extracted event day date: ${parsedDate}`);
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
  parseIndonesianDate(dateStr, fullMessage) {
    try {
      const lowerDateStr = dateStr.toLowerCase();
      const lowerMessage = fullMessage.toLowerCase();

      // Extract time from the full message (look for "jam HH:MM" or "HH:MM")
      let hour = 10; // Default 10 AM WIB
      let minute = 0;

      const timePatterns = [
        /jam\s+(\d{1,2})[:\.](\d{2})/i,        // "jam 10:00" or "jam 10.00"
        /jam\s+(\d{1,2})\s*(?:wib|wit|wita)?/i, // "jam 10 WIB" or just "jam 10"
        /pukul\s+(\d{1,2})[:\.](\d{2})/i,      // "pukul 10:00"
        /pukul\s+(\d{1,2})\s*(?:wib|wit|wita)?/i, // "pukul 10"
        /(\d{1,2})[:\.](\d{2})\s*(?:wib|wit|wita)/i  // "10:00 WIB"
      ];

      for (const pattern of timePatterns) {
        const timeMatch = lowerMessage.match(pattern);
        if (timeMatch) {
          hour = parseInt(timeMatch[1]);
          minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;

          // Validate hour and minute
          if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
            console.log(`[DEBUG] Extracted time: ${hour}:${minute.toString().padStart(2, '0')} WIB`);
            break;
          }
        }
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
        const year = numericMatch[3] ?
          (numericMatch[3].length === 2 ? 2000 + parseInt(numericMatch[3]) : parseInt(numericMatch[3])) :
          nowWIB.getFullYear();

        if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
          // Create date in WIB timezone with extracted time
          const date = new Date(year, month, day, hour, minute, 0, 0);
          if (!isNaN(date.getTime())) {
            return date;
          }
        }
      }

      return null;
    } catch (error) {
      console.error('[DEBUG] Error parsing date:', error);
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
