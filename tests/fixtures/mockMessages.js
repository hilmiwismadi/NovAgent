/**
 * Mock WhatsApp Messages and Intents for Testing
 */

export const mockMessages = {
  greetings: [
    'Halo',
    'Hi, saya mau tanya tentang NovaTix',
    'Selamat pagi, bisa bantu saya?'
  ],

  pricing: [
    'Berapa harga untuk event 1000 orang?',
    'Mau tanya pricing untuk kapasitas 500',
    'Harga tiket 100rb, venue 2000 orang, bisa dapat paket apa?'
  ],

  nameIntroduction: [
    'Nama saya John Doe dari Acme Corp',
    'Saya Jane, dari Tech Events',
    'Perkenalkan, Bob dari Music Festival Organizers'
  ],

  eventDetails: [
    'Event kami namanya Tech Conference 2025',
    'Mau bikin konser musik Summer Fest',
    'Rencana buat festival makanan bulan depan'
  ],

  dateEstimation: [
    'Event tanggal 15 Desember 2025',
    'Acara minggu depan',
    'Rencana bulan Juni',
    'Event pada 20/06/2025',
    'Konser di akhir tahun',
    'Meeting appointment tanggal 5 Februari jam 14:00',
    'Ticket sale start tanggal 1 Maret 2025',
    'Event d-day nya 15 April 2025'
  ],

  capacityMentions: [
    'Venue bisa muat 500 orang',
    'Kapasitas 2000 peserta',
    'Kira-kira 100 orang aja'
  ],

  pricingDetails: [
    'Harga tiket 150rb per orang',
    'Ticket price 250 ribu',
    'Tiket dijual 100k',
    'Harga 1 juta per tiket',
    'Price 500rb'
  ],

  dealStatus: [
    'Oke saya deal dengan paket Premium',
    'Masih mikir-mikir dulu',
    'Kayaknya nggak jadi deh',
    'Setuju, kita lanjut'
  ],

  internalCommands: [
    '/clients',
    '/leads',
    '/deals',
    '/client 628123456789@c.us',
    '/history 628987654321@c.us',
    '/search Acme',
    '/stats',
    '/today',
    '/active'
  ]
};

export const mockIntents = {
  greeting: {
    message: 'Halo, saya mau tanya tentang NovaTix',
    expectedIntent: 'greeting',
    expectedConfidence: 0.8
  },

  pricing: {
    message: 'Berapa harga untuk event 1000 orang dengan tiket 150rb?',
    expectedIntent: 'pricing_inquiry',
    expectedEntities: {
      capacity: 1000,
      ticketPrice: 150000
    }
  },

  introduction: {
    message: 'Nama saya John Doe dari Acme Corp',
    expectedIntent: 'introduction',
    expectedEntities: {
      nama: 'John Doe',
      instansi: 'Acme Corp'
    }
  },

  eventDetails: {
    message: 'Mau bikin event Tech Conference tanggal 15 Desember dengan kapasitas 500 orang',
    expectedIntent: 'event_details',
    expectedEntities: {
      event: 'Tech Conference',
      capacity: 500,
      dateEstimation: expect.any(Date)
    }
  },

  dealConfirmation: {
    message: 'Oke saya setuju dengan paket Premium',
    expectedIntent: 'deal_confirmation',
    expectedEntities: {
      pricingScheme: 'Premium',
      dealStatus: 'deal'
    }
  }
};

export const mockWhatsAppMessages = [
  {
    from: '628123456789@c.us',
    body: 'Halo',
    timestamp: 1704067200,
    _data: {
      notifyName: 'John Doe',
      from: '628123456789@c.us'
    }
  },
  {
    from: '628987654321@c.us',
    body: 'Berapa harga untuk 500 orang?',
    timestamp: 1704153600,
    _data: {
      notifyName: 'Jane Smith',
      from: '628987654321@c.us'
    }
  }
];
