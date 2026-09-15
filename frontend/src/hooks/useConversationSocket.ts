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

/**
 * Hook that manages a WebSocket connection for a conversation.
 * It returns the list of received messages and a helper to send a message.
 */
export function useConversationSocket(conversationId: string | number) {
  const [messages, setMessages] = useState<Message[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token') ?? '';
    const ws = new WebSocket(`ws://${import.meta.env.VITE_API_URL.replace(/^http/, 'ws')}/ws/${conversationId}?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected for conversation', conversationId);
    };

    ws.onmessage = (event) => {
      try {
        const msg: Message = JSON.parse(event.data);
        setMessages((prev) => [...prev, msg]);
        // Show browser notification for emergency messages if permission granted
        if (msg.is_emergency && 'Notification' in window) {
          if (Notification.permission === 'granted') {
            new Notification('Emergency Alert', { body: `${msg.priority ?? ''} ${msg.content}` });
          } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then((perm) => {
              if (perm === 'granted') {
                new Notification('Emergency Alert', { body: `${msg.priority ?? ''} ${msg.content}` });
              }
            });
          }
        }
      } catch (e) {
        console.error('Failed to parse WS message', e);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket closed');
    };

    ws.onerror = (err) => {
      console.error('WebSocket error', err);
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

  return { messages, sendMessage };
}
