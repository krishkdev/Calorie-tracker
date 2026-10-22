import { render, screen } from '@testing-library/react';
import { beforeEach } from 'vitest';
import App from './App';
import { db } from './db/db';
import { saveProfile } from './db/repo';

beforeEach(async () => {
  await db.profile.clear();
  window.location.hash = '';
});

describe('App', () => {
  it('sends new users to onboarding', async () => {
    render(<App />);
    expect(await screen.findByText('About you')).toBeInTheDocument();
  });

  it('shows the dashboard and tab bar once a profile exists', async () => {
    await saveProfile({
      age: 30,
      sex: 'male',
      heightCm: 180,
      weightKg: 80,
      activity: 'moderate',
      goal: 'maintain',
      rateKgPerWeek: 0,
      targets: { kcal: 2760, proteinG: 128, carbsG: 390, fatG: 77 },
      targetsOverridden: false,
      onboardedAt: Date.now(),
    });
    render(<App />);
    expect(await screen.findByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(await screen.findByText(/of 2760 kcal eaten/)).toBeInTheDocument();
  });
});
