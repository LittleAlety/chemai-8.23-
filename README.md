# ChemAI — 三草酸合铁(III)酸钾制备实验 智能教学平台

[![Deploy](https://img.shields.io/badge/GitHub%20Pages-Live-brightgreen)](https://littlealety.github.io/chemai-8.6-/)
[![Version](https://img.shields.io/badge/version-v44-blue)](https://github.com/LittleAlety/chemai-8.6-)
[![FAQ](https://img.shields.io/badge/FAQ-3047条-green)](https://github.com/LittleAlety/chemai-8.6-)
[![Corpus](https://img.shields.io/badge/语料库-365篇-orange)](https://github.com/LittleAlety/chemai-8.6-)
[![KG](https://img.shields.io/badge/知识图谱-97节点-blueviolet)](https://github.com/LittleAlety/chemai-8.6-)
[![Videos](https://img.shields.io/badge/本地视频-4部-teal)](https://github.com/LittleAlety/chemai-8.6-)

**ChemAI** 是面向大学化学实验教学的 AI 智能平台，以 **三草酸合铁(III)酸钾 K₃[Fe(C₂O₄)₃]·3H₂O** 制备实验为核心，集成 **LLM-RAG 智能问答、知识图谱可视化、语料库文献检索、掌握度自适应测评、本地教学视频、深度问题自学习迭代**等功能，并内置 **4 部本地录制教学视频**（制备/性质/配离子电荷）与 **白天/夜晚双主题**（导航栏 🌓 一键切换，自动记忆偏好），构建"图文+视频+AI 问答"三位一体的学习闭环。

---

## 功能模块

| 页面 | 文件 | 说明 |
|------|------|------|
| **首页入口** | `index.html` | React SPA 首页，身份选择（非化学专业 / 化学专业 / 教师），含 LLM 配置面板；**视频资源库页**（`#/videos`）含 4 部本地视频 + 精选 bilibili 教学视频 |
| **AI 助手** | `assistant.html` | 多策略检索 + 类比推理 + DeepSeek RAG 问答；**3047 条 FAQ**（运行时 `data/faq_runtime.js`）；10 KP 掌握度自适应测评；三维度雷达图 + 学习建议；12 条 selfCheck；侧栏**视频资源板块内嵌 4 部本地视频播放器** |
| **实验手册** | `main.html` | 11 章全文浏览器，LaTeX 公式 Unicode 渲染 |
| **知识图谱** | `knowledge.html` | 97 节点 / 136 关联的交互式配位化学知识网络 |
| **语料库** | `corpus.html` | **365 篇**中英文文献知识清单，PDF/PPTX/DOCX 上传解析，子领域分布 + URL 深链 |
| **课前预习** | `prep.html` | 多轮对话预习 + 自适应习题检测 + 错题本 |

---

## 🎬 视频资源

- **4 部本地录制教学视频**（王志勇·制备、王志勇·性质与配离子电荷、胡锴·制备上/下），**ffmpeg 压缩至 <100MB** 后随仓库部署到 GitHub Pages，在线直接播放；
- 分布在两处：**SPA 视频资源库页**（`index.html#/videos`，置顶展示）与 **AI 助手侧栏**"视频资源"板块（本地优先 + bilibili 在线）；
- 原版大文件（~1GB）备份于 `三草酸合铁酸钾资料/三草酸合铁酸钾视频资料/_原版备份/`，不入库。

---

## 深度问题自学习迭代体系

通过 **多 Agent 集群 + 对抗评分代理** 持续生成、审计、修正实验问答与 FAQ，目前运行时 FAQ 累计 **3047 条**（含深度操作问答、全文献学习、教材校准、学术词表驱动四代迭代）。

### 迭代历程

| 版本 | 新增领域 | 题数 | 评审结果 |
|------|----------|:----:|:--------:|
| v36 | 检漏、滤纸润湿、冷却称量、铁氰化钾检验、倾滗、恒重判据 | 6 | — |
| v36.5 | 步骤顺序错误、操作变异、安全废液、数据处理 | ~40 | — |
| v37 | 浓度梯度、扩散动力学、缓冲化学、界面现象、热历史 | 50 | 含自检 |
| v37.5 | 交叉污染、搅拌模式、H₂O₂浓度、棉线、漏斗、步骤压缩、pH微环境、Ostwald熟化 | 30 | 23/30 ✓ |
| v38 | 温度测量校准、玻璃仪器、时间控制、观察记录、仪器故障、数据报告 | 30 | 4.2/5 |
| v39 | **试剂用量偏差**（逐步骤逐试剂分析 +/- 影响） | 26 | 6✓/19部分/1✗ |
| v40 | **表征分析**（磁化率、蓝晒、热分析、红外、紫外、KMnO₄滴定） | 27 | **27/27 ✓** |
| v41 | **全文献深度学习**（355 篇语料再学习，补蓝晒/摩尔盐/草酸配合物/综合研究）；按实验讲义权威对齐；六集群审计 ~188 处 | 57 新增 | 渲染审计 0 残留 |
| v43 | **语料驱动学术词表 + 关键词清洗 + 补新条目**：构建 `academic_lexicon.json`（432 学术词+94 实体词），全库 keys 去泛词、keys<3 归零，补 23 条新 FAQ | 23 新增 | 全量校验 0 错误 |

### 自学习增强机制

- **对抗评分**：化学正确性 / 定量精确度 / 逻辑完整性 / 教学清晰度 / 实验贴近度 5 维评审
- **双重评审**（v40+）：首轮评分+主动质疑 → 复核裁定+交叉一致性校验
- **参数锁定校验**：每轮强制对照基准配方（Ksp=3.2×10⁻⁷、6%H₂O₂=1.8M、干燥50°C、失水100°C、Fe=0.01275mol、理论产量6.26g）
- **知识权威层级**：实验讲义 > 文献 > 搜索；数值冲突一律以武汉大学实验讲义为准

---

## 技术架构

### AI 问答流水线 — 智能体集群

```
用户提问
  ↓
阶段 1：多策略检索（BM25 + IDF 加权 + 化学实体类比 + 方法学转移）
  ↓
阶段 2：类比推理引擎（24 组跨体系概念映射）
  ↓
阶段 3：置信度评分 + 混合答案生成（FAQ / 类比 / LLM / 网络回退）
  ↓
阶段 4：自检（12 条验证规则）
```

### 三页深度链接闭环

```
AI 助手 ──文献卡片/引用──→ 语料库（精确定位条目）
    ↑                          ↓
    └──知识延伸── 知识图谱 ──文献关联──┘
```

---

## 项目结构

```
chemai-8.6-/
├── index.html                 # 首页入口（React SPA，含视频资源库页）
├── assistant.html             # AI 助手（939 FAQ + 本地视频 + 测评）
├── main.html                  # 实验手册（11 章）
├── knowledge.html             # 知识图谱（97 节点 / 136 关联）
├── corpus.html                # 语料库（365 篇）
├── prep.html                  # 课前预习
├── data/
│   ├── faq_runtime.js        # 运行时 FAQ（v37.6+ 唯一真相源，3047 条，window.FAQ=）
│   ├── manual.json           # 实验手册（11 章 / 42 节）
│   ├── corpus.json           # 语料库清单（365 篇）
│   ├── images.json           # 实验图片索引（76 张）
│   ├── kg.json / questions_bank.json / report_rubric.json / faq_unified.json
│   └── academic_lexicon.json # 学术词表（dev-only，不部署）
│   # 其余 dev-only（不部署）：kb.json（遗留知识块，已被 FAQ 取代）、questions_master.json（题库池）、
│   #   categories.json、assessment_kp.json、lexicon_sources_dump.json、all_cycle_questions.json、faq_key_blacklist.json
├── assets/                    # CSS / JS（含 SPA 编译产物，已注入本地视频）
├── scripts/                   # 工具脚本（lib-assistant-faq.js、v44-inject-bundle.js 等）
├── Agent工作区/ 训练管道/ 诊断与调试/ 试题迭代记录/
├── 三草酸合铁酸钾资料/        # 原始语料 + 视频资料（含 _原版备份）
├── .github/workflows/deploy.yml  # GitHub Pages 自动部署（含视频文件夹）
└── README.md / DEPLOY.md
```

---

## 已知限制

- **SPA 落地页内嵌手册为历史快照**：`assets/index-B-pT4Snc.js`（React 落地页构建产物）内嵌旧 12 章版实验手册（含已删除的「实验报告撰写规范」章），与 `main.html` 的动态手册（11 章）分叉。React 源码未随仓库维护，暂不重建；**实验手册以 `main.html` 为准**。
- **本地视频部署依赖分支构建**：4 部本地视频位于 `三草酸合铁酸钾资料/三草酸合铁酸钾视频资料/`，是否在线可播取决于部署机制（内置「Deploy from a branch」会发布整个仓库根目录；`deploy.yml` 的 `_site` 精简组装不含该文件夹）。

---

## 快速开始

```bash
cd chemai-8.6-
python -m http.server 8080      # Python
# 或
npx serve .                     # Node.js
# 浏览器打开 http://localhost:8080/
```

> ⚠️ 必须通过 HTTP(S) 访问（`file://` 会导致 JSON 加载失败）；本地视频在 `file://` 下可正常播放。

### 启用 LLM

在「AI 助手」页面左侧 **🤖 LLM AI 配置** 面板粘贴 DeepSeek API Key 即可；不配置则自动回退本地检索 + 类比推理模式。

---

## 部署

GitHub Actions + GitHub Pages 自动部署：向 `master` 推送即触发，`deploy.yml` 拷贝页面 + `assets`/`data` + **视频文件夹**到 `_site`。详见 [DEPLOY.md](./DEPLOY.md)。

---

## 版本历史

| 版本 | 主要变更 |
|------|------|
| **v44** | **视频部署 + 界面美化**：①4 部本地教学视频 ffmpeg 压缩至 <100MB 入库 GitHub，Pages 直接服务（SPA 视频资源库页置顶 + assistant 侧栏内嵌播放器，`assets/index-B-pT4Snc.js` 注入本地视频条目）；②全站 ChemAI 艺术字（流动渐变 + 辉光 + 图标呼吸光晕）；③语料归类（10 文档入子文件夹）+ corpus.json 补 10 条（id 356-365，total 365）；④README 重写 |
| **v43** | **第三轮语料自学习**：语料驱动学术词表 `academic_lexicon.json`（432 学术词/94 实体词）；全库 916 条 FAQ keys/ents 清洗（去泛词 11 处、keys<3 归零、重复 key 归零）；gap 分析补 23 条新 FAQ（FAQ 916→939），新条目 keys 100% 取自词表 |
| **v42** | **基础教科书学习**：Greenwood/Housecroft 教材新增 26 条基础 FAQ，校准 Δo(oxalate)、d-d 自旋禁阻、Fe(SCN)₃ 等 11 处 |
| **v41** | **全文献深度学习 + 权威对齐**：355 篇语料再学习补 57 条 FAQ（833→890）；按武汉大学讲义全库对齐；六集群审计修正 ~188 处 |
| **v40** | 表征分析深度问答 27 题（27/27 正确）；语料库 291→355 篇；知识图谱深链关联 |
| **v39** | 试剂用量偏差专项 26 题 |
| **v38** | 深度问答 v2：30 题对抗评审（avg 4.2/5） |
| **v37.5** | 自学习循环 v1：30 题，23/30 正确 |
| **v37** | 50 条自检深度 FAQ |
| **v36** | 深度操作 FAQ + selfCheck 3 条 |
| **v35** | 答案格式大重构、ENT_TIPS 9→30、matchFAQ IDF 加权、110°C→50°C 修正 |
| **v33** | 智能体集群、知识图谱 82→97 节点、LaTeX 渲染 |
| v32.5 | 实验手册精简、苏格拉底自适应测评 + SVG 雷达图 |
| v32 | 知识图谱 55→77 节点、评估 8→12 KP |
| v31 | 共享 RAG 模块、FAQ 验证、KG 同步 |
| v30 | 6-dim 评分、700 FAQ、30 周期训练 |

---

## 致谢

- 武汉大学化学与分子科学学院
- 语料库收录的所有文献作者与期刊
- 王志勇、胡锴等提供的本地教学视频

---

## 许可证

本项目仅用于教育和研究目的。语料库中的文献版权归原出版方所有；代码部分采用 MIT License。
