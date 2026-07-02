/**
 * parseEA.js — EA XMI/JSON parser (client-side)
 *
 * Handles Enterprise Architect exports in both:
 *   - Standard JSON with _xmi:type / _name keys
 *   - Text exports (EA saves valid JSON even with .txt extension)
 *
 * Returns: { packages, blocks, connectors, ports, idMap, raw }
 */
export function parseEAJson(raw) {
  let data
  try {
    data = JSON.parse(raw)
  } catch (e) {
    throw new Error('El archivo no es JSON válido: ' + e.message)
  }

  const packages = []
  const blocks = []
  const connectors = []
  const ports = []
  const idMap = {}

  function walkElement(el, parentId = null) {
    if (!el || typeof el !== 'object') return

    const type = el['_xmi:type'] || el['xmi:type'] || ''
    const id   = el['_xmi:id']   || el['xmi:id']   || ''
    const name = el['_name']     || el['name']      || ''

    if (id) idMap[id] = { type, name, id, parentId }

    if (type === 'uml:Package' || type === 'uml:Model') {
      packages.push({ id, name, parentId })
    } else if (type === 'uml:Class' || type === 'uml:Component') {
      blocks.push({ id, name, parentId })
    } else if (type === 'uml:Port') {
      ports.push({ id, name, parentId })
    } else if (
      type === 'uml:Connector' ||
      type === 'uml:Association' ||
      type === 'uml:Dependency' ||
      type === 'uml:InformationFlow' ||
      type === 'uml:Realization'
    ) {
      const src = el['_supplier'] || el['supplier'] ||
        (Array.isArray(el.end) ? el.end[0]?.['_role'] || el.end[0]?.role || '' : '')
      const tgt = el['_client'] || el['client'] ||
        (Array.isArray(el.end) ? el.end[1]?.['_role'] || el.end[1]?.role || '' : '')
      connectors.push({ id, name, parentId, source: src, target: tgt, kind: type })
    }

    const childKeys = [
      'packagedElement', 'nestedClassifier', 'ownedAttribute',
      'ownedConnector', 'ownedOperation', 'ownedBehavior',
      'clientDependency', 'interfaceRealization',
      'packageImport', 'elementImport',
    ]
    for (const key of childKeys) {
      const child = el[key]
      if (!child) continue
      const childId = id || parentId
      if (Array.isArray(child)) child.forEach(c => walkElement(c, childId))
      else if (typeof child === 'object') walkElement(child, childId)
    }

    if (el.qualifier) {
      const q = el.qualifier
      const childId = id || parentId
      if (Array.isArray(q)) q.forEach(c => walkElement(c, childId))
      else walkElement(q, childId)
    }
  }

  const root =
    data?.XMI?.Model ||
    data?.['xmi:XMI']?.['uml:Model'] ||
    data?.Model ||
    data

  if (root) walkElement(root)

  return { packages, blocks, connectors, ports, idMap, raw: data }
}
