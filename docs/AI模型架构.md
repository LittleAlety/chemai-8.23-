# ChemAI 助手「AI 神经网络模式」说明

> 本文如实说明 assistant 答题所采用的 AI 机制。**没有任何"被训练的神经网络"用于检索排序**——检索是一条**固定权重、手调、无梯度**的线性打分层；真正含"神经网络"的是**生成与评分**所用的 DeepSeek Transformer 大语言模型（其权重由 DeepSeek 训练，ChemAI **不微调、不改权重**）。以下按数据流分层描述，并诚实标注哪些是"学习"，哪些只是"配置"。

---

## 〇、一句话总览

> **ChemAI 助手 = 确定性检索-评分层（手调权重，无学习）→ 确定性计算层（公式引擎）→ DeepSeek Transformer LLM 生成层（唯一含"神经网络"、权重冻结）→ LLM-as-Judge 评分层（自学习闭环门禁）**

- 检索排序不依赖 embedding 向量、不依赖反向传播、没有单层或多层感知机——它是一张**人工设定权重的打分表**。
- 全系统唯一的神经网络是 **DeepSeek LLM**（托管 API，权重由厂商训练，ChemAI 侧 zero fine-tuning）。
- "自学习/训练"在 ChemAI 语境里指的是**数据策展 + 门禁式增强**，不是梯度下降（详见 §6）。

---

## 层 1 · 确定性检索-评分层（手调权重，无学习）

这一层没有任何可学习参数，所有权重都是**代码里的常数**，跨训练轮次稳定。

### 1.1 语料检索 `searchCorpus`（assistant.html:1028+；local_answer.js 镜像）
对每条语料按字段命中加权，`score = Σ 字段最高命中权重 + 概念提升 + 反馈净重 + 权威度提升(v85)`：

| 字段 | 命中权重 |
|---|---|
| questions | 10 |
| title | 6 |
| content | 6 |
| objects / methods | 4 |
| abstract | 4 |
| subfield | 3 |

- **概念→子领域提升** `CONCEPT_BOOST`：通用概念词直接映射到对应子域（如「原理/方程式/制备」→合成制备 +8，「产率/测定/含量」→分析测定 +8，蓝晒/光化学/磁化率/莫尔盐/热分析 各 +8）。
- **反馈净重**：用户 👍/👎 按语料 id 聚合成 clamp(±3) 的加法项。
- **权威度提升（v85 新增）**：`score += entryAuthority[id].boosted × CORPUS_AUTH_BOOST(≈4)`。`entryAuthority[id]` 由 `训练管道/corpus_weight_analysis.js` 离线计算（`A(id) = 0.40·doctype + 0.20·abstract_type + 0.20·depth + 0.20·metadata_completeness`，再乘子域反挤占 boost）。**纯加法、门禁级**：只在已命中（`score>0`）的条目上锦上添花，不改基础公式；`corpus_weights.json` 缺失时退化为现行行为。
- **HIT_THRESHOLD = 6**：低于该分视为未命中。

### 1.2 FAQ 检索 `matchFAQ`（assistant.html:1134+；local_answer.js 镜像）
对每条 FAQ 计算主题匹配分：

```
score = keyScore + entScore + longKey×0.5 + lenBonus + titleTopical + distinctHits×2
```
- `keyScore`：命中 keys 的加权和，命中项乘 IDF 惩罚（高频通用词降权，如「实验/制备/化学」）；泛词（`GENERIC_KEYS`）与化学实体词（`CHEM_NOUN`）不当作"显著词"。
- `entScore`：命中的化学实体，权重 2 / 1。
- `longKey`：长 key（≥4字）追加 0.5。
- `lenBonus`：`min(2, len/800)`，条目越长越高（更完整者占优）。
- `titleTopical`：标题主题命中 +5（子域命中 +3）。
- `distinctHits×2`：不同命中项的区分奖励。
- 防御性惩罚：**精确命中题目原文 `exactQ`/长问题 +200**；**操作步骤模板（OP_RE）整体 ×0.12**；**跨实验室防护（OTHER_OX）×0.03**；**firehose 阻尼**：keys 超过 `FH_THRESH=45` 且标题未印证时用 `sqrt` 削弱宽泛条目。

> ⚠️ 纪律：`matchFAQ` 基础打分公式与各项惩罚 **永不改动**（改动必回归）。v85 的语料权威度只落在 `searchCorpus`、`buildLLMContext`、`relatedFAQs`，不进 `matchFAQ`。

