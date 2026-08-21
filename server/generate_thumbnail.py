"""
3D 模型缩略图生成 & 格式转换工具（支持多零件 3MF）
用法: python generate_thumbnail.py <input_file> <output_dir> [--size 512]

对于 .3mf 文件（本质是 zip）：
  - 自动解压到临时目录
  - 解析 3dmodel.model XML 获取所有零件（object）
  - 为每个零件分别生成缩略图和 STL 导出
  - 输出:
      output_dir/{basename}_thumb.png           (整体缩略图，复合所有零件)
      output_dir/{basename}_export.stl          (整体 STL，合并所有零件)
      output_dir/{basename}_obj_{i}_thumb.png  (零件 i 缩略图)
      output_dir/{basename}_obj_{i}_export.stl (零件 i STL)
      output_dir/{basename}_objects.json       (零件列表元数据)

对于其他格式（.stl/.obj 等）：
  - 按原有逻辑处理（单个零件）
"""
import sys
import os
import json
import argparse
import zipfile
import tempfile
import xml.etree.ElementTree as ET
import numpy as np
import trimesh

# 3MF XML 命名空间
NS_3MF = '{http://schemas.microsoft.com/3dmanufacturing/core/2015/02}'
NS_PROD = '{http://schemas.microsoft.com/3dmanufacturing/production/2015/06}'

# 尝试通用的 "不带命名空间" 的 path 属性键
# 有些 3MF 文件用默认命名空间，有些用 production 命名空间
def _get_path_from_component(comp_elem):
    """从 component 元素中读取 path 属性（兼容不同命名空间）"""
    # 先试 production 命名空间（常见）
    p = comp_elem.get(f'{NS_PROD}path')
    if p:
        return p
    # 再试默认 3MF 命名空间
    p = comp_elem.get(f'{NS_3MF}path')
    if p:
        return p
    # 最后试无命名空间（某些生成工具）
    p = comp_elem.get('path')
    return p


def parse_3mf_objects(three_mf_path):
    """
    解析 .3mf 文件，返回零件列表。
    每个零件是一个 dict: {id, name, model_path, transform, mesh}
    """
    tmpdir = tempfile.mkdtemp(prefix='3mf_')
    with zipfile.ZipFile(three_mf_path, 'r') as z:
        z.extractall(tmpdir)

    model_xml = os.path.join(tmpdir, '3D', '3dmodel.model')
    if not os.path.exists(model_xml):
        print("ERROR: 3dmodel.model not found in 3MF", file=sys.stderr)
        sys.exit(1)

    tree = ET.parse(model_xml)
    root = tree.getroot()

    # 读取 resources/object 列表，获取每个 object 引用的 .model 文件路径
    # 格式: <object id="3" type="model"><components><component path=".../object_2.model" .../></components></object>
    objects_meta = {}  # id -> {paths: [...]}
    for obj in root.findall(f'{NS_3MF}resources/{NS_3MF}object'):
        obj_id = obj.get('id')
        components = obj.find(f'{NS_3MF}components')
        if components is not None:
            paths = []
            for comp in components.findall(f'{NS_3MF}component'):
                p = _get_path_from_component(comp)
                transform = comp.get('transform', '')
                if p:
                    paths.append({'path': p, 'transform': transform})
            objects_meta[obj_id] = paths
        else:
            # 无 components 的 object（直接包含 mesh 数据？不太可能）
            objects_meta[obj_id] = []

    # 收集所有需要加载的 .model 文件路径（去重）
    model_files = set()
    for obj_id, paths in objects_meta.items():
        for p in paths:
            # path 格式如 "/3D/Objects/object_2.model"
            full_path = p['path'].lstrip('/')
            model_files.add(full_path)

    # 逐个解析 .model 文件（XML 格式，含 vertices + triangles）
    meshes_by_path = {}
    for mf in model_files:
        mf_path = os.path.join(tmpdir, mf)
        if not os.path.exists(mf_path):
            print(f"  WARNING: model file not found: {mf}", file=sys.stderr)
            continue
        mesh = _parse_3mf_model_xml(mf_path)
        if mesh is not None:
            meshes_by_path[mf] = mesh

    # 组装零件列表（每个 object = 一个零件，可能包含多个 instance）
    objects = []
    for obj_id, paths in objects_meta.items():
        if not paths:
            continue
        # 合并该 object 下所有 instance 的 mesh
        parts = []
        for p in paths:
            mf_path = p['path'].lstrip('/')
            if mf_path in meshes_by_path:
                m = meshes_by_path[mf_path].copy()
                # 应用 transform（如果有）
                if p['transform']:
                    m.apply_transform(_parse_transform(p['transform']))
                parts.append(m)
        if parts:
            combined = trimesh.util.concatenate(parts) if len(parts) > 1 else parts[0]
            objects.append({
                'id': obj_id,
                'name': f'零件 {len(objects) + 1}',
                'mesh': combined
            })

    # 如果没有带 components 的 object，尝试直接读取 Object 目录下的所有 .model 文件
    if not objects:
        objects_dir = os.path.join(tmpdir, '3D', 'Objects')
        if os.path.exists(objects_dir):
            for fname in sorted(os.listdir(objects_dir)):
                if fname.endswith('.model'):
                    mf_path = os.path.join(objects_dir, fname)
                    mesh = _parse_3mf_model_xml(mf_path)
                    if mesh is not None:
                        objects.append({
                            'id': fname,
                            'name': fname.replace('.model', ''),
                            'mesh': mesh
                        })

    print(f"  3MF 解析完成: {len(objects)} 个零件")
    return objects, tmpdir


