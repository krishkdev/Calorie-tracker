import { Link } from 'react-router-dom';
import type { AIError } from '../ai/types';

export default function AIErrorCard({ error }: { error: AIError }) {
  const settingsLink = [
    'no_api_key',
    'unauthorized',
    'no_vision',
    'network_or_cors',
    'http',
  ].includes(error.code);
  return (
    <div
      className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-200"
      role="alert"
    >
      <p>{error.message}</p>
      {settingsLink && (
        <Link to="/settings" className="mt-1 inline-block font-medium underline">
          Open Settings
        </Link>
      )}
      {error.code === 'no_vision' && (
        <>
          {' · '}
          <Link to="/log/text" className="mt-1 inline-block font-medium underline">
            Describe it instead
          </Link>
        </>
      )}
    </div>
  );
}
