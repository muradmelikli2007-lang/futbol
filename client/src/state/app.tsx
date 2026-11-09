import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, errorMessage } from '../api';
import type { Meta, Season } from '../types';

const STORAGE_KEY = 'sixes.season';

interface AppState {
  meta: Meta | null;
  seasons: Season[];
  loaded: boolean;
  bootError: string | null;
  /** 'all' for all-time statistics, otherwise a season id as a string */
  seasonKey: string;
  setSeasonKey: (key: string) => void;
  /** Query-string value to send to the API */
  seasonParam: string;
  scopeLabel: string;
  currentSeason: Season | null;
  /** Bump after any change so every screen refetches. */
  version: number;
  changed: () => Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [seasonKey, setSeasonKeyState] = useState<string>(() => readStored() ?? '');
  const [version, setVersion] = useState(0);

  const setSeasonKey = useCallback((key: string) => {
    setSeasonKeyState(key);
    try {
      localStorage.setItem(STORAGE_KEY, key);
    } catch {
      /* private mode: the choice just will not persist */
    }
  }, []);

  const loadSeasons = useCallback(async () => {
    const list = await api.get<Season[]>('/api/seasons');
    setSeasons(list);
    return list;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [m, list] = await Promise.all([api.get<Meta>('/api/meta'), loadSeasons()]);
        if (cancelled) return;
        setMeta(m);
        setSeasonKeyState((current) => {
          if (current === 'all') return 'all';
          if (current && list.some((s) => String(s.id) === current)) return current;
          return list.length ? String(list[0].id) : 'all'; // newest season by default
        });
      } catch (e) {
        if (!cancelled) setBootError(errorMessage(e));
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadSeasons]);

  const changed = useCallback(async () => {
    const list = await loadSeasons();
    setSeasonKeyState((current) =>
      current === 'all' || list.some((s) => String(s.id) === current) ? current : list.length ? String(list[0].id) : 'all',
    );
    setVersion((v) => v + 1);
  }, [loadSeasons]);

  const value = useMemo<AppState>(() => {
    const currentSeason = seasons.find((s) => String(s.id) === seasonKey) ?? null;
    return {
      meta,
      seasons,
      loaded,
      bootError,
      seasonKey: seasonKey || 'all',
      setSeasonKey,
      seasonParam: seasonKey || 'all',
      scopeLabel: currentSeason ? currentSeason.name : 'All time',
      currentSeason,
      version,
      changed,
    };
  }, [meta, seasons, loaded, bootError, seasonKey, setSeasonKey, version, changed]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppProvider');
  return v;
}
