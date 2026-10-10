import type { IncidentType } from '../types/incident';

export const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
  earthquake:             '🌍 Earthquake',
  flood:                  '🌊 Flood / Flash Flood',
  cyclone:                '🌪️ Cyclone / Severe Storm',
  landslide:              '⛰️ Landslide',
  wildfire:               '🔥 Wildfire / Forest Fire',
  building_collapse:      '🏚️ Building / Structural Collapse',
  industrial_hazard:      '☣️ Industrial / Chemical Hazard',
  infrastructure_failure: '⚡ Major Infrastructure Failure',
  mass_casualty:          '🚨 Mass Casualty / Large-Scale Emergency',
  other:                  '❓ Other Disaster',
};

export const CITIZEN_INCIDENT_TYPES: IncidentType[] = [
  'earthquake',
  'flood',
  'cyclone',
  'landslide',
  'wildfire',
  'building_collapse',
  'industrial_hazard',
  'infrastructure_failure',
  'mass_casualty',
  'other',
];

export interface QuestionField {
  key: string;
  label: string;
  type: 'number' | 'boolean' | 'text' | 'select';
  options?: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
}

export const INCIDENT_QUESTIONS: Record<IncidentType, QuestionField[]> = {
  earthquake: [
    { key: 'description',        label: 'Describe the situation',                    type: 'text',    placeholder: 'Tremors felt, buildings damaged, etc.', required: true },
    { key: 'injured',            label: 'Number of people injured',                  type: 'number',  placeholder: '0' },
    { key: 'trapped',            label: 'Are people trapped under debris?',          type: 'boolean' },
    { key: 'buildings_damaged',  label: 'Are buildings damaged or collapsed?',       type: 'boolean' },
    { key: 'roads_blocked',      label: 'Are roads blocked?',                        type: 'boolean' },
    { key: 'affected',           label: 'Estimated number of people affected',       type: 'number',  placeholder: '0' },
    { key: 'immediate_rescue',   label: 'Is immediate rescue required?',             type: 'boolean' },
    { key: 'children',           label: 'Are children involved?',                    type: 'boolean' },
  ],

  flood: [
    { key: 'description',        label: 'Describe the flooding situation',           type: 'text',    placeholder: 'Area flooded, water level, etc.', required: true },
    { key: 'water_severity',     label: 'Water level / severity',                   type: 'select',  options: [
        { value: 'minor',    label: 'Minor — ankle deep' },
        { value: 'moderate', label: 'Moderate — knee to waist deep' },
        { value: 'severe',   label: 'Severe — above waist / flowing fast' },
      ], required: true },
    { key: 'trapped',            label: 'Are people stranded or trapped?',           type: 'boolean' },
    { key: 'buildings_affected', label: 'Are buildings submerged or damaged?',       type: 'boolean' },
    { key: 'roads_blocked',      label: 'Are roads inaccessible?',                   type: 'boolean' },
    { key: 'injured',            label: 'Number of people injured',                  type: 'number',  placeholder: '0' },
    { key: 'affected',           label: 'Estimated number of people affected',       type: 'number',  placeholder: '0' },
    { key: 'children',           label: 'Are children involved?',                    type: 'boolean' },
    { key: 'immediate_rescue',   label: 'Is medical / rescue assistance required?',  type: 'boolean' },
  ],

  cyclone: [
    { key: 'description',        label: 'Describe the storm situation',              type: 'text',    placeholder: 'Wind speed, damage, area affected', required: true },
    { key: 'wind_severity',      label: 'Wind / storm severity',                    type: 'select',  options: [
        { value: 'moderate', label: 'Moderate — strong winds, minor damage' },
        { value: 'severe',   label: 'Severe — structural damage, uprooted trees' },
        { value: 'extreme',  label: 'Extreme — widespread destruction' },
      ], required: true },
    { key: 'injured',            label: 'Number of people injured',                  type: 'number',  placeholder: '0' },
    { key: 'trapped',            label: 'Are people trapped?',                       type: 'boolean' },
    { key: 'evacuation_required',label: 'Is evacuation required?',                   type: 'boolean' },
    { key: 'affected',           label: 'Estimated number of people affected',       type: 'number',  placeholder: '0' },
    { key: 'children',           label: 'Are children involved?',                    type: 'boolean' },
  ],

  landslide: [
    { key: 'description',        label: 'Describe the landslide',                   type: 'text',    placeholder: 'Mudslide, debris flow, area affected', required: true },
    { key: 'injured',            label: 'Number of people injured',                  type: 'number',  placeholder: '0' },
    { key: 'trapped',            label: 'Are people trapped or buried?',             type: 'boolean' },
    { key: 'roads_blocked',      label: 'Are roads blocked?',                        type: 'boolean' },
    { key: 'buildings_damaged',  label: 'Are buildings damaged?',                    type: 'boolean' },
    { key: 'affected',           label: 'Estimated number of people affected',       type: 'number',  placeholder: '0' },
    { key: 'immediate_rescue',   label: 'Is immediate rescue required?',             type: 'boolean' },
    { key: 'children',           label: 'Are children involved?',                    type: 'boolean' },
  ],

  wildfire: [
    { key: 'description',        label: 'Describe the fire situation',               type: 'text',    placeholder: 'Forest, grassland, buildings threatened, etc.', required: true },
    { key: 'spreading',          label: 'Is the fire actively spreading?',           type: 'boolean' },
    { key: 'injured',            label: 'Number of people injured',                  type: 'number',  placeholder: '0' },
    { key: 'trapped',            label: 'Are people trapped or unable to evacuate?', type: 'boolean' },
    { key: 'buildings_threatened', label: 'Are buildings or infrastructure threatened?', type: 'boolean' },
    { key: 'evacuation_required', label: 'Is evacuation required?',                  type: 'boolean' },
    { key: 'affected',           label: 'Approximate area / people affected',        type: 'number',  placeholder: '0' },
    { key: 'children',           label: 'Are children involved?',                    type: 'boolean' },
  ],

  building_collapse: [
    { key: 'description',        label: 'Describe the collapse',                     type: 'text',    placeholder: 'Partial, full, floors, cause', required: true },
    { key: 'collapse_extent',    label: 'Extent of collapse',                        type: 'select',  options: [
        { value: 'partial', label: 'Partial — section or floor' },
        { value: 'full',    label: 'Full — entire structure' },
        { value: 'imminent', label: 'Imminent — structure unstable' },
      ], required: true },
    { key: 'trapped',            label: 'Are people trapped inside?',                type: 'boolean' },
    { key: 'injured',            label: 'Number of people injured',                  type: 'number',  placeholder: '0' },
    { key: 'affected',           label: 'Estimated number of people affected',       type: 'number',  placeholder: '0' },
    { key: 'hazmat',             label: 'Are hazardous materials (gas, chemicals) involved?', type: 'boolean' },
    { key: 'evacuation_required', label: 'Is evacuation of surrounding area required?', type: 'boolean' },
    { key: 'children',           label: 'Are children involved?',                    type: 'boolean' },
  ],

  industrial_hazard: [
    { key: 'description',        label: 'Describe the hazard',                       type: 'text',    placeholder: 'Chemical leak, explosion, industrial fire, etc.', required: true },
    { key: 'hazard_type',        label: 'Type of hazard',                            type: 'select',  options: [
        { value: 'chemical_leak',  label: 'Chemical / toxic leak' },
        { value: 'explosion',      label: 'Explosion' },
        { value: 'industrial_fire', label: 'Industrial fire' },
        { value: 'radiation',      label: 'Radiation / nuclear' },
        { value: 'other',          label: 'Other industrial hazard' },
      ], required: true },
    { key: 'chemical_leak',      label: 'Is there a chemical or toxic leak?',        type: 'boolean' },
    { key: 'injured',            label: 'Number of people injured',                  type: 'number',  placeholder: '0' },
    { key: 'immediate_danger',   label: 'Are people in immediate danger?',           type: 'boolean' },
    { key: 'evacuation_required', label: 'Is evacuation required?',                  type: 'boolean' },
    { key: 'affected',           label: 'Estimated number of people affected',       type: 'number',  placeholder: '0' },
  ],

  infrastructure_failure: [
    { key: 'description',        label: 'Describe the failure',                      type: 'text',    placeholder: 'Power grid, water supply, communications, etc.', required: true },
    { key: 'infrastructure_type', label: 'Type of infrastructure affected',          type: 'select',  options: [
        { value: 'power',    label: 'Power / electricity grid' },
        { value: 'water',    label: 'Water supply / sewage' },
        { value: 'telecom',  label: 'Telecommunications / internet' },
        { value: 'transport', label: 'Transport / roads / bridges' },
        { value: 'hospital', label: 'Hospital / medical facility' },
        { value: 'other',    label: 'Other critical infrastructure' },
      ], required: true },
    { key: 'critical_infrastructure_down', label: 'Is critical infrastructure (hospital, emergency services) affected?', type: 'boolean' },
    { key: 'injured',            label: 'Are people injured as a result?',           type: 'boolean' },
    { key: 'affected',           label: 'Estimated number of people affected',       type: 'number',  placeholder: '0' },
    { key: 'immediate_danger',   label: 'Is anyone in immediate danger?',            type: 'boolean' },
  ],

  mass_casualty: [
    { key: 'description',        label: 'Describe the emergency',                    type: 'text',    placeholder: 'Stampede, explosion, multi-vehicle accident, etc.', required: true },
    { key: 'injured',            label: 'Estimated number of people injured',        type: 'number',  placeholder: '0', required: true },
    { key: 'trapped',            label: 'Are people trapped?',                       type: 'boolean' },
    { key: 'affected',           label: 'Total estimated people affected',           type: 'number',  placeholder: '0' },
    { key: 'evacuation_required', label: 'Is mass evacuation required?',             type: 'boolean' },
    { key: 'children',           label: 'Are children involved?',                    type: 'boolean' },
    { key: 'immediate_rescue',   label: 'Is immediate coordinated rescue required?', type: 'boolean' },
  ],

  other: [
    { key: 'description',        label: 'Describe the disaster / emergency',         type: 'text',    placeholder: 'Provide as much detail as possible', required: true },
    { key: 'injured',            label: 'Number of people injured',                  type: 'number',  placeholder: '0' },
    { key: 'trapped',            label: 'Are people trapped?',                       type: 'boolean' },
    { key: 'affected',           label: 'Estimated number of people affected',       type: 'number',  placeholder: '0' },
    { key: 'immediate_rescue',   label: 'Is immediate rescue required?',             type: 'boolean' },
  ],
};

