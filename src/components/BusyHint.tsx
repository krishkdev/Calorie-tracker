import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { PresetId } from '../db/types';

interface Props {
  preset: PresetId;
  model: string;
}

/** Shown while an AI request is in flight: elapsed time, and a way out if it drags. */
export default function BusyHint({ preset, model }: Props) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 500);
    return () => clearInterval(timer);
  }, []);
  const name = preset === 'gemini' ? 'Google Gemini' : 'OpenAI';
  const lighter = preset === 'gemini' && model !== 'gemini-3.5-flash-lite';
  return (
    <p className="text-center text-xs text-gray-500 dark:text-gray-400" aria-live="polite">
      Waiting on {name}… {seconds}s
      {seconds >= 10 && (
        <span className="block">
          Slower than usual.{' '}
          {lighter ? (
            <>
              <Link to="/settings" className="underline">
                Switch to gemini-3.5-flash-lite
              </Link>{' '}
              for faster answers, or keep waiting.
            </>
          ) : (
            'The provider may be busy; you can cancel and try again.'
          )}
        </span>
      )}
    </p>
  );
}
