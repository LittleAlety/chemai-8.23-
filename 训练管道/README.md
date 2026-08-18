# 训练管道

多 Agent 协作训练流水线的核心脚本。运行时 FAQ 真相源为 `data/faq_runtime.js`（`window.FAQ=`，v37.6+ 外置），管道通过 `scripts/lib-assistant-faq.js` 的 `readFAQRuntime`/`writeFAQRuntime` 读写，不再改动 `assistant.html`。

## 当前自训练流水线（v43+）

| 文件 | 用途 |
|------|------|
| `self_train.js` | **自训练主编排器**：出题→审核→本地回复→评分(门禁9.5)→三优化→确定性覆盖注入→多轮循环；含 `validateQuestionSet()`（重复 id 自动修复） |
| `local_answer.js` | 浏览器端 `handleQA` 本地路径复刻（从 faq_runtime 解析 FAQ），self_train/finalize/generalize 共用 |
| `finalize.js` / `finalize_fast.js` | 卡点修复：低分题 answer=参考答案+清 detail → 复评至全达标 |
| `precision_finalize.js` | 精准兜底：保证每题命中自己的 q=原文 条目（注入/强化 key/置回答案，幂等） |
| `generalize.js` / `generalize_r2.js` / `generalize_r2b.js` | FAQ 泛化实验：逐题专属条目聚类为通用条目（设计上与逐题注入方向相反） |
| `dedup_generic.js` | 通用条目去重合并（产出 dedup_groups，需人工确认后 --dry 预览再写回） |

## 早期五 Agent 管线（v30 时代，已由 self_train 取代）

| 文件 | 用途 |
|------|------|
| `run_pipeline.js` | 五 Agent 训练管线主入口（DeepSeek API） |
| `gen_round3.js` | 第三轮题目生成 |
| `score_answers.js` | LLM-as-Judge 六维评分 |
| `evaluate.js` | 本地 FAQ + KB 评测（含章节映射） |
| `eval_llm.js` | LLM 评测脚本 |
| `train_faq.js` | FAQ 训练增强（⚠ DEPRECATED，勿运行） |
| `faq_tools.js` | FAQ 管理工具集 |
| `fix_faq.py` | FAQ 修复（Python） |
| `fix_faq_data.js` | FAQ 数据修复 |
| `questions_200_fullset.py` | 200 题全量生成 |
| `gen_questions.ps1` / `merge_questions.ps1` | 辅助脚本 |
