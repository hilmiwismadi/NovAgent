import { IntentDetector } from './src/utils/intent-detector.js';

/**
 * Test Intent Detection for Natural Language Commands
 * Run: node test-intent-detection.js
 */

const detector = new IntentDetector();

console.log('🧪 Testing Intent Detection\n');
console.log('='.repeat(70));

// Test cases: natural language messages
const testMessages = [
  // Stats
  'berapa client yang sekarang berjalan',
  'ada berapa jumlah client',
  'total client',
  'statistik keseluruhan',
  'conversion rate berapa',

  // Clients
  'daftar semua client',
  'list client',
  'tampilkan client',
  'siapa saja client kita',

  // Leads
  'daftar lead',
  'ada lead siapa aja',
  'calon client apa saja',
  'yang belum deal',
  'prospect apa aja',

  // Deals
  'berapa yang sudah deal',
  'ada berapa deal',
  'siapa yang udah deal',
  'yang lagi negosiasi',
  'client deal',

  // Today
  'aktivitas hari ini',
  'hari ini ada berapa client baru',
  'report hari ini',
  'laporan hari ini',

  // Active
  'client yang aktif',
  'siapa yang sedang chat',
  'ada yang online ga',
  'session aktif',

  // Events
  'daftar event',
  'ada event apa',
  'event apa saja',
  'tampilkan semua event',

  // Search
  'cari client John',
  'search Dzaki',
  'ada client dari kemarigama',
  'cari instansi ABC',

  // Client detail
  'info tentang John',
  'detail client Dzaki',
  'data dari kemarigama',
  'gimana client ABC',

  // History
  'riwayat chat John',
  'history client Dzaki',
  'percakapan dengan ABC',

  // Pricing
  'client dengan harga 50k sampai 100k',
  'harga tiket antara 100000 sampai 200000',
  'budget dibawah 50k',
  'range pricing 50-100',

  // Help
  'bisa tanya apa',
  'apa aja yang bisa kamu lakukan',
  'gimana cara lihat client',
  'help',

  // Commands (should stay as commands)
  '/stats',
  '/clients',
  '/search John'
];

console.log('\n📝 Testing Natural Language Messages\n');

testMessages.forEach((msg, i) => {
  const result = detector.detectIntent(msg);
  const commandInfo = result.intent ? detector.intentToCommand(result.intent, result.entities) : null;

  console.log(`${i + 1}. "${msg}"`);
  console.log(`   Intent: ${result.intent || 'none'} (${result.confidence?.toFixed(2) || 'N/A'})`);

  if (result.entities && Object.keys(result.entities).length > 0) {
    console.log(`   Entities:`, result.entities);
  }

  if (commandInfo) {
    console.log(`   → ${commandInfo.command} ${commandInfo.args.join(' ')}`);
  }

  // Show natural prefix
  if (result.intent) {
    const prefix = detector.getNaturalResponsePrefix(result.intent, result.entities);
    if (prefix) {
      console.log(`   Prefix: "${prefix.substring(0, 50)}..."`);
    }
  }

  console.log('');
});

console.log('='.repeat(70));
console.log('\n✅ Intent Detection Test Complete\n');

// Summary statistics
console.log('📊 Summary:');
const intents = testMessages.map(msg => detector.detectIntent(msg));
const highConfidence = intents.filter(r => r.confidence > 0.7).length;
const medConfidence = intents.filter(r => r.confidence >= 0.5 && r.confidence <= 0.7).length;
const lowConfidence = intents.filter(r => r.confidence < 0.5).length;

console.log(`   High confidence (>0.7): ${highConfidence}/${testMessages.length}`);
console.log(`   Medium confidence (0.5-0.7): ${medConfidence}/${testMessages.length}`);
console.log(`   Low confidence (<0.5): ${lowConfidence}/${testMessages.length}`);

// Show unique intents detected
const uniqueIntents = [...new Set(intents.map(r => r.intent).filter(Boolean))];
console.log(`\n   Unique intents detected: ${uniqueIntents.length}`);
console.log(`   ${uniqueIntents.join(', ')}`);
