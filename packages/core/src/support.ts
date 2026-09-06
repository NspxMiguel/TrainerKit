/**
 * PARA ONDE VAI UMA DOAÇÃO.
 *
 * Uma constante só, compartilhada pelos dois apps, pra o endereço nunca divergir
 * entre eles — uma tela de doação com endereço velho é pior que nenhuma, porque
 * falha calada do lado de quem paga.
 *
 * ── POR QUE BITCOIN E NÃO PIX ───────────────────────────────────────────────
 *
 * O Pix esteve aqui e saiu. O motivo não é técnico: **o Pix mostra o nome civil
 * completo do dono da chave** na tela de confirmação do banco de quem paga, e
 * isso não tem como desligar — é do arranjo, não do app.
 *
 * Num app derivado de propriedade de terceiro (o `LICENSE` deste repositório
 * diz, com todas as letras, que o dado do jogo não é nosso), isso junta as duas
 * coisas que convém manter separadas: um pedido de dinheiro e um nome próprio
 * identificável. Um endereço Bitcoin não carrega nome nenhum.
 *
 * ⚠️ Isto NÃO é anonimato: a rede é pública e todo pagamento fica registrado
 * pra sempre. O que muda é que o endereço não vem com um nome colado nele.
 *
 * **Pix volta no dia em que houver chave de CNPJ** — aí quem paga vê a razão
 * social, não uma pessoa, e é exatamente o critério do `CLAUDE.md`: empresa
 * onde há risco, pseudônimo no resto.
 */

/**
 * Endereço Bitcoin (bech32, SegWit v0, mainnet).
 *
 * ⚠️ CONFERIDO PELO CHECKSUM, e não copiado no olho. Ele foi lido de um print
 * da carteira, e endereço lido errado é dinheiro que some — então o bech32 foi
 * validado (BIP-173) antes de entrar aqui: 42 caracteres, HRP `bc`, versão 0,
 * `polymod` fechando em 1. A chance de uma leitura errada produzir checksum
 * válido é de cerca de 1 em 1 bilhão.
 *
 * Quem mexer nele: valide de novo. Carteira nenhuma aceita endereço com
 * checksum quebrado, então o erro aparece como "endereço inválido" na mão de
 * quem quis doar — e essa pessoa não volta pra avisar.
 */
export const BITCOIN_ADDRESS = "bc1qm64el0gp0kvk7zqhl89x0vkngu2skqxd26vpjg";
