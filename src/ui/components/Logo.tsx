// Lockup SERGES: símbolo (cruz segmentada) + wordmark em fonte arredondada.
// Os SVGs de marca vivem em src/assets; aqui o lockup é composto para escalar
// e usar a fonte da página de forma confiável.

export function SergesMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden>
      <g fill="var(--color-serges-blue)">
        <rect x="37" y="6" width="26" height="26" rx="8" />
        <rect x="6" y="37" width="26" height="26" rx="8" />
        <rect x="37" y="37" width="26" height="26" rx="8" />
        <rect x="68" y="37" width="26" height="26" rx="8" />
        <rect x="37" y="68" width="26" height="26" rx="8" />
      </g>
    </svg>
  );
}

export function SergesLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2" aria-label="SERGES">
      <SergesMark size={compact ? 26 : 30} />
      {!compact && (
        <span
          className="text-[var(--color-serges-blue)]"
          style={{
            fontFamily: 'var(--font-brand)',
            fontWeight: 600,
            fontSize: '26px',
            letterSpacing: '-0.5px',
            lineHeight: 1,
          }}
        >
          serges
        </span>
      )}
    </span>
  );
}
