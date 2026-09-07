import * as Speech from "expo-speech";

/**
 * A VOZ — a do sistema, e só ela.
 *
 * O PWA oferece três motores: ElevenLabs (chave própria), Kokoro (modelo no
 * aparelho, 1,7 GB) e a voz do sistema. Aqui só a última atravessa, e não é
 * corte de escopo: no iOS a voz do sistema é o `AVSpeechSynthesizer`, que já
 * está no aparelho, fala os dez idiomas, **não pede chave, não pede conta e não
 * custa nada** — que é exatamente a regra do projeto.
 *
 * ⚠️ ELA NÃO BAIXA NADA E NÃO MANDA NADA. Por isso ligar a voz **não** muda a
 * tela de Privacidade: continua um host só recebendo pedido do app. Se um dia
 * entrar um motor de nuvem aqui, aquela tela muda junto — é a mesma regra das
 * imagens.
 */

/**
 * O idioma do app vira etiqueta de voz do iOS.
 *
 * ⚠️ `pt-BR` funciona; `pt` sozinho pega a voz de Portugal, que soa errado pra
 * quem é do Brasil. As etiquetas do dicionário já são BCP-47 completas, então o
 * caminho certo é repassar como está e deixar o sistema resolver.
 */
export function falar(texto: string, idioma: string): void {
  Speech.stop();
  Speech.speak(texto, {
    language: idioma,
    /* Um pouco abaixo do padrão: o texto é cheio de número e nome próprio, e a
       voz do sistema atropela os dois na velocidade normal. */
    rate: 0.95,
  });
}

/** Cala a boca. Chamado ao sair da tela — voz que continua sozinha assusta. */
export function calar(): void {
  Speech.stop();
}

/** `true` enquanto está falando, pra tela poder mostrar o botão de parar. */
export async function falando(): Promise<boolean> {
  return Speech.isSpeakingAsync();
}
