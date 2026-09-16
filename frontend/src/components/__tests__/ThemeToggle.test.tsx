import { render, screen, fireEvent } from '@testing-library/react';
import ThemeToggle from '../ThemeToggle';

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
  });

  it('renders correctly and toggles theme', () => {
    render(<ThemeToggle />);
    const button = screen.getByRole('button');
    
    // Initially should be in light mode, button should say 'Dark Mode'
    expect(button).toHaveTextContent('Dark Mode');
    expect(localStorage.getItem('theme')).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    // Click to toggle to dark mode
    fireEvent.click(button);
    expect(button).toHaveTextContent('Light Mode');
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    // Click again to toggle back to light mode
    fireEvent.click(button);
    expect(button).toHaveTextContent('Dark Mode');
    expect(localStorage.getItem('theme')).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
