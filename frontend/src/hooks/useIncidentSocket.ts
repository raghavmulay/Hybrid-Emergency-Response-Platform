import { useEffect, useRef, useState, useCallback } from 'react';
import type { Incident, IncidentSocketEvent } from '../types/incident';

const API_BASE = (import.meta.env.VITE_API_URL as string) || 'http://127.0.0.1:8000/api/v1';

function buildWsUrl(token: string) {
  const base = API_BASE.replace(/\/api\/v1\/?$/, '');
  const wsBase = base.replace(/^http/, 'ws');
  return `${wsBase}/ws/0?token=${token}`;
}

export type WsConnectionStatus = 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED';

interface UseIncidentSocketResult {
  latestEvent: IncidentSocketEvent | null;
  incidentCreated: Incident | null;
  incidentUpdated: Incident | null;
  connectionStatus: WsConnectionStatus;
}

const BACKOFF_DELAYS = [1000, 2000, 4000, 8000, 10000];

export function useIncidentSocket(): UseIncidentSocketResult {
  const [latestEvent, setLatestEvent] = useState<IncidentSocketEvent | null>(null);
  const [incidentCreated, setIncidentCreated] = useState<Incident | null>(null);
  const [incidentUpdated, setIncidentUpdated] = useState<Incident | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<WsConnectionStatus>('CONNECTING');

  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

  const connect = useCallback(() => {
    const token = localStorage.getItem('token') ?? '';
    if (!token || unmountedRef.current) return;

    setConnectionStatus('CONNECTING');

    let ws: WebSocket;
    try {
      ws = new WebSocket(buildWsUrl(token));
    } catch {
      scheduleReconnect();
      return;
    }

    wsRef.current = ws;

    ws.onopen = () => {
      if (unmountedRef.current) { ws.close(); return; }
      retryRef.current = 0;
      setConnectionStatus('CONNECTED');
    };

    ws.onmessage = (event) => {
      try {
        const raw = JSON.parse(event.data as string);
        if (raw.type === 'incident') {
          const evt = raw as IncidentSocketEvent;
          setLatestEvent(evt);
          if (evt.event === 'created') setIncidentCreated(evt.payload);
          if (evt.event === 'status_updated') setIncidentUpdated(evt.payload);
        }
      } catch { /* non-JSON or non-incident — ignore */ }
    };

    ws.onclose = () => {
      if (unmountedRef.current) return;
      setConnectionStatus('DISCONNECTED');
      scheduleReconnect();
    };

    ws.onerror = () => {
      // onclose fires after onerror, so reconnect is handled there
      setConnectionStatus('DISCONNECTED');
    };
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (unmountedRef.current) return;
    const delay = BACKOFF_DELAYS[Math.min(retryRef.current, BACKOFF_DELAYS.length - 1)];
    retryRef.current += 1;
    timerRef.current = setTimeout(() => {
      if (!unmountedRef.current) connect();
    }, delay);
  }, [connect]);

  useEffect(() => {
    unmountedRef.current = false;
    connect();
    return () => {
      unmountedRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { latestEvent, incidentCreated, incidentUpdated, connectionStatus };
}
