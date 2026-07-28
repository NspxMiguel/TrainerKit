import { IconPlus } from "../ui/Icons.tsx";

export function CollectionScreen() {
  return (
    <>
      <h1 className="tk-h1">Coleção</h1>

      <div className="tk-empty">
        <div className="tk-empty-mark">
          <IconPlus size={26} />
        </div>
        <div className="tk-empty-title">Nenhum Pokémon salvo</div>
        <p className="tk-body">
          Quando você adicionar o primeiro, ele aparece aqui com o veredito:
          investir, evoluir, guardar ou transferir.
        </p>
      </div>

      <button type="button" className="tk-fab" aria-label="Adicionar Pokémon">
        <IconPlus size={26} />
      </button>
    </>
  );
}
