<template>
  <div class="model-viewer" ref="containerRef">
    <!-- 3D 渲染画布 -->
    <div class="canvas-wrapper" ref="canvasRef"></div>

    <!-- 工具栏 -->
    <div class="toolbar">
      <button
        v-for="tool in tools"
        :key="tool.name"
        :class="{ active: activeTool === tool.name }"
        @click="handleTool(tool)"
        :title="tool.title"
      >
        {{ tool.label }}
      </button>
      <span class="toolbar-sep"></span>
      <button @click="resetCamera" title="重置视角"><MaterialIcon :path="ICONS.refresh" :size="14" style="vertical-align:middle;margin-right:2px" /> 重置</button>
      <button @click="toggleAutoRotate" :title="autoRotate ? '停止旋转' : '自动旋转'">
        <MaterialIcon :path="autoRotate ? ICONS.pause : ICONS.play" :size="14" style="vertical-align:middle;margin-right:2px" /> 旋转
      </button>
      <button @click="toggleWireframe" :title="wireframe ? '实体模式' : '线框模式'">
        线框
      </button>
    </div>

    <!-- 模型信息悬浮条 -->
    <div class="info-bar">
      <span>{{ modelInfo.fileName }}</span>
      <span>·</span>
      <span>顶点: {{ stats.vertices }}</span>
      <span>·</span>
      <span>面数: {{ stats.faces }}</span>
    </div>

    <!-- 加载状态 -->
    <div class="loading-overlay" v-if="loading">
      <div class="spinner"></div>
      <p>正在加载模型...</p>
    </div>

    <!-- 错误提示 -->
    <div class="error-overlay" v-if="error">
      <p><MaterialIcon :path="ICONS.alert" :size="16" style="vertical-align:middle;margin-right:4px" /> {{ error }}</p>
    </div>
  </div>
</template>

<script setup>
/* eslint-disable no-undef */
import { ref, reactive, watch, onMounted, onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import MaterialIcon from '@/components/MaterialIcon.vue'
import { ICONS } from '@/utils/icons'

const props = defineProps({
  /** 模型文件 URL */
  url: {
    type: String,
    default: ''
  },
  /** 模型格式: stl / obj */
  format: {
    type: String,
    default: 'stl',
    validator: (v) => ['stl', 'obj'].includes(v)
  },
  /** 背景色 */
  backgroundColor: {
    type: String,
    default: '#f0f2f5'
  }
})

const emit = defineEmits(['loaded', 'error', 'stats'])

// DOM 引用
const containerRef = ref(null)
const canvasRef = ref(null)

// 状态
const loading = ref(true)
const error = ref('')
const autoRotate = ref(false)
const wireframe = ref(false)
const activeTool = ref('')

// 统计信息
const stats = reactive({
  vertices: '-',
  faces: '-'
})

// 模型信息（从 URL 提取文件名）
const modelInfo = reactive({
  fileName: props.url ? decodeURIComponent(props.url.split('/').pop()) : 'demo.stl'
})

// Three.js 核心对象
let scene = null
let camera = null
let renderer = null
let controls = null
let currentMesh = null

// 工具栏配置
const tools = [
  { name: 'front', label: '前视图', title: '正面观察' },
  { name: 'top', label: '顶视图', title: '俯视观察' },
  { name: 'left', label: '左视图', title: '左侧观察' }
]

/** 初始化 Three.js 场景 */
function initScene() {
  const container = containerRef.value
  if (!container) return

  // 场景
  scene = new THREE.Scene()
  scene.background = new THREE.Color(props.backgroundColor)

  // 相机 - 正交相机更适合3D打印模型展示（无透视畸变）
  const aspect = container.clientWidth / container.clientHeight || 1.6
  camera = new THREE.PerspectiveCamera(45, aspect, 0.01, 10000)
  camera.position.set(0, 80, 200)

  // 渲染器
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(container.clientWidth, container.clientHeight)
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.shadowMap.enabled = true
  canvasRef.value.appendChild(renderer.domElement)

  // 控制器 - 轨道控制器，支持旋转/缩放/平移
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.rotateSpeed = 0.8
  controls.zoomSpeed = 1.2
  controls.panSpeed = 0.8
  controls.minDistance = 20
  controls.maxDistance = 1000

  // 光照系统
  setupLights()

  // 坐标网格辅助线（地面参考）
  const gridHelper = new THREE.GridHelper(300, 30, 0xcccccc, 0xe8e8e8)
  scene.add(gridHelper)

  // 开始渲染循环
  animate()

  // 监听窗口大小变化
  window.addEventListener('resize', onResize)
}

/** 配置场景光照 */
function setupLights() {
  // 环境光 - 整体基础亮度
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
  scene.add(ambientLight)

  // 主方向光 - 从右上方照射
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.9)
  dirLight.position.set(150, 200, 100)
  dirLight.castShadow = true
  scene.add(dirLight)

  // 补光 - 减少阴影过暗
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.4)
  fillLight.position.set(-100, 50, -100)
  scene.add(fillLight)

  // 底部补光 - 填充底部暗部
  const bottomLight = new THREE.DirectionalLight(0xffffff, 0.15)
  bottomLight.position.set(0, -100, 0)
  scene.add(bottomLight)
}

