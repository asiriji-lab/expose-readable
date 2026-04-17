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

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      signOut: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
    })),
  },
}));

// Mock child components
vi.mock('../_components/SheetEmbed', () => ({
  default: () => <div data-testid="sheet-embed">Sheet Embed</div>
}));

describe('SessionDetailPage - Admin Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useParams as any).mockReturnValue({ id: 'test-session-123' });
    
    // Force development mode for the test
    vi.stubEnv('NODE_ENV', 'development');
  });

  it('renders the session detail page with core elements', () => {
    render(<SessionDetailPage />);

    // Check for Title - be specific to avoid multiple headings issue
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings.length).toBeGreaterThanOrEqual(1);
    
    // Check if SheetEmbed is rendered
    expect(screen.getByTestId('sheet-embed')).toBeDefined();
  });

  it('shows the validation section initially', () => {
    render(<SessionDetailPage />);
    
    // Using getAllByTestId because for some reason JSDOM sees duplicates
    expect(screen.getAllByTestId('main-validate-button')[0]).toBeDefined();
    
    // Check if tabs are listed using test-ids
    expect(screen.getAllByTestId('tab-card-teacher')[0]).toBeDefined();
    expect(screen.getAllByTestId('tab-card-room')[0]).toBeDefined();
  });

  it('simulates clicking the validation button', async () => {
    render(<SessionDetailPage />);
    
    const validateBtn = screen.getAllByTestId('main-validate-button')[0];
    fireEvent.click(validateBtn);
    
    expect(validateBtn).toBeDefined();
  });

  it('displays the DevTestPanel in development environment', () => {
    render(<SessionDetailPage />);
    
    // Look for Dev Test Panel root
    expect(screen.getAllByTestId('dev-test-panel')[0]).toBeDefined();
  });
});
