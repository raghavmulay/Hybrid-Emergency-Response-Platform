import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '../components/Layout';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getIncidentById, getIncidentTimeline, updateIncidentStatus } from '../api/incidents';
import { getIncidentAssignments } from '../api/responders';
import {
  INCIDENT_TYPE_LABELS,
  PRIORITY_BADGE_CLASSES,
  PRIORITY_LABELS,
  STATUS_LABELS,
  ASSIGNMENT_STATUS_LABELS,
} from '../constants/incidentConfig';
import type { IncidentStatus } from '../types/incident';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const OPERATIONAL_TRANSITIONS: Record<string, IncidentStatus> = {
  accepted: 'en_route',
  en_route: 'on_scene',
  on_scene: 'resolving',
  resolving: 'resolved',
};

export default function ResponderIncidentDetail() {
  const { id } = useParams<{ id: string }>();
  const incidentId = parseInt(id ?? '0');
  const queryClient = useQueryClient();

  const { data: incident, isLoading } = useQuery({
    queryKey: ['responderIncident', incidentId],
    queryFn: () => getIncidentById(incidentId),
    enabled: !!incidentId,
  });

  const { data: timeline = [] } = useQuery({
    queryKey: ['responderTimeline', incidentId],
    queryFn: () => getIncidentTimeline(incidentId),
    enabled: !!incidentId,
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ['responderAssignments', incidentId],
    queryFn: () => getIncidentAssignments(incidentId),
    enabled: !!incidentId,
  });

  const statusMutation = useMutation({
    mutationFn: (status: IncidentStatus) =>
      updateIncidentStatus(incidentId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['responderIncident', incidentId] });
      queryClient.invalidateQueries({ queryKey: ['responderTimeline', incidentId] });
      queryClient.invalidateQueries({ queryKey: ['myAssignments'] });
    },
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-3">⏳</p>
          <p>Loading…</p>
        </div>
      </Layout>
    );
  }

  if (!incident) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto mt-12 text-center">
          <p className="text-5xl mb-4">🔍</p>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Incident Not Found</h2>
          <Link to="/responder" className="inline-block mt-6 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold">
            ← Dashboard
          </Link>
        </div>
      </Layout>
    );
  }

  const nextStatus = OPERATIONAL_TRANSITIONS[incident.status];
  const hasCoords = incident.latitude != null && incident.longitude != null;
  const details = incident.details ?? {};

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Link to="/responder" className="hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline">
            Dashboard
          </Link>
          <span>›</span>
          <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">
            {incident.incident_number}
          </span>
        </div>

        {/* Main card */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg p-6 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                {incident.incident_number}
              </span>
              <h1 className="text-xl font-extrabold text-gray-900 dark:text-white">{incident.title}</h1>
              <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                {INCIDENT_TYPE_LABELS[incident.type]}
              </span>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className={`text-sm font-bold px-3 py-1 rounded-full ${PRIORITY_BADGE_CLASSES[incident.priority]}`}>
                {PRIORITY_LABELS[incident.priority]}
              </span>
              <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2.5 py-1 rounded-full font-semibold">
                {STATUS_LABELS[incident.status] ?? incident.status}
              </span>
            </div>
          </div>

          {/* Operational status update */}
          {nextStatus && (
            <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
              <button
                onClick={() => statusMutation.mutate(nextStatus)}
                disabled={statusMutation.isPending}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm disabled:opacity-50 transition-colors"
              >
                {statusMutation.isPending ? 'Updating…' : `→ Update to ${STATUS_LABELS[nextStatus] ?? nextStatus}`}
              </button>
            </div>
          )}

          {incident.description && (
            <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Description</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">{incident.description}</p>
            </div>
          )}

          {Object.keys(details).length > 0 && (
            <div className="border-t border-gray-100 dark:border-gray-700 pt-4 space-y-2">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Reported Details</p>
              {Object.entries(details).map(([key, val]) => (
                <div key={key} className="flex justify-between items-start gap-3">
                  <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                    {key.replace(/_/g, ' ')}
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100 text-right">
                    {val === true ? 'Yes' : val === false ? 'No' : String(val)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {incident.resource_recommendations && incident.resource_recommendations.length > 0 && (
            <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Recommended Resources</p>
              <ul className="space-y-1">
                {incident.resource_recommendations.map((r, i) => (
                  <li key={i} className="text-sm font-medium text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                    <span className="text-emerald-500">✔</span> {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Map */}
        {hasCoords && (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                📍 Incident Location
                {incident.address && <span className="font-normal text-gray-500 dark:text-gray-400"> — {incident.address}</span>}
              </h2>
            </div>
            <div style={{ height: '260px' }}>
              <MapContainer center={[incident.latitude!, incident.longitude!]} zoom={14} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Marker position={[incident.latitude!, incident.longitude!]}>
                  <Popup>{incident.incident_number}</Popup>
                </Marker>
              </MapContainer>
            </div>
          </div>
        )}

        {/* Assignment info */}
        {assignments.length > 0 && (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg p-5">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-3">📋 Assignment History</h2>
            <div className="space-y-2">
              {assignments.map((a) => (
                <div key={a.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-gray-50 dark:bg-gray-700/40">
                  <span className="text-gray-600 dark:text-gray-300">
                    Responder #{a.responder_id} · {new Date(a.assigned_at).toLocaleString()}
                  </span>
                  <span className="font-bold">{ASSIGNMENT_STATUS_LABELS[a.status]}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg p-6">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-4">🕒 Timeline</h2>
          {timeline.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No timeline entries yet.</p>
          ) : (
            <ol className="relative border-l border-gray-200 dark:border-gray-700 space-y-5 ml-3">
              {timeline.map((entry, i) => (
                <li key={i} className="ml-4">
                  <div className="absolute -left-1.5 w-3 h-3 rounded-full bg-indigo-500 border-2 border-white dark:border-gray-800" />
                  <div className="flex flex-wrap items-center gap-2 mb-0.5">
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-200">
                      {STATUS_LABELS[entry.status] ?? entry.status}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(entry.changed_at).toLocaleString()}
                    </span>
                  </div>
                  {entry.reason && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">{entry.reason}</p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </Layout>
  );
}
