// Exportação dos slides como PDF / PPTX (1 slide = 1 página/slide, 16:9).
// Cada slide já é uma caixa 16:9; rasterizamos em PNG e montamos o arquivo.
// Libs carregadas sob demanda (ficam fora do bundle inicial).

/** Rasteriza cada nó (um slide) em PNG (dataURL), na ordem recebida. */
export async function rasterizarSlides(nodes: HTMLElement[]): Promise<string[]> {
  const html2canvas = (await import('html2canvas-pro')).default;
  // Garante fontes carregadas antes de capturar (evita texto com fonte errada).
  try { await (document as any).fonts?.ready; } catch { /* noop */ }
  const imgs: string[] = [];
  for (const node of nodes) {
    const canvas = await html2canvas(node, { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true });
    imgs.push(canvas.toDataURL('image/png'));
  }
  return imgs;
}

/** PDF paisagem 16:9, uma página por slide. */
export async function exportarPDF(imgs: string[], nome: string): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const W = 960;
  const H = 540; // 16:9 em pontos
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: [W, H] });
  imgs.forEach((data, i) => {
    if (i > 0) pdf.addPage([W, H], 'landscape');
    pdf.addImage(data, 'PNG', 0, 0, W, H);
  });
  pdf.save(`${nome}.pdf`);
}

/** PPTX 16:9, um slide por imagem (full-bleed). */
export async function exportarPPTX(imgs: string[], nome: string): Promise<void> {
  const Pptx = (await import('pptxgenjs')).default;
  const pptx = new Pptx();
  pptx.defineLayout({ name: 'SERGES16x9', width: 13.333, height: 7.5 });
  pptx.layout = 'SERGES16x9';
  for (const data of imgs) {
    const slide = pptx.addSlide();
    slide.addImage({ data, x: 0, y: 0, w: 13.333, h: 7.5 });
  }
  await pptx.writeFile({ fileName: `${nome}.pptx` });
}

/** Nome de arquivo seguro a partir do título da competência. */
export function nomeArquivo(base: string): string {
  return (base || 'apresentacao').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9-_ ]/g, '').trim().replace(/\s+/g, '_') || 'apresentacao';
}
