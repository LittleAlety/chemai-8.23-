# ChemAI — 三草酸合铁(III)酸钾制备实验 智能教学平台

[![Deploy](https://img.shields.io/badge/GitHub%20Pages-Live-brightgreen)](https://littlealety.github.io/chemai-8.6-/)
[![Version](https://img.shields.io/badge/version-v33-blue)](https://github.com/LittleAlety/chemai-8.6-)
[![FAQ](https://img.shields.io/badge/FAQ-700条-green)](https://github.com/LittleAlety/chemai-8.6-)
[![Corpus](https://img.shields.io/badge/语料库-291篇-orange)](https://github.com/LittleAlety/chemai-8.6-)

**ChemAI** 是一个面向大学化学实验教学的 AI 智能平台，以 **三草酸合铁(III)酸钾 K₃[Fe(C₂O₄)₃]·3H₂O** 的制备实验为核心，集成 LLM-RAG 智能问答、知识图谱可视化、语料库文献检索、掌握度自适应测评、实验报告多维评估等功能。

---

## 功能模块

| 页面 | 文件 | 说明 |
|------|------|------|
| **首页入口** | `index.html` | React SPA 首页，身份选择（非化学专业 / 化学专业 / 教师），含 LLM 配置面板 |
| **AI 助手** | `assistant.html` | 多策略检索 + 类比推理引擎 + DeepSeek RAG 问答；12 知识点掌握度自适应测评（苏格拉底式引导对话），含三维度雷达图 + 掌握度分布直方图 + 综合评语 + 学习建议，支持导出 Word/TXT |
| **实验手册** | `main.html` | 11 章全文浏览器，左侧目录导航 + 右侧内容区，LaTeX 公式 Unicode 渲染（非斜体），响应式布局 |
| **知识图谱** | `knowledge.html` | 82 节点 / 115 关联的 Canvas 交互式配位化学知识网络，边标签 + 节点脉冲动画 + KaTeX 公式渲染 + 迷你地图 + 语料文献关联 |
| **语料库** | `corpus.html` | 291 篇中英文文献知识清单，支持 PDF/PPTX/DOCX 上传解析、子领域分布条形图、学习迭代报告 |
| **课前预习** | `prep.html` | 多轮对话预习 + 自适应习题检测 + 错题本 |

---

## 技术架构

### AI 问答流水线（v33 — 智能体集群）

```
用户提问
  ↓
阶段 1：多策略检索
  ├─ 直接关键词搜索语料库（BM25 加权）
  ├─ 化学实体类比检索（同子领域相似结构/性质条目）
  └─ 方法学转移检索（相同操作术语跨体系匹配）
  ↓
阶段 2：类比推理引擎
  ├─ 比较问题术语与已知概念库
  ├─ 识别跨化学体系的模式（K₃[Fe(C₂O₄)₃] → K₃[Cr(C₂O₄)₃] 等）
  └─ 无直接匹配时生成"通过类比"桥接解释
  ↓
阶段 3：置信度评分 + 混合答案生成
  ├─ 语料库命中高 → 标准模板答案
  ├─ 命中低但类比存在 → 类比桥接 + 通用化学知识模板
  └─ 无命中 → LLM 回答（如已配置）或网络回退
  ↓
阶段 4：自检
  └─ 验证基础化学概念一致性、标注不确定内容
```

- **前端**: 纯 HTML/CSS/JS，Canvas 知识图谱，暗色主题，LaTeX Unicode 渲染，响应式适配手机/平板/桌面
- **AI 引擎**: DeepSeek API（兼容 OpenAI），RAG 模式，支持流式输出，可切换模型
- **检索引擎**: BM25 + 化学实体加权 + 类比概念扩展 + FAQ 倒排索引
- **部署**: GitHub Pages 静态托管，零后端依赖
- **知识规模**: 700 FAQ + 291 文献 + 82 知识图谱节点 + 1113 试题

### 类比知识库

AI 助手内置 20+ 组化学概念类比映射，涵盖配合物制备、电导率测定、光谱表征、热分析、磁性研究等领域，使系统能够将三草酸合铁酸钾实验中建立的知识迁移至相关化学问题。

---

## 快速开始

```bash
# 本地启动（二选一）
cd chemai-8.6-
python -m http.server 8080           # Python
npx serve .                          # Node.js (serve)
# 浏览器打开 http://localhost:8080/
```

> ⚠️ 必须通过 HTTP(S) 访问，直接双击 `index.html`（file://）会导致 JSON 数据加载失败。

### 启用 LLM

在「AI 助手」页面左侧 **🤖 LLM AI 配置** 面板中粘贴 DeepSeek API Key 即可。不配置则自动回退本地检索 + 类比推理模式。

---

## 项目结构

```
chemai-8.6-/
│
├── index.html                   # 首页入口（React SPA）
├── assistant.html               # AI 助手（智能体集群 + 类比推理 + 掌握度测评 + 评估报告）
├── main.html                    # 实验手册浏览器（11 章全文）
├── knowledge.html               # 知识图谱（82 节点 Canvas 交互式网络）
├── corpus.html                  # 语料库管理（文献搜索/上传/学习迭代）
├── prep.html                    # 课前预习（对话 + 习题 + 错题本）
│
├── run_pipeline.js              # 五代理训练管线
├── faq_tools.js                 # FAQ 管理工具集
├── score_answers.js             # LLM-as-Judge 6 维评分系统
├── evaluate.js                  # 本地 FAQ+KB 评测
├── train_faq.js                 # FAQ 训练增强
├── gen_round3.js                # 试题生成器
├── eval_llm.js                  # LLM 评测
├── debug_eval.js                # 调试：FAQ 匹配
├── debug_trace.js               # 调试：BM25 追踪
│
├── data/
│   ├── faq_unified.json         # FAQ 知识库（700 条，17 分类）
│   ├── manual.json              # 实验手册（11 章）
│   ├── corpus.json              # 语料库清单（291 篇文献）
│   ├── kg.json                  # 知识图谱（82 节点 / 115 关联）
│   ├── kb.json                  # 知识库
│   ├── questions_master.json    # 全部试题（1113 题）
│   ├── categories.json          # 权威分类体系
│   ├── assessment_kp.json       # 测评知识点映射
│   └── all_cycle_questions.json # 各周期题目统计
│
├── assets/                      # CSS / JS / KaTeX 字体 / 第三方库
├── scripts/                     # 工具脚本（分类、FAQ、语料处理）
├── .github/workflows/deploy.yml # GitHub Pages 自动部署
├── README.md                    # 本文件
└── DEPLOY.md                    # 部署说明
```

---

## 知识体系

所有 FAQ、试题和评分均遵循统一的 **17 分类体系**：

| # | 分类 | 核心内容 |
|:--:|------|------|
| 1 | 合成制备 | 四步合成路线、投料比、产率计算 |
| 2 | 反应原理 | 氧化还原/配位反应方程式、机理 |
| 3 | 实验操作 | 过滤、结晶、洗涤、干燥、故障排查 |
| 4 | 分析测定 | KMnO₄ 滴定、标定、含量测定 |
| 5 | 光化学应用 | LMCT 机理、蓝晒工艺、避光操作 |
| 6 | 结构表征 | UV-Vis、IR、XRD、晶体结构 |
| 7 | 磁性研究 | 磁化率、磁矩、高自旋 d⁵ |
| 8 | 热分析 | TG-DSC、热分解、失重分析 |
| 9 | 安全与废物处理 | MSDS、废液分类回收、急救 |
| 10 | 配位化学理论 | 晶体场理论、CFSE、光谱化学序 |
| 11 | 实验教学 | 教学目标、思政素养、考核方式 |
| 12 | 综合研究 | 跨章综合、对比分析、前沿进展 |
| 13 | 化学史 | 配位化学发展史、诺贝尔奖 |
| 14 | 高等理论 | 量子化学计算、分子轨道 |
| 15 | 蓝晒工艺 | 光敏剂、曝光参数、显影定影 |
| 16 | 摩尔盐相关 | 莫尔盐制备、性质、纯度 |
| 17 | 草酸配合物 | 草酸根配位模式、对比研究 |

---

## 掌握度测评

12 个知识点 × 多轮自适应对话 × 苏格拉底式引导：

- **8 个基础知识点**：实验目的、反应原理、试剂仪器、操作流程、产率计算、误差分析、安全废液、配合物稳定性
- **4 个进阶知识点**：配位化学理论、磁性研究、结构表征、热分析
- **测评报告**：总分 + 等级 + 三维度雷达图 + 掌握度分布直方图 + 知识点得分排序 + 综合评语 + 针对性学习建议
- **导出格式**：Word (.doc) / TXT (.txt)，含完整测评数据和学习建议

---

## 部署

本项目使用 **GitHub Actions + GitHub Pages** 自动部署。向 `master` 分支推送后自动触发。

```yaml
# .github/workflows/deploy.yml
push to master → checkout → 组装静态站点 → upload artifact → deploy to Pages
```

### 手动部署

详见 [DEPLOY.md](./DEPLOY.md)，支持 Python / Nginx / Apache / Docker 四种方案。

---

## 语料库来源

291 篇中英文文献，涵盖：

- **中文期刊**: 大学化学、化学教育、化学通报、无机化学学报 等
- **英文期刊**: *Journal of Chemical Education*, *Inorganic Chemistry*, *Polyhedron*, *Coordination Chemistry Reviews* 等
- **内容**: 三草酸合铁酸钾的合成、热分解、晶体结构、光化学性质、磁性、实验教学设计

---

## 版本历史

| 版本 | 主要变更 |
|------|------|
| **v33** | 智能体集群（多策略检索 + 类比推理引擎 + 置信度评分 + 自检）；知识图谱增强（82 节点 / 115 关联 / 边标签 / 节点脉冲动画 / KaTeX / 迷你地图）；报告评估增强（详细综合评语 / 三维度诊断 / 学习建议 / 打印样式表）；移动端全面响应式优化；代码清理；LaTeX 非斜体渲染 |
| v32.5 | 实验手册精简（ch5-12 压缩）；知识图谱美化（响应式布局 / 渐变标签淡入 / 贝塞尔曲线边 / 悬浮发光）；苏格拉底自适应测评 + SVG 雷达图 + 掌握度直方图 |
| v32 | 知识图谱 55→77 节点；评估 8→12 KP with 3-dim 分析；LaTeX 评分；计时追踪；4 个新进阶主题 |
| v31 | 共享 RAG 模块；FAQ 验证；47 个测试；KG 同步命令 |
| v30 | 基于 v4 流水线的 README 重写；6-dim 评分；700 FAQ；30 周期训练历史 |

---

## 致谢

- Alfred Werner（配位化学奠基人，1866–1919）
- DeepSeek API
- 语料库收录的所有文献作者与期刊

---

## 许可证

本项目仅用于教育和研究目的。语料库中的文献版权归原出版方所有。代码部分采用 MIT License。
