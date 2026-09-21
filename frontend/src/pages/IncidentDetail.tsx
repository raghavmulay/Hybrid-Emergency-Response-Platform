import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import Layout from '../components/Layout';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getIncidentById, getIncidentTimeline } from '../api/incidents';
import {
  INCIDENT_TYPE_LABELS,
  PRIORITY_BADGE_CLASSES,
  PRIORITY_LABELS,
  STATUS_LABELS,
} from '../constants/incidentConfig';
import { useIncidentSocket } from '../hooks/useIncidentSocket';
import { formatDateTime } from '../utils/time';

// Fix Leaflet icon
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function IncidentDetail() {
  const { id } = useParams<{ id: string }>();
  const incidentId = parseInt(id ?? '0');
  const queryClient = useQueryClient();
  const { incidentUpdated } = useIncidentSocket();

  const {
    data: incident,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['incident', incidentId],
    queryFn: () => getIncidentById(incidentId),
    enabled: !!incidentId,
  });

  const { data: timeline = [], refetch: refetchTimeline } = useQuery({
    queryKey: ['incidentTimeline', incidentId],
    queryFn: () => getIncidentTimeline(incidentId),
    enabled: !!incidentId,
  });

  // Refresh when WS reports a status update for this incident
  useEffect(() => {
    if (incidentUpdated && incidentUpdated.id === incidentId) {
      queryClient.invalidateQueries({ queryKey: ['incident', incidentId] });
      refetchTimeline();
    }
  }, [incidentUpdated, incidentId, queryClient, refetchTimeline]);

  if (isLoading) {
    return (
      <Layout>
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-3">⏳</p>
          <p>Loading incident…</p>
        </div>
      </Layout>
    );
  }

  if (isError || !incident) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto mt-12 text-center">
          <p className="text-5xl mb-4">🔍</p>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Incident Not Found</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            This incident does not exist or you do not have access.
          </p>
          <Link
            to="/my-incidents"
            className="inline-block mt-6 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold"
          >
            ← My Incidents
          </Link>
        </div>
      </Layout>
    );
  }

  const details = incident.details ?? {};
  const hasCoords = incident.latitude != null && incident.longitude != null;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Link to="/my-incidents" className="hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline">
            My Incidents
          </Link>
          <span>›</span>
          <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">{incident.incident_number}</span>
        </div>

        {/* Main card */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg p-6 space-y-5">
          {/* Header */}
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
                {STATUS_LABELS[incident.status]}
              </span>
            </div>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-gray-100 dark:border-gray-700 pt-5">
            <InfoItem label="Reported" value={formatDateTime(incident.created_at)} />
            <InfoItem label="Last Updated" value={formatDateTime(incident.updated_at)} />
            {incident.severity_score != null && (
              <InfoItem label="Severity Score" value={`${incident.severity_score}/100`} />
            )}
            {incident.calculated_priority && (
              <InfoItem
                label="System-Calculated Priority"
                value={
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${PRIORITY_BADGE_CLASSES[incident.calculated_priority]}`}>
                    {PRIORITY_LABELS[incident.calculated_priority]}
                  </span>
                }
              />
            )}
            {incident.user_selected_priority && (
              <InfoItem
                label="Your Reported Priority"
                value={
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                    {PRIORITY_LABELS[incident.user_selected_priority]} (advisory)
                  </span>
                }
              />
            )}
            {incident.priority_reason && (
              <InfoItem label="Triage Reason" value={incident.priority_reason} wide />
            )}
          </div>

          {/* Description */}
          {incident.description && (
            <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Description</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">{incident.description}</p>
            </div>
          )}

          {/* Structured details */}
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

          {/* Resource recommendations */}
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

        {/* Location */}
        {hasCoords && (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                📍 Incident Location
                {incident.address && <span className="font-normal text-gray-500 dark:text-gray-400">— {incident.address}</span>}
              </h2>
            </div>
            <div style={{ height: '280px' }}>
              <MapContainer
                center={[incident.latitude!, incident.longitude!]}
                zoom={14}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Marker position={[incident.latitude!, incident.longitude!]}>
                  <Popup>
                    <div className="text-sm">
                      <p className="font-bold">{incident.incident_number}</p>
                      <p>{incident.address ?? `${incident.latitude!.toFixed(5)}, ${incident.longitude!.toFixed(5)}`}</p>
                      <a
                        href={`https://maps.google.com/?q=${incident.latitude},${incident.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 hover:underline text-xs"
                      >
                        Open in Google Maps ↗
                      </a>
                    </div>
                  </Popup>
                </Marker>
              </MapContainer>
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg p-6">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            🕒 Incident Timeline
          </h2>
          {timeline.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No timeline entries yet.</p>
          ) : (
            <ol className="relative border-l border-gray-200 dark:border-gray-700 space-y-5 ml-3">
              {timeline.map((entry, i) => (
                <li key={i} className="ml-4">
                  <div className="absolute -left-1.5 w-3 h-3 rounded-full bg-indigo-500 border-2 border-white dark:border-gray-800" />
                  <div className="flex flex-wrap items-center gap-2 mb-0.5">
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-200">
                      {STATUS_LABELS[entry.status]}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatDateTime(entry.changed_at)}
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

function InfoItem({
  label,
  value,
  wide,
}: {
  label: string;
  value: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  );
}
