'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { getSocket } from './socket-client';

const SocketContext = createContext(null);

export function useSocket() {
  return useContext(SocketContext);
}

export default function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const s = getSocket();
    s.connect();
    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
}
