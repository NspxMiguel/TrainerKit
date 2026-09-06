import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system";
import { useEffect, useState } from "react";

/**
 * O dataset, lido do proprio pacote.
 *
 * ⚠️ NAO E `import gamedata from "./gamedata.json"`, e a diferenca importa: o
 * Metro embutiria 2 MB de JSON dentro do bundle JavaScript, que o Hermes teria
 * que analisar inteiro no arranque. Como asset, o arquivo fica no pacote e e
 * lido do disco — o app abre antes de precisar dele.
 *
 * No web isto era `fetch` mais service worker; aqui o arquivo ja esta no
 * aparelho desde a instalacao, entao nao ha rede, nao ha cache e nao ha o que
 * revalidar. A revalidacao diaria (`data/useDataset.ts` do web) continua
 * fazendo sentido e entra depois — o que ela precisa e de um endereco pra
 * buscar, nao de um caminho de arquivo.
 */
export interface EstadoDados {
  pronto: boolean;
  erro: string | null;
  dados: Base | null;
}

export interface Especie {
  id: string;
  dex: number;
  name: string;
  types: string[];
  baseStats: { atk: number; def: number; hp: number };
  spriteId: number | null;
}

export interface Base {
  species: Especie[];
  cpm: number[];
  version: { levelCap: number };
}

export function useDados(): EstadoDados {
  const [estado, setEstado] = useState<EstadoDados>({ pronto: false, erro: null, dados: null });

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const asset = Asset.fromModule(require("../assets/dataset/gamedata.json"));
        await asset.downloadAsync();
        const caminho = asset.localUri ?? asset.uri;
        const texto = await FileSystem.readAsStringAsync(caminho);
        if (vivo) setEstado({ pronto: true, erro: null, dados: JSON.parse(texto) as Base });
      } catch (e) {
        if (vivo) setEstado({ pronto: false, erro: String(e).slice(0, 200), dados: null });
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  return estado;
}
