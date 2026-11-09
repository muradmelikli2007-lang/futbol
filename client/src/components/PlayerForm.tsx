import { useEffect, useRef, useState } from 'react';
import { api, errorMessage } from '../api';
import { POSITION_LABEL } from '../format';
import type { PlayerRef, Position } from '../types';
import { useApp } from '../state/app';
import { Avatar, Button, Field, Modal, useToast } from './ui';

/** Crops to a centred square and downsizes so photos stay small in the database. */
async function resizeImage(file: File, size = 320): Promise<string> {
  if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) throw new Error('Choose a PNG, JPEG or WebP image.');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('That image could not be read.'));
      el.src = url;
    });
    const side = Math.min(img.width, img.height);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Your browser cannot process images.');
    ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
    return canvas.toDataURL('image/jpeg', 0.86);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function PlayerFormModal({
  open,
  player,
  onClose,
  onSaved,
}: {
  open: boolean;
  player?: PlayerRef | null;
  onClose: () => void;
  onSaved?: (p: PlayerRef) => void;
}) {
  const { meta, changed } = useApp();
  const toast = useToast();
  const [name, setName] = useState('');
  const [position, setPosition] = useState<Position>('ANY');
  // undefined = keep what is stored, null = remove, string = new photo
  const [photo, setPhoto] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setName(player?.name ?? '');
    setPosition(player?.position ?? 'ANY');
    setPhoto(undefined);
    setError(null);
    setBusy(false);
  }, [open, player]);

  const shownPhoto = photo === undefined ? player?.photoUrl ?? null : photo;

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      setPhoto(await resizeImage(file));
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const save = async () => {
    if (!name.trim()) {
      setError('Enter the player name.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { name: name.trim(), position };
      if (photo !== undefined) body.photo = photo;
      const saved = player
        ? await api.put<PlayerRef>(`/api/players/${player.id}`, body)
        : await api.post<PlayerRef>('/api/players', body);
      await changed();
      toast(player ? 'Player updated' : 'Player added');
      onSaved?.(saved);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title={player ? 'Edit player' : 'Add player'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" busy={busy} onClick={save}>
            {player ? 'Save changes' : 'Add player'}
          </Button>
        </>
      }
    >
      <form
        className="stack-sm"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="photo-pick">
          <Avatar player={{ name: name || '?', photoUrl: shownPhoto }} size={72} />
          <div className="stack-sm" style={{ gap: 8 }}>
            <div className="row" style={{ gap: 8 }}>
              <Button type="button" onClick={() => fileRef.current?.click()}>
                {shownPhoto ? 'Change photo' : 'Add photo'}
              </Button>
              {shownPhoto && (
                <Button type="button" variant="ghost" onClick={() => setPhoto(null)}>
                  Remove
                </Button>
              )}
            </div>
            <span className="field-hint">Optional. The image is cropped to a square.</span>
          </div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
        <Field label="Name" htmlFor="pf-name">
          <input id="pf-name" className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </Field>
        <Field label="Preferred position" htmlFor="pf-pos">
          <select id="pf-pos" className="select" value={position} onChange={(e) => setPosition(e.target.value as Position)}>
            {(meta?.positions ?? ['ANY']).map((p) => (
              <option key={p} value={p}>
                {POSITION_LABEL[p]}
              </option>
            ))}
          </select>
        </Field>
        {error && (
          <p className="field-msg" role="alert">
            {error}
          </p>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
