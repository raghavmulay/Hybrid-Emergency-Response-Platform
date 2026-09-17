// Shared TypeScript interfaces for the Incident domain (Part 1)

export type IncidentType =
  | 'fire'
  | 'flood'
  | 'medical'
  | 'road_accident'
  | 'building_collapse'
  | 'electrical_hazard'
  | 'missing_person'
  | 'trapped_person'
  | 'security_emergency'
  | 'road_blockage'
  | 'other';

export type IncidentPriority = 'low' | 'medium' | 'high' | 'critical';

export type IncidentStatus =
  | 'reported'
  | 'acknowledged'
  | 'verified'
  | 'assigned'
  | 'accepted'
  | 'en_route'
  | 'on_scene'
  | 'resolving'
  | 'resolved'
  | 'rejected'
  | 'false_alarm'
  | 'duplicate'
  | 'cancelled'
  | 'needs_information';

export interface Incident {
  id: number;
  incident_number: string;
  title: string;
  description: string | null;
  type: IncidentType;
  status: IncidentStatus;
  priority: IncidentPriority;
  calculated_priority: IncidentPriority | null;
  user_selected_priority: IncidentPriority | null;
  severity_score: number | null;
  priority_reason: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  details: Record<string, unknown> | null;
  resource_recommendations: string[];
  reporter_id: number;
  created_at: string;
  updated_at: string;
  // Phase 3
  possible_duplicate: boolean;
  duplicate_of_incident_id: number | null;
  reported_at: string | null;
  acknowledged_at: string | null;
  verified_at: string | null;
  assigned_at: string | null;
  accepted_at: string | null;
  en_route_at: string | null;
  on_scene_at: string | null;
  resolving_at: string | null;
  resolved_at: string | null;
}

export interface IncidentTimelineEntry {
  status: IncidentStatus;
  changed_at: string;
  reason: string | null;
}

export interface IncidentListResponse {
  incidents: Incident[];
  total: number;
}

export interface CreateIncidentPayload {
  title: string;
  type: IncidentType;
  description?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  details?: Record<string, unknown>;
  user_selected_priority?: IncidentPriority;
}

export interface UpdateIncidentStatusPayload {
  status: IncidentStatus;
  reason?: string;
}

// WS incident event envelope
export interface IncidentSocketEvent {
  type: 'incident';
  event: 'created' | 'status_updated';
  payload: Incident;
}

// WS assignment/responder events
export interface AssignmentSocketEvent {
  type: 'incident';
  event: 'incident_assigned' | 'assignment_updated' | 'responder_status_updated';
  payload: Record<string, unknown>;
}

export type AssignmentStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'completed';

export interface Assignment {
  id: number;
  incident_id: number;
  responder_id: number;
  assigned_by: number;
  assigned_at: string;
  status: AssignmentStatus;
  accepted_at: string | null;
  rejected_at: string | null;
  completed_at: string | null;
  rejection_reason: string | null;
  notes: string | null;
  incident?: Incident;
}

export interface Responder {
  id: number;
  email: string;
  role: string;
  availability: 'AVAILABLE' | 'BUSY' | 'OFFLINE';
  latitude: number | null;
  longitude: number | null;
  active_assignments: number;
  distance_km?: number | null;
}
