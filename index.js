const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const app = express();
app.use(express.json());

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: true }
});

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
    console.log('Escanea este QR con tu WhatsApp');
});

client.on('ready', () => {
    console.log('WhatsApp conectado y listo!');
});

client.initialize();

// Endpoint que llama Google Sheets
app.post('/enviar', async (req, res) => {
  const { telefono, mensaje } = req.body;

  if (!telefono || !mensaje) {
    return res.status(400).json({ error: 'Faltan datos' });
  }

  try {
    const chatId = ${telefono}@c.us;
    await client.sendMessage(chatId, mensaje);
    console.log(Enviado a ${telefono});
    res.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(Servidor corriendo en puerto ${PORT});
});
