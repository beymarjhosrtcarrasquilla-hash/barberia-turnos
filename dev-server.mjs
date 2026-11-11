import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.webmanifest': 'application/manifest+json',
};

// Clientes SSE para auto-reload
const sseClients = new Set();

function broadcastReload() {
  for (const client of sseClients) {
    client.write('data: reload\n\n');
  }
}

// Observador de cambios de archivos para Live Reload
let debounceTimer = null;
fs.watch(__dirname, { recursive: true }, (eventType, filename) => {
  if (!filename) return;
  // Ignorar archivos temporales o del sistema
  if (filename.includes('.git') || filename.includes('node_modules')) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    console.log(`[LiveReload] Cambio detectado en: ${filename}`);
    broadcastReload();
  }, 100);
});

const LIVE_RELOAD_SCRIPT = `
<script>
(() => {
  let es;
  function connect() {
    es = new EventSource('/__live_reload');
    es.onmessage = (e) => {
      if (e.data === 'reload') {
        console.log('[LiveReload] Recargando página...');
        window.location.reload();
      }
    };
    es.onerror = () => {
      es.close();
      setTimeout(connect, 1500);
    };
  }
  connect();
})();
</script>
`;

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];

  // Endpoint de Live Reload
  if (urlPath === '/__live_reload') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  // Normalizar ruta de archivo
  let safePath = path.normalize(urlPath).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '\\') safePath = '/index.html';

  let filePath = path.join(__dirname, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Si no existe, intentar con .html
      const htmlPath = filePath + '.html';
      if (fs.existsSync(htmlPath)) {
        filePath = htmlPath;
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found - Archivo no encontrado');
        return;
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('500 Error interno del servidor');
        return;
      }

      // Inyectar script de auto-reload en archivos HTML
      if (ext === '.html') {
        const bodyCloseIndex = content.lastIndexOf('</body>');
        if (bodyCloseIndex !== -1) {
          const before = content.subarray(0, bodyCloseIndex);
          const after = content.subarray(bodyCloseIndex);
          res.writeHead(200, { 'Content-Type': contentType });
          res.write(before);
          res.write(LIVE_RELOAD_SCRIPT);
          res.end(after);
          return;
        }
      }

      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`=======================================================`);
  console.log(`  BARBERÍA APP - Servidor de Desarrollo Ultraligero    `);
  console.log(`  (0 dependencias externas - optimizado para 4GB RAM) `);
  console.log(`=======================================================`);
  console.log(`  > Local:       http://localhost:${PORT}`);
  console.log(`  > Clientes:    http://localhost:${PORT}/index.html`);
  console.log(`  > Barbero:     http://localhost:${PORT}/barbero.html`);
  console.log(`  > Comparador:  http://localhost:${PORT}/comparador.html`);
  console.log(`  > Red/Móvil:   http://100.70.78.107:${PORT} (vía Tailscale)`);
  console.log(`=======================================================`);
});
