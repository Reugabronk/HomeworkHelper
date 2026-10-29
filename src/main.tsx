import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

function Placeholder() {
  return <p>Verslagcoach wordt opgebouwd…</p>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Placeholder />
  </StrictMode>,
);
