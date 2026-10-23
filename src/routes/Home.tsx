import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import { isProviderConfigured } from '../ai/presets';
import CalorieRing from '../components/CalorieRing';
import DateNav from '../components/DateNav';
import MacroBars from '../components/MacroBars';
import MealSection from '../components/MealSection';
import { MEAL_ORDER } from '../lib/meals';
import { useDayEntries, useProfile, useSettingsLoaded } from '../db/hooks';
import { DEFAULT_SETTINGS } from '../db/defaults';
import { todayKey } from '../lib/dates';
import { sumMacros, ZERO_MACROS } from '../nutrition/totals';

export default function Home() {
  const [dayKey, setDayKey] = useState(todayKey);
  const profile = useProfile();
  const loaded = useSettingsLoaded();
  const settings = loaded ?? DEFAULT_SETTINGS;
  // Assume configured until settings arrive so the setup card never flashes.
  const configured = loaded ? isProviderConfigured(settings.provider) : true;
  const entries = useDayEntries(dayKey) ?? [];
  const consumed = entries.length ? sumMacros(entries.map((e) => e.totals)) : ZERO_MACROS;
  const target = profile?.targets ?? ZERO_MACROS;

  return (
    <div className="home-screen">
      <DateNav dayKey={dayKey} onChange={setDayKey} />
      <div className="dashboard-grid">
        <section className="nutrition-panel" aria-label="Daily nutrition">
          <div className="card energy-card">
            <CalorieRing consumed={consumed.kcal} target={target.kcal} />
          </div>
          <MacroBars consumed={consumed} target={target} />
          <Link to={configured ? `/log?day=${dayKey}` : '/settings'} className="quick-log-card">
            <span className="quick-log-icon">
              <Icon name={configured ? 'camera' : 'settings'} size={23} />
            </span>
            <span>
              <strong>{configured ? 'A little less effort.' : 'Your AI. Your choice.'}</strong>
              <small>
                {configured
                  ? settings.provider.supportsVision
                    ? 'Snap a photo. Let your AI do the rest.'
                    : 'Describe a meal. Let your AI do the rest.'
                  : 'Add your Gemini or OpenAI key to get started.'}
              </small>
            </span>
            <Icon name="arrow" size={19} />
          </Link>
          <p className="privacy-footnote">
            <Icon name="shield" size={13} /> No account. No subscription. Always yours.
          </p>
        </section>
        <section className="meals-panel" aria-labelledby="meals-title">
          <div className="section-heading">
            <h2 id="meals-title">Your meals</h2>
            <span>
              {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>
          {entries.length === 0 && (
            <div className="empty-meals">
              <span className="empty-illustration">
                <Icon name="bowl" size={34} />
              </span>
              <h3>A fresh start.</h3>
              <p>Your first meal is the start of a clearer picture.</p>
              <Link to={`/log?day=${dayKey}`} className="btn btn-primary">
                <Icon name="plus" size={18} />
                Log your first meal
              </Link>
            </div>
          )}
          <div className="meal-list">
            {MEAL_ORDER.map((meal) => (
              <MealSection
                key={meal}
                meal={meal}
                dayKey={dayKey}
                entries={entries.filter((e) => e.meal === meal)}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
