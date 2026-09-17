import type { IncidentType } from '../types/incident';

/**
 * Human-readable label for each backend IncidentType enum value.
 * Keys must match the backend IncidentType enum values exactly.
 */
export const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
  fire: '🔥 Fire',
  flood: '🌊 Flood',
  medical: '🚑 Medical Emergency',
  road_accident: '🚗 Road Accident',
  building_collapse: '🏚️ Building Collapse',
  electrical_hazard: '⚡ Electrical Hazard',
  missing_person: '🔍 Missing Person',
  trapped_person: '🆘 Trapped Person',
  security_emergency: '🔒 Crime / Security',
  road_blockage: '🚧 Road Blockage',
  other: '❓ Other',
};

/**
 * Incident types available in the Report form (citizen-facing, ordered for usability).
 */
export const CITIZEN_INCIDENT_TYPES: IncidentType[] = [
  'road_accident',
  'fire',
  'medical',
  'security_emergency',
  'flood',
  'building_collapse',
  'electrical_hazard',
  'missing_person',
  'trapped_person',
  'road_blockage',
  'other',
];

export interface QuestionField {
  /** Key used in `details` payload sent to backend */
  key: string;
  /** Visible label */
  label: string;
  type: 'number' | 'boolean' | 'text' | 'select';
  /** For select type */
  options?: { value: string; label: string }[];
  placeholder?: string;
  /** If true, must have a non-empty answer before form can be submitted */
  required?: boolean;
}

/**
 * Dynamic questionnaire configuration per incident type.
 * These keys feed into the `details` object sent to the backend,
 * which the triage utility uses to compute severity.
 */
export const INCIDENT_QUESTIONS: Record<IncidentType, QuestionField[]> = {
  road_accident: [
    { key: 'description', label: 'What happened?', type: 'text', placeholder: 'Describe the accident briefly', required: true },
    { key: 'injured', label: 'Number of injured people', type: 'number', placeholder: '0' },
    { key: 'trapped', label: 'Are people trapped?', type: 'boolean' },
    { key: 'missing', label: 'Are people missing?', type: 'boolean' },
    { key: 'children', label: 'Are children involved?', type: 'boolean' },
    { key: 'vehicles_involved', label: 'Number of vehicles involved', type: 'number', placeholder: '1' },
    { key: 'hazmat', label: 'Hazardous materials involved?', type: 'boolean' },
  ],
  fire: [
    { key: 'description', label: 'What is burning?', type: 'text', placeholder: 'Building, vehicle, forest, etc.', required: true },
    { key: 'injured', label: 'Are people injured?', type: 'boolean' },
    { key: 'trapped', label: 'Are people trapped?', type: 'boolean' },
    { key: 'children', label: 'Are children involved?', type: 'boolean' },
    { key: 'spreading', label: 'Is the fire spreading?', type: 'boolean' },
    { key: 'affected', label: 'Estimated people affected', type: 'number', placeholder: '0' },
  ],
  medical: [
    { key: 'description', label: 'What is the medical emergency?', type: 'text', placeholder: 'Heart attack, accident, etc.', required: true },
    { key: 'affected', label: 'Number of people affected', type: 'number', placeholder: '1' },
    { key: 'conscious', label: 'Is the person conscious?', type: 'boolean' },
    { key: 'children', label: 'Are children involved?', type: 'boolean' },
    { key: 'immediate_assistance', label: 'Is immediate medical assistance required?', type: 'boolean' },
  ],
  security_emergency: [
    { key: 'description', label: 'What happened?', type: 'text', placeholder: 'Robbery, assault, threat, etc.', required: true },
    { key: 'ongoing', label: 'Is the situation still ongoing?', type: 'boolean' },
    { key: 'injured', label: 'Is anyone injured?', type: 'boolean' },
    { key: 'immediate_danger', label: 'Is anyone in immediate danger?', type: 'boolean' },
    { key: 'affected', label: 'Number of people involved', type: 'number', placeholder: '1' },
  ],
  flood: [
    { key: 'description', label: 'Describe the flooding situation', type: 'text', placeholder: 'Area flooded, depth, etc.', required: true },
    { key: 'affected', label: 'Estimated people affected', type: 'number', placeholder: '0' },
    { key: 'injured', label: 'Number of injured people', type: 'number', placeholder: '0' },
    { key: 'trapped', label: 'Are people trapped?', type: 'boolean' },
    { key: 'missing', label: 'Are people missing?', type: 'boolean' },
    { key: 'children', label: 'Are children involved?', type: 'boolean' },
  ],
  building_collapse: [
    { key: 'description', label: 'Describe the collapse', type: 'text', placeholder: 'Partial, full, floors, etc.', required: true },
    { key: 'trapped', label: 'Are people trapped?', type: 'boolean' },
    { key: 'injured', label: 'Number of injured people', type: 'number', placeholder: '0' },
    { key: 'missing', label: 'Are people missing?', type: 'boolean' },
    { key: 'children', label: 'Are children involved?', type: 'boolean' },
    { key: 'affected', label: 'Estimated people affected', type: 'number', placeholder: '0' },
  ],
  electrical_hazard: [
    { key: 'description', label: 'Describe the hazard', type: 'text', placeholder: 'Fallen wire, transformer fire, etc.', required: true },
    { key: 'injured', label: 'Are people injured?', type: 'boolean' },
    { key: 'immediate_danger', label: 'Is anyone in immediate danger?', type: 'boolean' },
    { key: 'affected', label: 'People in the affected area', type: 'number', placeholder: '0' },
  ],
  missing_person: [
    { key: 'description', label: 'Who is missing?', type: 'text', placeholder: 'Age, description, last seen location', required: true },
    { key: 'missing', label: 'Number of missing people', type: 'number', placeholder: '1' },
    { key: 'children', label: 'Is the missing person a child?', type: 'boolean' },
    { key: 'time_missing', label: 'How long have they been missing?', type: 'text', placeholder: 'e.g. 2 hours, since morning' },
  ],
  trapped_person: [
    { key: 'description', label: 'Describe the situation', type: 'text', placeholder: 'How are they trapped, where', required: true },
    { key: 'trapped', label: 'Number of people trapped', type: 'number', placeholder: '1' },
    { key: 'injured', label: 'Are they injured?', type: 'boolean' },
    { key: 'children', label: 'Are children involved?', type: 'boolean' },
  ],
  road_blockage: [
    { key: 'description', label: 'What is causing the blockage?', type: 'text', placeholder: 'Tree fall, landslide, vehicle, etc.', required: true },
    { key: 'affected', label: 'People affected/stranded', type: 'number', placeholder: '0' },
    { key: 'injured', label: 'Are people injured?', type: 'boolean' },
  ],
  other: [
    { key: 'description', label: 'Describe the emergency', type: 'text', placeholder: 'Provide as much detail as possible', required: true },
    { key: 'affected', label: 'Estimated people affected', type: 'number', placeholder: '0' },
    { key: 'injured', label: 'Are people injured?', type: 'boolean' },
  ],
};

