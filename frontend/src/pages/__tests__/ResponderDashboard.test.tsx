import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import ResponderDashboard from '../ResponderDashboard';
import * as respondersApi from '../../api/responders';
import * as incidentsApi from '../../api/incidents';

vi.mock('../../api/responders');
vi.mock('../../api/incidents');
vi.mock('../../hooks/useIncidentSocket', () => ({
  useIncidentSocket: () => ({ latestEvent: null, incidentCreated: null, incidentUpdated: null, connected: false }),
}));

const mockProfile = {
  id: 1,
  email: 'responder@test.com',
  role: 'responder',
  availability: 'AVAILABLE' as const,
  latitude: null,
  longitude: null,
  active_assignments: 1,
};

const mockPendingAssignment = {
  id: 10,
  incident_id: 5,
  responder_id: 1,
  assigned_by: 2,
  assigned_at: new Date().toISOString(),
  status: 'pending' as const,
  accepted_at: null,
  rejected_at: null,
  completed_at: null,
  rejection_reason: null,
  notes: null,
  incident: {
    id: 5,
    incident_number: 'HERP-2024-000001',
    title: 'Road Accident on NH4',
    type: 'road_accident' as const,
    status: 'assigned' as const,
    priority: 'high' as const,
    description: 'Multi-vehicle accident',
    calculated_priority: 'high' as const,
    user_selected_priority: null,
    severity_score: 75,
    priority_reason: null,
    latitude: 18.5,
    longitude: 73.8,
    address: 'NH4, Pune',
    details: {},
    resource_recommendations: ['Ambulance', 'Police'],
    reporter_id: 3,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    possible_duplicate: false,
    duplicate_of_incident_id: null,
    reported_at: new Date().toISOString(),
    acknowledged_at: null,
    verified_at: null,
    assigned_at: null,
    accepted_at: null,
    en_route_at: null,
    on_scene_at: null,
    resolving_at: null,
    resolved_at: null,
  },
};

const mockAcceptedAssignment = {
  ...mockPendingAssignment,
  id: 11,
  status: 'accepted' as const,
  accepted_at: new Date().toISOString(),
  incident: { ...mockPendingAssignment.incident!, status: 'accepted' as const },
};

function renderDashboard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <ResponderDashboard />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe('ResponderDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(respondersApi.getMyProfile).mockResolvedValue(mockProfile);
    vi.mocked(respondersApi.getMyAssignments).mockResolvedValue([mockPendingAssignment]);
    vi.mocked(respondersApi.updateMyAvailability).mockResolvedValue({ ...mockProfile, availability: 'BUSY' });
    vi.mocked(respondersApi.acceptAssignment).mockResolvedValue({ ...mockPendingAssignment, status: 'accepted' });
    vi.mocked(respondersApi.rejectAssignment).mockResolvedValue({ ...mockPendingAssignment, status: 'rejected' });
    vi.mocked(incidentsApi.updateIncidentStatus).mockResolvedValue(mockPendingAssignment.incident!);
  });

  it('renders responder email and availability buttons', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('responder@test.com')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Available/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Busy/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Offline/i })).toBeInTheDocument();
  });

  it('calls updateMyAvailability when availability button clicked', async () => {
    renderDashboard();
    await waitFor(() => screen.getByText('responder@test.com'));
    fireEvent.click(screen.getByRole('button', { name: /Busy/i }));
    await waitFor(() => {
      expect(respondersApi.updateMyAvailability).toHaveBeenCalledWith('BUSY', expect.anything());
    });
  });

  it('displays pending assignment with incident details', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('HERP-2024-000001')).toBeInTheDocument();
      expect(screen.getByText('Road Accident on NH4')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Accept/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reject/i })).toBeInTheDocument();
  });

  it('calls acceptAssignment when Accept is clicked', async () => {
    renderDashboard();
    await waitFor(() => screen.getByRole('button', { name: /Accept/i }));
    fireEvent.click(screen.getByRole('button', { name: /Accept/i }));
    await waitFor(() => {
      expect(respondersApi.acceptAssignment).toHaveBeenCalledWith(10, expect.anything());
    });
  });

  it('opens reject modal and submits rejection with reason', async () => {
    renderDashboard();
    await waitFor(() => screen.getByRole('button', { name: /Reject/i }));
    fireEvent.click(screen.getByRole('button', { name: /Reject/i }));

    await waitFor(() => screen.getByPlaceholderText(/Reason for rejection/i));
    fireEvent.change(screen.getByPlaceholderText(/Reason for rejection/i), {
      target: { value: 'Off duty' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Confirm Reject/i }));
    await waitFor(() => {
      expect(respondersApi.rejectAssignment).toHaveBeenCalledWith(10, 'Off duty');
    });
  });

  it('shows operational status update button for accepted assignment', async () => {
    vi.mocked(respondersApi.getMyAssignments).mockResolvedValue([mockAcceptedAssignment]);
    renderDashboard();
    await waitFor(() => {
      // Should show "En Route" as next status button
      expect(screen.getByRole('button', { name: /En Route/i })).toBeInTheDocument();
    });
  });

  it('calls updateIncidentStatus when operational status button clicked', async () => {
    vi.mocked(respondersApi.getMyAssignments).mockResolvedValue([mockAcceptedAssignment]);
    renderDashboard();
    await waitFor(() => screen.getByRole('button', { name: /En Route/i }));
    fireEvent.click(screen.getByRole('button', { name: /En Route/i }));
    await waitFor(() => {
      expect(incidentsApi.updateIncidentStatus).toHaveBeenCalledWith(5, { status: 'en_route' });
    });
  });

  it('shows assignment history section for completed/rejected assignments', async () => {
    const historyAssignment = { ...mockPendingAssignment, id: 20, status: 'completed' as const };
    vi.mocked(respondersApi.getMyAssignments).mockResolvedValue([historyAssignment]);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/Assignment History/i)).toBeInTheDocument();
    });
  });
});
