const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const socketIO = require('socket.io');
const { Pool } = require('pg');
const { Vonage } = require('@vonage/server-sdk'); // <--- NEU: Import

// Load environment variables
dotenv.config();

// Import database initialization
const { initializeDatabase } = require('./db/init');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

// --- NEU: Vonage Initialisierung ---
// Nutzt die Variablen, die du in Railway eingetragen hast
const vonage = new Vonage({
  apiKey: process.env.VONAGE_API_KEY,
  apiSecret: process.env.VONAGE_API_SECRET
});

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Database connection (optional)
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
      // Initialize database tables
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

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/auth', require('./routes/refresh-token'));
app.use('/api/users', require('./routes/users'));
app.use('/api/profiles', require('./routes/profiles'));
app.use('/api/photos', require('./routes/photo-upload'));
app.use('/api/discovery', require('./routes/discovery'));
app.use('/api', require('./routes/discovery')); // For /api/like endpoint
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

// --- NEU: SMS ROUTEN FÜR VONAGE ---

// 1. SMS Senden
app.post('/api/send-code', async (req, res) => {
  const { phoneNumber } = req.body;
  console.log("📨 Versuche SMS zu senden an:", phoneNumber);

  try {
    const result = await vonage.verify.request({
      number: phoneNumber,
      brand: "SunoMilo"
    });
    
    console.log("Vonage Result:", result);

    if (result.request_id) {
       res.json({ success: true, requestId: result.request_id });
    } else {
       res.status(400).json({ success: false, message: result.error_text || "Fehler bei Vonage" });
    }
  } catch (error) {
    console.error("❌ Server Error bei SMS:", error);
    res.status(500).json({ success: false, message: 'Interner SMS Fehler' });
  }
});

// 2. Code Prüfen
app.post('/api/verify-code', async (req, res) => {
  const { requestId, code } = req.body;
  console.log(`🔍 Prüfe Code ${code} für ID ${requestId}`);

  try {
    const result = await vonage.verify.check({
      request_id: requestId,
      code: code
    });

    if (result.status === '0') {
      console.log("✅ Verifizierung erfolgreich!");
      res.json({ success: true });
    } else {
      console.log("❌ Falscher Code");
      res.status(400).json({ success: false, message: 'Falscher Code' });
    }
  } catch (error) {
    console.error("❌ Verify Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ------------------------------------

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Socket.io events
io.on('connection', (socket) => {
  console.log('🔗 User connected:', socket.id);

  // Join match room
  socket.on('join_match', (matchId) => {
    socket.join(`match_${matchId}`);
    console.log(`User ${socket.id} joined match ${matchId}`);
  });

  // Send message
  socket.on('send_message', (data) => {
    io.to(`match_${data.matchId}`).emit('receive_message', data);
  });

  // Typing indicator
  socket.on('typing', (data) => {
    socket.to(`match_${data.matchId}`).emit('user_typing', data);
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('🔌 User disconnected:', socket.id);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Frontend URL: ${process.env.FRONTEND_URL}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    pool.end();
    process.exit(0);
  });
});

module.exports = { app, server, io, pool };
