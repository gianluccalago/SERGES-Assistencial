import { Fragment, type ReactNode } from 'react';

// Renderizador de markdown mínimo, sem dependências. Cobre o necessário para o
// playbook: títulos (#, ##, ###), listas (-, 1.), parágrafos e **negrito**.

function inline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-[var(--color-ink)]">
          {p.slice(2, -2)}
        </strong>
      );
    }
    return <Fragment key={i}>{p}</Fragment>;
  });
}

export function Markdown({ source }: { source: string }) {
  const lines = source.split('\n');
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) {
      blocks.push(
        <p key={`p${blocks.length}`} className="mb-3 text-[length:var(--text-body)] text-[var(--color-ink-soft)]">
          {inline(para.join(' '))}
        </p>,
      );
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      const Tag = list.ordered ? 'ol' : 'ul';
      blocks.push(
        <Tag
          key={`l${blocks.length}`}
          className={`mb-3 ml-5 space-y-1 text-[length:var(--text-body)] text-[var(--color-ink-soft)] ${
            list.ordered ? 'list-decimal' : 'list-disc'
          }`}
        >
          {list.items.map((it, i) => (
            <li key={i}>{inline(it)}</li>
          ))}
        </Tag>,
      );
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^#{1,3}\s/.test(line)) {
      flushPara();
      flushList();
      const level = line.match(/^#+/)![0].length;
      const text = line.replace(/^#+\s/, '');
      const cls =
        level === 1
          ? 'text-[length:var(--text-title)] mt-2 mb-3'
          : level === 2
            ? 'text-[length:var(--text-heading)] mt-5 mb-2'
            : 'text-[length:var(--text-subheading)] mt-4 mb-2';
      blocks.push(
        <div key={`h${blocks.length}`} className={`font-semibold text-[var(--color-ink)] ${cls}`}>
          {inline(text)}
        </div>,
      );
    } else if (/^[-*]\s/.test(line)) {
      flushPara();
      if (!list || list.ordered) {
        flushList();
        list = { ordered: false, items: [] };
      }
      list.items.push(line.replace(/^[-*]\s/, ''));
    } else if (/^\d+\.\s/.test(line)) {
      flushPara();
      if (!list || !list.ordered) {
        flushList();
        list = { ordered: true, items: [] };
      }
      list.items.push(line.replace(/^\d+\.\s/, ''));
    } else if (line.trim() === '') {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();

  return <div>{blocks}</div>;
}
