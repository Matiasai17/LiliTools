/**
 * Catálogo de tipos de artwork buscables en el sistema interno.
 *
 * - kind "list": páginas con estructura contmedio > grafA (producto) + grafB
 *   (versiones). Cubre Etiquetas, Manuales, Gráficas y Cajas — todas comparten
 *   el mismo HTML.
 * - kind "imagen": no tiene endpoint de listado propio; se arma buscando los
 *   productos en Search.php y entrando al detalle (Articulo.php) de cada uno
 *   para leer la sección "Imagen ALTA".
 *
 * OJO: el sistema es case-sensitive. El link del menú a Cajas ("Dg_cajas.php")
 * está roto; el archivo real es "Dg_Cajas.php".
 */
export const SOURCES = {
  etiquetas: { label: "Etiquetas", endpoint: "Etiquetas.php", kind: "list" },
  manuales: { label: "Manuales", endpoint: "Dm.php", kind: "list" },
  graficas: { label: "Gráficas", endpoint: "Dg.php", kind: "list" },
  cajas: { label: "Cajas", endpoint: "Dg_Cajas.php", kind: "list" },
  imagenes: { label: "Imágenes en alta", endpoint: "Search.php", kind: "imagen" },
};

export const DEFAULT_TIPO = "etiquetas";

export function getSource(tipo) {
  return SOURCES[tipo] || null;
}
