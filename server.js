// ============================================================
// KDA 평가 시스템 — 커스텀 서버
// Next.js + Socket.io를 하나의 HTTP 서버에서 구동한다.
// App Router만으로는 WebSocket을 지원할 수 없어 커스텀 서버가 필요.
// global.__io로 Socket.io 인스턴스를 API route에서 참조할 수 있게 한다.
// ============================================================

import { createServer } from 'http';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(handler);

  const io = new SocketIOServer(httpServer, {
    cors: { origin: '*' },
  });

  // API route에서 접근 가능하게 global에 저장
  global.__io = io;

  io.on('connection', (socket) => {
    console.log(`[WS] Connected: ${socket.id}`);

    // 기수별 room 참가
    socket.on('join-cohort', (cohortId) => {
      socket.join(`cohort:${cohortId}`);
      console.log(`[WS] ${socket.id} joined cohort:${cohortId}`);
    });

    socket.on('leave-cohort', (cohortId) => {
      socket.leave(`cohort:${cohortId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[WS] Disconnected: ${socket.id}`);
    });
  });

  httpServer.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
