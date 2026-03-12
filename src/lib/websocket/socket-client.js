'use client';

import { io } from 'socket.io-client';

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io({
      autoConnect: false,
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}
