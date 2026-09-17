import * as cheerio from "cheerio";

const FILES_BASE = "https://gestion.liliana.com.ar/administracion/";

function resolveUrl(relative) {
  if (!relative) return null;
  return new URL(relative, FILES_BASE).href;
}

function parseFecha(str) {
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec((str || "").trim());
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
}

function versionNumero(v) {
  const m = /v(\d+)/i.exec(v || "");
  return m ? parseInt(m[1], 10) : -1;
}

function fileType(url) {
  const m = /\.([a-z0-9]+)(?:\?|$)/i.exec(url || "");
  return m ? m[1].toLowerCase() : null;
}

const IMAGE_EXT = new Set(["jpg", "jpeg", "png", "gif", "webp"]);

function esImagen(url) {
  return IMAGE_EXT.has(fileType(url) || "");
}

/**
 * Ordena todas las versiones de todos los grupos y elige la "última"
 * (mayor fecha; desempate por mayor número de versión). Para las de tipo
 * lista, si la última no trae PDF pero hay un asset hermano (misma versión y
 * fecha) que sí, se lo adjunta para que la tarjeta ofrezca ver imagen + PDF.
 */
function resolverUltima(grupos) {
  const todas = grupos.flatMap((g) => g.versiones.map((v) => ({ ...v, grupo: g })));
  todas.sort((a, b) => {
    const fa = a.fechaOrden ? a.fechaOrden.getTime() : -Infinity;
    const fb = b.fechaOrden ? b.fechaOrden.getTime() : -Infinity;
    if (fb !== fa) return fb - fa;
    return versionNumero(b.version) - versionNumero(a.version);
  });
  const ultima = todas[0] || null;
  if (ultima && !ultima.pdfUrl) {
    const pdfHermano = ultima.grupo.versiones.find(
      (v) => v !== ultima && v.version === ultima.version && v.fecha === ultima.fecha && fileType(v.url) === "pdf"
    );
    if (pdfHermano) ultima.pdfUrl = pdfHermano.url;
  }
  return ultima;
}

/**
 * Parser genérico para las páginas de listado (Etiquetas, Manuales, Gráficas,
 * Cajas). Estructura: div.contmedio que contiene un div.grafA (datos del
 * producto) seguido de varios div.grafB (cada uno un asset/versión). Entre
 * medio puede haber div.grafD que son títulos de sub-sección
 * ("Descargar ARCHIVOS para Imprenta", "Manual WEB", etc.).
 */
export function parseListPage(html) {
  const $ = cheerio.load(html);
  const grupos = [];

  $("div.contmedio").each((_, contmedio) => {
    const $c = $(contmedio);
    const $grafA = $c.find("div.grafA").first();
    if ($grafA.length === 0) return; // encabezado, no es grupo de producto

    const $prod = $grafA.find("li.pprodudpzz");
    const link = $prod.find("a");
    const idMatch = /ID=(\d+)/.exec(link.attr("href") || "");
    const codigo = link.text().replace(/^\./, "").trim();
    const descripcion = $prod.find("span.textoFam").text().trim();

    const $estadoClone = $prod.clone();
    $estadoClone.find("a, span, img, br").remove();
    const estado = $estadoClone.text().trim();

    const fotoUrl = resolveUrl($grafA.find("li.pprodudpzzx img").attr("src"));

    const versiones = [];
    let seccion = null;
    $c.children("div").each((__, child) => {
      const $child = $(child);
      if ($child.hasClass("grafD")) {
        seccion = $child.text().trim() || null;
        return;
      }
      if (!$child.hasClass("grafB")) return;

      const version = $child.find("li.pestadodp").first().text().trim();
      const fecha = $child.find("li.pfecha").first().text().trim();
      const comentario = $child
        .find("li.gcomentario")
        .map((___, li) => $(li).text().trim())
        .get()
        .filter((t) => t && t.toLowerCase() !== "datos tecnicos")
        .join(" ");
      const previewSrc = $child.find("li.pgvisualizar img").attr("src");
      const url = resolveUrl($child.find("li.pgvisualizar a").attr("href"));
      if (!url) return;

      versiones.push({
        version,
        fecha,
        fechaOrden: parseFecha(fecha),
        comentario: comentario || null,
        seccion,
        url,
        previewUrl: previewSrc ? resolveUrl(previewSrc) : esImagen(url) ? url : null,
        fileType: fileType(url),
        pdfUrl: fileType(url) === "pdf" ? url : null,
      });
    });

    grupos.push({ id: idMatch ? idMatch[1] : null, codigo, descripcion, estado, fotoUrl, versiones });
  });

  return { grupos, ultima: resolverUltima(grupos) };
}

/**
 * Parsea el resultado de Search.php para obtener la lista de productos
 * (grupos) que matchean el código, con su ID de detalle (Articulo.php).
 */
export function parseSearchGroups(html) {
  const $ = cheerio.load(html);
  const grupos = [];

  $("div.contmedio ul.pnac").each((_, ul) => {
    const $ul = $(ul);
    const $prod = $ul.find("li.pprodudpzz");
    if ($prod.length === 0) return;

    const artLink = $ul.find("li.pvisualdp a").attr("href") || $prod.find("a").attr("href") || "";
    const idMatch = /ID=(\d+)/.exec(artLink);
    if (!idMatch) return;

    // En Search.php el código y el estado son nodos de texto sueltos dentro
    // del <li> (no van en <a>), separados por los <br>/<img> intermedios.
    const textNodes = $prod
      .contents()
      .filter((_, n) => n.type === "text")
      .map((_, n) => $(n).text().trim())
      .get()
      .filter(Boolean);
    const codigo = (textNodes[0] || "").replace(/^\./, "").trim();
    const estado = textNodes.length > 1 ? textNodes[textNodes.length - 1] : "";
    const descripcion = $prod.find("span.textoFam").text().trim();
    const fotoUrl = resolveUrl($ul.find("li.pprodudpzzx img").attr("src"));
    const fecha = $ul.find("li.pfecha").first().text().trim();

    grupos.push({ id: idMatch[1], codigo, descripcion, estado, fotoUrl, fecha });
  });

  return grupos;
}

/**
 * Extrae la sección "Imagen ALTA" del detalle de un producto (Articulo.php).
 * Devuelve las imágenes de alta resolución (folletería/catálogo, control
 * remoto, etc.) con su fecha y comentario.
 */
export function parseImagenAlta(html) {
  const $ = cheerio.load(html);
  const imagenes = [];
  let seccionActual = null;

  $("ul.pnacarDes, ul.pnacar1").each((_, ul) => {
    const $ul = $(ul);
    if ($ul.hasClass("pnacarDes")) {
      seccionActual = $ul.find("li.artipo").first().text().trim().toLowerCase();
      return;
    }
    if (seccionActual !== "imagen alta") return;

    const url = resolveUrl($ul.find("li.arvisualt a").attr("href"));
    if (!url) return;
    const fecha = $ul.find("li.arfechat").first().text().trim();
    const version = $ul.find("li.arversion").first().text().trim();
    const comentario = $ul.find("li.arcoment").first().text().trim();

    imagenes.push({
      version,
      fecha,
      fechaOrden: parseFecha(fecha),
      comentario: comentario || null,
      url,
      previewUrl: url,
      fileType: fileType(url),
      pdfUrl: null,
    });
  });

  return imagenes;
}
