/**
 * Intent Detector for Natural Language Commands
 * Detects user intent from casual Indonesian chat
 */

export class IntentDetector {
  constructor() {
    // Intent patterns dengan keywords dan variations
    this.intents = {
      // Stats & Analytics
      stats: {
        keywords: ['statistik', 'stats', 'overview', 'ringkasan', 'rangkuman', 'total'],
        patterns: [
          /berapa (jumlah )?client/i,
          /ada berapa client/i,
          /total client/i,
          /jumlah client/i,
          /berapa (jumlah )?user/i,
          /conversion rate/i,
          /performa/i,
          /kinerja/i
        ]
      },

      // List all clients
      clients: {
        keywords: ['daftar client', 'list client', 'semua client', 'lihat client'],
        patterns: [
          /daftar (semua )?client/i,
          /list (semua )?client/i,
          /tampilkan (semua )?client/i,
          /lihat (semua )?client/i,
          /siapa saja client/i,
          /client apa saja/i
        ]
      },

      // Leads/Prospects
      leads: {
        keywords: ['lead', 'prospect', 'calon client'],
        patterns: [
          /daftar lead/i,
          /list lead/i,
          /siapa (saja )?lead/i,
          /ada lead (apa|siapa)/i,
          /calon client/i,
          /prospect/i,
          /yang belum (deal|close)/i,
          /yang masih prospect/i
        ]
      },

      // Deals
      deals: {
        keywords: ['deal', 'closing', 'negosiasi'],
        patterns: [
          /berapa deal/i,
          /ada (berapa )?deal/i,
          /daftar deal/i,
          /list deal/i,
          /yang (sudah|udah) deal/i,
          /siapa (yang )?(sudah|udah) deal/i,
          /client deal/i,
          /nego(siasi)?/i,
          /yang (lagi|sedang) nego/i
        ]
      },

      // Today's activity
      today: {
        keywords: ['hari ini', 'today', 'harian'],
        patterns: [
          /(aktivitas|activity) hari ini/i,
          /hari ini (ada )?berapa/i,
          /client (baru )?hari ini/i,
          /conversation hari ini/i,
          /chat hari ini/i,
          /update (hari )?ini/i,
          /report (hari )?ini/i,
          /laporan (hari )?ini/i
        ]
      },

      // Active sessions
      active: {
        keywords: ['aktif', 'active', 'online', 'sedang chat'],
        patterns: [
          /client (yang )?aktif/i,
          /siapa (yang )?(sedang|lagi) (chat|online)/i,
          /ada (yang|siapa) (chat|online)/i,
          /(session|sesi) aktif/i,
          /yang (sedang|lagi) aktif/i
        ]
      },

      // Events
      events: {
        keywords: ['event', 'acara', 'kegiatan'],
        patterns: [
          /daftar event/i,
          /list event/i,
          /ada event apa/i,
          /event apa saja/i,
          /semua event/i,
          /lihat event/i,
          /tampilkan event/i
        ]
      },

      // Search client
      search: {
        keywords: ['cari', 'search', 'find'],
        patterns: [
          /cari client/i,
          /search client/i,
          /find client/i,
          /cari (nama|instansi|organisasi)/i,
          /ada (gak|ga|tidak) client/i,
          /siapa (yang|client) (dari|namanya)/i
        ]
      },

      // Client detail
      clientDetail: {
        keywords: ['info client', 'detail client', 'data client'],
        patterns: [
          /info (tentang |client )?(.+)/i,
          /detail (tentang |client )?(.+)/i,
          /data (dari |client )?(.+)/i,
          /siapa (itu )?(.+)/i,
          /gimana (client )?(.+)/i,
          /bagaimana (client )?(.+)/i
        ]
      },

      // History
      history: {
        keywords: ['riwayat', 'history', 'percakapan', 'chat history'],
        patterns: [
          /riwayat (chat |percakapan )?(.+)/i,
          /history (dari |client )?(.+)/i,
          /percakapan (dengan |client )?(.+)/i,
          /chat (dengan |dari |client )?(.+)/i,
          /pernah (chat|bicara) (apa|tentang)/i
        ]
      },

      // Pricing filter
      pricing: {
        keywords: ['harga', 'pricing', 'budget', 'biaya'],
        patterns: [
          /client (dengan |yang punya )?harga/i,
          /harga (tiket )?(berapa|antara|dari|sampai)/i,
          /budget (berapa|antara|dari)/i,
          /range (harga|price|pricing)/i,
          /filter (harga|price|pricing)/i
        ]
      },

      // Help
      help: {
        keywords: ['help', 'bantuan', 'gimana', 'bagaimana', 'apa aja', 'bisa apa'],
        patterns: [
          /bisa (tanya|nanya) apa/i,
          /apa (aja|saja) (yang )?bisa/i,
          /gimana (cara)?/i,
          /bagaimana (cara)?/i,
          /butuh bantuan/i,
          /tolong/i,
          /help/i
        ]
      }
    };
  }

