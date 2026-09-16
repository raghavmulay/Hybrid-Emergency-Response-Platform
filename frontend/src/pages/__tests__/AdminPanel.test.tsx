import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import AdminPanel from '../AdminPanel';
import { api } from '../../api/client';

// Mock the API client
vi.mock('../../api/client', () => ({
  api: {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock MessageMap so we don't have to deal with Leaflet in JSDOM
vi.mock('../../components/MessageMap', () => ({
  default: () => <div data-testid="mock-map">Map</div>,
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>
  );
};

const mockConversations = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  title: `Conv ${i + 1}`,
  owner_id: 1,
  created_at: new Date().toISOString(),
}));

const mockMessages = [
  {
    id: 101,
    conversation_id: 1,
    sender_id: 2,
    content: 'Help me',
    priority: 'HIGH',
    timestamp: new Date().toISOString(),
  },
];

describe('AdminPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.get as any).mockImplementation(async (url: string) => {
      if (url.includes('/conversations')) {
        return { data: mockConversations };
      }
      if (url.includes('/messages/emergency')) {
        return { data: mockMessages };
      }
      return { data: [] };
    });
  });

  it('renders conversations and handles pagination', async () => {
    renderWithProviders(<AdminPanel />);

    await waitFor(() => {
      expect(screen.getByText('Conv 1')).toBeInTheDocument();
    });
    
    // Check Next button is enabled (since we returned 20 items)
    const nextBtn = screen.getByRole('button', { name: 'Next' });
    expect(nextBtn).not.toBeDisabled();

    // Prev button should be disabled on page 1
    const prevBtn = screen.getByRole('button', { name: 'Prev' });
    expect(prevBtn).toBeDisabled();

    // Click next
    fireEvent.click(nextBtn);
    expect(screen.getByText('Page 2')).toBeInTheDocument();
  });

  it('handles edit and delete of emergency messages', async () => {
    vi.spyOn(window, 'prompt')
      .mockReturnValueOnce('New content')
      .mockReturnValueOnce('CRITICAL');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    (api.put as any).mockResolvedValueOnce({ data: {} });
    (api.delete as any).mockResolvedValueOnce({ data: {} });

    renderWithProviders(<AdminPanel />);

    await waitFor(() => {
      expect(screen.getByText('Help me')).toBeInTheDocument();
    });

    const editBtn = screen.getByRole('button', { name: 'Edit' });
    const deleteBtn = screen.getByRole('button', { name: 'Delete' });

    // Test Edit
    fireEvent.click(editBtn);
    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/messages/101', { content: 'New content', priority: 'CRITICAL' });
    });

    // Test Delete
    fireEvent.click(deleteBtn);
    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/messages/101');
    });
  });
});
