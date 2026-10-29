// Algemene coach-chat die weet in welke opdracht en welk hoofdstuk de student zit.
import { useEffect, useId, useRef, useState } from 'react';
import { useApp } from '../../app/context';
import { chatMetCoach } from '../../ai/coach';
import { CHAT_GEHEUGEN } from '../../ai/prompts';
import { HOOFDSTUK_NAMEN } from '../../ai/standaard-instructies';
import { nieuwChatBericht } from '../../data/model';
import type { HoofdstukId, Opdracht } from '../../data/types';
import { AiFoutmelding } from './AiFoutmelding';
import { Markdown } from './Markdown';
import { useAiVerzoek } from './useAiVerzoek';

interface Props {
  opdracht: Opdracht;
  hoofdstuk: HoofdstukId;
  wijzig: (fn: (o: Opdracht) => Opdracht) => void;
}

export function ChatPaneel({ opdracht, hoofdstuk, wijzig }: Props) {
  const { omgeving, heeftSleutel } = useApp();
  const [open, setOpen] = useState(false);
  const [invoer, setInvoer] = useState('');
  const { bezig, liveTekst, fout, foutInInstellingen, voerUit, stop } = useAiVerzoek();
  const lijst = useRef<HTMLDivElement>(null);
  const invoerRef = useRef<HTMLTextAreaElement>(null);
  const openKnop = useRef<HTMLButtonElement>(null);
  const titelId = useId();
  const invoerId = useId();

  useEffect(() => {
    lijst.current?.scrollTo({ top: lijst.current.scrollHeight });
  }, [opdracht.chat.length, liveTekst, open]);

  useEffect(() => {
    if (open) invoerRef.current?.focus();
  }, [open]);

  const sluit = () => {
    setOpen(false);
    openKnop.current?.focus();
  };

  const verstuur = async () => {
    const tekst = invoer.trim();
    if (!tekst || bezig) return;
    const bericht = nieuwChatBericht('student', tekst, hoofdstuk);
    const geschiedenis = [...opdracht.chat, bericht];
    wijzig((o) => ({ ...o, chat: [...o.chat, bericht] }));
    setInvoer('');
    const antwoord = await voerUit((opties) => chatMetCoach(omgeving, { ...opdracht, chat: geschiedenis }, hoofdstuk, geschiedenis, opties));
    if (antwoord !== undefined) {
      wijzig((o) => ({ ...o, chat: [...o.chat, nieuwChatBericht('coach', antwoord, hoofdstuk)] }));
    }
  };

  if (!open) {
    return (
      <button ref={openKnop} type="button" className="chat-knop primair" onClick={() => setOpen(true)} aria-expanded={false}>
        💬 Vraag de coach
      </button>
    );
  }

  return (
    <aside
      className="chatpaneel"
      aria-labelledby={titelId}
      onKeyDown={(e) => {
        if (e.key === 'Escape') sluit();
      }}
    >
      <header>
        <h2 id={titelId}>Coach-chat</h2>
        {opdracht.chat.length > 0 && (
          <button
            type="button"
            className="klein"
            onClick={() => window.confirm('Het hele gesprek wissen?') && wijzig((o) => ({ ...o, chat: [] }))}
          >
            Wis
          </button>
        )}
        <button type="button" className="klein" onClick={sluit} aria-label="Chat sluiten">
          ✕
        </button>
      </header>
      <p className="zacht klein" style={{ margin: '0.5rem 1rem 0' }}>
        Je zit in: <strong>{HOOFDSTUK_NAMEN[hoofdstuk]}</strong>. De coach kent je opdracht en de tekst van dit hoofdstuk, en
        onthoudt de laatste {CHAT_GEHEUGEN} berichten.
      </p>
      <div className="chat-berichten" ref={lijst} aria-live="polite">
        {opdracht.chat.length === 0 && (
          <p className="zacht">Stel een vraag over de opdracht, de theorie of je planning. De coach schrijft geen verslagtekst voor je, maar helpt je wel op weg.</p>
        )}
        {opdracht.chat.map((b) =>
          b.rol === 'student' ? (
            <div key={b.id} className="chat-bericht student">
              <span className="sr-only">Jij: </span>
              {b.tekst}
            </div>
          ) : (
            <div key={b.id} className="chat-bericht coach">
              <span className="sr-only">Coach: </span>
              <Markdown tekst={b.tekst} />
            </div>
          ),
        )}
        {bezig && (
          <div className="chat-bericht coach" aria-busy="true">
            {liveTekst ? <Markdown tekst={liveTekst} /> : <span className="laden">De coach denkt na</span>}
          </div>
        )}
        <AiFoutmelding fout={fout} inInstellingen={foutInInstellingen} />
        {!heeftSleutel && <p className="zacht klein">Vul eerst je API-sleutel in bij Instellingen.</p>}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void verstuur();
        }}
      >
        <label htmlFor={invoerId} className="sr-only">
          Bericht aan de coach
        </label>
        <textarea
          id={invoerId}
          ref={invoerRef}
          value={invoer}
          placeholder="Typ je vraag… (Enter = versturen, Shift+Enter = nieuwe regel)"
          onChange={(e) => setInvoer(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void verstuur();
            }
          }}
        />
        {bezig ? (
          <button type="button" onClick={stop}>
            Stop
          </button>
        ) : (
          <button type="submit" className="primair" disabled={!invoer.trim()}>
            Stuur
          </button>
        )}
      </form>
    </aside>
  );
}