export const PRIORITY_LABELS: Record<string, string> = {
  critical: '🔴 CRITICAL',
  high: '🟠 HIGH',
  medium: '🟡 MEDIUM',
  low: '🔵 LOW',
};

export const PRIORITY_BADGE_CLASSES: Record<string, string> = {
  critical: 'bg-red-600 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-500 text-black',
  low: 'bg-blue-600 text-white',
};

export const STATUS_LABELS: Record<string, string> = {
  reported: '📋 Reported',
  acknowledged: '👁️ Acknowledged',
  verified: '✅ Verified',
  assigned: '👤 Assigned',
  accepted: '🤝 Accepted',
  en_route: '🚗 En Route',
  on_scene: '📍 On Scene',
  resolving: '🔧 Resolving',
  resolved: '🟢 Resolved',
  rejected: '❌ Rejected',
  false_alarm: '⚪ False Alarm',
  duplicate: '🔁 Duplicate',
  cancelled: '🚫 Cancelled',
  needs_information: '❓ Needs Info',
};

/** Part 1 admin-allowed statuses */
export const ADMIN_ALLOWED_STATUSES = [
  'acknowledged',
  'verified',
  'rejected',
  'false_alarm',
  'duplicate',
  'needs_information',
  'cancelled',
  'resolved',
] as const;

export const ASSIGNMENT_STATUS_LABELS: Record<string, string> = {
  pending: '⏳ Pending',
  accepted: '✅ Accepted',
  rejected: '❌ Rejected',
  cancelled: '🚫 Cancelled',
  completed: '🏁 Completed',
};

export const AVAILABILITY_LABELS: Record<string, string> = {
  AVAILABLE: '🟢 Available',
  BUSY: '🟡 Busy',
  OFFLINE: '⚫ Offline',
};

export const AVAILABILITY_BADGE: Record<string, string> = {
  AVAILABLE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  BUSY: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  OFFLINE: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
};
