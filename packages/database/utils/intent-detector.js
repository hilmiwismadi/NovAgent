/**
 * Intent Detector for Natural Language Commands
 * Detects user intent from casual Indonesian chat using LLM
 */

import { ChatGroq } from "@langchain/groq";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import dotenv from 'dotenv';

dotenv.config();

export class IntentDetector {
  constructor() {
    // Initialize LLM for intent detection
    this.model = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      temperature: parseFloat(process.env.AGENT_TEMPERATURE || "0.3"), // Lower temp for consistent classification
      maxTokens: parseInt(process.env.AGENT_MAX_TOKENS || "256")
    });

    // Intent categories for classification
    this.intentCategories = {
      stats: 'statistik, overview, performa, conversion rate, total client, jumlah client',
      clients: 'daftar client, list client, semua client, lihat client, client apa saja',
      leads: 'daftar lead, list lead, prospect, calon client, yang belum deal, yang masih prospect',
      deals: 'berapa deal, daftar deal, yang sudah deal, negosiasi, yang lagi nego, client deal',
      today: 'aktivitas hari ini, update hari ini, report hari ini, laporan hari ini, client baru hari ini',
      active: 'client aktif, sedang chat, online, sesi aktif, yang lagi aktif',
      events: 'daftar event, list event, semua event, lihat event, event apa saja',
      search: 'cari client, search client, find client, cari nama, cari instansi, cari organisasi',
      clientDetail: 'info client, detail client, data client, siapa itu, gimana client, bagaimana client',
      history: 'riwayat chat, history percakapan, chat dengan, pernah bicara, percakapan dengan',
      pricing: 'harga, pricing, budget, biaya, range harga, filter harga, client dengan harga',
      help: 'bantuan, help, gimana cara, bagaimana cara, bisa tanya apa, tolong, butuh bantuan'
    };

    // Create intent classification prompt
    let systemPrompt = 'Kamu adalah AI classifier untuk mendeteksi intent dari pesan Bahasa Indonesia yang casual.\n\n' +
      'KATEGORI INTENT YANG TERSEDIA:\n' +
      '- stats: statistik, overview, performa, conversion rate, total client, jumlah client\n' +
      '- clients: daftar client, list client, semua client, lihat client, client apa saja\n' +
      '- leads: daftar lead, list lead, prospect, calon client, yang belum deal, yang masih prospect\n' +
      '- deals: berapa deal, daftar deal, yang sudah deal, negosiasi, yang lagi nego, client deal\n' +
      '- today: aktivitas hari ini, update hari ini, report hari ini, laporan hari ini, client baru hari ini\n' +
      '- active: client aktif, sedang chat, online, sesi aktif, yang lagi aktif\n' +
      '- events: daftar event, list event, semua event, lihat event, event apa saja\n' +
      '- search: cari client, search client, find client, cari nama, cari instansi, cari organisasi\n' +
      '- clientDetail: info client, detail client, data client, siapa itu, gimana client, bagaimana client\n' +
      '- history: riwayat chat, history percakapan, chat dengan, pernah bicara, percakapan dengan\n' +
      '- pricing: harga, pricing, budget, biaya, range harga, filter harga, client dengan harga\n' +
      '- help: bantuan, help, gimana cara, bagaimana cara, bisa tanya apa, tolong, butuh bantuan\n\n' +
      'RESPON DALAM FORMAT JSON:\n' +
      '{\n' +
      '  "intent": "nama_intent",\n' +
      '  "confidence": 0.9,\n' +
      '  "entities": {\n' +
      '    "searchTerm": "jika ada pencarian",\n' +
      '    "clientId": "jika ada identitas client",\n' +
      '    "minPrice": "jika ada harga minimum",\n' +
      '    "maxPrice": "jika ada harga maksimum"\n' +
      '  }\n' +
      '}\n\n' +
      'CONTOH:\n' +
      'Pesan: "Berapa jumlah client kita?"\n' +
      'Response: {"intent": "stats", "confidence": 0.95, "entities": {}}\n\n' +
      'Pesan: "Cari client dari PT Maju Jaya"\n' +
      'Response: {"intent": "search", "confidence": 0.9, "entities": {"searchTerm": "PT Maju Jaya"}}\n\n' +
      'Pesan: "Riwayat chat dengan Budi"\n' +
      'Response: {"intent": "history", "confidence": 0.9, "entities": {"clientId": "Budi"}}\n\n' +
      'Pesan: "Client dengan harga 50k-100k"\n' +
      'Response: {"intent": "pricing", "confidence": 0.9, "entities": {"minPrice": 50000, "maxPrice": 100000}}\n\n' +
      'Petunjuk:\n' +
      '- Deteksi intent dengan confidence 0.6-1.0\n' +
      '- Extract entities jika relevan (nama client, harga, dll)\n' +
      '- Jika pesan tidak jelas, beri confidence rendah\n' +
      '- Jika pesan dimulai dengan "/", itu adalah command intent';

    this.intentPrompt = ChatPromptTemplate.fromMessages([
      ["system", systemPrompt],
      ["human", "Pesan: {message}\n\nResponse:"]
    ]);

    this.outputParser = new StringOutputParser();
    this.intentChain = this.intentPrompt.pipe(this.model).pipe(this.outputParser);
  }

  /**
   * Detect intent from natural language message using LLM
   * @param {string} message - User message
   * @returns {Object} { intent: string, confidence: number, entities: Object }
   */
  async detectIntent(message) {
    // Normalize whitespace: replace multiple spaces with single space
    message = message.replace(/\s+/g, ' ').trim();
    const lowerMessage = message.toLowerCase();

    // Check if message is a slash command (skip LLM)
    if (lowerMessage.startsWith('/')) {
      return { intent: 'command', confidence: 1.0, command: lowerMessage.split(/\s+/)[0] };
    }

    try {
      // Use LLM to detect intent
      const response = await this.intentChain.invoke({ message });

      // Parse JSON response from LLM
      const result = JSON.parse(response);

      // Validate and normalize the result
      return {
        intent: result.intent || 'unknown',
        confidence: Math.min(Math.max(result.confidence || 0.6, 0.6), 1.0),
        entities: result.entities || {}
      };
    } catch (error) {
      console.error('Error detecting intent with LLM:', error);

      // Fallback to basic keyword matching
      return this.fallbackIntentDetection(message);
    }
  }

  /**
   * Fallback intent detection using basic keywords
   * @param {string} message - User message
   * @returns {Object} { intent: string, confidence: number, entities: Object }
   */
  fallbackIntentDetection(message) {
    const lowerMessage = message.toLowerCase();

    // Basic keyword matching as fallback
    for (const [intent, keywords] of Object.entries(this.intentCategories)) {
      if (keywords.split(', ').some(keyword => lowerMessage.includes(keyword.trim()))) {
        return {
          intent,
          confidence: 0.6,
          entities: this.extractBasicEntities(message, intent)
        };
      }
    }

    return {
      intent: 'unknown',
      confidence: 0.5,
      entities: {}
    };
  }

  /**
   * Basic entity extraction for fallback
   * @param {string} message - User message
   * @param {string} intent - Detected intent
   * @returns {Object} Extracted entities
   */
  extractBasicEntities(message, intent) {
    const entities = {};

    if (intent === 'search' || intent === 'clientDetail') {
      // Extract search terms (simple keyword-based)
      const searchKeywords = ['cari', 'search', 'info', 'detail', 'data', 'siapa'];
      for (const keyword of searchKeywords) {
        const regex = new RegExp(`${keyword}\\s+(.+)`, 'i');
        const match = message.match(regex);
        if (match && match[1]) {
          entities.searchTerm = match[1].trim();
          break;
        }
      }
    }

    if (intent === 'history') {
      // Extract client name for history
      const historyKeywords = ['riwayat', 'history', 'chat dengan', 'percakapan dengan'];
      for (const keyword of historyKeywords) {
        const regex = new RegExp(`${keyword}\\s+(.+)`, 'i');
        const match = message.match(regex);
        if (match && match[1]) {
          entities.clientId = match[1].trim();
          break;
        }
      }
    }

    return entities;
  }

  
  /**
   * Convert intent to command
   */
  intentToCommand(intent, entities = {}) {
    const commandMap = {
      stats: '/stats',
      clients: '/clients',
      leads: '/leads',
      deals: '/deals',
      today: '/today',
      active: '/active',
      events: '/events',
      help: '/help-internal'
    };

    // Handle intents that need parameters
    if (intent === 'search' && entities.searchTerm) {
      return { command: '/search', args: [entities.searchTerm] };
    }

    if (intent === 'clientDetail' && entities.searchTerm) {
      return { command: '/client', args: [entities.searchTerm] };
    }

    if (intent === 'history' && entities.clientId) {
      return { command: '/history', args: [entities.clientId] };
    }

    if (intent === 'pricing' && entities.minPrice && entities.maxPrice) {
      return { command: '/pricing', args: [entities.minPrice.toString(), entities.maxPrice.toString()] };
    }

    // Default command mapping
    if (commandMap[intent]) {
      return { command: commandMap[intent], args: [] };
    }

    return null;
  }

  /**
   * Generate natural language response prefix
   */
  getNaturalResponsePrefix(intent, entities = {}) {
    const prefixes = {
      stats: '📊 Baik, ini statistik keseluruhan:\n\n',
      clients: '📋 Berikut daftar semua client:\n\n',
      leads: '🎯 Ini daftar leads/prospects yang belum deal:\n\n',
      deals: '💰 Berikut daftar deals dan yang sedang negosiasi:\n\n',
      today: '📅 Ini aktivitas hari ini:\n\n',
      active: '🟢 Client yang sedang aktif (24 jam terakhir):\n\n',
      events: '🎉 Berikut semua event yang ada:\n\n',
      search: entities.searchTerm ? `🔍 Hasil pencarian "${entities.searchTerm}":\n\n` : '🔍 Hasil pencarian:\n\n',
      clientDetail: entities.searchTerm ? `👤 Info lengkap tentang "${entities.searchTerm}":\n\n` : '👤 Info client:\n\n',
      history: entities.clientId ? `💬 Riwayat percakapan dengan ${entities.clientId}:\n\n` : '💬 Riwayat percakapan:\n\n',
      pricing: '💵 Client dengan range harga tersebut:\n\n',
      help: '🤖 Saya bisa membantu Anda dengan:\n\n'
    };

    return prefixes[intent] || '';
  }
}

export default IntentDetector;
