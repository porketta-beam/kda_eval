'use client';

import { createContext, useContext } from 'react';

export const CohortDataContext = createContext(null);

export function useCohortDataContext() {
  const ctx = useContext(CohortDataContext);
  if (!ctx) throw new Error('useCohortDataContext must be used within CohortDataContext.Provider');
  return ctx;
}
