import { COLOR_LABELS, COLOR_LABELS_EN } from './config.js'
import { parseBool, formatVersion } from './utils.js'
import styles from './SpecPanel.module.css'

/*
 * Rótulo / panel de especificaciones (el "documento" para la imprenta).
 * Porta `buildDocumentInnerHTML` de Et.art/v7 (js/label.js).
 * Ancho fijo 170mm: en el preview se escala; en impresión va a tamaño real.
 */

const PLACEHOLDER = 'Please complete the table with the adjusted specifications.'

/** Filas de la tabla de specs. Exportada: la reusa spec-svg.js para el export PDF. */
export function getPrintRows(d, imported, impresionVal) {
  if (imported) {
    const rows = [
      { key: 'print', lbl: 'Print', val: impresionVal },
      { key: 'dim', lbl: 'Dimensions', val: `${d.ancho}×${d.alto} mm` },
      { key: 'mat', lbl: 'Material', placeholder: true, val: PLACEHOLDER },
      { key: 'fin', lbl: 'Finish', placeholder: true, val: PLACEHOLDER },
    ]
    if (d.supplierNote?.trim()) {
      rows.push({ key: 'sup', lbl: 'Supplier note', val: d.supplierNote.trim() })
    }
    return rows
  }
  return [
    { key: 'cod', lbl: 'Código de insumo', val: d.codigo },
    { key: 'imp', lbl: 'Impresión', val: impresionVal },
    { key: 'dim', lbl: 'Dimensiones', val: `${d.ancho}×${d.alto} mm` },
    { key: 'mat', lbl: 'Material de referencia', val: 'Papel ilustración (o autoadhesivo OPP)' },
    { key: 'aca', lbl: 'Acabado superficial', val: 'Barniz transparente (o laminado)' },
  ]
}

export default function SpecPanel({ data }) {
  const imported = parseBool(data.modoImportado)
  const vNum = formatVersion(data.version)
  const specTitle = imported ? 'Product label' : 'Etiqueta de producto'
  const specHeader = imported ? 'SPECIFICATIONS' : 'ESPECIFICACIONES'
  const subHeader = imported ? 'PRINTING DETAILS' : 'DETALLES DE IMPRENTA'
  const impresionVal = imported
    ? COLOR_LABELS_EN[data.colorImpresion] || data.impresion
    : COLOR_LABELS[data.colorImpresion] || data.impresion

  const rows = getPrintRows(data, imported, impresionVal)

  return (
    <div className={styles.panel}>
      <div className={styles.left}>
        <div>
          <div className={styles.productType}>{specTitle}</div>
          <div className={styles.productName}>
            Art. {data.articulo} — {data.descripcion}
          </div>
        </div>
      </div>
      <div className={styles.right}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th colSpan={2}>{specHeader}</th>
              <th className={styles.versionCell}>.v{vNum}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th colSpan={3} className={styles.subheader}>
                {subHeader}
              </th>
            </tr>
            {rows.map((r) => (
              <tr key={r.key}>
                <td className={styles.rowLabel}>{r.lbl}</td>
                <td colSpan={2} className={r.placeholder ? styles.placeholder : undefined}>
                  {r.val}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
