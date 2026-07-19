// server.js — 의존성 0 (npm install 불필요) Node 정적 파일 서버
// 브라우저가 요청한 파일(html/css/js/이미지)을 그대로 내려준다.
// 실행: node server.js  →  http://localhost:3000

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3000;

// 확장자 → MIME 타입 (브라우저가 파일 종류를 알게 해줌)
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  // 1) 쿼리(?뒤) 떼고, 루트('/')면 index.html 로
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';

  // 2) '../' 같은 경로 탈출 차단 (보안)
  const safePath = normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = join(__dirname, safePath);

  // 3) 파일 읽어서 내려주기
  try {
    const data = await readFile(filePath);
    const type = MIME[extname(filePath)] || 'application/octet-stream';
    // 개발 서버 — 브라우저가 예전 파일을 캐시해 새 코드가 안 보이는 일을 막는다
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`\n  🌊 Sea-Pulse  ▶  http://localhost:${PORT}\n`);
});
