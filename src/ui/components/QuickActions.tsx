import { useStore } from '../../state/store';
import type { ResolvedObligation } from '../useObligations';
import { whatsappLink, mailtoLink } from '../contatoLinks';
import { StatusSelector } from './StatusSelector';

// Ação na própria linha: trocar o status (4 estados, livre) e, quando aguarda o
// contratante, o WhatsApp/e-mail do contato para cobrar em um toque.
export function QuickActions({ ro }: { ro: ResolvedObligation }) {
  const store = useStore();
  const { item, estado } = ro;
  const aguardando = estado === 'aguardandoInput';
  const contratantes = store.contatosDoProjeto(item.projetoId).filter((c) => c.categoria === 'contratante');
  const tel = contratantes.find((c) => c.telefone)?.telefone;
  const email = contratantes.find((c) => c.email)?.email;
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div className="flex flex-wrap items-center gap-2" onClick={stop}>
      <StatusSelector ro={ro} />
      {aguardando && tel && (
        <a className="btn-secondary" href={whatsappLink(tel)} target="_blank" rel="noreferrer" onClick={stop}>
          WhatsApp
        </a>
      )}
      {aguardando && email && (
        <a className="btn-secondary" href={mailtoLink(email)} onClick={stop}>
          E-mail
        </a>
      )}
    </div>
  );
}
