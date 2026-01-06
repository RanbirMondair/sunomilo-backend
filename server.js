require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { Vonage } = require('@vonage/server-sdk');

const app = express();
const port = process.env.PORT || 3000;

// Datenbank-Verbindung (Railway nutzt DATABASE_URL)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(cors());
app.use(express.json());

const vonage = new Vonage({
  apiKey: process.env.VONAGE_API_KEY,
  apiSecret: process.env.VONAGE_API_SECRET
});

// TEST-ROUTE
app.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ message: 'SunoMilo API läuft!', db_time: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ error: 'DB Verbindung fehlgeschlagen' });
  }
});

// SMS SENDEN & IN DB SPEICHERN
app.post('/send-sms', async (req, res) => {
    const { to, text } = req.body;
    // Extrahiere den Code aus dem Text (letzte 4 Ziffern)
    const code = text.match(/\d+/)[0];

    try {
        // 1. SMS versenden
        await vonage.sms.send({ to, from: "Sunomilo", text });

        // 2. In DB merken (oder updaten falls Nummer existiert)
        await pool.query(
            'INSERT INTO users (phone, verification_code, name, email, password_hash) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (phone) DO UPDATE SET verification_code = $2',
            [to, code, 'TestUser', `${to}@temp.com`, 'placeholder']
        );

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
  console.log(`Server läuft auf Port ${port}`);
});
