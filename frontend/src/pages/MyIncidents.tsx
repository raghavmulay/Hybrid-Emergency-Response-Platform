import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import IncidentMap from '../components/IncidentMap';
import { getMyIncidents } from '../api/incidents';
import {
  INCIDENT_TYPE_LABELS,
  PRIORITY_BADGE_CLASSES,
  PRIORITY_LABELS,
  STATUS_LABELS,
} from '../constants/incidentConfig';
import { useIncidentSocket } from '../hooks/useIncidentSocket';
import { formatDateTime } from '../utils/time';

export default function MyIncidents() {
  const queryClient = useQueryClient();
  const { incidentCreated } = useIncidentSocket();

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['myIncidents'],
    queryFn: () => getMyIncidents(),
    refetchInterval: 30000, // refresh every 30s as fallback
  });

  // Refresh list when a new incident is created via WS
  useEffect(() => {
    if (incidentCreated) {
      queryClient.invalidateQueries({ queryKey: ['myIncidents'] });
    }
  }, [incidentCreated, queryClient]);

  const incidents = data?.incidents ?? [];
  const mappable = incidents.filter((i) => i.latitude != null && i.longitude != null);
  const [view, setView] = useState<'list' | 'map'>('list');

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
              📋 My Incidents
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              All emergency reports you have submitted.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex rounded-lg overflow-hidden text-xs font-semibold" style={{ border: '1px solid var(--border)' }}>
              <button
                onClick={() => setView('list')}
                className="px-3 py-1.5 transition-colors"
                style={view === 'list'
                  ? { background: '#6366f1', color: '#fff' }
                  : { background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}
              >☰ List</button>
              <button
                onClick={() => setView('map')}
                className="px-3 py-1.5 transition-colors"
                style={view === 'map'
                  ? { background: '#6366f1', color: '#fff' }
                  : { background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}
              >🗺️ Map {mappable.length > 0 && `(${mappable.length})`}</button>
            </div>
            <button
              onClick={() => refetch()}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
              style={{ border: '1px solid var(--border)', color: 'var(--text-muted)', background: 'var(--bg-subtle)' }}
            >
              🔄
            </button>
            <Link
              to="/report"
              className="text-xs font-bold px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-sm transition-colors"
            >
              + Report
            </Link>
          </div>
        </div>

        {/* Map view */}
        {view === 'map' && !isLoading && (
          <div className="mb-4">
            {mappable.length === 0 ? (
              <div className="text-center py-16" style={{ color: 'var(--text-dim)' }}>
                <p className="text-4xl mb-3">📍</p>
                <p className="text-sm">None of your incidents have location data.</p>
              </div>
            ) : (
              <IncidentMap incidents={mappable} responders={[]} height="520px" />
            )}
          </div>
        )}

        {/* Loading */}
        {view === 'list' && isLoading && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">⏳</p>
            <p>Loading your incidents…</p>
          </div>
        )}

        {/* Error */}
        {view === 'list' && isError && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-xl p-4 text-sm text-red-700 dark:text-red-300">
            ⚠️ Failed to load incidents. Please check your connection.
            <button onClick={() => refetch()} className="ml-3 underline font-semibold">
              Retry
            </button>
          </div>
        )}

        {/* Empty */}
        {view === 'list' && !isLoading && !isError && incidents.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            <p className="text-5xl mb-4">📭</p>
            <p className="text-lg font-semibold text-gray-600 dark:text-gray-300">No incidents reported yet.</p>
            <p className="text-sm mt-2">Use the button above to report an emergency.</p>
          </div>
        )}

        {/* Incident list */}
        {view === 'list' && incidents.length > 0 && (
          <div className="space-y-3">
            {incidents.map((inc) => (
              <Link
                key={inc.id}
                to={`/incident/${inc.id}`}
                className="block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 hover:shadow-md hover:border-indigo-400 dark:hover:border-indigo-500 transition-all"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    {/* Incident number + type */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        {inc.incident_number}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                        {INCIDENT_TYPE_LABELS[inc.type]}
                      </span>
                    </div>

                    {/* Title */}
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">{inc.title}</p>

                    {/* Location */}
                    {(inc.address || (inc.latitude && inc.longitude)) && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        📍 {inc.address ?? `${inc.latitude?.toFixed(4)}, ${inc.longitude?.toFixed(4)}`}
                      </p>
                    )}

                    {/* Timestamps */}
                    <p className="text-xs text-gray-400">
                      Reported: {formatDateTime(inc.created_at)}
                      {inc.updated_at !== inc.created_at && (
                        <> · Updated: {formatDateTime(inc.updated_at)}</>
                      )}
                    </p>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${PRIORITY_BADGE_CLASSES[inc.priority]}`}>
                      {PRIORITY_LABELS[inc.priority]}
                    </span>
                    <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-full font-medium">
                      {STATUS_LABELS[inc.status]}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {data && (
          <p className="text-xs text-gray-400 text-center mt-6">
            Showing {incidents.length} of {data.total} incidents
          </p>
        )}
      </div>
    </Layout>
  );
}
