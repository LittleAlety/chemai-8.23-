# ChemAI — 三草酸合铁(III)酸钾制备实验智能教学平台

[![Deploy](https://img.shields.io/badge/GitHub%20Pages-Live-brightgreen)](https://littlealety.github.io/chemai-7.20-/)
[![Version](https://img.shields.io/badge/version-v28-blue)](https://github.com/LittleAlety/chemai-7.20-)

**ChemAI** 是一个面向大学化学实验教学的 AI 智能平台，以 **三草酸合铁(III)酸钾 K₃[Fe(C₂O₄)₃]·3H₂O** 的制备实验为核心，集成 LLM-RAG 问答、知识图谱、语料库检索、自动出题与评分等能力。

---

## 功能模块

| 页面 | 文件 | 说明 |
|------|------|------|
| **AI 助手** | `assistant.html` | DeepSeek RAG 智能体，FAQ 634 条 + KB 1335 条 + 语料库 291 篇三层检索 |
| **首页入口** | `index.html` | React SPA 首页，含 LLM 配置面板 |
| **知识图谱** | `knowledge.html` | 配位化学 / 氧化还原 / 分析化学 / 物理化学四方向关联网络 |
| **语料库** | `corpus.html` | 291 篇中英文文献知识清单，支持 PDF 上传和在线检索 |
| **课前预习** | `prep.html` | 多轮对话预习 + 自适应习题检测 |
| **主面板** | `main.html` | 实验手册浏览器，12 章完整知识体系 |

---

## 技术架构

```
用户提问
  ↓
① FAQ 关键词匹配（634 条，17 分类）
  ↓
② KB BM25 全文检索（1335 条知识条目）
  ↓
③ 语料库文献检索（291 篇）
  ↓
④ DeepSeek LLM 基于检索结果精准回答
  ↓ （无匹配时）
⑤ 网络搜索引擎回退
```

- **前端**: 纯 HTML/CSS/JS，单文件 SPA，暗色主题
- **AI 引擎**: DeepSeek API（兼容 OpenAI），RAG 模式
- **检索引擎**: BM25 + FAQ 关键词命中 + 语料库打分 + bigram 模糊匹配
- **部署**: GitHub Pages 静态托管，零后端依赖
- **知识规模**: 634 FAQ + 1335 KB + 1113 试题 + 291 文献

---

## 快速开始

```bash
# 本地启动
cd chemai-7.20-
python -m http.server 8080
# 浏览器打开 http://localhost:8080/assistant.html
```

### 启用 LLM

在 `assistant.html` 左侧 **🤖 LLM 配置** 面板中粘贴 API Key 即可。不配置则自动回退本地检索模式。

---

## 项目结构（v28 总集架构）

```
chemai-7.20-/
│
├── assistant.html              # AI 助手主页（含嵌入式 FAQ + RAG + LLM 面板）
├── index.html                  # 首页入口
├── knowledge.html              # 知识图谱页面
├── corpus.html                 # 语料库页面
├── prep.html                   # 课前预习页面
├── main.html                   # 实验手册浏览器
│
├── run_pipeline.js             # 【总集】统一训练管线（甲-训练/乙-出题/丁-校验/丙-评分）
├── faq_tools.js                # 【总集】FAQ 管理工具（sync/merge/refine/add/apply-fixes/stats）
├── score_answers.js            # LLM-as-Judge 评分系统
├── evaluate.js                 # 本地 FAQ+KB 评测系统
├── gen_round3.js               # 第3轮试题生成器
├── eval_llm.js                 # LLM 评测脚本
├── train_faq.js                # FAQ 训练增强
├── debug_eval.js               # 调试工具：单选题 FAQ 匹配
├── debug_trace.js              # 调试工具：BM25 匹配追踪
│
├── data/
│   ├── faq_unified.json        # FAQ 知识库（634 条，17 分类）
│   ├── kb.json                 # 知识库（1335 条）
│   ├── manual.json             # 实验手册（12 章）
│   ├── corpus.json             # 语料库（291 篇文献）
│   ├── questions_master.json   # 【总集】全部试题（1113 题，17 分类）
│   ├── categories.json         # 权威分类体系（17 分类 + 别名映射）
│   ├── kg.json                 # 知识图谱节点数据
│   └── all_cycle_questions.json # 训练周期题目统计
│
├── reports_master.json         # 【总集】全部训练/评分/评测报告
│
├── scripts/
│   ├── category-utils.js       # 分类工具库（normalize / canonical / 别名处理）
│   ├── normalize-faq.js        # FAQ 分类归一化
│   ├── normalize-corpus.js     # 语料库分类归一化
│   ├── normalize-questions.js  # 试题分类归一化
│   └── verify-categories.js    # 分类一致性验证
│
├── assets/                     # CSS / JS / 字体 / 图片
├── README.md                   # 本文件
└── DEPLOY.md                   # 部署说明
```

---

## 知识体系：17 权威分类

题目和 FAQ 均基于统一的 **17 分类体系**（`data/categories.json`）：

| # | 分类 | 覆盖内容 |
|:--:|------|------|
| 1 | 合成制备 | 四步合成路线、投料比、产率计算 |
| 2 | 反应原理 | 氧化还原/配位反应方程式、机理、中间体 |
| 3 | 实验操作 | 过滤、结晶、洗涤、干燥、故障排查 |
| 4 | 分析测定 | KMnO₄ 滴定、标定、含量测定 |
| 5 | 光化学应用 | LMCT 机理、蓝晒工艺、避光操作 |
| 6 | 结构表征 | UV-Vis、IR、XRD、晶体结构、颜色 |
| 7 | 磁性研究 | 磁化率、磁矩、高自旋 d⁵ |
| 8 | 热分析 | TG-DSC、热分解、脱水温度 |
| 9 | 安全与废物处理 | MSDS、废液分类、急救措施 |
| 10 | 配位化学理论 | 晶体场理论、CFSE、Jahn-Teller |
| 11 | 实验教学 | 教学目标、思政素养、实验报告 |
| 12 | 综合研究 | 跨章综合、对比分析、前沿进展 |
| 13 | 化学史 | 配位化学发展史、诺贝尔奖、奠基人物 |
| 14 | 高等理论 | 量子化学、分子轨道、热力学参数 |
| 15 | 蓝晒工艺 | 光敏剂、曝光参数、显影定影 |
| 16 | 摩尔盐相关 | 莫尔盐制备、纯度分析 |
| 17 | 草酸配合物 | 草酸根配位模式、对比研究 |

---

## 四代理训练管线

```
甲 (Trainer)      乙 (Generator)      丁 (Validator)       丙 (Scorer)
  FAQ缺口分析  →   全分类精准出题  →   逐题手册校验  →   RAG + 4维LLM评分
  FAQ补全修复       17分类遍历        章节引用验证        准确性/完整性
  HTML同步          难度/题型分配     问题分类追踪        来源引用/清晰度
```

### 运行方式

```bash
# 完整模式：10 轮 × 102 题/轮，17 分类全覆盖
node run_pipeline.js --mode full --cycles 10

# 快速模式：10 轮 × 50 题/轮，14 分类
node run_pipeline.js --mode quick --cycles 10

# 单轮 200 题加权分配模式
node run_pipeline.js --mode single

# 同步 FAQ 到 HTML
node run_pipeline.js --sync-html
```

### FAQ 工具

```bash
node faq_tools.js sync              # FAQ → assistant.html
node faq_tools.js merge             # 合并多个 FAQ 源文件
node faq_tools.js refine            # 自动分类 + 质量检查
node faq_tools.js apply-fixes <file> # 应用训练修复
node faq_tools.js stats             # FAQ 统计
```

---

## 训练历史

| 版本 | 管线 | 轮次 | 模型 | FAQ 增长 | 均分趋势 |
|------|------|:--:|------|------|------|
| v1 | 5-cycle | 10 | deepseek-chat | 538 → 548 | 79.8 → 67.5 |
| v2 | 10-cycle | 10 | deepseek-v4 | 548 → 605 | 64.9 → 72.5 |
| v3 | 4agents-200q | 1 | deepseek-v4 | 625 → 634 | — |

> 详细数据见 `reports_master.json`

---

## 许可证

本项目仅用于教育和研究目的。语料库中的文献版权归原出版方所有。

---

## 致谢

- 武汉大学化学与分子科学学院基础化学实验教学团队
- Alfred Werner（配位化学奠基人）
- DeepSeek API
- 语料库收录的所有文献作者
