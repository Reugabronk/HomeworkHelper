import { useEffect, useId, useRef, type ReactNode } from 'react';

interface Props {
  open: boolean;
  titel: string;
  onSluit: () => void;
  children: ReactNode;
}

/** Toegankelijke dialoog op basis van het native <dialog>-element (Esc sluit, focus blijft binnen). */
export function Dialoog({ open, titel, onSluit, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titelId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titelId}
      onClose={onSluit}
      onCancel={(e) => {
        e.preventDefault();
        onSluit();
      }}
    >
      {open && (
        <div className="dialoog-binnen">
          <div className="kaart-kop">
            <h2 id={titelId}>{titel}</h2>
            <button type="button" className="klein" onClick={onSluit} aria-label="Sluiten">
              ✕
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
