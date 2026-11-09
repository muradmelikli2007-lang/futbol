import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '../api';
import { useApp } from './app';

interface State<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

/**
 * Fetches `url` (skips when null) and refetches whenever the url or the app-wide data version changes.
 * Old data stays on screen while the next request is in flight, so switching season does not flash.
 */
export function useApi<T>(url: string | null) {
  const { version } = useApp();
  const [state, setState] = useState<State<T>>({ data: null, error: null, loading: url !== null });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (url === null) {
      setState({ data: null, error: null, loading: false });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    api
      .get<T>(url)
      .then((data) => {
        if (!cancelled) setState({ data, error: null, loading: false });
      })
      .catch((e) => {
        if (!cancelled) setState((s) => ({ data: s.data, error: errorMessage(e), loading: false }));
      });
    return () => {
      cancelled = true;
    };
  }, [url, version, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}
