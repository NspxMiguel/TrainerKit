import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A camera ao vivo da Pokedex.
 *
 * O Miguel: "nao funcionando modo live da pokedex. so tem opcao de usar foto".
 * Ele estava certo e a razao e simples: `<input type="file" capture>` NAO e camera
 * ao vivo. Ele abre o app de camera do sistema, tira uma foto, fecha e devolve o
 * arquivo. Funciona, mas nao e apontar — e fotografar.
 *
 * Ao vivo exige `getUserMedia`: o video roda dentro da pagina, e o app decide
 * quando congelar um quadro e mandar analisar. E o que faz parecer com o aparelho
 * da serie, onde a tela mostra o que a lente ve ANTES de dizer o nome.
 *
 * Duas coisas que so aparecem no aparelho de verdade:
 *
 *   `playsInline` e OBRIGATORIO no iPhone. Sem ele o Safari joga o video em tela
 *   cheia nativa e engole a interface inteira — o "modo live" viraria o player do
 *   sistema.
 *
 *   A trilha TEM que ser parada na saida. Uma `MediaStreamTrack` viva mantem a
 *   luzinha da camera acesa mesmo com a tela fechada, e isso e a coisa mais
 *   assustadora que um app pode fazer sem querer.
 */

export type CameraState = "off" | "starting" | "on" | "denied" | "unsupported";

export interface Camera {
  state: CameraState;
  /** Ligar no `<video>`. */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  start: () => void;
  stop: () => void;
  /** Congela o quadro atual num JPEG. `null` se o video ainda nao tem imagem. */
  grab: () => Promise<File | null>;
  error: string | null;
}

export function supportsCamera(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function"
  );
}

export function useCamera(): Camera {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CameraState>(() =>
    supportsCamera() ? "off" : "unsupported",
  );
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    // Para cada trilha, nao so o `srcObject`: limpar o elemento sem parar as
    // trilhas deixa a camera ligada com a luz acesa.
    for (const t of streamRef.current?.getTracks() ?? []) t.stop();
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setState((s) => (s === "unsupported" ? s : "off"));
  }, []);

  const start = useCallback(() => {
    if (!supportsCamera()) {
      setState("unsupported");
      return;
    }
    setState("starting");
    setError(null);

    navigator.mediaDevices
      .getUserMedia({
        // `environment` e a de tras — a de frente serviria pra selfie, nao pra
        // apontar pra um Pokemon na tela do jogo ou numa carta.
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      })
      .then((stream) => {
        streamRef.current = stream;
        const el = videoRef.current;
        if (el) {
          el.srcObject = stream;
          void el.play().catch(() => undefined);
        }
        setState("on");
      })
      .catch((e: unknown) => {
        // `NotAllowedError` e recusa da pessoa, nao defeito: merece texto
        // diferente de "deu erro".
        const nome = e instanceof DOMException ? e.name : "";
        setState(nome === "NotAllowedError" || nome === "SecurityError" ? "denied" : "off");
        setError(e instanceof Error ? e.message : String(e));
      });
  }, []);

  /** Para a camera quando a tela sai do ar, em qualquer caminho. */
  useEffect(() => stop, [stop]);

  const grab = useCallback(async (): Promise<File | null> => {
    const el = videoRef.current;
    if (!el || el.videoWidth === 0) return null;

    /*
     * Reduz pra 640px no maior lado antes de mandar.
     *
     * Nao e economia de rede, e de LIMITE: a Groq da 8.000 tokens por minuto no
     * plano gratuito e uma imagem grande custa uns 2.500. Em 640px o custo cai
     * bastante e o modelo continua reconhecendo — sprite e desenho, nao radiografia.
     */
    const maior = Math.max(el.videoWidth, el.videoHeight);
    const escala = Math.min(1, 640 / maior);
    const w = Math.round(el.videoWidth * escala);
    const h = Math.round(el.videoHeight * escala);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(el, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((r) =>
      canvas.toBlob((b) => r(b), "image/jpeg", 0.82),
    );
    if (!blob) return null;
    return new File([blob], "camera.jpg", { type: "image/jpeg" });
  }, []);

  return { state, videoRef, start, stop, grab, error };
}
