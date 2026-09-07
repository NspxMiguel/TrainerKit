import { Directory, File, Paths } from "expo-file-system";
import { useCallback, useEffect, useState } from "react";

import { spriteUrl, type BuiltinSourceId } from "@trainerkit/core";

/**
 * AS IMAGENS NO APARELHO.
 *
 * ⚠️ Isto é o print 10 do pacote, e é a última função do site que faltava aqui.
 * Com a fonte de imagem ligada o app busca cada sprite do GitHub enquanto a
 * pessoa navega — funciona, e depende da rede. Baixado uma vez, o app abre a
 * grade inteira sem tocar na rede.
 *
 * ⚠️ O ARQUIVO LOCAL VEM PRIMEIRO e a rede é o fallback, não o contrário. Se
 * fosse ao contrário, baixar não mudaria nada: a tela continuaria esperando o
 * GitHub responder antes de olhar o disco.
 *
 * ⚠️ Uma pasta POR FONTE. Arte oficial e renders 3D são imagens diferentes do
 * mesmo bicho; misturar as duas na mesma pasta faria trocar de fonte mostrar a
 * imagem da outra.
 */
const RAIZ = new Directory(Paths.document, "sprites");

function pasta(fonte: BuiltinSourceId): Directory {
  return new Directory(RAIZ, fonte);
}

/** Onde a imagem daquela espécie mora, se estiver baixada. */
export function arquivoLocal(spriteId: number | null, fonte: BuiltinSourceId): string | null {
  if (spriteId == null || fonte === "off") return null;
  const f = new File(pasta(fonte), `${spriteId}.png`);
  return f.exists ? f.uri : null;
}

export interface EstadoDownload {
  baixando: boolean;
  /** Quantas já foram, de `total`. */
  feitas: number;
  total: number;
  /** Quantas existem no disco agora. */
  guardadas: number;
}

/**
 * Baixa as imagens de uma lista de espécies, uma a uma.
 *
 * ⚠️ SEQUENCIAL, e não em paralelo. São mais de mil arquivos: disparar tudo de
 * uma vez derruba a conexão de quem está no 4G e o GitHub responde 429. Uma de
 * cada vez leva mais tempo e termina.
 *
 * ⚠️ Quem já está no disco é PULADO, então reabrir e continuar é de graça — e é
 * como isto sobrevive a um download interrompido, que numa lista de mil é o
 * caso normal e não a exceção.
 */
export function useOffline(fonte: BuiltinSourceId): {
  estado: EstadoDownload;
  baixar: (ids: readonly (number | null)[]) => Promise<void>;
  apagar: () => void;
  recontar: () => void;
} {
  const [estado, setEstado] = useState<EstadoDownload>({
    baixando: false,
    feitas: 0,
    total: 0,
    guardadas: 0,
  });

  const recontar = useCallback(() => {
    try {
      const d = pasta(fonte);
      setEstado((e) => ({ ...e, guardadas: d.exists ? d.list().length : 0 }));
    } catch {
      setEstado((e) => ({ ...e, guardadas: 0 }));
    }
  }, [fonte]);

  useEffect(recontar, [recontar]);

  const baixar = useCallback(
    async (ids: readonly (number | null)[]) => {
      if (fonte === "off") return;
      const d = pasta(fonte);
      if (!d.exists) d.create({ intermediates: true });

      const alvos = ids.filter((x): x is number => x != null);
      setEstado({ baixando: true, feitas: 0, total: alvos.length, guardadas: 0 });

      let feitas = 0;
      for (const id of alvos) {
        const destino = new File(d, `${id}.png`);
        if (!destino.exists) {
          const url = spriteUrl({ spriteId: id }, fonte);
          if (url) {
            try {
              await File.downloadFileAsync(url, destino);
            } catch {
              /* Espécie sem arte na fonte escolhida não é erro: as formas
                 regionais faltam em várias, e o selo já sabe cair no monograma. */
            }
          }
        }
        feitas += 1;
        /* A cada vinte, e não a cada uma: mil e duzentos `setState` seguidos
           travam a rolagem da tela que mostra o progresso. */
        if (feitas % 20 === 0 || feitas === alvos.length) {
          setEstado((e) => ({ ...e, feitas, baixando: feitas < alvos.length }));
        }
      }
      recontar();
      setEstado((e) => ({ ...e, baixando: false, feitas: alvos.length }));
    },
    [fonte, recontar],
  );

  const apagar = useCallback(() => {
    try {
      const d = pasta(fonte);
      if (d.exists) d.delete();
    } catch {
      /* Nada a apagar é o mesmo que apagado. */
    }
    recontar();
  }, [fonte, recontar]);

  return { estado, baixar, apagar, recontar };
}
