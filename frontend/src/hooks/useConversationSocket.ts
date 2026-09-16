import { useEffect, useRef, useState } from 'react';

export interface Message {
  id: number;
  sender_id: number;
  content: string;
  timestamp: string;
  is_emergency: boolean;
  priority: string | null;
  score?: number;
  latitude?: number;
  longitude?: number;
  address?: string;
  safe_routes?: string[];
}

export interface MessageCreate {
  content: string;
  is_emergency: boolean;
  priority?: string;
  score?: number;
  latitude?: number;
  longitude?: number;
  address?: string;
  safe_routes?: string[];
}

const API_BASE = (import.meta.env.VITE_API_URL as string) || "http://127.0.0.1:8000/api/v1";

function buildWsUrl(conversationId: string | number, token: string) {
  // Strip /api/v1 suffix to get the base host, then build ws:// URL
  const base = API_BASE.replace(/\/api\/v1\/?$/, '');
  const wsBase = base.replace(/^http/, 'ws');
  return `${wsBase}/ws/${conversationId}?token=${token}`;
}

/**
 * Hook that manages a WebSocket connection for a conversation.
 * Falls back gracefully if the WebSocket is rejected (e.g. admin-token).
 */
export function useConversationSocket(conversationId: string | number) {
  const [messages, setMessages] = useState<Message[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token') ?? '';
    if (!token) return;

    const url = buildWsUrl(conversationId, token);
    let ws: WebSocket;

    try {
      ws = new WebSocket(url);
    } catch (e) {
      console.error('Failed to create WebSocket', e);
      return;
    }

    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      console.log('WebSocket connected for conversation', conversationId);
    };

    ws.onmessage = (event) => {
      try {
        const msg: Message = JSON.parse(event.data);
        setMessages((prev) => [...prev, msg]);

        // Browser notification for emergency messages
        const notificationsEnabled = localStorage.getItem('notificationsEnabled') !== 'false';
        if (msg.is_emergency && 'Notification' in window && notificationsEnabled) {
          if (Notification.permission === 'granted') {
            new Notification('🚨 Emergency Alert', {
              body: `${msg.priority ?? 'ALERT'}: ${msg.content}`,
              icon: '/favicon.ico',
            });
          } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then((perm) => {
              if (perm === 'granted') {
                new Notification('🚨 Emergency Alert', {
                  body: `${msg.priority ?? 'ALERT'}: ${msg.content}`,
                });
              }
            });
          }
        }
      } catch (e) {
        console.error('Failed to parse WS message', e);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      console.log('WebSocket closed');
    };

    ws.onerror = (err) => {
      console.error('WebSocket error', err);
      setConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [conversationId]);

  const sendMessage = (msg: MessageCreate) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    } else {
      console.warn('WebSocket not open, cannot send message');
    }
  };

  return { messages, sendMessage, connected };
}
