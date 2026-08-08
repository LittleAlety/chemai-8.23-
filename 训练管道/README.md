# 训练管道

多 Agent 协作训练流水线的核心脚本。

| 文件 | 用途 |
|------|------|
| `run_pipeline.js` | 五 Agent 训练管线主入口（DeepSeek API） |
| `gen_round3.js` | 第三轮题目生成 |
| `score_answers.js` | LLM-as-Judge 六维评分 |
| `evaluate.js` | 本地 FAQ + KB 评测 |
| `eval_llm.js` | LLM 评测脚本 |
| `train_faq.js` | FAQ 训练增强 |
| `faq_tools.js` | FAQ 管理工具集 |
| `fix_faq.py` | FAQ 修复（Python） |
| `fix_faq_data.js` | FAQ 数据修复 |
| `questions_200_fullset.py` | 200 题全量生成 |
| `gen_questions.ps1` / `merge_questions.ps1` | 辅助脚本 |
