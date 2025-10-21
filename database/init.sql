-- ============================================
-- NovaBot Database Schema
-- PostgreSQL Setup Script
-- ============================================

-- Drop tables if exists (untuk clean install)
DROP TABLE IF EXISTS "Conversation" CASCADE;
DROP TABLE IF EXISTS "Session" CASCADE;
DROP TABLE IF EXISTS "User" CASCADE;

-- ============================================
-- Table: User (CRM Data)
-- ============================================
CREATE TABLE "User" (
    "id" VARCHAR(255) PRIMARY KEY,              -- WhatsApp ID: 628123456789@c.us
    "nama" VARCHAR(255),                        -- Nama client
    "instansi" VARCHAR(255),                    -- Nama perusahaan/organisasi
    "event" VARCHAR(255),                       -- Nama event yang direncanakan
    "ticketPrice" INTEGER,                      -- Harga tiket (dalam rupiah)
    "capacity" INTEGER,                         -- Kapasitas venue (jumlah orang)
    "pricingScheme" VARCHAR(50),                -- Skema pricing yang dipilih (persenan/flat)
    "dealStatus" VARCHAR(50) DEFAULT 'prospect',-- Status: prospect, negotiating, deal, closed
    "notes" TEXT,                               -- Catatan tambahan
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index untuk pencarian cepat
CREATE INDEX idx_user_nama ON "User"("nama");
CREATE INDEX idx_user_instansi ON "User"("instansi");
CREATE INDEX idx_user_dealStatus ON "User"("dealStatus");
CREATE INDEX idx_user_createdAt ON "User"("createdAt");

-- ============================================
-- Table: Conversation (Long-term Memory)
-- ============================================
CREATE TABLE "Conversation" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" VARCHAR(255) NOT NULL,             -- Foreign key ke User
    "userMessage" TEXT NOT NULL,                -- Pesan dari user
    "agentResponse" TEXT NOT NULL,              -- Response dari NovaBot
    "toolsUsed" JSONB,                          -- Array tools yang digunakan: ["getPricing", "extractContext"]
    "contextSnapshot" JSONB,                    -- Snapshot context saat percakapan: {ticketPrice, capacity}
    "timestamp" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_user FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- Index untuk query cepat
CREATE INDEX idx_conversation_userId ON "Conversation"("userId");
CREATE INDEX idx_conversation_timestamp ON "Conversation"("timestamp");
CREATE INDEX idx_conversation_userId_timestamp ON "Conversation"("userId", "timestamp" DESC);

-- ============================================
-- Table: Session (Active Session Management)
-- ============================================
CREATE TABLE "Session" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" VARCHAR(255) UNIQUE NOT NULL,      -- WhatsApp ID
    "context" JSONB NOT NULL,                   -- Current context: {ticketPrice, capacity, eventName, etc}
    "conversationCount" INTEGER DEFAULT 0,      -- Jumlah pesan dalam session ini
    "lastActive" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP,                      -- Session expiry (optional)

    CONSTRAINT fk_session_user FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- Index untuk session management
CREATE INDEX idx_session_userId ON "Session"("userId");
CREATE INDEX idx_session_lastActive ON "Session"("lastActive");

-- ============================================
-- Triggers untuk auto-update updatedAt
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_updated_at BEFORE UPDATE ON "User"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Sample Data (Optional - untuk testing)
-- ============================================
INSERT INTO "User" ("id", "nama", "instansi", "event", "ticketPrice", "capacity", "dealStatus")
VALUES
    ('628123456789@c.us', 'John Doe', 'ABC Company', 'Tech Conference 2025', 150000, 500, 'negotiating'),
    ('628987654321@c.us', 'Jane Smith', 'XYZ Organization', 'Music Festival', 300000, 2000, 'prospect');

INSERT INTO "Conversation" ("userId", "userMessage", "agentResponse", "toolsUsed", "contextSnapshot")
VALUES
    ('628123456789@c.us',
     'Halo, saya mau tanya pricing untuk event saya',
     'Halo! Untuk memberikan informasi pricing yang akurat, saya perlu tahu harga tiket dan kapasitas venue Anda.',
     '[]'::jsonb,
     '{}'::jsonb),
    ('628123456789@c.us',
     'Harga tiket sekitar 150rb dan kapasitas 500 orang',
     'Berdasarkan harga tiket Rp 150.000 dan kapasitas 500 orang, berikut penawaran pricing kami: Skema Persenan: 6% dari harga tiket, Skema Flat: Rp 7.000 per tiket.',
     '["extractContext", "getPricing"]'::jsonb,
     '{"ticketPrice": 150000, "capacity": 500}'::jsonb);

-- ============================================
-- Views untuk Analytics (Optional)
-- ============================================

-- View: User dengan jumlah conversation
CREATE VIEW "UserConversationStats" AS
SELECT
    u."id",
    u."nama",
    u."instansi",
    u."dealStatus",
    COUNT(c."id") as "totalConversations",
    MAX(c."timestamp") as "lastConversation"
FROM "User" u
LEFT JOIN "Conversation" c ON u."id" = c."userId"
GROUP BY u."id", u."nama", u."instansi", u."dealStatus";

-- View: Active sessions
CREATE VIEW "ActiveSessions" AS
SELECT
    s."userId",
    u."nama",
    s."context",
    s."conversationCount",
    s."lastActive"
FROM "Session" s
JOIN "User" u ON s."userId" = u."id"
WHERE s."lastActive" > (CURRENT_TIMESTAMP - INTERVAL '24 hours');

-- ============================================
-- Grants (adjust based on your user)
-- ============================================
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_username;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_username;

-- ============================================
-- Success Message
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '✅ Database schema created successfully!';
    RAISE NOTICE 'Tables created: User, Conversation, Session';
    RAISE NOTICE 'Sample data inserted for testing';
END $$;
