import { routeNaarHash } from '../../app/router';

export function AiFoutmelding({ fout, inInstellingen }: { fout: string | null; inInstellingen?: boolean }) {
  if (!fout) return null;
  return (
    <div className="melding fout" role="alert">
      {fout}
      {inInstellingen && (
        <>
          {' '}
          <a href={routeNaarHash({ pagina: 'instellingen' })}>Naar Instellingen</a>
        </>
      )}
    </div>
  );
}