def _parse_3mf_model_xml(model_path):
    """解析 3MF .model XML 文件，返回 trimesh.Trimesh"""
    tree = ET.parse(model_path)
    root = tree.getroot()

    vertices = []
    triangles = []

    # 顶点
    for vp in root.findall(f'.//{NS_3MF}vertices/{NS_3MF}vertex'):
        vertices.append([
            float(vp.get('x', 0)),
            float(vp.get('y', 0)),
            float(vp.get('z', 0))
        ])

    # 三角面
    for tp in root.findall(f'.//{NS_3MF}triangles/{NS_3MF}triangle'):
        triangles.append([
            int(tp.get('v1', 0)),
            int(tp.get('v2', 0)),
            int(tp.get('v3', 0))
        ])

    if not vertices or not triangles:
        return None

    v = np.array(vertices, dtype=np.float64)
    f = np.array(triangles, dtype=np.int64)
    return trimesh.Trimesh(vertices=v, faces=f)


def _parse_transform(transform_str):
    """解析 3MF transform 字符串（16 个浮点数，行主序 4x4 矩阵）"""
    try:
        vals = list(map(float, transform_str.split()))
        if len(vals) == 16:
            return np.array(vals).reshape(4, 4)
    except Exception:
        pass
    return np.eye(4)


def generate_thumbnail(mesh, output_path, size=512):
    """对一个 mesh 生成缩略图 PNG"""
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    from mpl_toolkits.mplot3d.art3d import Poly3DCollection

    m = mesh.copy()
    m.vertices -= m.centroid
    scale = 1.0 / max(m.extents) if max(m.extents) > 0 else 1.0
    m.vertices *= scale * 0.8

    fig = plt.figure(figsize=(size / 100, size / 100), dpi=100)
    ax = fig.add_subplot(111, projection='3d')
    ax.set_facecolor('#f0f2f5')

    faces = m.faces if hasattr(m, 'faces') else []
    vertices = m.vertices
    if len(faces) > 20000:
        idx = np.random.choice(len(faces), 20000, replace=False)
        faces = faces[idx]

    if len(faces) > 0:
        tri = Poly3DCollection(vertices[faces], alpha=0.85, linewidth=0.05)
        tri.set_facecolor('#42a5f5')
        tri.set_edgecolor('#1e88e5')
        ax.add_collection3d(tri)

    all_verts = vertices
    xlim = [all_verts[:, 0].min(), all_verts[:, 0].max()]
    ylim = [all_verts[:, 1].min(), all_verts[:, 1].max()]
    zlim = [all_verts[:, 2].min(), all_verts[:, 2].max()]
    max_range = max(xlim[1] - xlim[0], ylim[1] - ylim[0], zlim[1] - zlim[0]) / 2.0
    mid_x = (xlim[0] + xlim[1]) / 2
    mid_y = (ylim[0] + ylim[1]) / 2
    mid_z = (zlim[0] + zlim[1]) / 2
    ax.set_xlim(mid_x - max_range, mid_x + max_range)
    ax.set_ylim(mid_y - max_range, mid_y + max_range)
    ax.set_zlim(mid_z - max_range, mid_z + max_range)

    ax.view_init(elev=25, azim=-60)
    ax.axis('off')
    plt.tight_layout(pad=0)
    plt.savefig(output_path, dpi=100, bbox_inches='tight', pad_inches=0.1)
    plt.close()


