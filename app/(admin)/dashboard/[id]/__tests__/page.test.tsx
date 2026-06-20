import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SessionDetailPage from '../page';
import { useParams } from 'next/navigation';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useParams: vi.fn(),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    back: vi.fn(),
  })),
}));

// Mock Clerk — AdminHeader calls useClerk()
vi.mock('@clerk/nextjs', () => ({
  useClerk: vi.fn(() => ({ signOut: vi.fn() })),
}));

// Mock the schedule API so the "load existing job" effect is inert
vi.mock('@/lib/api/scheduleApi', () => ({
  getScheduleRecord: vi.fn(() => Promise.resolve({ schedule: { status: 'generating' } })),
  submitScheduleJob: vi.fn(() => Promise.resolve({ job_id: 'job-1' })),
}));

describe('SessionDetailPage - Wizard Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Use 'new' so the page starts at step 1 (the load-existing-job effect returns early)
    (useParams as any).mockReturnValue({ id: 'new' });
    vi.stubEnv('NODE_ENV', 'development');
  });

  it('renders the wizard with the stepper and starts on step 1 (session info)', () => {
    render(<SessionDetailPage />);

    const headings = screen.getAllByRole('heading', { level: 2 });
    expect(headings.length).toBeGreaterThanOrEqual(1);

    // Stepper is present
    expect(screen.getAllByTestId('wizard-stepper')[0]).toBeDefined();

    // Step 1 shows the session-name input; step 2/3 content is not yet rendered
    expect(screen.getAllByPlaceholderText(/ตารางสอน/)[0]).toBeDefined();
    expect(screen.queryByTestId('input-panel')).toBeNull();
    expect(screen.queryByTestId('main-validate-button')).toBeNull();
  });

  it('gates "Next" until a schedule name is entered, then advances to step 2', () => {
    render(<SessionDetailPage />);

    const next = screen.getAllByTestId('wizard-next')[0] as HTMLButtonElement;
    // Disabled with empty name
    expect(next.disabled).toBe(true);

    // Type a name → Next enables
    const nameInput = screen.getAllByPlaceholderText(/ตารางสอน/)[0];
    fireEvent.change(nameInput, { target: { value: 'ตารางสอน ภาคเรียนที่ 1/2568' } });
    expect(next.disabled).toBe(false);

    // Advance to step 2 → InputPanel (Data Command Center) is shown
    fireEvent.click(next);
    expect(screen.getAllByTestId('input-panel')[0]).toBeDefined();
  });
});
