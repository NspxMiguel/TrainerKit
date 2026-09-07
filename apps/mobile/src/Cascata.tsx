import { Children, type ReactNode } from "react";

import { Entrada } from "./Entrada";

/**
 * A CASCATA — os filhos entram um depois do outro.
 *
 * ⚠️ Envolve os filhos em vez de pedir um `indice` em cada bloco: a ficha tem
 * quinze blocos e metade deles é condicional, então numerar à mão daria uma
 * cascata com buracos (o índice 4 some quando a espécie não evolui) e uma linha
 * de manutenção em cada bloco novo.
 *
 * `Children.toArray` já descarta o `false` que um `{cond && <Bloco/>}` produz,
 * então o índice conta os blocos que REALMENTE aparecem.
 *
 * ⚠️ Não use isto dentro de lista virtualizada. `FlatList` monta e desmonta
 * linha conforme rola, e cada remontagem dispararia a entrada de novo — a lista
 * ficaria piscando enquanto a pessoa arrasta.
 */
export function Cascata({ children }: { children: ReactNode }) {
  return (
    <>
      {Children.toArray(children).map((filho, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <Entrada key={i} indice={i}>
          {filho}
        </Entrada>
      ))}
    </>
  );
}