  /**
   * Detect intent from natural language message
   * @param {string} message - User message
   * @returns {Object} { intent: string, confidence: number, entities: Object }
   */
  detectIntent(message) {
    const lowerMessage = message.toLowerCase().trim();

    // Check if message is a slash command (skip NLU)
    if (lowerMessage.startsWith('/')) {
      return { intent: 'command', confidence: 1.0, command: lowerMessage.split(/\s+/)[0] };
    }

    let bestMatch = { intent: null, confidence: 0, entities: {} };

    // Check patterns first (higher priority)
    for (const [intent, config] of Object.entries(this.intents)) {
      for (const pattern of config.patterns) {
        const match = lowerMessage.match(pattern);
        if (match) {
          const confidence = this.calculateConfidence(lowerMessage, config.keywords, pattern);
          if (confidence > bestMatch.confidence) {
            bestMatch = {
              intent,
              confidence,
              entities: this.extractEntities(intent, match, lowerMessage)
            };
          }
        }
      }
    }

    // Check keywords if no pattern match
    if (bestMatch.confidence === 0) {
      for (const [intent, config] of Object.entries(this.intents)) {
        for (const keyword of config.keywords) {
          if (lowerMessage.includes(keyword.toLowerCase())) {
            const confidence = 0.6; // Lower confidence for keyword-only match
            if (confidence > bestMatch.confidence) {
              bestMatch = {
                intent,
                confidence,
                entities: this.extractEntities(intent, null, lowerMessage)
              };
            }
          }
        }
      }
    }

    return bestMatch;
  }

  /**
   * Calculate confidence score
   */
  calculateConfidence(message, keywords, pattern) {
    let confidence = 0.7; // Base confidence for pattern match

    // Boost if keywords also present
    const keywordCount = keywords.filter(kw =>
      message.toLowerCase().includes(kw.toLowerCase())
    ).length;

    confidence += (keywordCount * 0.1);

    // Boost for exact matches
    if (pattern.test(message) && message.split(' ').length <= 5) {
      confidence += 0.15;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Extract entities from message based on intent
   */
  extractEntities(intent, match, message) {
    const entities = {};

    switch (intent) {
      case 'search':
      case 'clientDetail':
        // Extract search term (anything after "cari", "info", etc.)
        const searchPatterns = [
          /cari (client )?(.+)/i,
          /search (client )?(.+)/i,
          /info (tentang |client )?(.+)/i,
          /detail (tentang |client )?(.+)/i,
          /data (dari |client )?(.+)/i
        ];

        for (const pattern of searchPatterns) {
          const m = message.match(pattern);
          if (m && m[m.length - 1]) {
            entities.searchTerm = m[m.length - 1].trim();
            break;
          }
        }
        break;

      case 'pricing':
        // Extract price range
        const priceMatch = message.match(/(\d+)k?\s*-?\s*(\d+)k?/i);
        if (priceMatch) {
          entities.minPrice = parseInt(priceMatch[1]) * (priceMatch[1].length <= 3 ? 1000 : 1);
          entities.maxPrice = parseInt(priceMatch[2]) * (priceMatch[2].length <= 3 ? 1000 : 1);
        }

        // Handle "dibawah X", "diatas X"
        const belowMatch = message.match(/di ?bawah (\d+)k?/i);
        const aboveMatch = message.match(/di ?atas (\d+)k?/i);

        if (belowMatch) {
          entities.minPrice = 0;
          entities.maxPrice = parseInt(belowMatch[1]) * (belowMatch[1].length <= 3 ? 1000 : 1);
        }

        if (aboveMatch) {
          entities.minPrice = parseInt(aboveMatch[1]) * (aboveMatch[1].length <= 3 ? 1000 : 1);
          entities.maxPrice = 999999999;
        }
        break;

      case 'history':
        // Extract client identifier from history request
        const historyPatterns = [
          /riwayat (chat |percakapan )?(dengan |client )?(.+)/i,
          /history (dari |client )?(.+)/i,
          /percakapan (dengan |client )?(.+)/i
        ];

        for (const pattern of historyPatterns) {
          const m = message.match(pattern);
          if (m && m[m.length - 1]) {
            entities.clientId = m[m.length - 1].trim();
            break;
          }
        }
        break;
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
