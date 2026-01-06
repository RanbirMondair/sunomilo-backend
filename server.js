require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Vonage } = require('@vonage/server-sdk');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- 1. VONAGE SETUP ---
// Wir nutzen API Key & Secret aus Railway Variables
const vonage = new Vonage({
  apiKey: process.env.VONAGE_API_KEY,
  apiSecret: process.env.VONAGE_API_SECRET
});

app.get('/', (req, res) => {
  res.send('Sunomilo Backend ist aktuell! 🚀');
});

// --- 2. SMS ROUTE ---
app.post('/send-sms', async (req, res) => {
    const { to, text } = req.body;
    console.log(`📨 Sende SMS an: ${to}`);

    try {
        const from = "Sunomilo";

        await vonage.sms.send({ to, from, text })
            .then(resp => {
                if (resp.messages[0]['status'] === '0') {
                    console.log("✅ SMS erfolgreich gesendet!");
                    res.json({ success: true });
                } else {
                    console.log(`❌ Fehler: ${resp.messages[0]['error-text']}`);
                    res.status(400).json({ error: resp.messages[0]['error-text'] });
                }
            })
            .catch(err => {
                console.error('API Fehler:', err);
                res.status(500).json({ error: err.message });
            });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
  console.log(`Server läuft auf Port ${port}`);
});
