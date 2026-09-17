import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { createIncident } from '../api/incidents';
import type { IncidentType, IncidentPriority, Incident } from '../types/incident';
import type { CreateIncidentPayload } from '../types/incident';
import {
  CITIZEN_INCIDENT_TYPES,
  INCIDENT_TYPE_LABELS,
  INCIDENT_QUESTIONS,
  PRIORITY_BADGE_CLASSES,
  PRIORITY_LABELS,
  STATUS_LABELS,
} from '../constants/incidentConfig';

// Fix Leaflet default icon
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function LocationPicker({ onSelect }: { onSelect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

type FormStep = 'type' | 'questions' | 'location' | 'review';

export default function ReportIncident() {
  const navigate = useNavigate();

  // Multi-step state
  const [step, setStep] = useState<FormStep>('type');
  const [selectedType, setSelectedType] = useState<IncidentType | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [extraDescription, setExtraDescription] = useState('');
  const [userPriority, setUserPriority] = useState<IncidentPriority | ''>('');

  // Location state
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [mapPickMode, setMapPickMode] = useState(false);

  // Submission result
  const [submitted, setSubmitted] = useState<Incident | null>(null);

  // ─── GPS ─────────────────────────────────────────────────────────────────
  const requestGps = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser. Please select location on the map.');
      return;
    }
    setGpsLoading(true);
    setGpsError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsLoading(false);
        setMapPickMode(false);
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsError('Location permission denied. You can select your location on the map below.');
        } else if (err.code === err.TIMEOUT) {
          setGpsError('Location request timed out. Please try again or select on the map.');
        } else {
          setGpsError('Could not get location. Please select on the map.');
        }
        setMapPickMode(true);
      },
      { timeout: 10000, maximumAge: 0 }
    );
  }, []);

  // ─── Mutation ─────────────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: async () => {
      if (!selectedType) throw new Error('No incident type selected');
      const details: Record<string, unknown> = { ...answers };
      if (extraDescription) details.extra_description = extraDescription;
      const payload: CreateIncidentPayload = {
        title: `${INCIDENT_TYPE_LABELS[selectedType]} — ${new Date().toLocaleString()}`,
        type: selectedType,
        description: extraDescription || undefined,
        details,
        latitude: location?.lat,
        longitude: location?.lng,
        address: address || undefined,
        user_selected_priority: userPriority || undefined,
      };
      return createIncident(payload);
    },
    onSuccess: (data) => {
      setSubmitted(data);
    },
  });

  const questions = selectedType ? INCIDENT_QUESTIONS[selectedType] : [];

  // ─── Validation helpers ───────────────────────────────────────────────────
  const questionsValid = () => {
    if (!selectedType) return false;
    return questions
      .filter((q) => q.required)
      .every((q) => {
        const val = answers[q.key];
        return val !== undefined && val !== '' && val !== null;
      });
  };

  // ─── Submitted success screen ─────────────────────────────────────────────
  if (submitted) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto mt-8">
          <div className="bg-white dark:bg-gray-800 border border-green-300 dark:border-green-700 rounded-2xl shadow-xl p-8 text-center space-y-5">
            <div className="text-6xl">✅</div>
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Emergency Report Submitted</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Your incident has been received and is being processed.</p>

            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-5 text-left space-y-3 border border-gray-200 dark:border-gray-600">
              <Row label="Incident Number" value={<span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{submitted.incident_number}</span>} />
              <Row label="Status" value={<span className="font-semibold">{STATUS_LABELS[submitted.status]}</span>} />
              <Row
                label="Calculated Priority"
                value={
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${PRIORITY_BADGE_CLASSES[submitted.calculated_priority ?? 'low']}`}>
                    {PRIORITY_LABELS[submitted.calculated_priority ?? 'low']}
                  </span>
                }
              />
              {submitted.severity_score !== null && (
                <Row label="Severity Score" value={`${submitted.severity_score}/100`} />
              )}
              {submitted.priority_reason && (
                <Row label="Triage Reason" value={submitted.priority_reason} />
              )}
              {submitted.resource_recommendations && submitted.resource_recommendations.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Recommended Resources</p>
                  <ul className="space-y-1">
                    {submitted.resource_recommendations.map((r, i) => (
                      <li key={i} className="text-sm font-medium text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                        <span className="text-emerald-500">✔</span> {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => navigate(`/incident/${submitted.id}`)}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-colors"
              >
                View Incident Details →
              </button>
              <button
                onClick={() => navigate('/my-incidents')}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-semibold transition-colors"
              >
                My Incidents
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // ─── Step 1: Select Incident Type ─────────────────────────────────────────
  if (step === 'type') {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
              🚨 Report an Emergency
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Select the type of emergency you are reporting.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {CITIZEN_INCIDENT_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => { setSelectedType(type); setStep('questions'); }}
                className={`p-4 rounded-2xl border-2 text-left font-semibold text-sm transition-all hover:shadow-md ${
                  selectedType === type
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:border-indigo-400'
                }`}
              >
                {INCIDENT_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  // ─── Step 2: Dynamic Questions ────────────────────────────────────────────
  if (step === 'questions') {
    return (
      <Layout>
        <div className="max-w-xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setStep('type')} className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">← Back</button>
            <h1 className="text-xl font-extrabold text-gray-900 dark:text-white">
              {selectedType && INCIDENT_TYPE_LABELS[selectedType]}
            </h1>
          </div>

          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg p-6 space-y-5">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              Answer the questions below. They help assess the severity and dispatch appropriate resources.
            </p>

            {questions.map((q) => (
              <div key={q.key}>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  {q.label}
                  {q.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                {q.type === 'text' && (
                  <textarea
                    rows={2}
                    placeholder={q.placeholder}
                    value={(answers[q.key] as string) ?? ''}
                    onChange={(e) => setAnswers((p) => ({ ...p, [q.key]: e.target.value }))}
                    className="w-full rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                )}
                {q.type === 'number' && (
                  <input
                    type="number"
                    min={0}
                    placeholder={q.placeholder ?? '0'}
                    value={(answers[q.key] as number) ?? ''}
                    onChange={(e) => setAnswers((p) => ({ ...p, [q.key]: parseInt(e.target.value) || 0 }))}
                    className="w-full rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                )}
                {q.type === 'boolean' && (
                  <div className="flex gap-3">
                    {['Yes', 'No'].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setAnswers((p) => ({ ...p, [q.key]: opt === 'Yes' }))}
                        className={`px-5 py-1.5 rounded-xl border text-sm font-semibold transition-colors ${
                          answers[q.key] === (opt === 'Yes')
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-indigo-400'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Free-form extra description */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Additional Information <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <textarea
                rows={3}
                placeholder="Any other details that may help responders..."
                value={extraDescription}
                onChange={(e) => setExtraDescription(e.target.value)}
                className="w-full rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* User-selected priority */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Your perceived priority <span className="font-normal text-gray-400">(optional — system will calculate automatically)</span>
              </label>
              <select
                value={userPriority}
                onChange={(e) => setUserPriority(e.target.value as IncidentPriority | '')}
                className="w-full rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-3 py-2 text-sm"
              >
                <option value="">Let system decide</option>
                <option value="critical">🔴 Critical</option>
                <option value="high">🟠 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">🔵 Low</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">The triage system will still calculate its own priority. Your input is advisory.</p>
            </div>

            <button
              onClick={() => setStep('location')}
              disabled={!questionsValid()}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-sm transition-colors"
            >
              Next: Set Location →
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  // ─── Step 3: Location ─────────────────────────────────────────────────────
  if (step === 'location') {
    const mapCenter: [number, number] = location ? [location.lat, location.lng] : [18.5204, 73.8567];
    return (
      <Layout>
        <div className="max-w-xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setStep('questions')} className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">← Back</button>
            <h1 className="text-xl font-extrabold text-gray-900 dark:text-white">📍 Set Incident Location</h1>
          </div>

          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg p-6 space-y-4">
            {/* GPS button */}
            <button
              onClick={requestGps}
              disabled={gpsLoading}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
            >
              {gpsLoading ? '⏳ Getting location…' : '📡 Use My Current Location (GPS)'}
            </button>

            {gpsError && (
              <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-xl p-3 text-sm text-amber-800 dark:text-amber-200">
                ⚠️ {gpsError}
              </div>
            )}

            {location && (
              <div className="bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-300 dark:border-emerald-700 rounded-xl p-3 text-sm text-emerald-800 dark:text-emerald-200">
                ✅ Location set: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
              </div>
            )}

            {/* Map */}
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                {mapPickMode || !location ? 'Click on the map to select the incident location:' : 'Current location shown on map. Click to change:'}
              </p>
              <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700" style={{ height: '300px' }}>
                <MapContainer center={mapCenter} zoom={location ? 14 : 6} style={{ height: '100%', width: '100%' }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <LocationPicker onSelect={(lat, lng) => { setLocation({ lat, lng }); setMapPickMode(false); }} />
                  {location && <Marker position={[location.lat, location.lng]} />}
                </MapContainer>
              </div>
            </div>

            {/* Optional address */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Address / Landmark <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Near City Hospital, MG Road"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('review')}
                className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-colors"
              >
                {location ? 'Review & Submit →' : 'Skip Location & Review →'}
              </button>
            </div>
            {!location && (
              <p className="text-xs text-gray-400 text-center">
                Location is optional — you can still submit the report without it.
              </p>
            )}
          </div>
        </div>
      </Layout>
    );
  }

  // ─── Step 4: Review & Submit ──────────────────────────────────────────────
  return (
    <Layout>
      <div className="max-w-xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setStep('location')} className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">← Back</button>
          <h1 className="text-xl font-extrabold text-gray-900 dark:text-white">📋 Review Your Report</h1>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg p-6 space-y-5">
          <div className="space-y-3">
            <Row label="Incident Type" value={selectedType ? INCIDENT_TYPE_LABELS[selectedType] : '—'} />
            {Object.entries(answers).map(([key, val]) => (
              <Row
                key={key}
                label={questions.find((q) => q.key === key)?.label ?? key}
                value={val === true ? 'Yes' : val === false ? 'No' : String(val)}
              />
            ))}
            {extraDescription && <Row label="Additional Info" value={extraDescription} />}
            {userPriority && <Row label="Your Priority" value={PRIORITY_LABELS[userPriority]} />}
            {location ? (
              <Row label="Location" value={`${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`} />
            ) : (
              <Row label="Location" value={<span className="text-gray-400 italic">Not provided</span>} />
            )}
            {address && <Row label="Address" value={address} />}
          </div>

          {mutation.isError && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-xl p-3 text-sm text-red-800 dark:text-red-200">
              ❌ Submission failed. Your report was NOT confirmed as submitted. Please try again.
              {mutation.error instanceof Error && (
                <p className="text-xs mt-1 opacity-70">{mutation.error.message}</p>
              )}
            </div>
          )}

          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-extrabold text-base transition-colors"
          >
            {mutation.isPending ? '⏳ Submitting…' : '🚨 Submit Emergency Report'}
          </button>

          <p className="text-xs text-gray-400 text-center">
            By submitting, you confirm this is a genuine emergency. False reports may hinder response to real emergencies.
          </p>
        </div>
      </div>
    </Layout>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">{label}</span>
      <span className="text-sm text-gray-900 dark:text-gray-100 text-right">{value}</span>
    </div>
  );
}
