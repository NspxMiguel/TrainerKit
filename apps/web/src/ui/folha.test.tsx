import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useFolha } from "./folha.ts";

/**
 * A saida da folha, medida no relogio.
 *
 * Nao dava pra conferir isto dirigindo o navegador: a aba em segundo plano
 * estrangula os timers pra 1s e PAUSA as animacoes, entao toda amostragem saia
 * com `currentTime: 0` e opacidade 1 — o que parece um bug e nao e. Aqui o
 * tempo e falso e o teste responde a unica pergunta que importa: a folha
 * continua no DOM durante a saida, e some depois.
 *
 * Montado com `createRoot` direto, sem biblioteca de teste de componente: o
 * `apps/web` nao tem nenhuma, e trazer uma dependencia nova pra exercitar um
 * hook de 40 linhas seria caro pelo que entrega. `act` sai do proprio React 19.
 */

function Folha({ onClose }: { onClose: () => void }) {
  const { saindo, fechar } = useFolha(onClose);
  return (
    <div id="folha" data-saindo={saindo || undefined}>
      <button type="button" id="voltar" onClick={fechar}>
        voltar
      </button>
    </div>
  );
}

let container: HTMLDivElement;
let root: Root;

function montar(onClose: () => void) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(<Folha onClose={onClose} />);
  });
}

function voltar() {
  act(() => {
    container.querySelector<HTMLButtonElement>("#voltar")!.click();
  });
}

const folha = () => container.querySelector("#folha");

describe("useFolha", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
  });

  it("segura a folha durante a saida e so entao fecha", () => {
    const onClose = vi.fn();
    montar(onClose);

    voltar();

    // O ponto todo: `onClose` ainda NAO foi chamado, e o no continua de pe com
    // a marca que dispara o `tk-sair` do CSS.
    expect(onClose).not.toHaveBeenCalled();
    expect(folha()?.getAttribute("data-saindo")).toBe("true");

    act(() => {
      vi.advanceTimersByTime(179);
    });
    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("dois toques no voltar fecham uma vez so", () => {
    // Sem a trava, o segundo toque reiniciaria a saida e `onClose` sairia duas
    // vezes — no app isso e fechar a folha e a de tras junto.
    const onClose = vi.fn();
    montar(onClose);

    voltar();
    voltar();
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("desmontar no meio da saida nao chama onClose depois", () => {
    // O pai pode fechar a folha por conta propria — trocar de aba, por exemplo.
    // Um timer sobrevivente chamaria `onClose` de uma tela que nao existe mais.
    const onClose = vi.fn();
    montar(onClose);

    voltar();
    act(() => {
      root.unmount();
    });
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("com movimento reduzido fecha na hora, sem esperar", () => {
    const original = window.matchMedia;
    window.matchMedia = ((q: string) => ({
      matches: q.includes("prefers-reduced-motion"),
      media: q,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;

    try {
      const onClose = vi.fn();
      montar(onClose);
      voltar();
      // Sem avancar o relogio: pra quem pediu menos movimento, esperar 180ms
      // nao e delicadeza, e lentidao.
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      window.matchMedia = original;
    }
  });
});
