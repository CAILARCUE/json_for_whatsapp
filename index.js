const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const app = express();
app.use(express.json());

let clientReady = false; // Variable para controlar el estado

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
    clientReady = false; // No está listo mientras muestra QR
});

client.on('ready', () => {
    console.log('WhatsApp conectado y listo!');
    clientReady = true; // Marcar como listo
});

client.on('authenticated', () => {
    console.log('Autenticación exitosa');
});

client.on('auth_failure', () => {
    console.error('Falló la autenticación');
    clientReady = false;
});

client.on('disconnected', () => {
    console.log('Cliente desconectado');
    clientReady = false;
});

client.initialize();

// Endpoint para verificar el estado
app.get('/status', (req, res) => {
    res.json({ 
        conectado: clientReady,
        mensaje: clientReady ? 'WhatsApp conectado' : 'WhatsApp desconectado - revisa logs para QR'
    });
});

// Endpoint que recibe los mensajes desde Google Sheets
app.post('/enviar', async (req, res) => {
    const { telefono, mensaje } = req.body;

    if (!telefono || !mensaje) {
        return res.status(400).json({ error: 'Faltan teléfono o mensaje' });
    }

    // VERIFICAR QUE EL CLIENTE ESTÉ LISTO
    if (!clientReady) {
        return res.status(503).json({ 
            error: 'WhatsApp no está conectado. Revisa los logs del servidor y escanea el QR si es necesario.' 
        });
    }

    try {
        const numeroLimpio = telefono.toString().replace(/[^\d]/g, '');
        
        // Formato para Argentina: 549 + número sin 0 ni 15
        let numeroFinal = numeroLimpio;
        
        // Si el número tiene 10 dígitos (ej: 3794595272), agregar código de país
        if (numeroLimpio.length === 10) {
            numeroFinal = '549' + numeroLimpio;
        }
        
        const chatId = numeroFinal + '@c.us';
        
        console.log(`Intentando enviar a: ${chatId}`);
        await client.sendMessage(chatId, mensaje);
        console.log(`✓ Mensaje enviado a ${numeroFinal}`);
        
        res.json({ success: true, enviadoA: numeroFinal });
    } catch (error) {
        console.error('Error enviando mensaje:', error.message);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
    console.log(`Verifica el estado en: https://json-for-whatsapp.onrender.com/status`);
});
