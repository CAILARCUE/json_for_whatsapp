const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const QRcode = require('qrcode');

const app = express();
app.use(express.json());

let clientReady = false;
let reconnecting = false;

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-first-run',
            '--no-zygote',
            '--single-process', // Importante para Render
            '--disable-features=IsolateOrigins,site-per-process'
        ]
    }
});

const QRCode = require('qrcode'); // Nueva librería

let currentQR = null; // Para guardar el último QR

client.on('qr', async (qr) => {
    try {
        // Genera imagen base64 (data URL) de alta calidad
        currentQR = await QRCode.toDataURL(qr, {
            width: 400,      // Tamaño grande para mejor escaneo
            margin: 4,       // Margen blanco alrededor
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });
        console.log('✓ Nuevo QR generado (accede a /qr para verlo)');
    } catch (err) {
        console.error('Error generando QR imagen:', err);
    }
    clientReady = false;
});

client.on('ready', () => {
    console.log('✓ WhatsApp conectado y listo!');
    clientReady = true;
    reconnecting = false;
});

client.on('authenticated', () => {
    console.log('✓ Autenticación exitosa');
});

client.on('auth_failure', (msg) => {
    console.error('✗ Falló la autenticación:', msg);
    clientReady = false;
});

client.on('disconnected', (reason) => {
    console.log('✗ Cliente desconectado. Razón:', reason);
    clientReady = false;
    
    // Intentar reconectar automáticamente
    if (!reconnecting) {
        reconnecting = true;
        console.log('Intentando reconectar en 10 segundos...');
        setTimeout(() => {
            console.log('Reinicializando cliente...');
            client.initialize();
        }, 10000);
    }
});

client.on('loading_screen', (percent, message) => {
    console.log('Cargando WhatsApp...', percent, message);
});

console.log('Inicializando cliente de WhatsApp...');
client.initialize();

// Endpoint para verificar el estado
app.get('/status', (req, res) => {
    res.json({ 
        conectado: clientReady,
        mensaje: clientReady ? 'WhatsApp conectado ✓' : 'WhatsApp desconectado - revisa logs',
        timestamp: new Date().toISOString()
    });
});

// Endpoint de health check básico
app.get('/', (req, res) => {
    res.json({ 
        status: 'servidor activo',
        whatsapp: clientReady ? 'conectado' : 'desconectado'
    });
});

// Endpoint que recibe los mensajes desde Google Sheets
app.post('/enviar', async (req, res) => {
    const { telefono, mensaje } = req.body;

    if (!telefono || !mensaje) {
        return res.status(400).json({ error: 'Faltan teléfono o mensaje' });
    }

    if (!clientReady) {
        return res.status(503).json({ 
            error: 'WhatsApp no está conectado. Espera unos segundos e intenta nuevamente.' 
        });
    }

    try {
        const numeroLimpio = telefono.toString().replace(/[^\d]/g, '');
        
        // Formato para Argentina: 549 + número
        let numeroFinal = numeroLimpio;
        if (numeroLimpio.length === 10) {
            numeroFinal = '549' + numeroLimpio;
        }
        
        const chatId = numeroFinal + '@c.us';
        
        console.log(`→ Enviando a: ${chatId}`);
        await client.sendMessage(chatId, mensaje);
        console.log(`✓ Mensaje enviado a ${numeroFinal}`);
        
        res.json({ success: true, enviadoA: numeroFinal });
    } catch (error) {
        console.error('✗ Error enviando mensaje:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint para ver el QR code como imagen en el navegador
app.get('/qr', (req, res) => {
    if (currentQR) {
        // Envía una página HTML simple con la imagen del QR
        res.send(`
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Escanea el QR para conectar WhatsApp</title>
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; background: #f0f0f0; }
                    img { max-width: 90%; height: auto; border: 2px solid #075e54; border-radius: 10px; }
                    h1 { color: #075e54; }
                    p { font-size: 1.2em; }
                    .refresh { margin-top: 20px; font-size: 1em; color: #666; }
                </style>
            </head>
            <body>
                <h1>Escanea este QR con tu WhatsApp</h1>
                <img src="${currentQR}" alt="QR Code WhatsApp">
                <p>Si el QR no funciona, espera unos segundos y recarga la página.</p>
                <p class="refresh">El QR se actualiza automáticamente cuando es necesario.</p>
            </body>
            </html>
        `);
    } else {
        res.send(`
            <h1>No hay QR disponible aún</h1>
            <p>Espera a que aparezca en los logs "Nuevo QR generado" y recarga esta página.</p>
            <p>Si ya está conectado, no se mostrará QR.</p>
        `);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('=================================');
    console.log(`Servidor corriendo en puerto ${PORT}`);
    console.log(`Status: https://json-for-whatsapp.onrender.com/status`);
    console.log('=================================');
});
