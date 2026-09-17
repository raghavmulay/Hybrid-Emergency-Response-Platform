import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import {
  getMyProfile,
  getMyAssignments,
  updateMyAvailability,
  acceptAssignment,
  rejectAssignment,
} from '../api/responders';
import { updateIncidentStatus } from '../api/incidents';
import {
  INCIDENT_TYPE_LABELS,
  PRIORITY_BADGE_CLASSES,
  PRIORITY_LABELS,
  STATUS_LABELS,
  ASSIGNMENT_STATUS_LABELS,
  AVAILABILITY_LABELS,
  AVAILABILITY_BADGE,
} from '../constants/incidentConfig';
import type { Assignment, IncidentStatus } from '../types/incident';
import { useIncidentSocket } from '../hooks/useIncidentSocket';

const OPERATIONAL_TRANSITIONS: Record<string, IncidentStatus> = {
  accepted: 'en_route',
  en_route: 'on_scene',
  on_scene: 'resolving',
  resolving: 'resolved',
};

export default function ResponderDashboard() {
  const queryClient = useQueryClient();
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const { latestEvent, connectionStatus } = useIncidentSocket();

  // Refresh on WS events
  if (latestEvent) {
    queryClient.invalidateQueries({ queryKey: ['myAssignments'] });
    queryClient.invalidateQueries({ queryKey: ['myProfile'] });
  }

  const { data: profile } = useQuery({
    queryKey: ['myProfile'],
    queryFn: getMyProfile,
  });

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['myAssignments'],
    queryFn: getMyAssignments,
    refetchInterval: 15000,
  });

  const availabilityMutation = useMutation({
    mutationFn: updateMyAvailability,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['myProfile'] }),
  });

  const acceptMutation = useMutation({
    mutationFn: acceptAssignment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myAssignments'] });
      queryClient.invalidateQueries({ queryKey: ['myProfile'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
      rejectAssignment(id, reason),
    onSuccess: () => {
      setRejectingId(null);
      setRejectReason('');
      queryClient.invalidateQueries({ queryKey: ['myAssignments'] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ incidentId, status }: { incidentId: number; status: IncidentStatus }) =>
      updateIncidentStatus(incidentId, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['myAssignments'] }),
  });

  const activeAssignments = assignments.filter(
    (a) => a.status === 'pending' || a.status === 'accepted'
  );
  const historyAssignments = assignments.filter(
    (a) => a.status !== 'pending' && a.status !== 'accepted'
  );

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Availability card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-lg font-extrabold text-gray-900 dark:text-white">
                🚑 Responder Dashboard
              </h1>
              {profile && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{profile.email}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                connectionStatus === 'CONNECTED'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700'
                  : connectionStatus === 'CONNECTING'
                  ? 'bg-yellow-50 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700 animate-pulse'
                  : 'bg-gray-100 text-gray-500 border-gray-300 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600'
              }`}>
                {connectionStatus === 'CONNECTED' ? '● Live' : connectionStatus === 'CONNECTING' ? '⚠ Reconnecting…' : '○ Offline'}
              </span>
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                Availability:
              </span>
              {(['AVAILABLE', 'BUSY', 'OFFLINE'] as const).map((av) => (
                <button
                  key={av}
                  onClick={() => availabilityMutation.mutate(av)}
                  disabled={availabilityMutation.isPending}
                  className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all ${
                    profile?.availability === av
                      ? AVAILABILITY_BADGE[av] + ' border-current shadow-sm'
                      : 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {AVAILABILITY_LABELS[av]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Active assignments */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden">
          <div className="p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">
              📋 Active Assignments
            </h2>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
              {activeAssignments.length}
            </span>
          </div>

          {isLoading && (
            <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>
          )}

          {!isLoading && activeAssignments.length === 0 && (
            <div className="p-10 text-center text-gray-400">
              <p className="text-3xl mb-2">✅</p>
              <p className="text-sm">No active assignments.</p>
            </div>
          )}

          {activeAssignments.map((a) => (
            <AssignmentCard
              key={a.id}
              assignment={a}
              onAccept={() => acceptMutation.mutate(a.id)}
              onReject={() => setRejectingId(a.id)}
              onStatusUpdate={(status) =>
                statusMutation.mutate({ incidentId: a.incident_id, status })
              }
              accepting={acceptMutation.isPending}
              updatingStatus={statusMutation.isPending}
            />
          ))}
        </div>

        {/* History */}
        {historyAssignments.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden">
            <div className="p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                🕒 Assignment History
              </h2>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {historyAssignments.map((a) => (
                <div key={a.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <p className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {a.incident?.incident_number ?? `INC-${a.incident_id}`}
                    </p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {a.incident?.title ?? '—'}
                    </p>
                    {a.rejection_reason && (
                      <p className="text-xs text-red-500">Reason: {a.rejection_reason}</p>
                    )}
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    {ASSIGNMENT_STATUS_LABELS[a.status]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Reject modal */}
      {rejectingId !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4 border border-gray-200 dark:border-gray-700">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              ❌ Reject Assignment
            </h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection (optional)"
              rows={3}
              className="w-full rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <div className="flex gap-3">
              <button
                onClick={() => rejectMutation.mutate({ id: rejectingId, reason: rejectReason })}
                disabled={rejectMutation.isPending}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm disabled:opacity-50"
              >
                {rejectMutation.isPending ? 'Rejecting…' : 'Confirm Reject'}
              </button>
              <button
                onClick={() => { setRejectingId(null); setRejectReason(''); }}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

function AssignmentCard({
  assignment: a,
  onAccept,
  onReject,
  onStatusUpdate,
  accepting,
  updatingStatus,
}: {
  assignment: Assignment;
  onAccept: () => void;
  onReject: () => void;
  onStatusUpdate: (s: IncidentStatus) => void;
  accepting: boolean;
  updatingStatus: boolean;
}) {
  const inc = a.incident;
  const nextStatus = inc ? OPERATIONAL_TRANSITIONS[inc.status] : undefined;

  return (
    <div className="p-4 border-b last:border-b-0 dark:border-gray-700 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
              {inc?.incident_number ?? `INC-${a.incident_id}`}
            </span>
            {inc && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${PRIORITY_BADGE_CLASSES[inc.priority]}`}>
                {PRIORITY_LABELS[inc.priority]}
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {inc?.title ?? '—'}
          </p>
          {inc && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {INCIDENT_TYPE_LABELS[inc.type]} · {STATUS_LABELS[inc.status] ?? inc.status}
            </p>
          )}
          {inc?.address && (
            <p className="text-xs text-gray-400">📍 {inc.address}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
            {ASSIGNMENT_STATUS_LABELS[a.status]}
          </span>
          <span className="text-xs text-gray-400">
            {new Date(a.assigned_at).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {a.status === 'pending' && (
          <>
            <button
              onClick={onAccept}
              disabled={accepting}
              className="text-xs font-bold px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
            >
              ✅ Accept
            </button>
            <button
              onClick={onReject}
              className="text-xs font-bold px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white"
            >
              ❌ Reject
            </button>
          </>
        )}

        {a.status === 'accepted' && nextStatus && (
          <button
            onClick={() => onStatusUpdate(nextStatus)}
            disabled={updatingStatus}
            className="text-xs font-bold px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
          >
            → {STATUS_LABELS[nextStatus] ?? nextStatus}
          </button>
        )}

        {inc && (
          <Link
            to={`/responder/incidents/${a.incident_id}`}
            className="text-xs font-semibold px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            View Details →
          </Link>
        )}
      </div>
    </div>
  );
}
