import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import { Link } from 'react-router-dom';
import { initials, ratingTone } from '../format';
import type { PlayerRef, Result } from '../types';
import { useApp } from '../state/app';

// ------------------------------------------------------------------ icons

const ICONS: Record<string, string> = {
  home: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  players:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  matches: 'M3 5h18v14H3z M12 5v14 M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  rankings: 'M8 21h8 M12 17v4 M7 4h10v5a5 5 0 0 1-10 0z M7 6H4v1a3 3 0 0 0 3 3 M17 6h3v1a3 3 0 0 1-3 3',
  statistics: 'M3 3v18h18 M7 15l4-4 3 3 5-6',
  seasons: 'M3 5h18v16H3z M3 10h18 M8 3v4 M16 3v4',
  compare: 'M7 7h13 M16 3l4 4-4 4 M17 17H4 M8 13l-4 4 4 4',
  plus: 'M12 5v14 M5 12h14',
  edit: 'M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  trash: 'M3 6h18 M8 6V4h8v2 M6 6l1 14h10l1-14',
  close: 'M6 6l12 12 M18 6L6 18',
  menu: 'M4 7h16 M4 12h16 M4 17h16',
  check: 'M5 12l5 5 9-11',
  chevron: 'M9 6l6 6-6 6',
  ball: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 8l3.8 2.8-1.4 4.4H9.6l-1.4-4.4z',
  assist: 'M5 19L19 5 M9 5h10v10',
  swap: 'M7 7h13 M16 3l4 4-4 4 M17 17H4 M8 13l-4 4 4 4',
};

export function Icon({ name, size = 20, className }: { name: keyof typeof ICONS | string; size?: number; className?: string }) {
  if (name === 'star') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
        <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" />
      </svg>
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={ICONS[name] ?? ''} />
    </svg>
  );
}

// ------------------------------------------------------------------ small pieces

export function Avatar({ player, size = 36 }: { player: Pick<PlayerRef, 'name' | 'photoUrl'>; size?: number }) {
  const style = { width: size, height: size, fontSize: Math.max(11, size * 0.38) };
  return player.photoUrl ? (
    <img className="avatar" style={style} src={player.photoUrl} alt="" loading="lazy" />
  ) : (
    <span className="avatar avatar-fallback" style={style} aria-hidden="true">
      {initials(player.name)}
    </span>
  );
}

export function PlayerLink({ player, size = 32, sub }: { player: PlayerRef; size?: number; sub?: ReactNode }) {
  return (
    <Link to={`/players/${player.id}`} className="player-link">
      <Avatar player={player} size={size} />
      <span className="player-link-text">
        <span className="player-link-name">{player.name}</span>
        {sub !== undefined && <span className="player-link-sub">{sub}</span>}
      </span>
    </Link>
  );
}

const RESULT_WORD: Record<Result, string> = { W: 'Win', D: 'Draw', L: 'Loss' };

export function FormChips({ form, size = 'md' }: { form: Result[]; size?: 'sm' | 'md' }) {
  if (!form.length) return <span className="muted">No matches yet</span>;
  return (
    <span className={`form-chips form-${size}`} role="img" aria-label={`Last ${form.length}: ${form.map((r) => RESULT_WORD[r]).join(', ')}`}>
      {form.map((r, i) => (
        <span key={i} className={`chip-result chip-${r}`}>
          {r}
        </span>
      ))}
    </span>
  );
}

export function ResultTag({ result }: { result: Result }) {
  return <span className={`chip-result chip-${result}`} title={RESULT_WORD[result]}>{result}</span>;
}

export function RatingBadge({ rating, size = 'md' }: { rating: number | null | undefined; size?: 'sm' | 'md' | 'lg' }) {
  if (rating === null || rating === undefined) return <span className="muted">-</span>;
  return <span className={`rating rating-${ratingTone(rating)} rating-${size}`}>{rating.toFixed(1)}</span>;
}

export function MvpBadge() {
  return (
    <span className="mvp-badge" title="Most valuable player">
      <Icon name="star" size={12} /> MVP
    </span>
  );
}

export function ScopeBadge() {
  const { scopeLabel, seasonKey } = useApp();
  return <span className={`scope-badge ${seasonKey === 'all' ? 'scope-all' : ''}`}>{scopeLabel}</span>;
}

// ------------------------------------------------------------------ layout pieces

