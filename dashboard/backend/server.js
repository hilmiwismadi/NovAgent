import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import dashboardRoutes from './routes/dashboardRoutes.js';
import waClientManager from './shared/whatsappClientManager.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.DASHBOARD_PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase limit for base64 images
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'NovAgent Dashboard API',
    whatsapp: waClientManager.isClientReady() ? 'connected' : 'disconnected'
  });
});

// Dashboard API routes
app.use('/api/dashboard', dashboardRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Server Error]:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path
  });
});

// Start server and WhatsApp client
app.listen(PORT, async () => {
  console.log('\n=================================');
  console.log('🚀 NovAgent Dashboard API Server');
  console.log('=================================');
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🔗 API URL: http://localhost:${PORT}`);
  console.log(`💚 Health check: http://localhost:${PORT}/health`);
  console.log(`📊 Dashboard API: http://localhost:${PORT}/api/dashboard`);
  console.log('=================================\n');

  // Note: WhatsApp client initialization is optional
  // If you want WhatsApp integration, run wa-bot.js separately with:
  // npm run start:wa
  console.log('\n📱 WhatsApp Integration:');
  console.log('   To enable WhatsApp message sending, run in separate terminal:');
  console.log('   npm run start:wa');
  console.log('   \n   Dashboard will auto-save messages to database.\n');
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n👋 Shutting down dashboard server...');
  await waClientManager.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n\n👋 Shutting down dashboard server...');
  await waClientManager.stop();
  process.exit(0);
});

export default app;
