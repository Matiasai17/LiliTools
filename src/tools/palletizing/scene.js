import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

import { gridFor } from './grid.js'
import { PALLET } from './products.js'

/*
 * Escena 3D del pallet (three.js).
 *
 * Adaptado de la demo, con dos cambios deliberados:
 * - OrbitControls en lugar del orbit manual (inercia, límites y touch resueltos).
 * - Todo recurso (geometrías, materiales, texturas, renderer) se libera en
 *   dispose(): al navegar el hub el componente se desmonta, y sin esto se
 *   filtran contextos WebGL hasta que el navegador empieza a descartarlos.
 *
 * El renderer va con alpha: true para que el canvas tome el fondo del hub y
 * funcione igual en tema claro y oscuro.
 */

const BOX_KRAFT = '#c79a63'
const BOX_BAND = '#e42320' // rojo de marca (mismo que --color-accent en claro)
const DECK_HEIGHT = 0.11
const GAP = 0.012

/** Textura de caja dibujada en canvas: kraft con grano, banda y etiqueta. */
function createBoxTexture(withLabel) {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = BOX_KRAFT
  ctx.fillRect(0, 0, 128, 128)

  // Grano sutil del cartón.
  for (let i = 0; i < 600; i++) {
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`
    ctx.fillRect(Math.random() * 128, Math.random() * 128, 1, 1)
  }

  if (withLabel) {
    ctx.fillStyle = BOX_BAND
    ctx.fillRect(0, 74, 128, 10)
    ctx.fillStyle = '#f4ede0'
    ctx.fillRect(18, 28, 92, 34)
    ctx.strokeStyle = 'rgba(0,0,0,.08)'
    ctx.lineWidth = 1
    ctx.strokeRect(18, 28, 92, 34)
  }

  ctx.strokeStyle = 'rgba(60,40,15,.35)'
  ctx.lineWidth = 4
  ctx.strokeRect(0, 0, 128, 128)

  return new THREE.CanvasTexture(canvas)
}

/**
 * Crea la escena y devuelve una API chica para manejarla desde React.
 * @param {HTMLElement} container Elemento que hospeda el canvas.
 * @param {{reducedMotion?: boolean}} options
 */
export function createPalletScene(container, { reducedMotion = false } = {}) {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  container.appendChild(renderer.domElement)

  // ----- Luces -----
  const hemi = new THREE.HemisphereLight(0xffffff, 0xd8d5cf, 0.85)
  scene.add(hemi)
  const key = new THREE.DirectionalLight(0xffffff, 0.9)
  key.position.set(3, 6, 4)
  key.castShadow = true
  key.shadow.mapSize.set(1024, 1024)
  key.shadow.camera.left = -3
  key.shadow.camera.right = 3
  key.shadow.camera.top = 3
  key.shadow.camera.bottom = -3
  scene.add(key)
  const fill = new THREE.DirectionalLight(0xffffff, 0.25)
  fill.position.set(-4, 2, 0)
  scene.add(fill)

  // ----- Piso que solo recibe sombra (invisible en cualquier tema) -----
  const floorGeo = new THREE.CircleGeometry(6, 48)
  const floorMat = new THREE.ShadowMaterial({ opacity: 0.16 })
  const floor = new THREE.Mesh(floorGeo, floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)

  // ----- Materiales compartidos por todas las cajas -----
  const texSide = createBoxTexture(true)
  const texTop = createBoxTexture(false)
  const matSide = new THREE.MeshStandardMaterial({ map: texSide, roughness: 0.95 })
  const matTop = new THREE.MeshStandardMaterial({ map: texTop, roughness: 0.95 })
  // Orden de caras de BoxGeometry: +x, -x, +y, -y, +z, -z
  const matsNormal = [matSide, matSide, matTop, matTop, matSide, matSide]

  // Variante resaltada: mismo mapa con emisivo de acento, para poder contar pisos.
  const matSideHi = new THREE.MeshStandardMaterial({
    map: texSide,
    roughness: 0.95,
    emissive: new THREE.Color(BOX_BAND),
    emissiveIntensity: 0.35,
  })
  const matTopHi = new THREE.MeshStandardMaterial({
    map: texTop,
    roughness: 0.95,
    emissive: new THREE.Color(BOX_BAND),
    emissiveIntensity: 0.35,
  })
  const matsHighlight = [matSideHi, matSideHi, matTopHi, matTopHi, matSideHi, matSideHi]

  // Variante apagada, para atenuar lo que no se está mirando.
  const matDim = new THREE.MeshStandardMaterial({
    map: texSide,
    roughness: 0.95,
    transparent: true,
    opacity: 0.22,
  })
  const matsDim = [matDim, matDim, matDim, matDim, matDim, matDim]

  const woodTop = new THREE.MeshStandardMaterial({ color: 0xb98a52, roughness: 0.9 })
  const woodBot = new THREE.MeshStandardMaterial({ color: 0x9c703f, roughness: 0.9 })

  // ----- Controles -----
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.enablePan = false
  controls.minDistance = 1.4
  controls.maxDistance = 9
  controls.maxPolarAngle = Math.PI / 2 - 0.02
  controls.minPolarAngle = 0.15
  // Sin autorrotación si el usuario pidió menos movimiento.
  controls.autoRotate = !reducedMotion
  controls.autoRotateSpeed = 0.9

  // Al interactuar, se corta la autorrotación (igual que en la demo).
  const stopAutoRotate = () => {
    controls.autoRotate = false
  }
  controls.addEventListener('start', stopAutoRotate)

  // Recursos que se recrean por producto y hay que liberar en cada rebuild.
  let stack = new THREE.Group()
  scene.add(stack)
  let boxGeometry = null
  let deckGeometry = null
  let footGeometry = null
  /** Cajas agrupadas por piso, para poder resaltar. */
  let boxesByLayer = []

  // Las geometrías se comparten entre todas las cajas de un mismo producto, así
  // que alcanza con liberar las tres referencias (no una por mesh).
  function disposeStack() {
    scene.remove(stack)
    boxGeometry?.dispose()
    deckGeometry?.dispose()
    footGeometry?.dispose()
    boxGeometry = deckGeometry = footGeometry = null
    boxesByLayer = []
    stack = new THREE.Group()
  }

  /** Reconstruye el pallet para un estándar dado. */
  function setProduct(product) {
    disposeStack()

    const { rows, cols } = gridFor(product.boxesPerLayer)
    const PL = PALLET.length
    const PW = PALLET.width

    // ----- Pallet de madera -----
    deckGeometry = new THREE.BoxGeometry(PL, 0.03, PW)
    const deck = new THREE.Mesh(deckGeometry, woodTop)
    deck.position.y = DECK_HEIGHT
    deck.castShadow = deck.receiveShadow = true
    stack.add(deck)

    footGeometry = new THREE.BoxGeometry(PL, DECK_HEIGHT - 0.03, 0.14)
    for (let i = 0; i < 3; i++) {
      const foot = new THREE.Mesh(footGeometry, woodBot)
      foot.position.set(0, (DECK_HEIGHT - 0.03) / 2, -PW / 2 + 0.07 + i * ((PW - 0.14) / 2))
      foot.castShadow = foot.receiveShadow = true
      stack.add(foot)
    }

    // ----- Cajas -----
    const cellWidth = (PL - GAP * (cols + 1)) / cols
    const cellDepth = (PW - GAP * (rows + 1)) / rows
    const boxHeight = Math.min(0.42, 1.28 / product.layers)
    boxGeometry = new THREE.BoxGeometry(cellWidth, boxHeight, cellDepth)

    const startY = DECK_HEIGHT + 0.015
    for (let layer = 0; layer < product.layers; layer++) {
      const inLayer = []
      let placed = 0
      for (let r = 0; r < rows && placed < product.boxesPerLayer; r++) {
        for (let c = 0; c < cols && placed < product.boxesPerLayer; c++) {
          const mesh = new THREE.Mesh(boxGeometry, matsNormal)
          mesh.castShadow = mesh.receiveShadow = true
          mesh.position.set(
            -PL / 2 + GAP + cellWidth / 2 + c * (cellWidth + GAP),
            startY + boxHeight / 2 + layer * boxHeight,
            -PW / 2 + GAP + cellDepth / 2 + r * (cellDepth + GAP),
          )
          stack.add(mesh)
          inLayer.push(mesh)
          placed++
        }
      }
      boxesByLayer.push(inLayer)
    }

    scene.add(stack)

    // ----- Encuadre -----
    const stackHeight = DECK_HEIGHT + boxHeight * product.layers
    controls.target.set(0, stackHeight * 0.46, 0)
    const radius = Math.max(PL, PW, stackHeight) * 2.15 + 0.6
    const theta = Math.PI * 0.62
    const phi = Math.PI * 0.36
    camera.position.set(
      controls.target.x + radius * Math.sin(phi) * Math.cos(theta),
      controls.target.y + radius * Math.cos(phi),
      controls.target.z + radius * Math.sin(phi) * Math.sin(theta),
    )
    controls.autoRotate = !reducedMotion
    controls.update()
  }

  /**
   * Modo de resaltado.
   * - null        → todas las cajas normales.
   * - 'layers'    → pisos alternados en acento, para poder contarlos.
   * - 'topLayer'  → solo el piso de arriba, el resto atenuado.
   */
  function setHighlight(mode) {
    boxesByLayer.forEach((layerBoxes, index) => {
      let mats = matsNormal
      if (mode === 'layers') {
        mats = index % 2 === 1 ? matsHighlight : matsNormal
      } else if (mode === 'topLayer') {
        mats = index === boxesByLayer.length - 1 ? matsHighlight : matsDim
      }
      layerBoxes.forEach((mesh) => {
        mesh.material = mats
      })
    })
  }

  function resize() {
    const w = container.clientWidth
    const h = container.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }

  let frameId = null
  function loop() {
    frameId = requestAnimationFrame(loop)
    controls.update()
    renderer.render(scene, camera)
  }

  const observer = new ResizeObserver(resize)
  observer.observe(container)

  resize()
  loop()

  /** Libera TODO. Sin esto se filtra el contexto WebGL al salir de la vista. */
  function dispose() {
    if (frameId !== null) cancelAnimationFrame(frameId)
    observer.disconnect()
    controls.removeEventListener('start', stopAutoRotate)
    controls.dispose()

    disposeStack()
    floorGeo.dispose()
    floorMat.dispose()
    texSide.dispose()
    texTop.dispose()
    ;[
      matSide,
      matTop,
      matSideHi,
      matTopHi,
      matDim,
      woodTop,
      woodBot,
    ].forEach((m) => m.dispose())

    renderer.dispose()
    renderer.domElement.remove()
  }

  return { setProduct, setHighlight, resize, dispose }
}