export function PageHeader({ title, subtitle, actions, scope = true }: { title: string; subtitle?: ReactNode; actions?: ReactNode; scope?: boolean }) {
  return (
    <header className="page-head">
      <div className="page-head-text">
        <div className="page-head-line">
          <h1>{title}</h1>
          {scope && <ScopeBadge />}
        </div>
        {subtitle && <p className="page-sub">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Panel({
  title,
  action,
  children,
  flush,
  className = '',
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  flush?: boolean;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {(title || action) && (
        <div className="panel-head">
          {title && <h2>{title}</h2>}
          {action && <div className="panel-action">{action}</div>}
        </div>
      )}
      <div className={flush ? 'panel-body flush' : 'panel-body'}>{children}</div>
    </section>
  );
}

export function StatTile({ label, value, hint, accent }: { label: string; value: ReactNode; hint?: ReactNode; accent?: boolean }) {
  return (
    <div className={`tile ${accent ? 'tile-accent' : ''}`}>
      <span className="tile-label">{label}</span>
      <span className="tile-value num">{value}</span>
      {hint && <span className="tile-hint">{hint}</span>}
    </div>
  );
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state state-error" role="alert">
      <h3>That did not load</h3>
      <p>{message}</p>
      {onRetry && (
        <button className="btn" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="state">
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action && <div className="state-action">{action}</div>}
    </div>
  );
}

/** Wraps a data hook result: loading on first load, error with retry, otherwise render. */
export function Async<T>({
  data,
  loading,
  error,
  reload,
  children,
}: {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload?: () => void;
  children: (data: T) => ReactNode;
}) {
  if (data) {
    return (
      <div className={loading ? 'is-refreshing' : undefined}>
        {error && <ErrorState message={error} onRetry={reload} />}
        {children(data)}
      </div>
    );
  }
  if (error) return <ErrorState message={error} onRetry={reload} />;
  return <Loading />;
}

// ------------------------------------------------------------------ controls

export function Button({
  variant = 'secondary',
  busy,
  icon,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; busy?: boolean; icon?: string }) {
  return (
    <button {...rest} disabled={rest.disabled || busy} className={`btn btn-${variant} ${rest.className ?? ''}`}>
      {busy ? <span className="spinner spinner-sm" aria-hidden="true" /> : icon ? <Icon name={icon} size={18} /> : null}
      {children}
    </button>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" className={o.value === value ? 'on' : ''} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: string; error?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className={`field ${error ? 'field-error' : ''}`}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? <span className="field-msg">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}

// ------------------------------------------------------------------ modal & confirm

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useRef(`modal-${Math.random().toString(36).slice(2)}`).current;
  // Keep the latest onClose in a ref so a parent that passes a new function on every render
  // cannot re-run the effect below (which would steal focus back while the user is typing).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => {
      // An explicit [data-autofocus] wins; otherwise the first visible field (never the hidden file picker).
      const first =
        ref.current?.querySelector<HTMLElement>('[data-autofocus]') ??
        ref.current?.querySelector<HTMLElement>('input:not([type=file]):not([type=hidden]):not([hidden]), select, textarea');
      (first ?? ref.current)?.focus();
    }, 30);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="modal-layer">
      <div className="modal-scrim" onClick={onClose} />
      <div ref={ref} className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  busy,
  blocked,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  busy?: boolean;
  /** The action is known to be impossible: only a Close button is offered. */
  blocked?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        blocked ? (
          <Button variant="ghost" onClick={onCancel}>
            Close
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button variant="danger" busy={busy} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </>
        )
      }
    >
      <p className="sub">{message}</p>
    </Modal>
  );
}

// ------------------------------------------------------------------ toasts

type ToastKind = 'ok' | 'error';
interface ToastItem {
  id: number;
  text: string;
  kind: ToastKind;
}
const ToastCtx = createContext<(text: string, kind?: ToastKind) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((text: string, kind: ToastKind = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs, { id, text, kind }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

// ------------------------------------------------------------------ comparison bar (used by compare + head-to-head)

export function TugBar({ a, b, better, format, colorA = 'var(--s1)', colorB = 'var(--s2)' }: { a: number; b: number; better: 'a' | 'b' | 'tie' | null; format: (n: number) => string; colorA?: string; colorB?: string }) {
  // Each bar is scaled to the larger of the two values, so equal values give equal bars.
  const max = Math.max(a, b);
  const wa = max > 0 ? (a / max) * 100 : 0;
  const wb = max > 0 ? (b / max) * 100 : 0;
  return (
    <div className="tug" aria-hidden="true">
      <span className={`tug-val num ${better === 'a' ? 'is-better' : ''}`}>{format(a)}</span>
      <span className="tug-track">
        <span className="tug-half tug-left">
          <span className="tug-fill" style={{ width: `${wa}%`, background: colorA }} />
        </span>
        <span className="tug-half tug-right">
          <span className="tug-fill" style={{ width: `${wb}%`, background: colorB }} />
        </span>
      </span>
      <span className={`tug-val num ${better === 'b' ? 'is-better' : ''}`}>{format(b)}</span>
    </div>
  );
}