### 1.3 置信度评分 `confidenceScore`（assistant.html:1304+；local_answer.js 镜像）
```
scores.corpus = min(1, maxDirectScore / 60)       # 语料最高命中分归一
scores.faq    = faqConfidence(maxDirectScore)      # = 0.5 + maxDirectScore×0.01，clamp [0.5,0.95]
scores.analogy= min(1, analogyCount×0.15)
scores.overall= max(corpus, faq, analogy×0.6)
level = overall≥0.7? high : (≥0.35? medium : low)
```

### 1.4 相关问答 / 类比桥接
- `relatedFAQs`：按 ents/keys 命中给相关 FAQ 打分 + **子域偏好（v85）**：依据问题主导语料子域 → 语料→FAQ 映射，给被映射子域的 FAQ 加 `link.w×3` 的小分。
- 类比推理表 `ANALOG_TABLE` + `retrieval2_chemicalAnalogy` / `retrieval3_methodologyTransfer`：把查询映射到既有化学原理（草酸根配位、H₂O₂ 氧化、乙醇析晶、磁化率测定、KMnO₄ 滴定等），用于"超出精确匹配但仍可推导"的题。

---

## 层 2 · 确定性计算层 `scripts/lib-calc.js`（公式引擎）

对**任意数值输入**按化学公式当场计算，不背诵 FAQ 里写死的示例值：

- `formulaMass` / `molarMassOf`：化学式解析 → 摩尔质量（先查 `KNOWN_MASS` 表，再回落公式解析）。
- `theoreticalYield(mMohr)`：`n = m/392.14; m_theo = n×491.25`（Fe 守恒）。
- `yieldPct(mActual, mTheory)`；`crystalWaterPct()` = `3×18.02/491.25`；`magneticMoment(n)` = `√[n(n+2)]`；`kmno4OxalatePct`（滴定）；`mean`/`rsd`。
- 权威常数：莫尔盐 392.14、产物 491.25、6% H₂O₂=8mL、烘干 50℃、失水 ~100℃。

命中可计算模式（产率|摩尔质量|结晶水|滴定|RSD|磁矩）时，答案正文由公式算出并顶到最前（"计算通用"）。

---

## 层 3 · DeepSeek Transformer 大语言模型（生成层）——**唯一的神经网络**

- **调用**：`callLLM`（assistant.html:774+），端点 `api.deepseek.com/v1/chat/completions`，`model=deepseek-chat`（默认）/ `deepseek-v4-flash`，`temperature=0.2`，`max_tokens=1000`，SSE 流式，指数退避重试 ×3。
- **上下文** `buildLLMContext`（assistant.html:874+）：`matchFAQ` top-1 + `searchCorpus(q,6)` 经 `pickAuthoritative` 取 top-2（v85 权威优先 + 子域多样性）→ 组装成 `<corpus-context>…</corpus-context>` 作为用户消息，防止 Prompt Injection。
- **角色镜头**：按身份（非化学/化学专业/教师）调整口吻与深度。
- **性质**：这是托管的大语言模型，**权重由 DeepSeek 训练，ChemAI 侧零微调、零反向传播**。ChemAI 只提供 prompt（systemPrompt 以武汉大学实验讲义为最高权威、数值以讲义为准、禁止编造）。
- **网络结构本质**：DeepSeek 采用**多层 Transformer 解码器**（自注意力 + 前馈），是真正的神经网络；但其**权重在 ChemAI 中冻结**，ChemAI 没有对它做任何训练/梯度更新。

---

## 层 4 · LLM-as-Judge 评分层（自学习闭环门禁）

- `_score_baseline.js`：跑 `local_answer.answer(q)` → LLM 对每条 0-10 打分，**GATE = 9.5**；判官 rubric：准确 + 覆盖参考答案要点（数值/步骤/机理）+ 与讲义一致；`≥9.5` 通过、`6-9` 部分、`<6` 跑题/漏要点；**严禁一律满分或一律压分**。结果写 `Agent工作区/Agent-报告/self_train_baseline_scores.json`。
- `self_train.js`：生成 → 本地回复 → 判官 → 三优化（Opt1 加 keys、Opt2 加 detail、Opt3 覆盖已交由确定性覆盖补录）→ 确定性覆盖补录 → `v45-round.js` 注入 FAQ。
- `run_pipeline.js`：五智能体（戊-语料校准器 → 甲-训练器 → 乙-生成器 → 丁-校验器 → 丙-评分器），判官维度 `RUBRIC_ANCHORS`：准确 30 / 完整 20 / 化学规范 15 / 来源 15 / 清晰 10 / 安全 10 = **100**。
- `agentCorpusCalibrator`：走语料库给 FAQ 答案补 `answer/detail/corpus_refs` 校准。

