import ActivityKit
import SwiftUI
import WidgetKit

/// O que a Live Activity mostra, e o que dela muda com o tempo.
///
/// `ContentState` é a parte que o app atualiza sem recriar a atividade — aqui
/// só o fim, porque o resto (nome e cabeçalho do evento) não muda enquanto o
/// evento acontece. Manter o estado pequeno é o que deixa a atualização barata.
struct EventoAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        /// Quando o evento acaba. O relógio da tela conta sozinho a partir daqui.
        var fim: Date
    }

    /// O nome do evento, já traduzido pelo lado JavaScript.
    var nome: String
    /// A linha de cima — "RAID BATTLES", "SEASON". Já em caixa alta.
    var cabecalho: String
    /// A cor de acento, em hexadecimal `#RRGGBB`, vinda do tipo da espécie do
    /// evento quando existe uma.
    var cor: String
}

/// `#RRGGBB` virando `Color`. Devolve branco no que não for hexadecimal válido:
/// uma cor errada não pode derrubar a tela de bloqueio.
private func cor(de texto: String) -> Color {
    var limpo = texto.trimmingCharacters(in: .whitespaces)
    if limpo.hasPrefix("#") { limpo.removeFirst() }
    guard limpo.count == 6, let n = UInt32(limpo, radix: 16) else { return .white }
    return Color(
        red: Double((n >> 16) & 0xFF) / 255,
        green: Double((n >> 8) & 0xFF) / 255,
        blue: Double(n & 0xFF) / 255
    )
}

struct AtividadeDoEvento: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: EventoAttributes.self) { contexto in
            // TELA DE BLOQUEIO. O fundo fica transparente de propósito: o
            // sistema desenha o material por trás, e pintar por cima dele tira
            // o Liquid Glass que o iOS já dá de graça aqui.
            VStack(alignment: .leading, spacing: 6) {
                Text(contexto.attributes.cabecalho)
                    .font(.caption2.weight(.bold))
                    .kerning(1.2)
                    .foregroundStyle(cor(de: contexto.attributes.cor))
                Text(contexto.attributes.nome)
                    .font(.headline)
                    .lineLimit(2)
                HStack(spacing: 4) {
                    Image(systemName: "clock")
                        .font(.caption2)
                    Text(contexto.state.fim, style: .timer)
                        .font(.caption.monospacedDigit())
                }
                .foregroundStyle(.secondary)
            }
            .padding(16)
            .activityBackgroundTint(nil)
        } dynamicIsland: { contexto in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Text(contexto.attributes.cabecalho)
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(cor(de: contexto.attributes.cor))
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(contexto.state.fim, style: .timer)
                        .font(.caption.monospacedDigit())
                        .multilineTextAlignment(.trailing)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(contexto.attributes.nome)
                        .font(.headline)
                        .lineLimit(2)
                }
            } compactLeading: {
                Circle()
                    .fill(cor(de: contexto.attributes.cor))
                    .frame(width: 8, height: 8)
            } compactTrailing: {
                Text(contexto.state.fim, style: .timer)
                    .font(.caption2.monospacedDigit())
                    // Sem largura fixa o timer empurra o resto da ilha a cada
                    // segundo em que um dígito muda de largura.
                    .frame(width: 44)
            } minimal: {
                Circle().fill(cor(de: contexto.attributes.cor)).frame(width: 8, height: 8)
            }
        }
    }
}

@main
struct AtividadeBundle: WidgetBundle {
    var body: some Widget {
        AtividadeDoEvento()
    }
}
