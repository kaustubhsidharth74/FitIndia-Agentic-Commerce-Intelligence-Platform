import { useEffect, useRef } from 'react'
import {
  Scene, PerspectiveCamera, WebGLRenderer, Color,
  BufferGeometry, Float32BufferAttribute, SphereGeometry,
  MeshBasicMaterial, InstancedMesh, Matrix4,
  Group, Vector3, AdditiveBlending,
} from 'three'

const DEFAULTS = {
  particlesCount: 8000,
  particleScale: 8,
  speed: 20,
  smoothing: 7,
  scale: 10,
  rotationDirection: 'clockwise',
  dragSpeed: 5,
  drag: true,
  cursorOn: true,
  cursorRadiusUI: 75,
  cursorStrengthUI: 10,
  sphereColor: '#1677C8',
}

const CURSOR_PHYSICS = { RETURN_FORCE: 0.015, FRICTION: 0.94 }

function genSphere(n, R) {
  const golden = Math.PI * (3 - Math.sqrt(5))
  const pts = []
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2
    const r = Math.sqrt(Math.max(0, 1 - y * y))
    const t = golden * i
    pts.push(new Vector3(Math.cos(t) * r * R, y * R, Math.sin(t) * r * R))
  }
  return pts
}

function mapLinear(value, inMin, inMax, outMin, outMax) {
  if (inMax === inMin) return outMin
  return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin)
}

function mapSpeedUiToInternal(ui)        { return mapLinear(ui, 0.1, 1.0, 0.01, 0.05) }
function mapScaleUiToMultiplier(ui)      { return mapLinear(Math.max(0, Math.min(1, ui)), 0, 1.0, 0.25, 1.25) }
function mapParticleSizeUiToInternal(ui) { return mapLinear(Math.max(0.1, Math.min(1, ui)), 0.1, 1.0, 0.01, 0.1) }
function mapCursorStrengthUiToMultiplier(ui) { return mapLinear(Math.max(0, Math.min(1, ui)), 0, 1.0, 0, 15) }

