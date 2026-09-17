import { api } from './client';

export interface AuditLogEntry {
  id: number;
  actor_id: number | null;
  actor_role: string;
  action: string;
  entity_type: string;
  entity_id: number | null;
  description: string;
  created_at: string;
}

export interface AuditLogResponse {
  total: number;
  page: number;
  page_size: number;
  logs: AuditLogEntry[];
}

export async function getAuditLogs(params?: {
  actor_id?: number;
  action?: string;
  entity_type?: string;
  from_date?: string;
  to_date?: string;
  page?: number;
  page_size?: number;
}): Promise<AuditLogResponse> {
  const res = await api.get<AuditLogResponse>('/audit-logs', { params });
  return res.data;
}
