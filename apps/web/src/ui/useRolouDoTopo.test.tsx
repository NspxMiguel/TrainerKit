import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useFolha } from "./folha.ts";
import { useRolouDoTopo } from "./useRolouDoTopo.ts";

/**
 * Quando o vidro da borda de cima acende.
 *
 * Nao dava pra conferir isto dirigindo o navegador, e a razao e a mesma do
 * `folha.test.tsx`: a aba em segundo plano nao roda quadro nenhum. Medido, uma
 * `window.scrollTo` levou o `scrollY` de 700 pra 900 e o contador de eventos
 * ficou em ZERO — sem quadro nao ha evento de `scroll` nem
 * `requestAnimationFrame`. O hook parecia quebrado e estava parado.
 *
 * O que se ganha aqui, e nao numa foto do simulador: a foto responde por UMA
 * tela. O filtro deste hook tem quatro saidas — janela, folha, coisa que rola de
 * lado, pedaco no meio da tela — e as tres ultimas so aparecem em telas
 * especificas do app. Um caso de teste cada custa cinco linhas.
 *
 * Montado com `createRoot` direto, sem biblioteca de teste de componente, pelo
 * mesmo motivo do `folha.test.tsx`: o `apps/web` nao tem nenhuma.
 */

function Sonda() {
  return <i id="sonda" data-rolou={useRolouDoTopo() || undefined} />;
}

/** Uma folha qualquer, so pra empilhar: `useFolha` e quem alimenta `useTemFolha`. */
function FolhaQualquer() {
  useFolha(() => {});
  return null;
}

let container: HTMLDivElement;
let root: Root;
let folhaNo: HTMLDivElement | null = null;
let folhaRoot: Root | null = null;
const soltos: HTMLElement[] = [];

function montar() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(<Sonda />);
  });
}

const aceso = () => container.querySelector("#sonda")?.getAttribute("data-rolou") === "true";

function abrirFolha() {
  folhaNo = document.createElement("div");
  document.body.appendChild(folhaNo);
  folhaRoot = createRoot(folhaNo);
  act(() => {
    folhaRoot!.render(<FolhaQualquer />);
  });
}

/**
 * jsdom nao tem layout: sem isto todo elemento diz que rola 0 dentro de uma
 * caixa de altura 0, e os tres testes de elemento passariam por acidente.
 */
function rolador(medidas: { topo?: number; rolagem?: number; altura?: number; conteudo?: number }) {
  const { topo = 0, rolagem = 0, altura = 400, conteudo = 2000 } = medidas;
  const el = document.createElement("div");
  document.body.appendChild(el);
  soltos.push(el);
  el.getBoundingClientRect = () => ({ top: topo }) as DOMRect;
  Object.defineProperty(el, "scrollTop", { value: rolagem, configurable: true });
  Object.defineProperty(el, "clientHeight", { value: altura, configurable: true });
  Object.defineProperty(el, "scrollHeight", { value: conteudo, configurable: true });
  return el;
}

function rolarJanela(ate: number) {
  Object.defineProperty(window, "scrollY", { value: ate, configurable: true });
  act(() => {
    document.dispatchEvent(new Event("scroll"));
    // O hook mede dentro de um quadro; sem avancar o relogio nada foi lido.
    vi.advanceTimersByTime(20);
  });
}

function rolarElemento(el: HTMLElement) {
  act(() => {
    el.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(20);
  });
}

describe("useRolouDoTopo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
      folhaRoot?.unmount();
    });
    folhaRoot = null;
    folhaNo?.remove();
    folhaNo = null;
    container.remove();
    for (const el of soltos.splice(0)) el.remove();
    vi.useRealTimers();
  });

  it("acende quando a janela sai do topo e apaga quando volta", () => {
    montar();
    expect(aceso()).toBe(false);

    rolarJanela(200);
    expect(aceso()).toBe(true);

    rolarJanela(0);
    expect(aceso()).toBe(false);
  });

  it("nao acende com o tremor do dedo parado", () => {
    // O limiar existe pro toque que nao rolou nada: sem ele o vidro pisca.
    montar();
    rolarJanela(4);
    expect(aceso()).toBe(false);
  });

  it("com folha aberta a janela nao manda mais", () => {
    /*
     * O caso que estraga a tela: a folha nasce no topo, mas a janela continua
     * rolada la atras. Lendo a janela, o vidro acenderia em cima do hero de uma
     * ficha recem-aberta — exatamente onde ele nao pode aparecer.
     */
    montar();
    rolarJanela(200);
    expect(aceso()).toBe(true);

    abrirFolha();
    expect(aceso()).toBe(false);

    rolarJanela(400);
    expect(aceso()).toBe(false);
  });

  it("acende quando quem rola e a folha, nao a janela", () => {
    // `scroll` nao borbulha: se o ouvinte nao fosse de captura, isto nao chegaria.
    montar();
    abrirFolha();

    rolarElemento(rolador({ rolagem: 200 }));
    expect(aceso()).toBe(true);
  });

  it("ignora quem so rola de lado", () => {
    /*
     * A fila de tipos do Monta um Time. O `scrollTop` dela e 0 pra sempre, entao
     * arrastar ela de lado APAGARIA o vidro de quem esta rolado por baixo.
     */
    montar();
    rolarJanela(200);

    rolarElemento(rolador({ rolagem: 0, altura: 44, conteudo: 44 }));
    expect(aceso()).toBe(true);
  });

  it("ignora um pedaco que rola no meio da tela", () => {
    // Nao encosta na borda de cima: nao e ele que passa por tras do relogio.
    montar();

    rolarElemento(rolador({ topo: 120, rolagem: 200 }));
    expect(aceso()).toBe(false);
  });
});