function parseColorToRgba(input) {
  if (!input || !input.trim()) return { r: 0, g: 0, b: 0, a: 1 }
  const str = input.trim()
  const hex = str.replace(/^#/, '')
  if (hex.length === 6) {
    return {
      r: parseInt(hex.slice(0, 2), 16) / 255,
      g: parseInt(hex.slice(2, 4), 16) / 255,
      b: parseInt(hex.slice(4, 6), 16) / 255,
      a: 1,
    }
  }
  if (hex.length === 3) {
    return {
      r: parseInt(hex[0] + hex[0], 16) / 255,
      g: parseInt(hex[1] + hex[1], 16) / 255,
      b: parseInt(hex[2] + hex[2], 16) / 255,
      a: 1,
    }
  }
  return { r: 0.1, g: 0.47, b: 0.78, a: 1 }
}

export default function ParticleSphere(props) {
  const {
    particlesCount = DEFAULTS.particlesCount,
    speed         = DEFAULTS.speed,
    smoothing     = DEFAULTS.smoothing,
    scale         = DEFAULTS.scale,
    rotationDirection = DEFAULTS.rotationDirection,
    dragSpeed     = DEFAULTS.dragSpeed,
    drag          = DEFAULTS.drag,
    particleScale = DEFAULTS.particleScale,
    cursorOn      = DEFAULTS.cursorOn,
    cursorRadiusUI    = DEFAULTS.cursorRadiusUI,
    cursorStrengthUI  = DEFAULTS.cursorStrengthUI,
    sphereColor   = DEFAULTS.sphereColor,
    style,
  } = props

  const speedN    = speed / 10
  const smoothingN = smoothing / 10
  const scaleN    = scale / 10
  const dragN     = dragSpeed / 10
  const sizeN     = particleScale / 10
  const strengthN = cursorStrengthUI / 10

  const containerRef  = useRef(null)
  const animFrameRef  = useRef(null)
  const basePositions = useRef([])
  const displacements = useRef([])
  const mouseRef      = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const cw = container.clientWidth  || 500
    const ch = container.clientHeight || 500
    const OVR = 2.5
    const canvasW = cw * OVR
    const canvasH = ch * OVR

    const scene = new Scene()
    const baseFOV = 50
    const adjFOV = 2 * Math.atan(Math.tan((baseFOV * Math.PI) / 180 / 2) * OVR) * (180 / Math.PI)
    const camera = new PerspectiveCamera(adjFOV, canvasW / canvasH, 0.1, 1000)
    const scaleMultiplier = mapScaleUiToMultiplier(scaleN)
    camera.position.z = Math.max(3.0, 1.0 * scaleMultiplier + 1.0)

    const renderer = new WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(canvasW, canvasH)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = 'srgb'
    const canvas = renderer.domElement
    const offsetX = (canvasW - cw) / 2
    const offsetY = (canvasH - ch) / 2
    canvas.style.cssText = `position:absolute;left:-${offsetX}px;top:-${offsetY}px;width:${canvasW}px;height:${canvasH}px;display:block;pointer-events:none;`
    container.appendChild(canvas)

    const rgba = parseColorToRgba(sphereColor)
    const baseColor = new Color(rgba.r, rgba.g, rgba.b)
    const particleOpacity = rgba.a

    const sphereR = 1.0 * scaleMultiplier
    const spherePts = genSphere(particlesCount, sphereR)

    const vertices = []
    basePositions.current = []
    displacements.current = []

    for (let i = 0; i < particlesCount; i++) {
      const p = spherePts[i]
      vertices.push(p.x, p.y, p.z)
      basePositions.current.push(p.clone())
      displacements.current.push(new Vector3())
    }

    const pSize = mapParticleSizeUiToInternal(sizeN)
    const geo = new SphereGeometry(pSize * 0.15, 6, 6)
    const mat = new MeshBasicMaterial({
      color: 0xffffff,
      blending: AdditiveBlending,
      transparent: particleOpacity < 1,
      opacity: particleOpacity,
    })
    const mesh = new InstancedMesh(geo, mat, particlesCount)

    const colors = new Float32Array(particlesCount * 3)
    const mtx = new Matrix4()
    for (let i = 0; i < particlesCount; i++) {
      const idx = i * 3
      mtx.setPosition(vertices[idx], vertices[idx + 1], vertices[idx + 2])
      mesh.setMatrixAt(i, mtx)
      colors[idx] = baseColor.r; colors[idx + 1] = baseColor.g; colors[idx + 2] = baseColor.b
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.instanceColor = new Float32BufferAttribute(colors, 3)
    mesh.instanceColor.needsUpdate = true

    const group = new Group()
    group.add(mesh)
    scene.add(group)

    const rotation = { x: 0, y: 0 }
    const target   = { x: 0, y: 0 }
    const vel      = { x: 0, y: 0 }
    let isDragging = false
    let lastMX = 0, lastMY = 0, lastDragT = 0
    let lastFrameT = performance.now()
    const refDelta = 1000 / 60
    const lerpFactor = smoothingN === 0 ? 1 : mapLinear(smoothingN, 0, 1, 0.4, 0.03)
    const velDecay   = mapLinear(smoothingN, 0, 1, 0.7, 0.96)
    const rotSpeed   = mapSpeedUiToInternal(speedN) * (rotationDirection === 'anticlockwise' ? -1 : 1)
    const cursorRadius = Math.max(0, Math.min(600, cursorRadiusUI))
    const cursorStrength = mapCursorStrengthUiToMultiplier(strengthN)
    const cursorRSq  = cursorRadius * cursorRadius
    const thr = 0.01

    let animId = null
    const animate = () => {
      const now = performance.now()
      const dt  = now - lastFrameT
      lastFrameT = now
      const df  = dt / refDelta

      if (!isDragging) target.x += rotSpeed * 0.1 * df

      if (!isDragging && smoothingN > 0) {
        if (Math.abs(vel.x) > thr || Math.abs(vel.y) > thr) {
          target.x += vel.x * df
          target.y = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, target.y + vel.y * df))
          const decay = Math.pow(velDecay, df)
          vel.x *= decay; vel.y *= decay
        } else { vel.x = 0; vel.y = 0 }
      }

      const dx = target.x - rotation.x
      const dy = target.y - rotation.y
      if (Math.abs(dx) > thr || Math.abs(dy) > thr || rotSpeed !== 0 || isDragging) {
        const lf = 1 - Math.pow(1 - lerpFactor, df)
        rotation.x += dx * lf
        rotation.y = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotation.y + dy * lf))
      }

      group.rotation.y = rotation.x
      group.rotation.x = rotation.y
      group.updateMatrixWorld(true)

      const currCW = (containerRef.current?.clientWidth  || cw) * OVR
      const currCH = (containerRef.current?.clientHeight || ch) * OVR

      if (cursorOn && basePositions.current.length > 0) {
        for (let i = 0; i < basePositions.current.length; i++) {
          const base = basePositions.current[i]
          const disp = displacements.current[i]

          if (mouseRef.current) {
            const localPos = new Vector3().copy(base).add(disp)
            const worldPos = localPos.applyMatrix4(group.matrixWorld)
            const proj = worldPos.clone().project(camera)
            const sx = (proj.x * 0.5 + 0.5) * currCW
            const sy = (-proj.y * 0.5 + 0.5) * currCH
            const ddx = mouseRef.current.x - sx
            const ddy = mouseRef.current.y - sy
            const distSq = ddx * ddx + ddy * ddy

            if (distSq < cursorRSq && distSq > 0 && worldPos.z > 0) {
              const dist  = Math.sqrt(distSq)
              const force = (cursorRadius - dist) / cursorRadius
              const angle = Math.atan2(ddy, ddx)
              const cr = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize()
              const cu = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1).normalize()
              const rep = force * cursorStrength * speedN * df
              const wx = -Math.cos(angle) * rep * 0.01
              const wy =  Math.sin(angle) * rep * 0.01
              const wr = new Vector3().addScaledVector(cr, wx).addScaledVector(cu, wy)
              const inv = new Matrix4().copy(group.matrixWorld).invert()
              disp.add(wr.applyMatrix4(inv))
            }
          }

          // always apply return force so particles spring back when cursor leaves
          const ff = Math.pow(CURSOR_PHYSICS.FRICTION, df)
          disp.multiplyScalar(ff * (1 - CURSOR_PHYSICS.RETURN_FORCE * speedN * df))
        }
      }

      const posMtx = new Matrix4()
      for (let i = 0; i < basePositions.current.length; i++) {
        const fp = new Vector3().copy(basePositions.current[i]).add(displacements.current[i])
        posMtx.setPosition(fp.x, fp.y, fp.z)
        mesh.setMatrixAt(i, posMtx)
      }
      mesh.instanceMatrix.needsUpdate = true

      renderer.render(scene, camera)
      animId = requestAnimationFrame(animate)
      animFrameRef.current = animId
    }

    animId = requestAnimationFrame(animate)
    animFrameRef.current = animId

    const handleMouseMove = (e) => {
      const rect = container.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      if (mx >= 0 && mx <= rect.width && my >= 0 && my <= rect.height) {
        mouseRef.current = { x: mx + offsetX, y: my + offsetY }
      } else {
        mouseRef.current = null
      }
    }
    const handleMouseLeave = () => { mouseRef.current = null }

    const handleMouseDown = (e) => {
      if (!drag) return
      isDragging = true; vel.x = 0; vel.y = 0
      lastMX = e.clientX; lastMY = e.clientY; lastDragT = performance.now()
      const onMove = (me) => {
        const now2 = performance.now()
        const dt2  = now2 - lastDragT
        const sens = mapLinear(dragN, 0, 1, 0.001, 0.02)
        const ddx2 = me.clientX - lastMX; const ddy2 = me.clientY - lastMY
        target.x += ddx2 * sens
        target.y = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, target.y + ddy2 * sens))
        if (dt2 > 0) { const tn = refDelta / dt2; vel.x = ddx2 * sens * 0.3 * tn; vel.y = ddy2 * sens * 0.3 * tn }
        lastMX = me.clientX; lastMY = me.clientY; lastDragT = now2
      }
      const onUp = () => { isDragging = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    }

    container.style.cursor = drag ? 'grab' : 'default'
    container.addEventListener('mousemove', handleMouseMove)
    container.addEventListener('mouseleave', handleMouseLeave)
    container.addEventListener('mousedown', handleMouseDown)

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      container.removeEventListener('mousemove', handleMouseMove)
      container.removeEventListener('mouseleave', handleMouseLeave)
      container.removeEventListener('mousedown', handleMouseDown)
      renderer.dispose()
      if (canvas.parentNode === container) container.removeChild(canvas)
    }
  }, [particlesCount, speed, smoothing, scale, rotationDirection, dragSpeed, drag,
      particleScale, cursorOn, cursorRadiusUI, cursorStrengthUI, sphereColor])

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', overflow: 'hidden', width: '100%', height: '100%', ...style }}
    />
  )
}