/** 加载模型 */
async function loadModel() {
  if (!props.url) {
    // 无 URL 时生成一个内置 Demo 几何体
    loadDemoModel()
    return
  }

  try {
    loading.value = true
    error.value = ''

    // 用 fetch 获取文件（相对路径，走 dev proxy，无需鉴权头）
    const resp = await fetch(props.url)

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}: ${resp.statusText}`)
    }

    const arrayBuffer = await resp.arrayBuffer()

    let geometry
    if (props.format === 'stl') {
      const loader = new STLLoader()
      // Three.js 0.160+ 的 STLLoader.parse() 自动检测 ASCII/Binary
      geometry = loader.parse(arrayBuffer)
    } else {
      // OBJLoader.parse() 需要字符串
      const loader = new OBJLoader()
      const text = new TextDecoder('utf-8').decode(new Uint8Array(arrayBuffer))
      geometry = loader.parse(text)
    }

    addModelToScene(geometry)
    emit('loaded')
  } catch (e) {
    console.error('模型加载失败:', e)
    error.value = `加载失败: ${e.message}`
    emit('error', e)
  } finally {
    loading.value = false
  }
}

/** 内置 Demo 模型 - 一个带孔的机械零件风格几何体 */
function loadDemoModel() {
  loading.value = true

  // 创建组合几何体：底座 + 圆柱体 + 切割效果
  const group = new THREE.Group()

  // 主体 - 圆角立方体（模拟零件外壳）
  const boxGeo = new THREE.BoxGeometry(60, 25, 40, 4, 4, 4)
  const material = new THREE.MeshStandardMaterial({
    color: 0x42a5f5,
    metalness: 0.3,
    roughness: 0.6,
    wireframe: wireframe.value
  })

  // 对 BoxGeometry 的顶点做圆角化处理（简单近似）
  const positions = boxGeo.attributes.position
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i)
    const z = positions.getZ(i)

    // 边缘圆角近似（仅做边界判断）
    const isEdge = Math.abs(x) > 28 || Math.abs(z) > 18
    if (isEdge) {
      positions.setX(i, x * 0.95)
      positions.setZ(i, z * 0.95)
    }
  }

  boxGeo.computeVertexNormals()
  const mainBody = new THREE.Mesh(boxGeo, material)
  group.add(mainBody)

  // 顶部圆柱凸起
  const cylinderGeo = new THREE.CylinderGeometry(12, 14, 35, 32)
  cylinderGeo.translate(0, 30, 0)
  const cylMaterial = new THREE.MeshStandardMaterial({
    color: 0xef5350,
    metalness: 0.3,
    roughness: 0.6,
    wireframe: wireframe.value
  })
  const cylinder = new THREE.Mesh(cylinderGeo, cylMaterial)
  group.add(cylinder)

  // 顶部圆柱上的通孔（用深色小圆柱模拟）
  const holeGeo = new THREE.CylinderGeometry(6, 6, 38, 24)
  holeGeo.translate(0, 31, 0)
  const holeMaterial = new THREE.MeshStandardMaterial({
    color: 0x37474f,
    metalness: 0.5,
    roughness: 0.4,
    wireframe: wireframe.value
  })
  const hole = new THREE.Mesh(holeGeo, holeMaterial)
  group.add(hole)

  // 底部四个定位销钉
  const pinGeo = new THREE.CylinderGeometry(3, 3, 8, 16)
  const pinMaterial = new THREE.MeshStandardMaterial({
    color: 0x78909c,
    metalness: 0.4,
    roughness: 0.5,
    wireframe: wireframe.value
  })
  const pinPositions = [
    [-22, -16.5, 13],
    [22, -16.5, 13],
    [-22, -16.5, -13],
    [22, -16.5, -13]
  ]
  pinPositions.forEach(([px, py, pz]) => {
    const pin = new THREE.Mesh(pinGeo.clone(), pinMaterial)
    pin.position.set(px, py, pz)
    group.add(pin)
  })

  // 将整个组作为当前 mesh
  currentMesh = group
  scene.add(group)

  // 居中 & 缩放适配
  centerAndFitCamera(group)

  // 更新统计信息
  let totalVerts = 0
  let totalFaces = 0
  group.traverse((child) => {
    if (child.isMesh && child.geometry) {
      totalVerts += child.geometry.attributes.position?.count || 0
      totalFaces += child.geometry.index
        ? child.geometry.index.count / 3
        : (child.geometry.attributes.position?.count || 0) / 3
    }
  })
  stats.vertices = totalVerts.toLocaleString()
  stats.faces = Math.floor(totalFaces).toLocaleString()
  modelInfo.fileName = 'demo_mechanical_part.stl'

  loading.value = false
  emit('loaded')
  emit('stats', stats)
}

/** 将模型添加到场景并居中 */
function addModelToScene(geometry) {
  // STL 返回 BufferGeometry，OBJ 返回 Group
  let mesh
  if (geometry.isBufferGeometry) {
    // 计算法线以获得正确的光照效果
    if (!geometry.attributes.normal) {
      geometry.computeVertexNormals()
    }

    const material = new THREE.MeshStandardMaterial({
      color: 0x42a5f5,
      metalness: 0.3,
      roughness: 0.6,
      side: THREE.DoubleSide,
      wireframe: wireframe.value
    })
    mesh = new THREE.Mesh(geometry, material)
  } else {
    // OBJLoader 返回的是 Group
    mesh = geometry
    mesh.traverse((child) => {
      if (child.isMesh) {
        child.material = new THREE.MeshStandardMaterial({
          color: 0x42a5f5,
          metalness: 0.3,
          roughness: 0.6,
          side: THREE.DoubleSide,
          wireframe: wireframe.value
        })
      }
    })
  }

  currentMesh = mesh
  scene.add(mesh)
  centerAndFitCamera(mesh)

  // 更新统计
  if (mesh.geometry) {
    stats.vertices = mesh.geometry.attributes.position.count.toLocaleString()
    stats.faces = (
      mesh.geometry.index
        ? mesh.geometry.index.count / 3
        : mesh.geometry.attributes.position.count / 3
    ).toLocaleString()
  }

  loading.value = false
}

/** 居中模型并调整相机使其完整显示 */
function centerAndFitCamera(object) {
  // 计算包围盒并居中
  const box = new THREE.Box3().setFromObject(object)
  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())

  object.position.sub(center) // 将模型中心移到原点

  // 让相机后退到能看到整个模型的距离
  const maxDim = Math.max(size.x, size.y, size.z)
  const fov = camera.fov * (Math.PI / 180)
  let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2))
  cameraZ *= 1.8 // 留一点边距

  camera.position.set(cameraZ * 0.7, cameraZ * 0.5, cameraZ)
  camera.lookAt(0, 0, 0)
  controls.target.set(0, 0, 0)
  controls.update()
}

/** 动画循环 */
function animate() {
  requestAnimationFrame(animate)

  if (autoRotate.value && currentMesh) {
    currentMesh.rotation.y += 0.005
  }

  controls.update()
  renderer.render(scene, camera)
}

/** 窗口 resize 处理 */
function onResize() {
  const container = containerRef.value
  if (!container || !camera || !renderer) return

  const width = container.clientWidth
  const height = container.clientHeight
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
}

// ========== 工具栏操作 ==========

/** 视图切换 */
function handleTool(tool) {
  activeTool.value = tool.name
  const distance = 250

  switch (tool.name) {
    case 'front':
      camera.position.set(0, 0, distance)
      break
    case 'top':
      camera.position.set(0, distance, 0.01)
      break
    case 'left':
      camera.position.set(-distance, 0, 0)
      break
  }

  camera.lookAt(0, 0, 0)
  controls.target.set(0, 0, 0)
  controls.update()
}

/** 重置相机 */
function resetCamera() {
  centerAndFitCamera(currentMesh)
  activeTool.value = ''
}

/** 自动旋转开关 */
function toggleAutoRotate() {
  autoRotate.value = !autoRotate.value
}

/** 线框模式开关 */
function toggleWireframe() {
  wireframe.value = !wireframe.value
  if (currentMesh) {
    currentMesh.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.wireframe = wireframe.value
        child.material.needsUpdate = true
      }
    })
  }
}

// ========== 生命周期 ==========
onMounted(() => {
  initScene()
  loadModel()
})

// 监听 url 变化（父组件异步赋值后触发重新加载）
watch(() => props.url, (newUrl, oldUrl) => {
  if (newUrl === oldUrl) return
  // 清除旧模型
  if (currentMesh) {
    scene.remove(currentMesh)
    currentMesh = null
  }
  // 更新文件名显示
  if (newUrl) {
    const rawName = decodeURIComponent(newUrl.split('/').pop())
    modelInfo.fileName = rawName.includes('?') ? rawName.split('?')[0] : rawName
  }
  loadModel()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  if (renderer) {
    renderer.dispose()
  }
  if (controls) {
    controls.dispose()
  }
})
</script>

<style scoped>
.model-viewer {
  position: relative;
  width: 100%;
  height: 500px;
  border-radius: 12px;
  overflow: hidden;
  background-color: #f0f2f5;
  border: 1px solid #dcdfe6;
}

.canvas-wrapper {
  width: 100%;
  height: 100%;
}

.canvas-wrapper canvas {
  display: block;
  width: 100% !important;
  height: 100% !important;
}

/* 工具栏 */
.toolbar {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(8px);
  padding: 6px 10px;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  font-size: 13px;
  user-select: none;
  z-index: 10;
}

.toolbar button {
  padding: 4px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #555;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.toolbar button:hover {
  background: #ecf5ff;
  color: #409eff;
}

.toolbar button.active {
  background: #409eff;
  color: #fff;
}

.toolbar-sep {
  width: 1px;
  height: 16px;
  background: #ddd;
  margin: 0 4px;
}

/* 信息悬浮条 */
.info-bar {
  position: absolute;
  bottom: 12px;
  left: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #888;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(4px);
  padding: 4px 10px;
  border-radius: 6px;
  z-index: 10;
}

/* 加载遮罩 */
.loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: rgba(240, 242, 245, 0.85);
  z-index: 20;
}

.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid #dcdfe6;
  border-top-color: #409eff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 12px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-overlay p {
  color: #666;
  font-size: 14px;
}

/* 错误遮罩 */
.error-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgba(245, 108, 108, 0.08);
  z-index: 20;
}

.error-overlay p {
  color: #f56c6c;
  font-size: 14px;
  background: #fff;
  padding: 12px 24px;
  border-radius: 8px;
}
</style>
