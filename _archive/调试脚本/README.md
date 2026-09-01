# _archive/调试脚本/ 清单

> v85 重组时把**根目录散落的 `_*` 一次性调试/探针脚本**归档到此，按用途分 7 组。
> 全部是 **一次性诊断/探针工具**，不在产品（7 个 HTML + assets/data）运行链上，也不被生产脚本 require。
> 想复现某次诊断时按组说明 + 脚本内注释运行；**无日常维护义务**。相关产物备份见 `_archive/数据备份/`。

| 组 | 类别 | 用途 |
|---|---|---|
| 01-faq注入 | 注入/回调 | 修改 `faq_runtime.js` 的临时注入与修复脚本（curate/coverage/fix），读写运行时 FAQ |
| 02-求和数据 | 数据 | 求和各题集的字段总和；`_r2/_rg/_prb*.json` 是对应题集的中间数据 |
| 03-答非所问 | 诊断 | 排查步骤题「答非所问」：跑题集 → 结果 → shotgun 归因 → 滑窗 n-gram 修剪 → 低分溯源 |
| 04-探针集 | 探针 | 各版本探针题集与被测集合（probe/regress/round2q），用于回归采样 |
| 05-导出 | 导出 | 把 FAQ / 题集 dump 成可读文件供复查 |
| 06-验证引用 | 验证 | 验证 local_answer 引用/复刻一致性、round4 题集合并、LLM 判分调试 |
| 07-工作流 | 工作流 | `_score_workflow.js` = Claude Workflow skill 定义（`export const meta`，评分流水线） |

---

## 01-faq注入 — 临时注入/修复 faq_runtime.js
一组**一度用于离线增补/修复运行时 FAQ**的脚本（产线后来用 `训练管道/inject_authoritative_facts.js` 幂等注入，故这些为一次性遗留）。
- `_curate.js` `_curate2.js` `_curate3.js` `_curate4.js` —— FAQ 条目人工增补/修正（版本递进）
- `_coverage.js` `_coverage2.js` —— 覆盖率补录（对照 coverage 门禁）
- `_fix3.js` `_fix4.js` `_fix5.js` `_fix6.js` `_fix7.js` —— 逐轮修复（错键/别名/重复位）
- `_analyze.js` —— 分析运行时 FAQ 结构/键分布

## 02-求和数据 — 题集字段求和的中间数据
- `_sum.js` `_sum2.js` —— 求和脚本
- `_r2.json` `_rg.json` `_prb.json` `_prb4b.json` `_prb5.json` —— 对应题集/探针集的中间数据

## 03-答非所问 — 步骤题问答错位诊断
> 根因已查明并修复：条目 `keys` 含滑窗 n-gram → 删滑窗 key 即可（`_trim_ngram.js`），**不要**全局改 scorer。
- `_runQ.js` —— 跑题集取回复
- `_questions.json` `_results.json` —— 题集与逐题回复结果
- `_shotgun.js` —— scatter-gun 归因（哪些 key 把评分打散）
- `_trim_ngram.js` —— 删除 keys 里的滑窗 n-gram（零风险修法）
- `_lowsrc.js` —— 低分题溯源

## 04-探针集 — 回归/采样探针
- `_probe2.json` `_probe4.json` `_probe5.json` —— 各版本探针题集
- `_probe3.js` —— 生成/使用探针的脚本
- `_regress.json` —— 回归采样集合
- `_round2q.json` —— round2 题目抽样

## 05-导出 — FAQ/题集导出复查
- `_dump.js` `_dump6.js` `_dumpA.js` —— 导出工具（输出可读文件供人工复查）

## 06-验证引用 — local_answer 复刻/引用一致性验证
- `_verify.js` `_verify_p1.js` `_verify_p2.js` `_verify_r4.js` —— 无头验证 local_answer 命中/聚合/数值一致
- `_merge_r4.js` —— 合并 round4 两份题集（计算 90 + 操作 110 → 200 题，四份交付物）
- `_refs.js` `_refs4.js` `_reflog.js` —— 引用/反查日志工具
- `_inspectkeys.js` —— 检查条目 keys
- `_dbg_llm.js` —— LLM 判分/回复调试

## 07-工作流 — Claude Workflow skill
- `_score_workflow.js` —— `export const meta` 的 Claude Workflow 评分流水线定义（多智能体判分）
