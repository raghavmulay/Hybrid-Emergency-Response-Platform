import { api } from './client';
import type { Responder, Assignment } from '../types/incident';

export async function getMyProfile(): Promise<Responder> {
  const res = await api.get<Responder>('/responders/me');
  return res.data;
}

export async function updateMyAvailability(availability: string): Promise<Responder> {
  const res = await api.patch<Responder>('/responders/me/availability', { availability });
  return res.data;
}

export async function updateMyLocation(latitude: number, longitude: number): Promise<Responder> {
  const res = await api.patch<Responder>('/responders/me/location', { latitude, longitude });
  return res.data;
}

export async function getMyAssignments(): Promise<Assignment[]> {
  const res = await api.get<Assignment[]>('/responders/me/assignments');
  return res.data;
}

export async function acceptAssignment(assignmentId: number): Promise<Assignment> {
  const res = await api.post<Assignment>(`/responders/assignments/${assignmentId}/accept`);
  return res.data;
}

export async function rejectAssignment(assignmentId: number, reason?: string): Promise<Assignment> {
  const res = await api.post<Assignment>(`/responders/assignments/${assignmentId}/reject`, { reason });
  return res.data;
}

export async function listResponders(): Promise<Responder[]> {
  const res = await api.get<Responder[]>('/responders');
  return res.data;
}

export async function listAvailableResponders(): Promise<Responder[]> {
  const res = await api.get<Responder[]>('/responders/available');
  return res.data;
}

export async function suggestResponders(incidentId: number): Promise<Responder[]> {
  const res = await api.get<Responder[]>(`/responders/suggest/${incidentId}`);
  return res.data;
}

export async function assignResponder(
  incidentId: number,
  responderId: number,
  notes?: string
): Promise<Assignment> {
  const res = await api.post<Assignment>(`/responders/incidents/${incidentId}/assign`, {
    responder_id: responderId,
    notes,
  });
  return res.data;
}

export async function getIncidentAssignments(incidentId: number): Promise<Assignment[]> {
  const res = await api.get<Assignment[]>(`/incidents/${incidentId}/assignments`);
  return res.data;
}
