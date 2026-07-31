import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WheelPicker } from "./WheelPicker.tsx";

/**
 * A roda não pode escolher sozinha.
 *
 * ⚠️ Este arquivo existe por causa de um defeito que trocava o IDIOMA DO APP sem
 * ninguém pedir, e que passou despercebido por semanas porque só acontece com a
 * folha animando.
 *
 * Abrir Ajustes › Idioma bastava: enquanto a folha entra, o `scrollTop` do
 * trilho lê 44 — exatamente a altura de uma linha — em vez de 0. O `onScroll`
 * com debounce entendia isso como "o usuário parou a roda na linha 1" e trocava
 * para o SEGUNDO item da lista. Em inglês, abrir a tela e fechar sem tocar em
 * nada deixava o app em português.
 *
 * Foi achado por um varredor automático rodando o app nos dez idiomas: eu
 * pedia `en`, ele varria, e no fim o app estava em `pt-BR`. Passei um bom tempo
 * culpando o meu script.
 *
 * A regra que estes testes travam: **scroll do componente não é escolha; só
 * scroll de gente conta.**
 */

const OPCOES = [
  { value: "en", label: "English" },
  { value: "pt-BR", label: "Português" },
  { value: "es", label: "Español" },
];

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  /*
   * O jsdom não implementa `Element.scrollTo` — ele existe no navegador e não
   * aqui. Sem o esboço, o efeito de centralização estoura e o teste falha por
   * um motivo que não tem nada a ver com a regra que ele mede.
   */
  if (!Element.prototype.scrollTo) {
    Element.prototype.scrollTo = function scrollTo() {
      /* posicionar é efeito visual; o que se mede aqui é quem chama onChange */
    } as typeof Element.prototype.scrollTo;
  }
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/** O trilho da roda, que é quem recebe o scroll. */
function trilho(): HTMLElement {
  const el = container.querySelector<HTMLElement>(".tk-wheel-scroll");
  if (!el) throw new Error("trilho da roda não montou");
  return el;
}

function montar(onChange: (v: string) => void, value = "en") {
  act(() => {
    root.render(
      <WheelPicker options={OPCOES} value={value} onChange={onChange} ariaLabel="Idioma" />,
    );
  });
}

describe("roda de seleção", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("NÃO troca de valor quando o scroll vem do próprio componente", () => {
    /*
     * A reprodução exata do defeito: a folha animando deixa o trilho em 44 e
     * dispara `scroll` sem que ninguém tenha encostado nele.
     */
    const onChange = vi.fn();
    montar(onChange);

    const el = trilho();
    Object.defineProperty(el, "scrollTop", { value: 44, configurable: true });
    act(() => {
      el.dispatchEvent(new Event("scroll", { bubbles: true }));
      vi.advanceTimersByTime(300);
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("troca quando o scroll vem de um gesto", () => {
    // O outro lado da regra: depois de um toque, parar a roda numa linha
    // escolhe aquela linha — que é o comportamento do seletor do sistema, e o
    // motivo de a roda existir.
    const onChange = vi.fn();
    montar(onChange);

    const el = trilho();
    Object.defineProperty(el, "scrollTop", { value: 44, configurable: true });
    act(() => {
      el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      el.dispatchEvent(new Event("scroll", { bubbles: true }));
      vi.advanceTimersByTime(300);
    });

    expect(onChange).toHaveBeenCalledWith("pt-BR");
  });

  it("o clique direto continua escolhendo, sem depender de scroll", () => {
    // Quem está no mouse não rola a roda: clica no item. Esse caminho nunca
    // passou pelo `onScroll`, e não pode ter sido pego pelo guarda novo.
    const onChange = vi.fn();
    montar(onChange);

    const itens = container.querySelectorAll<HTMLButtonElement>(".tk-wheel-item");
    act(() => itens[2]?.click());

    expect(onChange).toHaveBeenCalledWith("es");
  });

  it("não repete o valor que já está escolhido", () => {
    // Um `onChange` redundante re-renderiza o app inteiro por nada — e no caso
    // do idioma, reescreve o `localStorage` a cada abertura de tela.
    const onChange = vi.fn();
    montar(onChange, "pt-BR");

    const el = trilho();
    Object.defineProperty(el, "scrollTop", { value: 44, configurable: true });
    act(() => {
      el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      el.dispatchEvent(new Event("scroll", { bubbles: true }));
      vi.advanceTimersByTime(300);
    });

    expect(onChange).not.toHaveBeenCalled();
  });
});
