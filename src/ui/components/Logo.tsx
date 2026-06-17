// Lockup SERGES oficial (na cor de marca #2042E1).
// - azul_1.svg: lockup horizontal (símbolo + "serges") para o cabeçalho.
// - serges-square.svg: símbolo isolado, para telas pequenas e favicon.
import lockup from '../../assets/azul_1.svg';
import square from '../../assets/serges-square.svg';

export function SergesMark({ size = 28 }: { size?: number }) {
  return <img src={square} alt="SERGES" width={size} height={size} style={{ display: 'block' }} />;
}

export function SergesLogo({ compact = false }: { compact?: boolean }) {
  if (compact) return <SergesMark size={28} />;
  return <img src={lockup} alt="SERGES" style={{ height: 30, width: 'auto', display: 'block' }} />;
}
