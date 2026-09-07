import AsyncStorage from "expo-sqlite/kv-store";

/**
 * APAGAR TUDO.
 *
 * ⚠️ Não existe servidor. O que sumir daqui sumiu — não há cópia em lugar
 * nenhum, e é por isso que a tela avisa antes e pede dois toques.
 *
 * ⚠️ A lista de chaves é EXPLÍCITA e não um `clear()`.
 *
 * `clear()` levaria junto o que outras bibliotecas guardam no mesmo armazém
 * (o expo-router guarda estado de navegação ali), e o app voltaria num estado
 * que ninguém testou. Chave nova no app é uma linha nova aqui — o custo é
 * lembrar, e o preço de esquecer é dado órfão, não app quebrado.
 */
const CHAVES = [
  "tk:colecao",
  "tk:colecoes",
  "tk:colecao-ativa",
  "tk:vistos",
  "tk:setup",
  "tk:idioma",
  "tk:tema",
  "tk:ia",
  "tk:imagens",
] as const;

export async function apagarTudo(): Promise<void> {
  await Promise.all(
    CHAVES.map((c) =>
      AsyncStorage.removeItem(c).catch(() => {
        /* Chave que nunca existiu não é erro: o app roda sem nenhuma delas. */
      }),
    ),
  );
}
