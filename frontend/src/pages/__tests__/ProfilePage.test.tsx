import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import ProfilePage from '../ProfilePage';
import { api } from '../../api/client';
import userEvent from '@testing-library/user-event';

import { vi } from 'vitest';

// Mock the API client
vi.mock('../../api/client', () => ({
  api: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
  },
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

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads and displays user info, updates email', async () => {
    (api.get as any).mockResolvedValueOnce({ data: { email: 'test@example.com', role: 'user' } });
    (api.put as any).mockResolvedValueOnce({});
    
    // Mock window.alert
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    renderWithProviders(<ProfilePage />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Profile' })).toBeInTheDocument();
    });

    expect(screen.getByText((_, element) => {
      return element?.textContent === 'Role: user';
    })).toBeInTheDocument();

    // Update Email
    const emailInput = screen.getByPlaceholderText('New email');
    await userEvent.type(emailInput, 'new@example.com');
    const saveButton = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/users/me', { email: 'new@example.com' });
      expect(alertSpy).toHaveBeenCalledWith('Email updated');
    });
    
    alertSpy.mockRestore();
  });

  it('changes password successfully', async () => {
    (api.get as any).mockResolvedValueOnce({ data: { email: 'test@example.com', role: 'user' } });
    (api.post as any).mockResolvedValueOnce({});
    
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    renderWithProviders(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Profile' })).toBeInTheDocument();
    });

    // Change Password
    const passwordInput = screen.getByPlaceholderText('New password');
    await userEvent.type(passwordInput, 'newpassword123');
    const changeButton = screen.getByRole('button', { name: 'Change' });
    fireEvent.click(changeButton);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/change-password', { new_password: 'newpassword123' });
      expect(alertSpy).toHaveBeenCalledWith('Password changed');
    });

    alertSpy.mockRestore();
  });
});
