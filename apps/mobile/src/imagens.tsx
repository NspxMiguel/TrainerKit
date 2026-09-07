import {
  SPRITE_SOURCE_KEYS,
  manifestSpriteUrl,
  spriteUrl,
  type BuiltinSourceId,
  type SpriteManifest,
} from "@trainerkit/core";
import AsyncStorage from "expo-sqlite/kv-store";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * A FONTE DE IMAGEM — desligada por padrão, e isso não é economia.
 *
 * O app é distribuído sem arte nenhuma, e o monograma colorido não é um
 * placeholder envergonhado: ele é o recurso de qualquer espécie sem arquivo, em
 * qualquer fonte. Ligar significa buscar imagem do GitHub enquanto se navega, e
 * essa é uma escolha de quem instala.
 *
 * ⚠️ E é a política de privacidade que obriga o padrão a ser esse. A tela de
 * Privacidade diz que UM host recebe pedido do app (a lista de eventos). Ligar
 * a fonte de imagem acrescenta um segundo — e é por isso que a mesma tela
 * declara isso, condicionado a esta configuração estar ligada. Ligar por padrão
 * transformaria uma frase verdadeira em falsa.
 */
const CHAVE = "tk:imagens";
/** O manifesto proprio, guardado inteiro: sem rede, a fonte continua de pe. */
const CHAVE_MANIFESTO = "tk:imagens-manifesto";
const CHAVE_MANIFESTO_URL = "tk:imagens-manifesto-url";

/** As três embutidas. O `.zip` próprio do web não atravessa pro nativo. */
export const FONTES: BuiltinSourceId[] = ["off", "pokeapi-artwork", "pokeapi-home"];

/**
 * A quarta opção: o manifesto de quem usa.
 *
 * ⚠️ O `.zip` do web NÃO atravessa — ele mora em IndexedDB e depende de
 * `fflate`. O manifesto por endereço atravessa inteiro, e é o que resolve o
 * mesmo problema: não ficar preso às duas fontes que EU escolhi.
 */
export type FonteId = BuiltinSourceId | "custom";

export { SPRITE_SOURCE_KEYS };

interface Ctx {
  fonte: FonteId;
  definir: (f: FonteId) => void;
  /** O manifesto em uso, quando `fonte === "custom"`. */
  manifesto: SpriteManifest | null;
  manifestoUrl: string | null;
  /** Guarda o manifesto JA VALIDADO e passa a fonte para `custom`. */
  definirManifesto: (url: string, m: SpriteManifest) => void;
  /** Endereço da arte de uma espécie nesta fonte, ou `null`. */
  urlDaEspecie: (req: { id: string; dex: number; spriteId: number | null }) => string | null;
}

const Contexto = createContext<Ctx | null>(null);

export function Imagens({ children }: { children: ReactNode }) {
  const [fonte, setFonte] = useState<FonteId>("off");
  const [manifesto, setManifesto] = useState<SpriteManifest | null>(null);
  const [manifestoUrl, setManifestoUrl] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [f, m, u] = await Promise.all([
        AsyncStorage.getItem(CHAVE).catch(() => null),
        AsyncStorage.getItem(CHAVE_MANIFESTO).catch(() => null),
        AsyncStorage.getItem(CHAVE_MANIFESTO_URL).catch(() => null),
      ]);
      if (m) {
        try {
          setManifesto(JSON.parse(m) as SpriteManifest);
          setManifestoUrl(u);
        } catch {
          /* Manifesto corrompido no disco não pode derrubar a abertura. */
        }
      }
      /*
       * ⚠️ `custom` só volta a valer COM manifesto no disco. Sem essa guarda,
       * quem tivesse escolhido a fonte própria e perdido o arquivo abriria o
       * app numa fonte que não resolve nenhuma imagem, e o monograma pareceria
       * defeito em vez de escolha.
       */
      if (f === "pokeapi-artwork" || f === "pokeapi-home" || f === "off") setFonte(f);
      else if (f === "custom" && m) setFonte("custom");
    })();
  }, []);

  const valor = useMemo<Ctx>(
    () => ({
      fonte,
      manifesto,
      manifestoUrl,
      definir: (f) => {
        setFonte(f);
        AsyncStorage.setItem(CHAVE, f).catch(() => {});
      },
      definirManifesto: (url, m) => {
        setManifesto(m);
        setManifestoUrl(url);
        setFonte("custom");
        AsyncStorage.setItem(CHAVE_MANIFESTO, JSON.stringify(m)).catch(() => {});
        AsyncStorage.setItem(CHAVE_MANIFESTO_URL, url).catch(() => {});
        AsyncStorage.setItem(CHAVE, "custom").catch(() => {});
      },
      urlDaEspecie: (req) => {
        if (fonte === "custom") return manifesto ? manifestSpriteUrl(req, manifesto) : null;
        return spriteUrl({ spriteId: req.spriteId }, fonte);
      },
    }),
    [fonte, manifesto, manifestoUrl],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useImagens(): Ctx {
  const c = useContext(Contexto);
  if (!c) throw new Error("useImagens fora do <Imagens>");
  return c;
}
