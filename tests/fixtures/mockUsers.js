/**
 * Mock User Data for Testing
 */

export const mockUsers = {
  prospect: {
    id: '628123456789@c.us',
    nama: 'John Doe',
    instansi: 'Acme Corp',
    event: null,
    ticketPrice: null,
    capacity: null,
    pricingScheme: null,
    dealStatus: 'prospect',
    notes: null,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z')
  },

  negotiating: {
    id: '628987654321@c.us',
    nama: 'Jane Smith',
    instansi: 'Tech Events Inc',
    event: 'Tech Conference 2025',
    ticketPrice: 150000,
    capacity: 500,
    pricingScheme: 'Standard',
    dealStatus: 'negotiating',
    notes: 'Interested in premium features',
    cpFirst: '081234567890',
    igLink: '@techevents',
    createdAt: new Date('2025-01-05T00:00:00Z'),
    updatedAt: new Date('2025-01-10T00:00:00Z')
  },

  deal: {
    id: '628555666777@c.us',
    nama: 'Bob Johnson',
    instansi: 'Music Festival Organizers',
    event: 'Summer Music Fest',
    ticketPrice: 250000,
    capacity: 2000,
    pricingScheme: 'Premium',
    dealStatus: 'deal',
    notes: 'Deal closed, ready for implementation',
    cpFirst: '081222333444',
    cpSecond: '081555666777',
    lastEvent: 'Winter Music Fest',
    lastEventDate: new Date('2024-12-15T00:00:00Z'),
    dateEstimation: new Date('2025-06-20T00:00:00Z'),
    igLink: '@musicfest',
    pic: 'Sales Agent A',
    status: 'To Do',
    createdAt: new Date('2024-12-01T00:00:00Z'),
    updatedAt: new Date('2025-01-15T00:00:00Z')
  },

  lost: {
    id: '628888999000@c.us',
    nama: 'Alice Brown',
    instansi: 'Community Events',
    event: 'Local Gathering',
    ticketPrice: 50000,
    capacity: 100,
    pricingScheme: 'Basic',
    dealStatus: 'lost',
    notes: 'Budget constraints, moved to competitor',
    status: 'Next Year',
    createdAt: new Date('2024-11-01T00:00:00Z'),
    updatedAt: new Date('2024-11-20T00:00:00Z')
  }
};

export const mockConversations = [
  {
    id: 1,
    userId: '628123456789@c.us',
    userMessage: 'Halo, saya tertarik dengan platform NovaTix',
    agentResponse: 'Halo! Senang bisa membantu Anda. NovaTix adalah platform ticketing yang memudahkan pengelolaan event Anda...',
    timestamp: new Date('2025-01-01T10:00:00Z'),
    toolsUsed: ['knowledge_base']
  },
  {
    id: 2,
    userId: '628987654321@c.us',
    userMessage: 'Saya dari Tech Events Inc, mau tanya harga untuk event 500 orang',
    agentResponse: 'Terima kasih atas pertanyaannya! Untuk kapasitas 500 orang, kami punya beberapa paket...',
    timestamp: new Date('2025-01-05T14:30:00Z'),
    toolsUsed: ['pricing_calculator'],
    contextSnapshot: {
      instansi: 'Tech Events Inc',
      capacity: 500
    }
  }
];

export const mockSessions = [
  {
    userId: '628123456789@c.us',
    context: JSON.stringify({
      conversationHistory: [
        { role: 'user', content: 'Halo' },
        { role: 'assistant', content: 'Halo! Ada yang bisa saya bantu?' }
      ]
    }),
    conversationCount: 2,
    lastActive: new Date('2025-01-01T10:05:00Z'),
    expiresAt: new Date('2025-01-02T10:05:00Z')
  }
];
