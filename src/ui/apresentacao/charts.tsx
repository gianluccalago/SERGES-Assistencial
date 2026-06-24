// Gráficos leves em SVG (sem dependência), com a identidade do módulo.
// X = 12 meses; aceitam séries com buracos (null = sem dado).

const MESES_CURTOS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

export interface Serie {
  nome: string;
  cor: string;
  valores: Array<number | null>;
}

/** Gráfico de linhas multi-série, 12 meses. Escala ajustada à faixa dos dados;
 * plota só pontos com dado; rotula o último ponto de cada série. */
export function LineChart({ series, fmt, altura = 200, rotuloIdx }: { series: Serie[]; fmt?: (v: number) => string; altura?: number; rotuloIdx?: number }) {
  const W = 720;
  const H = altura;
  const padL = 125;
  const padR = 70;
  const padT = 18;
  const padB = 46;
  const fy = fmt ?? ((v: number) => v.toLocaleString('pt-BR'));
  const vals = series.flatMap((s) => s.valores.filter((v): v is number => v != null));
  const dmax = vals.length ? Math.max(...vals) : 1;
  const dmin = vals.length ? Math.min(...vals) : 0;
  const span = dmax - dmin || dmax || 1;
  const hi = dmax + span * 0.12;
  const lo = Math.max(0, dmin - span * 0.18);
  const x = (i: number) => padL + (i * (W - padL - padR)) / 11;
  const y = (v: number) => padT + (H - padT - padB) * (1 - (v - lo) / (hi - lo || 1));
  const grid = [lo, (lo + hi) / 2, hi];

  // Rótulos: um por série (mês corrente quando há dado; senão o último ponto).
  // Resolve colisão vertical entre rótulos na mesma posição X — nunca sobrepõe.
  const GAP = 24;
  const rotulos = series
    .map((s) => {
      let last = -1;
      for (let i = 0; i < s.valores.length; i++) if (s.valores[i] != null) last = i;
      const idx = rotuloIdx != null && rotuloIdx >= 0 && s.valores[rotuloIdx] != null ? rotuloIdx : last;
      if (idx < 0) return null;
      const val = s.valores[idx] as number;
      const atEnd = idx === 11;
      return {
        cor: s.cor,
        val,
        tx: atEnd ? Math.min(W - 4, x(idx) + 8) : x(idx),
        anchor: (atEnd ? 'start' : 'middle') as 'start' | 'middle',
        y: y(val) - 12,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r != null);
  const grupos = new Map<number, typeof rotulos>();
  for (const r of rotulos) {
    const k = Math.round(r.tx);
    const g = grupos.get(k) ?? [];
    g.push(r);
    grupos.set(k, g);
  }
  const topoY = padT + 12;
  const baseY = H - padB - 4;
  for (const g of grupos.values()) {
    g.sort((a, b) => a.y - b.y);
    for (let i = 1; i < g.length; i++) if (g[i].y < g[i - 1].y + GAP) g[i].y = g[i - 1].y + GAP;
    const over = g[g.length - 1].y - baseY;
    if (over > 0) for (const r of g) r.y -= over;
    const under = topoY - g[0].y;
    if (under > 0) for (const r of g) r.y += under;
  }

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: H }} role="img">
        {grid.map((g, gi) => (
          <g key={gi}>
            <line x1={padL} y1={y(g)} x2={W - padR} y2={y(g)} stroke="var(--color-line)" strokeWidth={gi === 0 ? 2 : 1} />
            <text x={padL - 8} y={y(g) + 7} textAnchor="end" fontSize="20" fill="var(--color-ink-faint)">{fy(g)}</text>
          </g>
        ))}
        {MESES_CURTOS.map((m, i) => (
          <text key={i} x={x(i)} y={H - 12} textAnchor="middle" fontSize="20" fill="var(--color-ink-faint)">{m}</text>
        ))}
        {series.map((s) => {
          const pts = s.valores.map((v, i) => (v == null ? null : `${x(i)},${y(v)}`)).filter(Boolean) as string[];
          return (
            <g key={s.nome}>
              <polyline points={pts.join(' ')} fill="none" stroke={s.cor} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />
              {s.valores.map((v, i) => (v == null ? null : <circle key={i} cx={x(i)} cy={y(v)} r={5} fill={s.cor} />))}
            </g>
          );
        })}
        {/* Rótulos por cima das linhas, já sem sobreposição vertical. */}
        {rotulos.map((r, i) => (
          <text key={i} x={r.tx} y={r.y} textAnchor={r.anchor} fontSize="22" fontWeight={700} fill={r.cor}>
            {fy(r.val)}
          </text>
        ))}
      </svg>
      <Legenda series={series} />
    </div>
  );
}

