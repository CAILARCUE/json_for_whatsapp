const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const app = express();
app.use(express.json());

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-features=IsolateOrigins,site-per-process'
        ]
    }
});

client.on('qr', (qr) => {
    console.log('ESCANEA ESTE QR CON TU CELULAR:');
    qrcode.generate(qr, { small: false });
});

client.on('ready', () => {
    console.log('WhatsApp conectado y listo!');
});

client.on('authenticated', () => {
    console.log('Autenticación exitosa');
});

client.on('auth_failure', () => {
    console.error('Falló la autenticación');
});

client.initialize();

// Endpoint que recibe los mensajes desde Google Sheets
app.post('/enviar', async (req, res) => {
    const { telefono, mensaje } = req.body;

    if (!telefono || !mensaje) {
        return res.status(400).json({ error: 'Faltan teléfono o mensaje' });
    }

    try {
        const numeroLimpio = telefono.toString().replace(/[^\d]/g, '');
        const chatId = numeroLimpio + '@c.us';
        await client.sendMessage(chatId, mensaje);
        console.log(`Mensaje enviado a ${numeroLimpio}`);
        res.json({ success: true, enviadoA: numeroLimpio });
    } catch (error) {
        console.error('Error enviando mensaje:', error.message);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
}); 
