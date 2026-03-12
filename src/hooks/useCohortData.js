'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '@/lib/websocket/SocketProvider';

export default function useCohortData(cohortId) {
  const [config, setConfig] = useState(null);
  const [students, setStudents] = useState(null);
  const [scores, setScores] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const socket = useSocket();

  const enc = (id) => encodeURIComponent(id);

  const fetchConfig = useCallback(async () => {
    if (!cohortId) return;
    const res = await fetch(`/api/cohorts/${enc(cohortId)}/config`);
    if (res.ok) setConfig(await res.json());
  }, [cohortId]);

  const fetchStudents = useCallback(async () => {
    if (!cohortId) return;
    const res = await fetch(`/api/cohorts/${enc(cohortId)}/students`);
    if (res.ok) setStudents(await res.json());
  }, [cohortId]);

  const fetchScores = useCallback(async () => {
    if (!cohortId) return;
    const res = await fetch(`/api/cohorts/${enc(cohortId)}/scores?calculated=true`);
    if (res.ok) setScores(await res.json());
  }, [cohortId]);

  const fetchResults = useCallback(async (mode = 'actual') => {
    if (!cohortId) return;
    const url = `/api/cohorts/${enc(cohortId)}/results${mode === 'projected' ? '?mode=projected' : ''}`;
    const res = await fetch(url);
    if (res.ok) setResults(await res.json());
  }, [cohortId]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchConfig(), fetchStudents(), fetchScores(), fetchResults()]);
    setLoading(false);
  }, [fetchConfig, fetchStudents, fetchScores, fetchResults]);

  // Initial fetch
  useEffect(() => {
    if (cohortId) fetchAll();
  }, [cohortId, fetchAll]);

  // WebSocket: join room and listen for changes
  useEffect(() => {
    if (!socket || !cohortId) return;

    socket.emit('join-cohort', cohortId);

    const handleDataChanged = (data) => {
      if (data.cohortId !== cohortId) return;
      // Re-fetch the changed data type
      switch (data.type) {
        case 'config': fetchConfig(); break;
        case 'students': fetchStudents(); break;
        case 'scores': fetchScores(); fetchResults(); break;
        default: fetchAll();
      }
    };

    socket.on('data-changed', handleDataChanged);

    return () => {
      socket.off('data-changed', handleDataChanged);
      socket.emit('leave-cohort', cohortId);
    };
  }, [socket, cohortId, fetchConfig, fetchStudents, fetchScores, fetchResults, fetchAll]);

  return {
    config, students, scores, results, loading,
    fetchConfig, fetchStudents, fetchScores, fetchResults, fetchAll,
    setConfig, setStudents, setScores, setResults,
  };
}
