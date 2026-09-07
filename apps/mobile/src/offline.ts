import { Asset } from "expo-asset";
import { Directory, File, Paths } from "expo-file-system";
import { useCallback, useEffect, useState } from "react";

import { spriteUrl, type BuiltinSourceId } from "@trainerkit/core";

import type { FonteId } from "./imagens";

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
export function arquivoLocal(spriteId: number | null, fonte: FonteId): string | null {
  /* ⚠️ A fonte PRÓPRIA não tem cópia local: o download offline baixa das
     duas embutidas, que têm um endereço por spriteId. Um manifesto pode
     apontar cada espécie para um host diferente, e varrer isso seria
     outro recurso — não um detalhe deste. */
  if (spriteId == null || fonte === "off" || fonte === "custom") return null;
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

/**
 * QUANTO O APP OCUPA — medido agora, no disco, não estimado.
 *
 * ⚠️ Percorre as pastas de TODAS as fontes, não só a ligada: quem baixou a arte
 * oficial e depois trocou para os renders 3D continua com as duas no aparelho, e
 * uma medida que só olhasse a fonte atual esconderia metade do que ocupa.
 *
 * A base do jogo entra separada porque ela é o único item que não dá para
 * apagar — vem no pacote e é o que faz o app funcionar sem rede.
 */
export async function medirArmazenamento(): Promise<{
  base: number;
  imagens: number;
  total: number;
}> {
  let imagens = 0;
  try {
    if (RAIZ.exists) {
      for (const dir of RAIZ.list()) {
        if (!(dir instanceof Directory)) continue;
        for (const f of dir.list()) if (f instanceof File) imagens += f.size ?? 0;
      }
    }
  } catch {
    /* Pasta some entre o `exists` e o `list` numa limpeza do sistema. */
  }
  let base = 0;
  try {
    const asset = Asset.fromModule(require("../assets/dataset/gamedata.tkdata"));
    /* ⚠️ Em desenvolvimento o asset chega pelo Metro e `localUri` e nulo ate o
       download. Sem esta espera a base media 0 MB — um numero errado com cara
       de certo. */
    await asset.downloadAsync();
    const uri = asset.localUri ?? asset.uri;
    if (uri.startsWith("file:")) base = new File(uri).size ?? 0;
  } catch {
    /* Sem o caminho local a base ainda existe; o que falta é o número dela. */
  }
  return { base, imagens, total: base + imagens };
}

/** `1,2 MB` no idioma de quem lê — `Intl` já faz isso e não precisa de tabela. */
export function emMegabytes(bytes: number, idioma: string): string {
  const mb = bytes / (1024 * 1024);
  return `${new Intl.NumberFormat(idioma, { maximumFractionDigits: mb < 10 ? 1 : 0 }).format(mb)} MB`;
}
