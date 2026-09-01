// Material Design Icons 路径映射 — 集中管理项目中所有图标
// 引入方式: import { ICONS } from '@/utils/icons'

import {
  mdiMenu,
  mdiPrinter3d,
  mdiHome,
  mdiCubeOutline,
  mdiRss,
  mdiAccountGroup,
  mdiCloudUpload,
  mdiLogin,
  mdiChevronDown,
  mdiMagnify,
  mdiClose,
  mdiHeart,
  mdiHeartOutline,
  mdiShareVariant,
  mdiLinkVariant,
  mdiWechat,
  mdiBullhorn,
  mdiPenguin,
  mdiFileDocument,
  mdiCog,
  mdiAccount,
  mdiClockOutline,
  mdiMessageReplyText,
  mdiDownload,
  mdiDelete,
  mdiCamera,
  mdiEmail,
  mdiPackageVariant,
  mdiInbox,
  mdiAccountEye,
  mdiAccountHeart,
  mdiRefresh,
  mdiPause,
  mdiPlay,
  mdiAlert,
  mdiCube,
  mdiCellphone,
  mdiDrone,
  mdiPowerPlug,
  mdiDragon,
  mdiCakeVariant,
  mdiSprout,
  mdiPencil,
  mdiWrench,
  mdiHomeCity,
  mdiGamepadVariant,
  mdiTriangle,
  mdiPuzzle,
  mdiAxe,
  mdiNut
} from '@mdi/js'

export const ICONS = {
  // 导航
  printer3d: mdiPrinter3d,
  home: mdiHome,
  cubeOutline: mdiCubeOutline,
  rss: mdiRss,
  accountGroup: mdiAccountGroup,
  cloudUpload: mdiCloudUpload,
  login: mdiLogin,
  chevronDown: mdiChevronDown,

  // 操作
  menu: mdiMenu,
  magnify: mdiMagnify,
  close: mdiClose,
  heart: mdiHeart,
  heartOutline: mdiHeartOutline,
  share: mdiShareVariant,
  link: mdiLinkVariant,
  wechat: mdiWechat,
  bullhorn: mdiBullhorn,
  qq: mdiPenguin,
  fileDocument: mdiFileDocument,
  cog: mdiCog,
  account: mdiAccount,
  clock: mdiClockOutline,
  comment: mdiMessageReplyText,
  download: mdiDownload,
  delete: mdiDelete,
  camera: mdiCamera,
  email: mdiEmail,
  refresh: mdiRefresh,
  pause: mdiPause,
  play: mdiPlay,
  alert: mdiAlert,

  // 状态
  packageVariant: mdiPackageVariant,
  inbox: mdiInbox,
  accountEye: mdiAccountEye,
  accountHeart: mdiAccountHeart,

  // 模型卡片预览图标池（替换 emoji 数组）
  cube: mdiCube,
  cellphone: mdiCellphone,
  drone: mdiDrone,
  powerPlug: mdiPowerPlug,
  dragon: mdiDragon,
  cakeVariant: mdiCakeVariant,
  sprout: mdiSprout,
  pencil: mdiPencil,
  wrench: mdiWrench,
  homeCity: mdiHomeCity,
  gamepadVariant: mdiGamepadVariant,
  triangle: mdiTriangle,
  puzzle: mdiPuzzle,
  axe: mdiAxe,
  nut: mdiNut
}

// 模型卡片预览图标池（MDI path 数组，用于 getIcon 函数）
export const MODEL_ICONS = [
  ICONS.cube,           // 🔧→Cube
  ICONS.cellphone,      // 📱→Cellphone
  ICONS.drone,          // 🚁→Drone
  ICONS.powerPlug,      // 🔌→PowerPlug
  ICONS.dragon,         // 🐉→Dragon
  ICONS.cakeVariant,    // 🥧→Cake
  ICONS.sprout,         // 🪴→Sprout
  ICONS.pencil,         // ✏️→Pencil
  ICONS.wrench,         // 🔧→Wrench
  ICONS.homeCity,       // 🏠→HomeCity
  ICONS.gamepadVariant, // 🎮→Gamepad
  ICONS.packageVariant  // 📦→Package
]

// UserProfile 专用图标池
export const PROFILE_ICONS = [
  ICONS.wrench,          // 🔧
  ICONS.triangle,        // 📐
  ICONS.puzzle,          // 🧩
  ICONS.powerPlug,       // 🔌
  ICONS.dragon,          // 🐉
  ICONS.cakeVariant,     // 🥧
  ICONS.axe,             // 🪵
  ICONS.pencil,          // ✏️
  ICONS.nut,             // 🔩
  ICONS.homeCity,        // 🏠
  ICONS.gamepadVariant,  // 🎮
  ICONS.packageVariant   // 📦
]
