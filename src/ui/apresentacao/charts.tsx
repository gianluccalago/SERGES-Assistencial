// Gráficos leves em SVG (sem dependência), com a identidade do módulo.
// X = 12 meses; aceitam séries com buracos (null = sem dado).

const MESES_CURTOS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

export interface Serie {
  nome: string;
  cor: string;
  valores: Array<number | null>;
}

function maxDe(series: Serie[]): number {
  let m = 0;
  for (const s of series) for (const v of s.valores) if (v != null && v > m) m = v;
  return m || 1;
}

/** Gráfico de linhas multi-série, 12 meses. */
export function LineChart({ series, fmt, altura = 200 }: { series: Serie[]; fmt?: (v: number) => string; altura?: number }) {
  const W = 720;
  const H = altura;
  const padL = 56;
  const padR = 12;
  const padT = 12;
  const padB = 26;
  const max = maxDe(series);
  const x = (i: number) => padL + (i * (W - padL - padR)) / 11;
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / max);
  const fy = fmt ?? ((v: number) => v.toLocaleString('pt-BR'));
  const grid = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: H }} role="img">
        {grid.map((g) => {
          const gy = padT + (H - padT - padB) * (1 - g);
          return (
            <g key={g}>
              <line x1={padL} y1={gy} x2={W - padR} y2={gy} stroke="var(--color-line)" strokeWidth={1} />
              <text x={padL - 6} y={gy + 3} textAnchor="end" fontSize="10" fill="var(--color-ink-faint)">{fy(max * g)}</text>
            </g>
          );
        })}
        {MESES_CURTOS.map((m, i) => (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--color-ink-faint)">{m}</text>
        ))}
        {series.map((s) => {
          const pts = s.valores.map((v, i) => (v == null ? null : `${x(i)},${y(v)}`)).filter(Boolean) as string[];
          return (
            <g key={s.nome}>
              <polyline points={pts.join(' ')} fill="none" stroke={s.cor} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
              {s.valores.map((v, i) => (v == null ? null : <circle key={i} cx={x(i)} cy={y(v)} r={3} fill={s.cor} />))}
            </g>
          );
        })}
      </svg>
      <Legenda series={series} />
    </div>
  );
}

/** Gráfico de barras (uma série), 12 meses — para furos. */
export function BarChart({ valores, cor, fmt, altura = 160 }: { valores: Array<number | null>; cor: string; fmt?: (v: number) => string; altura?: number }) {
  const W = 720;
  const H = altura;
  const padL = 40;
  const padR = 12;
  const padT = 12;
  const padB = 26;
  const max = Math.max(1, ...valores.map((v) => v ?? 0));
  const x = (i: number) => padL + (i * (W - padL - padR)) / 12;
  const bw = ((W - padL - padR) / 12) * 0.6;
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / max);
  const fy = fmt ?? ((v: number) => String(Math.round(v)));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: H }} role="img">
      <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="var(--color-line)" strokeWidth={1} />
      <text x={padL - 6} y={padT + 4} textAnchor="end" fontSize="10" fill="var(--color-ink-faint)">{fy(max)}</text>
      {valores.map((v, i) => {
        const val = v ?? 0;
        const h = (H - padT - padB) * (val / max);
        return (
          <g key={i}>
            <rect x={x(i) + ((W - padL - padR) / 12 - bw) / 2} y={y(val)} width={bw} height={Math.max(0, h)} rx={2} fill={val > 0 ? cor : 'var(--color-line)'} />
            {val > 0 && <text x={x(i) + (W - padL - padR) / 24} y={y(val) - 4} textAnchor="middle" fontSize="9" fill={cor}>{val}</text>}
            <text x={x(i) + (W - padL - padR) / 24} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--color-ink-faint)">{MESES_CURTOS[i]}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Legenda({ series }: { series: Serie[] }) {
  return (
    <div className="mt-1 flex flex-wrap justify-center gap-4">
      {series.map((s) => (
        <span key={s.nome} className="flex items-center gap-1.5 text-[length:var(--text-caption)] text-[var(--color-ink-soft)]">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.cor }} />
          {s.nome}
        </span>
      ))}
    </div>
  );
}
