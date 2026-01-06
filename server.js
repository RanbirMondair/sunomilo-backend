const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const socketIO = require('socket.io');
const { Pool } = require('pg');
const { Vonage } = require('@vonage/server-sdk'); // Import

// Load environment variables
dotenv.config();

// Import database initialization
const { initializeDatabase } = require('./db/init');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Socket.io Setup
const io = socketIO(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*', 
    methods: ['GET', 'POST']
  }
});

// ==========================================
//    VONAGE SETUP (WICHTIG: NEU)
// ==========================================
// Wir nutzen jetzt ALLE 4 Variablen aus Railway,
// damit die sichere Verify V2 API funktioniert.
const vonage = new Vonage({
  apiKey: process.env.VONAGE_API_KEY,
  apiSecret: process.env.VONAGE_API_SECRET,
  applicationId: process.env.VONAGE_APPLICATION_ID,
  privateKey: process.env.VONAGE_PRIVATE_KEY
});
// ==========================================

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Database connection
let pool = null;
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
  });

  // Test database connection and initialize tables
  pool.query('SELECT NOW()', async (err, res) => {
    if (err) {
      console.error('Database connection error:', err);
    } else {
      console.log('✅ Database connected');
      try {
        await initializeDatabase();
      } catch (initError) {
        console.error('Database initialization error:', initError);
      }
    }
  });
} else {
  console.log('⚠️  No DATABASE_URL provided, running without PostgreSQL');
}

// Store database pool in app
app.locals.pool = pool;
app.locals.io = io;

// --- BESTEHENDE ROUTEN ---
app.use('/api/auth', require('./routes/auth'));
app.use('/api/auth', require('./routes/refresh-token'));
app.use('/api/users', require('./routes/users'));
app.use('/api/profiles', require('./routes/profiles'));
app.use('/api/photos', require('./routes/photo-upload'));
app.use('/api/discovery', require('./routes/discovery'));
app.use('/api', require('./routes/discovery'));
app.use('/api/likes', require('./routes/likes'));
app.use('/api/matches', require('./routes/matches'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/subscriptions', require('./routes/subscriptions'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/verification', require('./routes/verification'));
app.use('/api/migrate', require('./routes/migrate'));
app.use('/api/seed', require('./routes/seed_profiles'));
app.use('/api/location', require('./routes/location'));
app.use('/api/profile-images', require('./routes/sync_profile_images'));


// ==========================================
//    NEUE VONAGE SMS ROUTEN (VERIFY V2)
// ==========================================

// 1. SMS Senden
app.post('/api/send-code', async (req, res) => {
  let { phoneNumber } = req.body;
  
  // V2 API braucht zwingend ein "+"
  if (phoneNumber && !phoneNumber.toString().startsWith('+')) {
    phoneNumber = '+' + phoneNumber;
  }

  console.log("📨 Versuche SMS zu senden an:", phoneNumber);

  try {
    // Nutzung der neuen V2 API (benötigt App ID & Private Key)
    const result = await vonage.verify2.newRequest({
      brand: 'SunoMilo',
      workflow: [
        { channel: 'sms', to: phoneNumber }
      ]
    });
    
    console.log("✅ SMS beauftragt. ID:", result.requestId);
    res.json({ success: true, requestId: result.requestId });

  } catch (error) {
    console.error("❌ Fehler bei Vonage:", error);
    // Fehlerdetails ausgeben falls vorhanden
    if (error.response) console.error(error.response.data);
    
    res.status(500).json({ success: false, message: 'SMS konnte nicht gesendet werden.' });
  }
});

// 2. Code Prüfen
app.post('/api/verify-code', async (req, res) => {
  const { requestId, code } = req.body;
  console.log(`🔍 Prüfe Code ${code} für ID ${requestId}`);

  try {
    // Code prüfen
    await vonage.verify2.checkCode(requestId, code);

    console.log("✅ Code korrekt!");
    res.json({ success: true });

  } catch (error) {
    console.log("❌ Code falsch oder abgelaufen.");
    res.status(400).json({ success: false, message: 'Code ungültig' });
  }
});
// ==========================================


// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Socket.io events
io.on('connection', (socket) => {
  console.log('🔗 User connected:', socket.id);
  
  socket.on('join_match', (matchId) => {
    socket.join(`match_${matchId}`);
  });

  socket.on('send_message', (data) => {
    io.to(`match_${data.matchId}`).emit('receive_message', data);
  });

  socket.on('typing', (data) => {
    socket.to(`match_${data.matchId}`).emit('user_typing', data);
  });

  socket.on('disconnect', () => {
    console.log('🔌 User disconnected:', socket.id);
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// --- SERVER START ---
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    if (pool) pool.end();
    process.exit(0);
  });
});

module.exports = { app, server, io, pool };
