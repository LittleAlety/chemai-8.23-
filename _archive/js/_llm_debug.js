const https = require('https');
const KEY = process.env.DEEPSEEK_KEY;
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';
const sys = '你是 ChemAI 实验课程高级出题官，依据武汉大学实验讲义出题。只输出 JSON 数组，不要 Markdown。每项：{"question":"题目","referenceAnswer":"参考答案"}。要求题目有深度。';
const user = '请生成 2 道关于三草酸合铁酸钾制备实验的高深度题目。';
const body = JSON.stringify({ model: MODEL, messages: [{ role: 'system', content: sys }, { role: 'user', content: user }], max_tokens: 2000, temperature: 0.3 });
const req = https.request('https://api.deepseek.com/v1/chat/completions', {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEY }
}, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    console.log('HTTP', res.statusCode);
    try {
      const j = JSON.parse(d);
      const content = j.choices[0].message.content;
      console.log('===== 原始返回 =====');
      console.log(content);
      console.log('===== 长度:', content.length, '=====');
      // 测试 parseJSON
      try {
        const fence = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        const raw = fence ? fence[1] : content;
        const s = raw.indexOf('['), e = raw.lastIndexOf(']');
        console.log('fence:', !!fence, '| [@', s, ']@', e);
        if (s >= 0 && e > s) { JSON.parse(raw.slice(s, e + 1)); console.log('parseJSON OK'); }
        else console.log('parseJSON 失败');
      } catch (err) { console.log('parse err:', err.message); }
    } catch (e) { console.log('JSON解析失败:', e.message, d.slice(0, 400)); }
  });
});
req.on('error', e => console.error('req err', e.message));
req.write(body);
req.end();
