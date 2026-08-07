/**
 * Tamanho legivel.
 *
 * Uma casa decimal so quando ela diz algo: "796,0 MB" finge uma precisao que
 * ninguem pediu e ainda ocupa dois caracteres a toa numa linha ja apertada.
 *
 * ⚠️ MORA AQUI, e nao dentro de uma tela. Ele nasceu em `SettingsScreen`, e
 * quando a home passou a mostrar o mesmo numero a saida obvia era copiar a
 * funcao — que e exatamente como este app ja teve a mesma conta divergindo em
 * dois lugares (ver a nota do `PEDEM_ACAO` na home).
 */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  if (n < 1024 * 1024 * 1024) return `${Math.round(n / 1048576)} MB`;
  const gb = n / 1073741824;
  return `${gb >= 10 ? Math.round(gb) : gb.toFixed(1)} GB`;
}
