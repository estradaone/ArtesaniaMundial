const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const app = require('./app'); // ✅ importa la app sin iniciar

const HTTPS_PORT = 3001;
const HTTP_PORT = 3002;

// 🔐 Cargar certificados SSL
const privateKey = fs.readFileSync(path.join(__dirname, 'cert', 'key.pem'), 'utf8');
const certificate = fs.readFileSync(path.join(__dirname, 'cert', 'cert.pem'), 'utf8');
const credentials = { key: privateKey, cert: certificate };

// 🚀 Servidor HTTPS (para tu web)
https.createServer(credentials, app).listen(HTTPS_PORT, () => {
    console.log(`✅ Servidor HTTPS iniciado en https://localhost:${HTTPS_PORT}`);
});

// 🚀 Servidor HTTP (para tu app móvil en desarrollo)
http.createServer(app).listen(HTTP_PORT, '0.0.0.0', () => {
    console.log(`✅ Servidor HTTP para móvil iniciado en http://0.0.0.0:${HTTP_PORT}`);
});
