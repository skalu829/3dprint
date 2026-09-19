# 3DPrint · 3D 打印模型分享平台

面向 3D 打印爱好者的模型分享社区：上传模型 → 在线 3D 预览 → 交流分享。

![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A522.5-339933?logo=node.js&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.9+-3776AB?logo=python&logoColor=white)
![Vue 3](https://img.shields.io/badge/Vue-3-4FC08D?logo=vuedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-WAL-003B57?logo=sqlite&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue)

## ✨ 功能特性

**用户系统**
- 注册 / 登录，JWT 鉴权 + bcrypt 密码加密
- 邮箱验证（SMTP 验证码；未配置 SMTP 时注册流程不受阻断）
- 个人主页、头像上传、关注 / 粉丝、关注动态流、浏览历史

**模型库**
- 模型上传：支持 `.stl` `.3mf` `.obj` `.step` `.stp` `.iges` `.igs` `.amf`，单文件 ≤ 50MB
- 分类、标签与 CC 知识共享协议标注
- Python 工具链自动生成缩略图，3MF 自动导出 STL 供在线预览

**3D 在线预览（Three.js）**
- WebGL 实时渲染，顶点 / 面数统计
- 前 / 顶 / 左视图切换、线框模式、自动旋转、视角重置

**社区互动**
- 收藏、分享、评论、评论点赞

**搜索**
- 关键词搜索
- AI 语义搜索（接入阿里云百炼 DashScope；未配置 Key 时自动降级为关键词搜索）

**性能与部署**
- Redis 缓存模型列表（连不上自动降级直查数据库）
- 前后端同源部署：Express 托管 SPA，单端口运行
- 生产模式强制校验 `JWT_SECRET`，缺失拒绝启动；支持优雅关闭
- 响应式布局，适配移动端

## 📸 演示截图

<table>
  <tr>
    <td><img src="docs/screenshots/home.png" alt="首页" width="180"/></td>
    <td><img src="docs/screenshots/model-detail.png" alt="模型详情 · 3D 在线预览" width="180"/></td>
    <td><img src="docs/screenshots/mobile-drawer.png" alt="移动端抽屉导航" width="180"/></td>
    <td><img src="docs/screenshots/login.png" alt="登录 / 注册" width="180"/></td>
  </tr>
  <tr>
    <td align="center">首页 · 模型广场</td>
    <td align="center">详情页 · 3D 在线预览</td>
    <td align="center">移动端 · 抽屉导航</td>
    <td align="center">登录 / 注册 · 邮箱验证</td>
  </tr>
</table>

## 🧰 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3 · Vue Router · Vue CLI · Three.js 0.160 · MDI 图标 |
| 后端 | Node.js · Express · node:sqlite（WAL 模式） |
| 鉴权 | JWT · bcryptjs |
| 邮件 | Nodemailer（SMTP） |
| 缓存 | Redis（可选，自动降级） |
| 工具链 | Python · NumPy · Trimesh · Matplotlib |

## 📁 目录结构

```
3dprint/
├── src/                        # 前端源码（Vue 3）
│   ├── views/                  # 14 个页面视图
│   ├── components/             # ModelViewer（3D 预览）/ NavBar / MaterialIcon
│   ├── router/                 # 路由配置
│   ├── store/                  # 状态管理
│   └── api/ utils/ assets/
├── server/                     # 后端源码（Express 分层架构）
│   ├── config/                 # 环境变量加载与业务配置
│   ├── database/               # SQLite 初始化与建表
│   ├── middleware/             # JWT 鉴权 / multer 上传 / 统一错误处理
│   ├── routes/                 # auth / models / users / search
│   ├── services/               # mailer / aiSearch / cache / assets
│   ├── generate_thumbnail.py   # 缩略图生成 & 3MF → STL 转换
│   └── .env.example            # 环境变量模板
├── docs/screenshots/           # 演示截图
├── public/                     # 静态资源
└── vue.config.js               # 开发代理（8080 → 3001）
```

## 🚀 快速开始

### 环境要求

- **Node.js ≥ 22.5**（使用 `node:sqlite`，推荐 24+）
- **Python ≥ 3.9**（缩略图生成与格式转换）
- Redis（可选，未安装或连不上会自动降级）

### 步骤

```bash
# 1. 克隆并安装依赖
git clone https://github.com/<your-name>/3dprint.git
cd 3dprint
npm install

# 2. 安装 Python 依赖（缩略图生成）
pip install numpy trimesh matplotlib

# 3. 配置环境变量
cp server/.env.example server/.env
# 编辑 server/.env，至少修改 JWT_SECRET（可用 openssl rand -hex 32 生成）

# 4. 启动后端 API（http://localhost:3001）
npm run server

# 5. 启动前端开发服务（另开终端，http://localhost:8080，已配置 /api 代理）
npm run serve
```

首次启动会自动创建 SQLite 数据库与表结构；上传模型后自动调用 Python 脚本补生成缩略图。

## ⚙️ 环境变量

完整模板见 [`server/.env.example`](server/.env.example)。

| 变量 | 说明 | 默认值 |
|---|---|---|
| `PORT` | 服务端口 | `3001` |
| `NODE_ENV` | `production` 时强制要求 `JWT_SECRET` | — |
| `JWT_SECRET` | JWT 签名密钥（**生产必填**） | — |
| `JWT_EXPIRES_IN` | Token 有效期 | `7d` |
| `CORS_ORIGIN` | 跨域白名单，逗号分隔 | `*` |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | Redis 连接（可选，失败降级直查） | `127.0.0.1` / `6379` / 空 |
| `SMTP_USER` / `SMTP_PASS` | 邮箱验证发信（QQ 邮箱授权码，可选） | 空 |
| `DASHSCOPE_API_KEY` | 阿里云百炼 Key，启用 AI 语义搜索（可选） | 空 |
| `PYTHON_PATH` | Python 解释器路径 | `python3` |

## 📦 生产部署

```bash
# 构建前端（输出到 dist/，由 Express 托管，前后端同源单端口）
npm run build

# Linux / macOS
npm run start

# Windows（CMD）
npm run start:win
```

使用 pm2 常驻（推荐）：

```bash
pm2 start server/index.js --name 3dprint
pm2 save && pm2 startup
```

## 🔌 主要接口

| 模块 | 接口 | 说明 |
|---|---|---|
| 认证 | `POST /api/auth/register` | 注册并发送验证码 |
| | `POST /api/auth/login` | 登录 |
| 模型 | `GET /api/models` | 模型列表 |
| | `POST /api/models` | 上传模型（multipart，≤ 50MB） |
| | `GET /api/models/:id` | 模型详情 |
| | `GET /api/models/:id/stl` | STL 文件（预览 / 下载） |
| | `POST /api/models/:id/favorite` · `/:id/share` | 收藏 / 分享 |
| | `GET / POST /api/models/:id/comments` | 评论 |
| 用户 | `GET /api/users/:id/profile` | 用户主页 |
| | `POST /api/users/avatar` | 头像上传 |
| | `POST /api/users/:userId/follow` | 关注 / 取关 |
| | `GET /api/users/favorites` | 我的收藏 |
| 搜索 | `GET /api/search` | 关键词 + AI 语义搜索 |

## 📄 License

[MIT](LICENSE)
