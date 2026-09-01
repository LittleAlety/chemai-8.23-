const fs = require('fs'), https = require('https'), path = require('path');
const envPath = path.join(process.env.USERPROFILE, '.codex/skills/claude-vision/.env');
const env = fs.readFileSync(envPath, 'utf8');
const get = k => { const m = env.match(new RegExp('^' + k + '=(.*)', 'm')); return m ? m[1].trim() : ''; };
const KEY = get('DASHSCOPE_API_KEY');
const BASE = (get('DASHSCOPE_BASE_URL') || 'https://dashscope.aliyuncs.com/compatible-mode/v1').replace(/\/$/, '');
const MODEL = 'deepseek-v4-flash';
const SCORE = '你是 ChemAI 评分官。对每条给出"AI助手本地回复"对照"标准参考答案"的评分，满分10分。只输出 JSON 数组，每项：{"question":"原题","score":0-10小数一位,"accuracy":0-10,"completeness":0-10,"manualCompliance":0-10,"why":"一句原因","missing":"缺漏要点"}。评分准则：回复准确且覆盖参考答案关键点且与讲义一致→9.5以上；部分覆盖→6-9；答非所问/缺失关键→<6。严禁一律给满分或一律压分。';
const USER = '请按标准参考答案给 AI 助手本地回复评分(0-10)：\n' + JSON.stringify({ question: '制备K3[Fe(C2O4)3]·3H2O实验中称取5.00g莫尔盐，求理论产量(g)', referenceAnswer: '6.26 g(6.26 g)', assistantAnswer: '【计算】理论产量=6.26g' }, null, 2);
const body = JSON.stringify({ model: MODEL, messages: [{ role: 'system', content: SCORE }, { role: 'user', content: USER }], max_tokens: 16000, temperature: 0, reasoning_effort: 'low' });
const req = https.request(BASE + '/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEY } }, r => {
  const c = []; r.on('data', x => c.push(x)); r.on('end', () => { const d = Buffer.concat(c).toString('utf8'); console.log('status', r.statusCode); console.log('RAW:', d.slice(0, 1200)); });
}); req.on('error', e => console.log('ERR', e.message)); req.write(body); req.end();