/** Barras horizontais agrupadas Orçado × Realizado (um grupo por métrica). */
export function BarrasComparativas({
  grupos,
  fmt,
  corOrcado,
  corRealizado,
}: {
  grupos: Array<{ label: string; orcado: number; realizado: number; corReal?: string }>;
  fmt: (v: number) => string;
  corOrcado: string;
  corRealizado: string;
}) {
  const max = Math.max(1, ...grupos.flatMap((g) => [Math.abs(g.orcado), Math.abs(g.realizado)]));
  const Barra = ({ valor, cor, leg }: { valor: number; cor: string; leg: string }) => (
    <div className="flex items-center gap-2">
      <span className="w-[64px] shrink-0 text-[length:var(--text-caption)] text-[var(--color-ink-faint)]">{leg}</span>
      <div className="relative h-6 flex-1 overflow-hidden rounded-[var(--radius-sm)] bg-[var(--color-canvas)]">
        <div className="h-full rounded-[var(--radius-sm)]" style={{ width: `${Math.min(100, (Math.abs(valor) / max) * 100)}%`, backgroundColor: valor < 0 ? 'var(--color-overdue)' : cor }} />
      </div>
      <span className="w-[104px] shrink-0 text-right text-[length:var(--text-caption)] font-semibold tabular-nums">{fmt(valor)}</span>
    </div>
  );
  return (
    <div className="space-y-4">
      {grupos.map((g) => (
        <div key={g.label}>
          <div className="label mb-1">{g.label}</div>
          <div className="space-y-1">
            <Barra valor={g.orcado} cor={corOrcado} leg="Orçado" />
            <Barra valor={g.realizado} cor={g.corReal ?? corRealizado} leg="Realizado" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Gráfico de barras (uma série), 12 meses — para furos. */
export function BarChart({ valores, cor, fmt, altura = 160 }: { valores: Array<number | null>; cor: string; fmt?: (v: number) => string; altura?: number }) {
  const W = 720;
  const H = altura;
  const padL = 56;
  const padR = 16;
  const padT = 22;
  const padB = 46;
  const max = Math.max(1, ...valores.map((v) => v ?? 0));
  const x = (i: number) => padL + (i * (W - padL - padR)) / 12;
  const bw = ((W - padL - padR) / 12) * 0.6;
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / max);
  const fy = fmt ?? ((v: number) => String(Math.round(v)));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: H }} role="img">
      <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="var(--color-line)" strokeWidth={2} />
      <text x={padL - 8} y={padT + 6} textAnchor="end" fontSize="20" fill="var(--color-ink-faint)">{fy(max)}</text>
      {valores.map((v, i) => {
        const val = v ?? 0;
        const h = (H - padT - padB) * (val / max);
        return (
          <g key={i}>
            <rect x={x(i) + ((W - padL - padR) / 12 - bw) / 2} y={y(val)} width={bw} height={Math.max(0, h)} rx={2} fill={val > 0 ? cor : 'var(--color-line)'} />
            {val > 0 && <text x={x(i) + (W - padL - padR) / 24} y={y(val) - 8} textAnchor="middle" fontSize="20" fontWeight={700} fill={cor}>{val}</text>}
            <text x={x(i) + (W - padL - padR) / 24} y={H - 14} textAnchor="middle" fontSize="20" fill="var(--color-ink-faint)">{MESES_CURTOS[i]}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Legenda({ series }: { series: Serie[] }) {
  return (
    <div className="mt-1 flex flex-wrap justify-center gap-5">
      {series.map((s) => (
        <span key={s.nome} className="flex items-center gap-2 text-[length:var(--text-label)] text-[var(--color-ink-soft)]">
          <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: s.cor }} />
          {s.nome}
        </span>
      ))}
    </div>
  );
}
