# Agent 工作区

存放多 Agent 训练管道的中间输出和最终产物。

## Agent-B 问题生成
生成考试题目，按轮次（r1/r2/r3/400）分代输出 JSON。

## Agent-C 答案评分
对 Agent-B 生成的题目进行答案评测和评分。

## Agent-D 验证
对评分结果进行验证和纠错。

## Agent-优化
对低分题目的答案进行多轮优化（pass1/final/improved）。

## Agent-报告
各轮次的汇总报告和最终审计报告。
