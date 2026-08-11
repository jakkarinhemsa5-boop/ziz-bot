const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = 3000;

const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.png': 'image/png',
};

// เก็บ SSE clients ทั้งหมดที่กำลัง listen อยู่
let sseClients = [];

const server = http.createServer((req, res) => {
    // กำหนด base ให้ URL parser ไม่พัง
    const urlObj = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = urlObj.pathname;

    // --- CORS Headers ---
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // --- SSE: Receiver เชื่อมต่อเพื่อรับข้อมูล ---
    if (pathname === '/api/events' && req.method === 'GET') {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        });
        res.write('data: {"type":"CONNECTED"}\n\n');

        sseClients.push(res);
        console.log(`[SSE] Client connected. Total: ${sseClients.length}`);

        req.on('close', () => {
            sseClients = sseClients.filter(c => c !== res);
            console.log(`[SSE] Client disconnected. Total: ${sseClients.length}`);
        });
        return;
    }

    // --- API: Sender ส่งข้อมูลมาที่นี่ ---
    if (pathname === '/api/send' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const message = JSON.parse(body);
                console.log(`[SEND] Broadcasting to ${sseClients.length} client(s):`, message.status);

                const payload = `data: ${JSON.stringify(message)}\n\n`;
                sseClients.forEach(client => {
                    try { client.write(payload); } catch(e) {}
                });

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true, delivered: sseClients.length }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }));
            }
        });
        return;
    }

    // --- Static File Server ---
    let filePath = pathname === '/' ? '/sender.html' : pathname;
    filePath = path.join(__dirname, filePath);

    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'text/plain';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 - Not Found');
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log('');
    console.log('✅ HTTP Server (with SSE) is running!');
    console.log('');
    console.log('🎮 Controller (Sender):  http://localhost:' + PORT + '/sender.html');
    console.log('📺 Display  (Receiver):  http://localhost:' + PORT + '/receiver.html');
    console.log('');
    console.log('Press Ctrl+C to stop the server.');
});