---

## 诚实说明：「训练 / 自学习」到底改了什么？

| 词 | ChemAI 实际含义 |
|---|---|
| 训练/自学习 | **数据策展 + 门禁式增强**：改 FAQ 的 keys/ents/answer/detail、补覆盖条目、扩充 lexicon、语料回填、corpus 权威度离线计算。 |
| 检索器权重 | **未变**：`matchFAQ` / `searchCorpus` 的字段权重与惩罚全是手调常数，跨轮次稳定。 |
| 梯度下降/反向传播 | **无**（不存在）。 |
| LLM 微调 | **无**。DeepSeek 权重冻结，只换 prompt。 |

真正的"学习信号"只在两处：**① LLM-as-Judge 的评分门槛（≥9.5）**决定哪些修改进入 FAQ；**② 语料→权威度/映射**是离线统计导出（不是训练）。二者都**不改变检索器打分公式**。

---

## 为什么这样设计（与"AI 宣传"的差别）＆ 好处

- **没有检索器神经网络 / embedding / 本地模型**：检索打分表可读、可调、可解释。
- **可复现**：同一问题在 `local_answer.js`（无头）与浏览器得到一致结果（官方逐字镜像）。
- **可离线调试**：改权重后跑 `_score_baseline.js` 即可回归，不依赖线上。
- **LLM 只负责"生成措辞"**，不负责"判断哪个文献权威"——权威性由层1（手调权重 + 离线 corpus 权威度）决定，降低幻觉与不稳定。

---

## 局限

1. **检索不学习**：对同义词、长问题敏感；泛词（GENERIC_KEYS）可能让宽泛条目抢走细问（靠 firehose 阻尼 + exactQ +200 缓解）。
2. **LLM 幻觉**：仅靠 systemPrompt（以讲义为最高权威、禁止编造）+ `<corpus-context>` 隔离压制，无 RAG 幻觉校验层。
3. **语义检索缺失**：无 embedding 向量检索，纯关键词/带权命中；相近词但不同字面可能漏检。
4. **v85 权威度是离线统计**：基于 doctype/depth/元数据，非内容语义；`corpus_weights.json` 更新需重跑 `npm run corpus:weights`。
5. **任何未来权重再调**：属 gate 级，须跑 `local_answer.js` 回归；严禁改动 `matchFAQ` 基础打分公式。

---

## 附 · 学习式重排器对比实验（v87）：手工检索为何保留

在本文"检索非神经网络"的论断上，我们**真的训练了一个学习式重排器来对比**（`训练管道/mlp_reranker.js`）：

- **模型**：8 维内容重叠特征（query↔keys/ents/title/answer/subfield 的 bigram 重叠、query 长度、keys/ents 数），8→20(ReLU)→1(sigmoid)，**202 个可训练参数**，从零实现 **Adam + 反向传播** + BCE，40 epochs。特征**不含 `q==entry.q` 的精确命中**——避免记忆化，只学内容重叠。
- **数据/标签（无泄漏）**：FAQ 条目的 `q`（≥6字）与其自身构成正样本，采 ~8 个**对抗性近邻硬负样本**；**按题目切分** 80/20，测试题在训练中未出现。
- **诚实评测（全库 4547 条检索）**：

| top-1 | 原题 | 改写题(novel) |
|---|---|---|
| MLP 重排器 | 39.2% | **3.9%** |
| 手工 `matchFAQ` | **95.3%** | **17.3%** |

- **结论**：训练出的学习式重排器**打不过手工精调**的 `matchFAQ`——尤其改写题上差距显著（3.9% vs 17.3%）。`matchFAQ` 由 IDF 惩罚、实体加权、titleTopical、firehose `sqrt` 阻尼、步骤模板抑制、跨实验守卫等多年迭代的手工特征构成，一个 202 参数的 MLP 无法复刻。**因此保留手工检索、不上本地神经网络**——这一"无检索神经网络"的架构选择由**实证**支撑，而非仅口头声明。
- **说明**：① exact-q 对比偏向 matchFAQ（它含 +200 精确命中，近似记忆化查找，而实验禁止 MLP 用该特征）；但**改写题是公平对比，matchFAQ 仍胜**。② 即便 MLP 胜出也只是 research artifact——静态站无推理后端，与本文"无本地检索 NN"一致。

---

*版本：v87 · 2026-09 · 与本仓库代码同步。*