def process_file(input_path, output_dir, size=512):
    """
    处理输入文件，生成缩略图和 STL。
    返回: {basename, objects: [{id, name, thumb_path, stl_path}]}
    """
    os.makedirs(output_dir, exist_ok=True)
    basename = os.path.splitext(os.path.basename(input_path))[0]
    ext = os.path.splitext(input_path)[1].lower()

    result = {'basename': basename, 'objects': [], 'tmpdir': None}

    if ext == '.3mf':
        # 解析多零件 3MF
        objects, tmpdir = parse_3mf_objects(input_path)
        result['tmpdir'] = tmpdir

        if not objects:
            print("ERROR: No objects found in 3MF file", file=sys.stderr)
            sys.exit(1)

        # 为每个零件生成缩略图和 STL
        all_meshes = []
        for i, obj in enumerate(objects):
            obj_base = f"{basename}_obj_{i}"
            thumb_path = os.path.join(output_dir, f"{obj_base}_thumb.png")
            stl_path = os.path.join(output_dir, f"{obj_base}_export.stl")

            generate_thumbnail(obj['mesh'], thumb_path, size)
            obj['mesh'].export(stl_path)
            print(f"  零件 {i+1} 缩略图: {thumb_path}")
            print(f"  零件 {i+1} STL: {stl_path}")

            result['objects'].append({
                'index': i,
                'id': obj['id'],
                'name': obj['name'],
                'thumb_path': thumb_path,
                'stl_path': stl_path
            })
            all_meshes.append(obj['mesh'])

        # 生成整体缩略图（合并所有零件）
        combined = trimesh.util.concatenate(all_meshes) if len(all_meshes) > 1 else all_meshes[0]
        overall_thumb = os.path.join(output_dir, f"{basename}_thumb.png")
        overall_stl = os.path.join(output_dir, f"{basename}_export.stl")
        generate_thumbnail(combined, overall_thumb, size)
        combined.export(overall_stl)
        result['overall_thumb'] = overall_thumb
        result['overall_stl'] = overall_stl
        print(f"  整体缩略图: {overall_thumb}")
        print(f"  整体 STL: {overall_stl}")

        # 写入零件列表 JSON
        objects_json = os.path.join(output_dir, f"{basename}_objects.json")
        with open(objects_json, 'w', encoding='utf-8') as f:
            json.dump([
                {
                    'index': o['index'],
                    'id': o['id'],
                    'name': o['name'],
                    'thumb_file': os.path.basename(o['thumb_path']),
                    'stl_file': os.path.basename(o['stl_path'])
                }
                for o in result['objects']
            ], f, ensure_ascii=False, indent=2)
        result['objects_json'] = objects_json
        print(f"  零件列表: {objects_json}")

    else:
        # 单零件格式（STL/OBJ 等）
        scene_or_mesh = trimesh.load(input_path)
        if isinstance(scene_or_mesh, trimesh.Scene):
            meshes = [g for g in scene_or_mesh.geometry.values() if hasattr(g, 'vertices') and len(g.vertices) > 0]
            if not meshes:
                print("ERROR: No valid geometry found", file=sys.stderr)
                sys.exit(1)
            mesh = trimesh.util.concatenate(meshes)
        else:
            mesh = scene_or_mesh

        thumb_path = os.path.join(output_dir, f"{basename}_thumb.png")
        stl_path = os.path.join(output_dir, f"{basename}_export.stl")
        generate_thumbnail(mesh, thumb_path, size)
        mesh.export(stl_path)
        print(f"  缩略图: {thumb_path}")
        print(f"  STL: {stl_path}")
        result['overall_thumb'] = thumb_path
        result['overall_stl'] = stl_path
        result['objects'].append({
            'index': 0,
            'id': '0',
            'name': '整体',
            'thumb_path': thumb_path,
            'stl_path': stl_path
        })

    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Generate 3D model thumbnail & STL export (multi-object 3MF supported)')
    parser.add_argument('input', help='Input 3D model file path')
    parser.add_argument('output_dir', help='Output directory for thumbnails & STL')
    parser.add_argument('--size', type=int, default=512, help='Thumbnail size in pixels')
    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(f"ERROR: Input file not found: {args.input}", file=sys.stderr)
        sys.exit(1)

    process_file(args.input, args.output_dir, args.size)
