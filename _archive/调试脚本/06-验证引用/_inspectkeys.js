'use strict';
const faqLib = require('./scripts/lib-assistant-faq.js');
const arr = faqLib.readFAQRuntime();
[1345, 1403, 1720, 1557, 462, 964, 214].forEach(i => {
  console.log('#idx' + i + ' "' + arr[i].title.slice(0, 42) + '" keysLen=' + (arr[i].keys || []).length);
  console.log('   keys: ' + JSON.stringify((arr[i].keys || []).slice(0, 50)));
});
