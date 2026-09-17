import { buscarEnEndpoint, traerArticulo } from "./lilianaClient.js";
import { parseListPage, parseSearchGroups, parseImagenAlta } from "./parsers.js";
import { getSource } from "./sources.js";

function versionNumero(v) {
  const m = /v(\d+)/i.exec(v || "");
  return m ? parseInt(m[1], 10) : -1;
}

function elegirUltima(grupos) {
  const todas = grupos.flatMap((g) => g.versiones.map((v) => ({ ...v, grupo: g })));
  todas.sort((a, b) => {
    const fa = a.fechaOrden ? a.fechaOrden.getTime() : -Infinity;
    const fb = b.fechaOrden ? b.fechaOrden.getTime() : -Infinity;
    if (fb !== fa) return fb - fa;
    return versionNumero(b.version) - versionNumero(a.version);
  });
  return todas[0] || null;
}

/**
 * Busca un código de artículo para un tipo de artwork y devuelve los grupos de
 * producto con sus versiones, más la versión resuelta como "última".
 */
export async function buscar(tipo, codigo, phpSessId) {
  const source = getSource(tipo);
  if (!source) throw new Error(`Tipo de artwork desconocido: ${tipo}`);

  if (source.kind === "list") {
    const html = await buscarEnEndpoint(source.endpoint, codigo, phpSessId);
    return parseListPage(html);
  }

  // kind "imagen": Search.php da los grupos; el detalle da la sección Imagen ALTA.
  const searchHtml = await buscarEnEndpoint(source.endpoint, codigo, phpSessId);
  const baseGrupos = parseSearchGroups(searchHtml);

  const grupos = await Promise.all(
    baseGrupos.map(async (g) => {
      let versiones = [];
      try {
        const detalle = await traerArticulo(g.id, phpSessId);
        versiones = parseImagenAlta(detalle);
      } catch {
        versiones = [];
      }
      return { ...g, versiones };
    })
  );

  const conImagenes = grupos.filter((g) => g.versiones.length > 0);
  return { grupos: conImagenes, ultima: elegirUltima(conImagenes) };
}
