# ChemAI 化学实验教学智能体 · 部署指南

本文档说明如何将本网站完整部署到你自己的服务器。网站为**纯静态站点**（无需 Node.js、数据库或构建步骤），外加一个可选的语料云端同步接收端（Python）。

> 网站文件位于**仓库根目录**（无 `app/` 子目录），部署时直接发布仓库根目录即可；线上由 GitHub Pages 分支构建 + `.github/workflows/deploy.yml` 组装发布。

---

## 一、文件结构

```
├── index.html          # 首页（React SPA：身份选择/视频库/习题/错题本等）
├── main.html           # 主页（实验手册全文，11 章 42 节）
├── assistant.html      # AI助手（FAQ 问答 + 掌握度测评 + 4 部本地视频）
├── knowledge.html      # 知识图谱（123 节点 / 195 关联）
├── prep.html           # 课前预习
├── corpus.html         # 语料库管理（445 篇，上传/学习迭代/云端同步）
├── generator.html      # 智能命题（教师组卷，教师门禁）
├── docs/
│   ├── AI模型架构.md   # AI「神经网络模式」说明（诚实的工程架构）
│   └── 语料权重分析报告.md
├── DEPLOY.md           # 本文档
├── assets/
│   ├── index-*.js      # 主应用（React SPA，已压缩）
│   ├── index-*.css     # 样式
│   ├── images/         # 实验图片（76 张，经 data/images.json 接入）
│   ├── KaTeX_*.woff/woff2/ttf   # 公式字体
│   └── vendor/         # 第三方库（jszip、pdf.js 等）
├── data/               # 运行时数据（deploy.yml 组装 10 个）
│   ├── faq_runtime.js  # 运行时 FAQ（3326 条，唯一真相源）
│   ├── corpus.json     # 语料库清单（445 篇）
│   ├── corpus_weights.json # 语料权威度权重（离线生成，v85）
│   ├── manual.json     # 实验手册（11 章 42 节）
│   ├── images.json     # 图片索引（76 张）
│   ├── kg.json         # 知识图谱（123 节点 / 195 关联）
│   └── categories.json / questions_bank.json / report_rubric.json / faq_unified.json
└── scripts/
    ├── lib-calc.js     # 通用计算引擎（assistant.html 运行时加载，deploy.yml 必须复制）
    └── corpus-server.py # 可选：语料云端同步接收端
```

## 二、快速部署（任选其一）

> 必须通过 HTTP(S) 访问，直接双击 index.html（file://）会导致数据文件无法加载。

### 方案 A：Python（最简）
```bash
cd <仓库根目录>
python3 -m http.server 8080
# 访问 http://服务器IP:8080/
```

### 方案 B：Nginx
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/chemai;        # 上传整个仓库根目录到此
    index index.html;
    location / { try_files $uri $uri/ /index.html; }
    location ~* \.(js|css|json|woff2?|ttf)$ {
        expires 7d;
        add_header Cache-Control "public";
    }
}
```

### 方案 C：Apache
将仓库根目录放入站点根目录，并启用 `.htaccess`：
```apache
DirectoryIndex index.html
FallbackResource /index.html
```

### 方案 D：Docker
```dockerfile
FROM nginx:alpine
COPY . /usr/share/nginx/html/
EXPOSE 80
```
```bash
docker build -t chemai . && docker run -d -p 8080:80 chemai
```

## 三、可选：语料云端同步服务

网站「语料库」页支持把上传解析的文献同步到云服务器。接收端参考实现已随包提供：

```bash
python3 scripts/corpus-server.py 8765
# 启动后接口为 http://你的服务器:8765/api/corpus
```

然后在网站「语料库 → 云端同步」面板中填入该地址并开启自动同步即可。
- 接收端按 id 合并去重后持久化到 `scripts/cloud_corpus.json`
- 支持 GET /api/corpus 查看已接收语料、GET /api/health 健康检查；已处理 CORS
- 生产环境建议用 Nginx 反代并加 HTTPS 与访问鉴权

## 四、使用说明

1. **身份选择**：打开首页选择身份（非化学专业/化学专业/教师）→ 进入主页（实验手册全文）。
2. **权限**：实验报告检测评估仅「教师」可用；科普探索仅「非化学专业」可用。
3. **AI助手**：直接问答走「知识清单检索→文献→网络回退」流程；掌握度测评为多轮自适应对话，可导出评估报告（Word/TXT）。
4. **实验报告评估**：教师上传 DOCX 实验报告，系统自动提取文字与图片并按 6 维度（满分100）评估。
5. **语料库**：支持上传 pdf/pptx/docx，自动解析入库、触发学习迭代；数据保存在浏览器 localStorage，配置云端同步后可上传服务器。

## 五、注意事项

- 首次打开会向 kimi.com 请求一个统计 SDK（不可达不影响功能）；本地 4 部视频随仓库部署，在线直接播放；离线环境显示占位。
- 各页面数据通过相对路径加载 `data/*.json`，部署时请保持目录结构完整。
- 如需修改语料/图谱/手册内容，直接编辑 `data/` 下对应 JSON 即可。
- 语料权威度权重 `data/corpus_weights.json` 由离线作业生成：`npm run corpus:weights`（`node 训练管道/corpus_weight_analysis.js`，无需 LLM）。若改动 `data/corpus.json` 或 `data/categories.json`，请重跑该脚本再部署，否则运行时权威度加成未更新。
