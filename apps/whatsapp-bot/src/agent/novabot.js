import { ChatGroq } from "@langchain/groq";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { novatixContext, getPricing } from "../knowledge/novatix-context.js";
import { DatabaseService } from "../database/database-service.js";
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
    this.conversationHistory = [];
    this.userContext = {
      nama: null,
      instansi: null,
      ticketPrice: null,
      capacity: null,
      eventName: null,
      eventDate: null
    };

    this.systemPrompt = this.buildSystemPrompt();
  }

  buildSystemPrompt() {
    const featuresText = novatixContext.features.main
      .map((f, i) => `${i + 1}. ${f.name}: ${f.description}`)
      .join('\n');

    return `Kamu adalah NovaBot, asisten virtual yang ramah dan profesional untuk NovaTix - platform ticketing untuk Event Organizer (EO).

INFORMASI NOVATIX:
${novatixContext.companyInfo.description}

FITUR UTAMA NOVATIX:
${featuresText}

SKEMA PRICING:
Kami memiliki 2 skema pricing:
1. PERSENAN (% dari harga tiket)
2. FLAT (biaya tetap per tiket)

Pricing ditentukan berdasarkan:
- Harga tiket (Rp 0-50rb, Rp 50rb-250rb, Rp 250rb+)
- Kapasitas venue (0-750 pax, 750-1500 pax, 1500+ pax)

PANDUAN PERCAKAPAN:
1. Sambut client dengan ramah
2. Tanyakan kebutuhan mereka (fitur, pricing, panduan penggunaan)
3. Jika membahas pricing:
   - Tanyakan estimasi HARGA TIKET terlebih dahulu
   - Kemudian tanyakan KAPASITAS venue
   - Setelah kedua data lengkap, tunggu data pricing dari sistem
   - Berikan HANYA angka yang diberikan sistem, JANGAN hitung sendiri!
4. Berikan penjelasan detail jika ada pertanyaan lanjutan
5. Jika ditanya cara penggunaan, berikan step-by-step guide

ATURAN PRICING (WAJIB!):
- HANYA gunakan angka pricing yang diberikan oleh sistem dalam [INTERNAL] message
- JANGAN pernah menghitung sendiri atau mengubah angka pricing
- JANGAN memberikan contoh perhitungan matematis (misal: "10% x 75.000 = ...")
- Cukup sampaikan: "Skema Persenan: X% dari harga tiket" dan "Skema Flat: Rp X per tiket"
- Biarkan client yang menghitung sendiri jika mereka butuh

PENTING:
- Selalu gunakan bahasa Indonesia yang ramah dan profesional
- Jika client memberikan angka, ekstrak nilai numeriknya (80.000 atau 80000 sama saja)
- Jangan mengira-ngira harga atau kapasitas, SELALU tanya jika belum ada
- Untuk pricing, tunggu hingga KEDUA informasi (harga tiket DAN kapasitas) tersedia
- Berikan respons yang singkat dan jelas, tidak bertele-tele
- Jika ada pertanyaan di luar konteks NovaTix, arahkan kembali ke topik ticketing

Jawab pertanyaan berikut dengan konteks percakapan sebelumnya.`;
  }

  async chat(userMessage) {
    // Extract price and capacity from message if available
    this.extractContextFromMessage(userMessage);

    // Build conversation history
    const messages = [
      { role: "system", content: this.systemPrompt },
      ...this.conversationHistory,
      { role: "user", content: userMessage }
    ];

    // Track tools used
    const toolsUsed = [];

    // Check if we have pricing info to provide
    let additionalContext = "";
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

    // Extract name (nama saya X, saya X, perkenalkan nama saya X)
    if (!this.userContext.nama) {
      const namePatterns = [
        /(?:nama saya|saya|perkenalkan|perkenalkan nama saya|namaku)\s+(?:adalah\s+)?([A-Za-z\s]+?)(?:\s|$|,|\.)/i,
        /^([A-Za-z]+)\s+(?:dari|here|disini)/i
      ];

      for (const pattern of namePatterns) {
        const nameMatch = message.match(pattern);
        if (nameMatch && nameMatch[1]) {
          const nama = nameMatch[1].trim();
          // Filter out common words
          const excludeWords = ['mau', 'ingin', 'butuh', 'perlu', 'tanya', 'adalah', 'dari', 'di', 'ke'];
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
  }

  async resetConversation() {
    this.conversationHistory = [];
    this.userContext = {
      nama: null,
      instansi: null,
      ticketPrice: null,
      capacity: null,
      eventName: null,
      eventDate: null
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
