import { useStore } from '../../state/store';
import { useToast } from './Toast';
import type { ResolvedObligation } from '../useObligations';
import { registrarRetorno } from '../../domain/stateMachine';
import { todayISO } from '../format';
import { whatsappLink, mailtoLink } from '../contatoLinks';

// Ações rápidas exibidas na própria linha (lista, semana, checklist), conforme
// o estado da obrigação. Resolve o caso comum com um toque, sem abrir o detalhe.
export function QuickActions({ ro }: { ro: ResolvedObligation }) {
  const store = useStore();
  const toast = useToast();
  const { item, estado, podeConcluir } = ro;
  const aguardando = estado === 'aguardandoInput';

  const contratantes = store.contatosDoProjeto(item.projetoId).filter((c) => c.categoria === 'contratante');
  const tel = contratantes.find((c) => c.telefone)?.telefone;
  const email = contratantes.find((c) => c.email)?.email;

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  function concluir(e: React.MouseEvent) {
    stop(e);
    const anterior = item.baseEstado;
    store.setEstado(item, 'concluida');
    toast.show('Concluída.', () => store.setEstado(item, anterior));
  }

  function reabrir(e: React.MouseEvent) {
    stop(e);
    store.setEstado(item, 'pendente');
  }

  function registrar(e: React.MouseEvent) {
    stop(e);
    const ov = store.getOverride(item.id);
    store.patchOverride(item.id, {
      ...registrarRetorno(ov, todayISO(), todayISO()),
      ocRecebida: item.dependenciaAguardada === 'ordemDeCompra' ? true : undefined,
    });
    toast.show('Retorno registrado.', () =>
      store.patchOverride(item.id, { estado: undefined, dataNova: undefined, retornoRecebidoEm: undefined, ocRecebida: undefined }),
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1" onClick={stop}>
      {aguardando && (
        <>
          {tel && (
            <a className="btn-secondary" href={whatsappLink(tel)} target="_blank" rel="noreferrer" onClick={stop}>
              WhatsApp
            </a>
          )}
          {email && (
            <a className="btn-secondary" href={mailtoLink(email)} onClick={stop}>
              E-mail
            </a>
          )}
          {item.tipo === 'faturamentoCard' && !item.isManual && (
            <button className="btn-secondary" onClick={registrar}>
              Registrar retorno
            </button>
          )}
        </>
      )}
      {!aguardando && estado !== 'concluida' && (
        <button className="btn-primary" disabled={!podeConcluir} onClick={concluir}>
          Concluir
        </button>
      )}
      {estado === 'concluida' && (
        <button className="btn-secondary" onClick={reabrir}>
          Reabrir
        </button>
      )}
    </div>
  );
}
