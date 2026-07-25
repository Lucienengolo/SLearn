import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Footer from '../components/Layout/Footer';

describe('Footer', () => {
  it('renders the top audience links and navigates on click', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<Footer onNavigate={onNavigate} />);

    const topNav = screen.getByRole('navigation', { name: /footer audience links/i });
    await user.click(within(topNav).getByRole('button', { name: 'Schools & Universities' }));
    expect(onNavigate).toHaveBeenCalledWith('audience-schools');
  });

  it('renders the 3 link columns with real, existing routes only', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<Footer onNavigate={onNavigate} />);

    expect(screen.getByText('For Learners')).toBeInTheDocument();
    expect(screen.getByText('For Educators')).toBeInTheDocument();
    expect(screen.getByText('For Organizations')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Browse courses' }));
    expect(onNavigate).toHaveBeenCalledWith('courses');

    await user.click(screen.getByRole('button', { name: 'Find a tutor' }));
    expect(onNavigate).toHaveBeenCalledWith('my-requests');
  });

  it('does not link to any Terms/Privacy/social pages, since none exist', () => {
    render(<Footer onNavigate={vi.fn()} />);
    expect(screen.queryByText(/terms of use/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/privacy policy/i)).not.toBeInTheDocument();
  });

  it('renders the copyright line', () => {
    render(<Footer onNavigate={vi.fn()} />);
    expect(screen.getByText(/Store of Learning/i)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`© ${new Date().getFullYear()}`))).toBeInTheDocument();
  });
});