export const PRIORITY_LABELS: Record<string, string> = {
  critical: '🔴 CRITICAL',
  high:     '🟠 HIGH',
  medium:   '🟡 MEDIUM',
  low:      '🔵 LOW',
};

export const PRIORITY_BADGE_CLASSES: Record<string, string> = {
  critical: 'bg-red-600 text-white',
  high:     'bg-orange-500 text-white',
  medium:   'bg-yellow-500 text-black',
  low:      'bg-blue-600 text-white',
};

export const STATUS_LABELS: Record<string, string> = {
  reported:          '📋 Reported',
  acknowledged:      '👁️ Acknowledged',
  verified:          '✅ Verified',
  assigned:          '👤 Assigned',
  accepted:          '🤝 Accepted',
  en_route:          '🚗 En Route',
  on_scene:          '📍 On Scene',
  resolving:         '🔧 Resolving',
  resolved:          '🟢 Resolved',
  rejected:          '❌ Rejected',
  false_alarm:       '⚪ False Alarm',
  duplicate:         '🔁 Duplicate',
  cancelled:         '🚫 Cancelled',
  needs_information: '❓ Needs Info',
};

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
  pending:   '⏳ Pending',
  accepted:  '✅ Accepted',
  rejected:  '❌ Rejected',
  cancelled: '🚫 Cancelled',
  completed: '🏁 Completed',
};

export const AVAILABILITY_LABELS: Record<string, string> = {
  AVAILABLE: '🟢 Available',
  BUSY:      '🟡 Busy',
  OFFLINE:   '⚫ Offline',
};

export const AVAILABILITY_BADGE: Record<string, string> = {
  AVAILABLE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  BUSY:      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  OFFLINE:   'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
};
