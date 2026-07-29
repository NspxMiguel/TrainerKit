import Dexie, { type Table } from "dexie";
import { useEffect, useState } from "react";

import type { IVs } from "@trainerkit/core";

/**
 * A colecao do usuario.
 *
 * Fica em IndexedDB, no aparelho, e nunca sai dali. Nao ha servidor, nao ha
 * conta e nao ha sincronizacao — o que significa que o unico jeito de perder
 * isto e o navegador despejar os dados, que e exatamente o risco que
 * `persist.ts` combate.
 *
 * Por isso o export em JSON existe desde o primeiro dia: rede de seguranca que
 * nao depende do humor do browser.
 */

export interface OwnedPokemon {
  id: string;
  speciesId: string;
  /** Apelido do jogador. Cosmetico — nunca usado para identificar a especie. */
  nickname: string | null;
  ivs: IVs;
  /** `null` quando o jogador nao informou PC e PS. */
  level: number | null;
  cp: number | null;
  hp: number | null;
  lucky: boolean;
  shadow: boolean;
  addedAt: string;
  /**
   * O veredito que a pessoa JA CUMPRIU.
   *
   * O app dizia "INVESTIR" em verde e continuava dizendo pra sempre, mesmo
   * depois de a pessoa investir. Um aviso que nao sai depois de atendido para
   * de ser aviso e vira ruido — e pior, ensina a ignorar os outros.
   *
   * Guardamos QUAL acao foi feita, nao um booleano: o veredito muda quando o
   * Pokemon sobe de nivel ou evolui, e "ja evolui" nao responde a um
   * "transferir" que apareca depois. Marcado e cumprido so quando o veredito
   * atual e o mesmo que foi marcado.
   */
  doneAction: string | null;
}

class CollectionDb extends Dexie {
  pokemon!: Table<OwnedPokemon, string>;

  constructor() {
    super("trainerkit-collection");
    this.version(1).stores({ pokemon: "id, speciesId, addedAt" });
  }
}

const db = new CollectionDb();

const listeners = new Set<() => void>();
function emit(): void {
  for (const fn of listeners) fn();
}

export async function addPokemon(
  entry: Omit<OwnedPokemon, "id" | "addedAt">,
): Promise<OwnedPokemon> {
  const row: OwnedPokemon = {
    ...entry,
    id: crypto.randomUUID(),
    addedAt: new Date().toISOString(),
  };
  await db.pokemon.put(row);
  emit();
  return row;
}

export async function removePokemon(id: string): Promise<void> {
  await db.pokemon.delete(id);
  emit();
}

/** Marca (ou desmarca) o veredito como cumprido. `null` volta a cobrar. */
export async function setDoneAction(id: string, action: string | null): Promise<void> {
  await db.pokemon.update(id, { doneAction: action });
  emit();
}

export async function listPokemon(): Promise<OwnedPokemon[]> {
  const all = await db.pokemon.toArray();
  return (
    all
      // Linhas gravadas antes do campo existir vem sem ele. Normalizar aqui
      // dispensa `?? null` espalhado por toda tela que le a colecao.
      .map((row) => ({ ...row, doneAction: row.doneAction ?? null }))
      // Mais recente primeiro: o que voce acabou de escanear e o que voce quer ver.
      .sort((a, b) => b.addedAt.localeCompare(a.addedAt))
  );
}

/** Lista reativa — recarrega sozinha quando algo e adicionado ou removido. */
export function useCollection(): { items: OwnedPokemon[] | null; reload: () => void } {
  const [items, setItems] = useState<OwnedPokemon[] | null>(null);

  const reload = () => {
    void listPokemon().then(setItems);
  };

  useEffect(() => {
    reload();
    listeners.add(reload);
    return () => {
      listeners.delete(reload);
    };
  }, []);

  return { items, reload };
}

/**
 * Backup em JSON.
 *
 * Nao e recurso de luxo: e a unica coisa que sobrevive a um despejo do
 * navegador. Fica acessivel sempre, nao escondido atras de "avancado".
 */
export async function exportJson(): Promise<string> {
  const items = await listPokemon();
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), items }, null, 2);
}

export async function importJson(text: string): Promise<number> {
  const parsed = JSON.parse(text) as { items?: unknown };
  if (!Array.isArray(parsed.items)) {
    throw new Error("Arquivo não parece um backup do TrainerKit.");
  }

  const rows = parsed.items as OwnedPokemon[];
  for (const row of rows) {
    if (!row.speciesId || !row.ivs) throw new Error("Backup com entrada inválida.");
  }

  await db.pokemon.bulkPut(rows);
  emit();
  return rows.length;
}
