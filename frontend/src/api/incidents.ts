import { api } from './client';
import type {
  Incident,
  IncidentListResponse,
  IncidentTimelineEntry,
  CreateIncidentPayload,
  UpdateIncidentStatusPayload,
} from '../types/incident';

/** Citizen: report a new incident */
export async function createIncident(payload: CreateIncidentPayload): Promise<Incident> {
  const res = await api.post<Incident>('/incidents', payload);
  return res.data;
}

/** Citizen: list own incidents */
export async function getMyIncidents(skip = 0, limit = 50): Promise<IncidentListResponse> {
  const res = await api.get<IncidentListResponse>('/incidents/my', {
    params: { skip, limit },
  });
  return res.data;
}

/** Any authenticated user who owns the incident, or admin */
export async function getIncidentById(id: number): Promise<Incident> {
  const res = await api.get<Incident>(`/incidents/${id}`);
  return res.data;
}

/** Any authenticated user who owns the incident, or admin */
export async function getIncidentTimeline(id: number): Promise<IncidentTimelineEntry[]> {
  const res = await api.get<IncidentTimelineEntry[]>(`/incidents/${id}/timeline`);
  return res.data;
}

/** Admin: list all incidents with optional filters */
export async function listIncidents(params?: {
  skip?: number;
  limit?: number;
  priority?: string;
  status?: string;
}): Promise<IncidentListResponse> {
  const res = await api.get<IncidentListResponse>('/incidents', { params });
  return res.data;
}

/** Admin: update incident status */
export async function updateIncidentStatus(
  id: number,
  payload: UpdateIncidentStatusPayload
): Promise<Incident> {
  const res = await api.patch<Incident>(`/incidents/${id}/status`, payload);
  return res.data;
}

/** Admin: update incident fields (title, description, etc.) */
export async function updateIncident(
  id: number,
  payload: Partial<Pick<Incident, 'title' | 'description' | 'address'>>
): Promise<Incident> {
  const res = await api.patch<Incident>(`/incidents/${id}`, payload);
  return res.data;
}
