# ChemAI — 三草酸合铁(III)酸钾制备实验 智能教学平台

[![Deploy](https://img.shields.io/badge/GitHub%20Pages-Live-brightgreen)](https://littlealety.github.io/chemai-8.6-/)
[![Version](https://img.shields.io/badge/version-v32.5-blue)](https://github.com/LittleAlety/chemai-8.6-)
[![FAQ](https://img.shields.io/badge/FAQ-700条-green)](https://github.com/LittleAlety/chemai-8.6-)
[![KB](https://img.shields.io/badge/知识库-1335条-orange)](https://github.com/LittleAlety/chemai-8.6-)

**ChemAI** 是一个面向大学化学实验教学的 AI 智能平台，以 **三草酸合铁(III)酸钾 K₃[Fe(C₂O₄)₃]·3H₂O** 的制备实验为核心，集成 LLM-RAG 问答、知识图谱、语料库检索、自动出题与评分、实验报告评估等能力。

---

## 功能模块

| 页面 | 文件 | 说明 |
|------|------|------|
| **首页入口** | `index.html` | React SPA 首页，身份选择（非化学专业 / 化学专业 / 教师），含 LLM 配置面板 |
| **AI 助手** | `assistant.html` | DeepSeek RAG 智能体，三层检索（FAQ → KB → 语料库）+ 12 知识点掌握度自适应测评 + 3 维度分析报告（含 SVG 雷达图 + 掌握度分布直方图） |
| **主面板** | `main.html` | 实验手册全文浏览器，12 章 47 节完整知识体系，支持 PDF 导出 |
| **知识图谱** | `knowledge.html` | 77 节点 / 76 关联的配位化学知识网络，图谱-语料互通 |
| **语料库** | `corpus.html` | 291 篇中英文文献知识清单，支持 PDF/PPTX/DOCX 上传解析与云端同步 |
| **课前预习** | `prep.html` | 多轮对话预习 + 自适应习题检测 |

---

## 技术架构

```
用户提问
  ↓
① FAQ 关键词 + Bigram 倒排索引匹配（700 条，17 分类）
  ↓
② KB BM25 全文检索（1335 条知识条目）
  ↓
③ 语料库 BM25 文献检索（291 篇 SCI/EI 论文）
  ↓
④ DeepSeek LLM 基于检索结果精准回答
  ↓  （无匹配时）
⑤ 网络搜索引擎回退
```

- **前端**: 纯 HTML/CSS/JS，React SPA，暗色主题，LaTeX 全页面渲染（Unicode 转换 + 内联数学）
- **AI 引擎**: DeepSeek API（兼容 OpenAI），RAG 模式，可切换模型
- **检索引擎**: BM25 + FAQ 倒排索引 + 语料库打分 + Bigram/Jaccard 语义去重
- **部署**: GitHub Pages 静态托管，零后端依赖
- **知识规模**: 700 FAQ + 1335 KB + 1113 试题 + 291 文献

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

在「AI 助手」页面左侧 **🤖 LLM 配置** 面板中粘贴 DeepSeek API Key 即可。不配置则自动回退本地检索模式。

---

## 项目结构

```
chemai-8.6-/
│
├── index.html                   # 首页入口（React SPA）
├── assistant.html               # AI 助手主页（嵌入式 FAQ + RAG + LLM 面板 + 评测）
├── main.html                    # 实验手册浏览器
├── knowledge.html               # 知识图谱页面
├── corpus.html                  # 语料库管理页面
├── prep.html                    # 课前预习页面
│
├── run_pipeline.js              # 【总集】五代理训练管线（戊-语料校准/甲-训练/乙-出题/丁-校验/丙-评分）
├── faq_tools.js                 # 【总集】FAQ 管理工具（sync/merge/refine/add/apply-fixes/stats）
├── score_answers.js             # LLM-as-Judge 6 维评分系统
├── evaluate.js                  # 本地 FAQ+KB 评测系统
├── train_faq.js                 # FAQ 训练增强
├── gen_round3.js                # 试题生成器
├── eval_llm.js                  # LLM 评测脚本
├── debug_eval.js                # 调试工具：单选题 FAQ 匹配
├── debug_trace.js               # 调试工具：BM25 匹配追踪
├── fix_faq.py                   # FAQ 自动修复 / 重分类（Python）
├── questions_200_fullset.py     # 200 题加权分配生成器
│
├── data/
│   ├── faq_unified.json         # FAQ 知识库（700 条，17 分类全覆盖）
│   ├── kb.json                  # 知识库（1335 条）
│   ├── manual.json              # 实验手册（12 章 47 节，核心实验操作详细，补充知识精简）
│   ├── corpus.json              # 语料库（291 篇中英文文献，含 DOI/摘要/知识清单）
│   ├── questions_master.json    # 【总集】全部试题（1113 题，17 分类）
│   ├── categories.json          # 权威分类体系（17 分类 + 别名映射）
│   ├── kg.json                  # 知识图谱节点数据（77 节点 / 76 关联）
│   ├── assessment_kp.json       # 掌握度测评 12 知识点映射
│   └── all_cycle_questions.json # 各周期题目统计
│
├── reports_master.json          # 【总集】11 次训练/评分/评测完整报告
├── agent_*.json                 # 各代理输出文件（试题/答案/评分/校验）
├── test_questions_core_*.json   # 各轮次试题快照（C1-C18）
│
├── assets/                      # CSS / JS / KaTeX 字体 / 第三方库（jszip / pdf.js / mammoth）
├── scripts/
│   ├── category-utils.js       # 分类工具库
│   ├── normalize-*.js          # 各数据源分类归一化
│   └── verify-categories.js    # 分类一致性验证
│
├── .github/workflows/deploy.yml # GitHub Pages 自动部署
├── README.md                    # 本文件
└── DEPLOY.md                    # 部署说明
```

---

## 知识体系：17 权威分类

所有 FAQ、试题和评分均遵循统一的 **17 分类体系**（`data/categories.json`）：

| # | 分类 | 核心内容 |
|:--:|------|------|
| 1 | 合成制备 | 四步合成路线、投料比、产率计算 |
| 2 | 反应原理 | 氧化还原/配位反应方程式、机理、中间体 |
| 3 | 实验操作 | 过滤、结晶、洗涤、干燥、故障排查 |
| 4 | 分析测定 | KMnO₄ 滴定、标定、含量测定 |
| 5 | 光化学应用 | LMCT 机理、蓝晒工艺、避光操作、量子产率 |
| 6 | 结构表征 | UV-Vis、IR、XRD、晶体结构、颜色外观、晶系 |
| 7 | 磁性研究 | 磁化率、磁矩、高自旋 d⁵、磁天平 |
| 8 | 热分析 | TG-DSC、热分解、脱水温度、失重分析 |
| 9 | 安全与废物处理 | MSDS、废液分类回收、急救措施 |
| 10 | 配位化学理论 | 晶体场理论、CFSE、Jahn-Teller、光谱化学序 |
| 11 | 实验教学 | 教学目标、思政素养、实验报告、考核方式 |
| 12 | 综合研究 | 跨章综合、对比分析、前沿进展 |
| 13 | 化学史 | 配位化学发展史、诺贝尔奖、奠基人物 |
| 14 | 高等理论 | 量子化学计算、分子轨道、热力学参数 |
| 15 | 蓝晒工艺 | 光敏剂、曝光参数、显影定影、图像质量 |
| 16 | 摩尔盐相关 | 莫尔盐制备、性质、纯度分析 |
| 17 | 草酸配合物 | 草酸根配位模式、对比研究 |

---

## 五代理增强训练管线（v4）

```
阶段0: 戊 (Corpus Calibrator) → 遍历 291 篇语料库文献校准全部 FAQ
─── 训练循环 1-N ───
甲 (Trainer)  ──→  乙 (Generator)  ──→  丁 (Validator)  ──→  丙 (Scorer)
 FAQ缺口分析       全分类精准出题       逐题手册校验        RAG + 6维LLM评分
 FAQ补全/丰富      17分类遍历           章节引用验证        准确性/完整性/规范
 自适应分配        难度/题型配比        问题分类追踪        来源引用/清晰度/安全
```

### 6 维评分标准（满分 100）

| 维度 | 分值 | 评分规则 |
|------|:--:|------|
| 事实准确性 | 0-30 | 0=完全错误 · 10=方向对但有误 · 20=基本正确 · 30=完全正确含精确数值/方程式 |
| 完整性 | 0-20 | 0=未回答 · 7=部分要点 · 14=大部分 · 20=全面覆盖 |
| 化学规范性 | 0-15 | 0=口语化 · 5=有化学式缺规范 · 10=基本规范 · 15=完美（上下标/单位/Δ 齐全） |
| 来源引用 | 0-15 | 0=无引用 · 5=模糊 · 10=≥1明确引用 · 15=≥2精确引用（DOI/语料#ID/FAQ标题） |
| 表述清晰度 | 0-10 | 0=混乱 · 4=可读 · 7=有条理 · 10=逻辑严密/分层/术语准确 |
| 安全性提示 | 0-10 | 0=未提及 · 3=笼统 · 7=具体风险 · 10=GHS/防护/应急处理 |

### 运行方式

```bash
# 完整模式：30 轮 × 102 题/轮，17 分类全覆盖（约 25 小时）
node run_pipeline.js --mode full --cycles 30

# 快速模式：10 轮 × 50 题/轮，14 分类
node run_pipeline.js --mode quick --cycles 10

# 单轮 200 题加权分配模式
node run_pipeline.js --mode single

# 同步 FAQ 到 HTML
node run_pipeline.js --sync-html

# 断点续跑（默认开启，--no-resume 禁用）
node run_pipeline.js --mode full --cycles 30 --resume
```

### FAQ 工具

```bash
node faq_tools.js sync              # FAQ → assistant.html 同步
node faq_tools.js merge             # 合并多个 FAQ 源文件
node faq_tools.js refine            # 自动分类 + 质量检查
node faq_tools.js apply-fixes <file> # 应用训练修复
node faq_tools.js stats             # FAQ 统计
```

---

## 训练历史

| # | 版本 | 管线 | 轮次 | 模型 | FAQ 增长 | 均分范围 | 均分均值 |
|:--:|------|------|:--:|------|------|------|:--:|
| 1 | v1-10cycle | 4-agent v1 | 10 | deepseek-chat | 538 → 548 | 67.5 – 81.6 | 71.6 |
| 2 | v2-10cycle-full | 4-agent v2 | 10 | deepseek-v4-pro | 548 → 605 | 54.0 – 75.3 | 69.2 |
| 3 | v3-4agent-200q | 4-agent single | 1 | deepseek-v4-pro | 634 → 634 | — | 90.9 |
| 4 | v4-5agent-30c | **5-agent v4** | **30** | deepseek-v4-pro | 645 → 709 | 60.2 – 80.8 | **68.0** |

| 指标 | v32.5 最新状态 |
|------|:--:|
| 知识图谱节点 | **77** 节点 / 76 关联 |
| 评估知识点 | **12** 个（含 4 个进阶：配位化学理论/磁性/结构表征/热分析） |
| 测评维度 | **3 维度**分析（理论基础/实验技能/综合应用），含 SVG 雷达图 |
| 公式渲染 | LaTeX 全页面 Unicode 渲染（$$...$$ 块 + $...$ 内联） |
| 实验手册 | 12 章 47 节 · 核心实验操作详细 · 补充知识精简 |
| 武汉大学 | 已从教学内容中移除，仅保留为文献来源 attribution |
| 总耗时 | 1511 分钟（约 25 小时） |
| FAQ 净增长 | +64 条 |
| 出题总量 | 3059 题 |
| 17 分类覆盖 | ✓ 全覆盖（零盲区） |

> 详细数据见 `reports_master.json`（11 次完整训练记录）

---

## 部署

本项目使用 **GitHub Actions + GitHub Pages** 自动部署。向 `master` 分支推送后自动触发部署流水线。

```yaml
# .github/workflows/deploy.yml
push to master → checkout → 组装静态站点 → upload artifact → deploy to Pages
```

### 部署内容

| 页面文件 | 数据目录 |
|------|------|
| `index.html` `main.html` `assistant.html` | `data/`（全部 JSON） |
| `knowledge.html` `prep.html` `corpus.html` | `assets/`（全部静态资源） |

### 手动部署到其他服务器

详见 [DEPLOY.md](./DEPLOY.md)，支持 Python / Nginx / Apache / Docker 四种方案。

---

## 语料库来源

语料库收录 291 篇中英文文献，涵盖：

- **中文期刊**: 大学化学、化学教育、化学通报、无机化学学报 等
- **英文期刊**: *Journal of Chemical Education*, *Inorganic Chemistry*, *Polyhedron*, *Coordination Chemistry Reviews* 等
- **内容主题**: 三草酸合铁酸钾的合成、热分解、晶体结构、光化学性质、磁性、实验教学设计

---

## 致谢

- 武汉大学化学与分子科学学院（文献来源 attribution，教学部分已移除）
- Alfred Werner（配位化学奠基人，1866–1919）
- DeepSeek API
- 语料库收录的所有文献作者与期刊

---

## 许可证

本项目仅用于教育和研究目的。语料库中的文献版权归原出版方所有。代码部分采用 MIT License。
