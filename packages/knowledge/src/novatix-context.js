/**
 * NovaTix Knowledge Base
 * Contains all information about NovaTix platform for the AI agent
 */

export const novatixContext = {
  companyInfo: {
    name: "NovaTix",
    description: "Platform ticketing yang mempermudah pengelolaan acara terutama untuk seated venue agar Event Organizer (EO) bisa lebih efisien dan mudah dalam menggelar acara.",
    target: "Event Organizer (EO) yang menyelenggarakan acara dengan seated venue"
  },

  features: {
    main: [
      {
        name: "Pemilihan Tiket Seat-Based",
        description: "Menawarkan tampilan intuitif dan mudah digunakan sehingga pembeli dapat memilih kursi yang sesuai dan berpengaruh pada experience pembeli."
      },
      {
        name: "Payment Gateway Integration",
        description: "Support QRIS yang menerima berbagai jenis kanal bank dan mempermudah EO melakukan verifikasi transaksi secara otomatis dan terekap dengan rapi."
      },
      {
        name: "E-Ticket Verification",
        description: "Kami menyiapkan scanner untuk hari acara sehingga penyelenggara dapat memverifikasi tiket pembeli lewat sistem scan QR code unik yang bisa diakses oleh HP EO."
      },
      {
        name: "Data Analytics",
        description: "Dashboard yang dipegang EO memiliki fitur untuk rekapan data seperti informasi pembeli, transaksi dan detail lainnya sehingga dapat digunakan untuk analisis acara."
      }
    ]
  },

  pricing: {
    percentage: {
      description: "Skema pricing berdasarkan persentase dari harga tiket",
      tiers: [
        {
          capacity: "0 - 750 pax",
          ranges: [
            { ticketPrice: "Rp 0 - 50.000", fee: "10%" },
            { ticketPrice: "Rp 50.000 - 250.000", fee: "6%" },
            { ticketPrice: "Rp 250.000+", fee: "5.5%" }
          ]
        },
        {
          capacity: "750 - 1500 pax",
          ranges: [
            { ticketPrice: "Rp 0 - 50.000", fee: "8%" },
            { ticketPrice: "Rp 50.000 - 250.000", fee: "5.5%" },
            { ticketPrice: "Rp 250.000+", fee: "5%" }
          ]
        },
        {
          capacity: "1500+ pax",
          ranges: [
            { ticketPrice: "Rp 0 - 50.000", fee: "7.5%" },
            { ticketPrice: "Rp 50.000 - 250.000", fee: "5%" },
            { ticketPrice: "Rp 250.000+", fee: "4%" }
          ]
        }
      ]
    },
    flat: {
      description: "Skema pricing flat per tiket",
      tiers: [
        {
          capacity: "0 - 750 pax",
          ranges: [
            { ticketPrice: "Rp 0 - 50.000", fee: "Rp 7.500" },
            { ticketPrice: "Rp 50.000 - 250.000", fee: "Rp 7.000" },
            { ticketPrice: "Rp 250.000+", fee: "Rp 5.500" }
          ]
        },
        {
          capacity: "750 - 1500 pax",
          ranges: [
            { ticketPrice: "Rp 0 - 50.000", fee: "Rp 7.000" },
            { ticketPrice: "Rp 50.000 - 250.000", fee: "Rp 6.000" },
            { ticketPrice: "Rp 250.000+", fee: "Rp 5.000" }
          ]
        },
        {
          capacity: "1500+ pax",
          ranges: [
            { ticketPrice: "Rp 0 - 50.000", fee: "Rp 7.000" },
            { ticketPrice: "Rp 50.000 - 250.000", fee: "Rp 6.000" },
            { ticketPrice: "Rp 250.000+", fee: "Rp 5.000" }
          ]
        }
      ]
    }
  },

  userGuides: {
    ticketPurchase: [
      "Masuk dengan Gmail dan pilih akun yang ingin digunakan",
      "Lihat detail event dan pilih kursi",
      "Setelah yakin dengan kursi pilihan, scroll ke bawah untuk mengisi data input yang dibutuhkan",
      "Jika ingin memesan merchandise, klik 'Browse All' untuk memilih dan menentukan jumlah",
      "Klik 'Add to Order' jika telah selesai memilih merchandise",
      "Cek ulang pada Price Summary untuk total pembayaran",
      "Klik 'Proceed Transaction' lalu scan QRIS untuk membayar",
      "Setelah membayar, klik 'Check Status'",
      "Cek email untuk tiket dan konfirmasi yang terkirim otomatis",
      "Tiket juga tersimpan di tab 'My Tickets' (pojok kanan atas)",
      "Klik 'Download All Tickets' untuk menyimpan dalam format PDF",
      "Bisa juga membuka tab 'My Orders' untuk melihat detail transaksi"
    ],

    eventSetup: [
      "Masuk dengan akun EO yang sudah diberikan",
      "Pada sidebar, pilih tab 'Events'",
      "Pilih event yang ingin dicek",
      "Pada layar atas, terdapat tombol 'Ubah'",
      "Terdapat beberapa opsi untuk mengkonfigurasi pengaturan event"
    ],

    scannerUsage: [
      "Masuk dengan akun scanner yang diberikan",
      "Aktifkan kamera pada fitur yang tersedia",
      "Arahkan kamera ke QR code pada tiket"
    ],

    dataChecking: [
      "Masuk ke akun EO",
      "Buka tab 'Ticket' untuk cek data tiket yang ada",
      "Gunakan filter untuk kategori, sort, dan search",
      "Buka tab 'Order' untuk cek data pembelian yang ada",
      "Masukkan filter untuk kategori, sort, dan search"
    ]
  },

  conversationFlow: {
    greeting: "Halo! Saya NovaBot, asisten virtual NovaTix. Ada yang bisa saya bantu mengenai platform ticketing kami?",

    pricingNegotiation: {
      steps: [
        "Menanyakan estimasi harga tiket",
        "Menanyakan kapasitas venue/event",
        "Memberikan penawaran 2 skema (Persenan dan Flat)"
      ]
    }
  }
};

// Helper function to get pricing based on ticket price and capacity
export function getPricing(ticketPrice, capacity, scheme = 'both') {
  const numPrice = parseInt(ticketPrice.toString().replace(/[^0-9]/g, ''));
  const numCapacity = parseInt(capacity.toString().replace(/[^0-9]/g, ''));

  let capacityTier;
  if (numCapacity <= 750) capacityTier = 0;
  else if (numCapacity <= 1500) capacityTier = 1;
  else capacityTier = 2;

  let priceRange;
  if (numPrice <= 50000) priceRange = 0;
  else if (numPrice <= 250000) priceRange = 1;
  else priceRange = 2;

  const result = {};

  if (scheme === 'percentage' || scheme === 'both') {
    result.percentage = {
      ...novatixContext.pricing.percentage.tiers[capacityTier].ranges[priceRange],
      capacity: novatixContext.pricing.percentage.tiers[capacityTier].capacity
    };
  }

  if (scheme === 'flat' || scheme === 'both') {
    result.flat = {
      ...novatixContext.pricing.flat.tiers[capacityTier].ranges[priceRange],
      capacity: novatixContext.pricing.flat.tiers[capacityTier].capacity
    };
  }

  return result;
}

export default novatixContext;
