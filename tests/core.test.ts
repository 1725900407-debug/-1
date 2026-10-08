import test from 'node:test';
import assert from 'node:assert/strict';
import { coreScenarios, getScenario, scenarios } from '../shared/scenarios';
import { demoFeedback, demoRecap, demoTurn } from '../server/demo';
import { feedbackSchema, recapSchema } from '../shared/types';
import type { Message, SimConfig } from '../shared/types';
import { emptyStore, parseChat, parseImport } from '../src/storage';
test('题库各级12题，包含成年人、多种反馈与不发送选项；所有演示参考结构有效',()=>{
  assert.equal(coreScenarios.length,36);assert.equal(scenarios.filter(s=>s.transfer).length,7);
  for(const level of ['基础','进阶','综合'])assert.equal(coreScenarios.filter(s=>s.level===level).length,12);
  assert.equal(new Set(scenarios.map(s=>s.id)).size,scenarios.length);
  for(const s of scenarios){assert(s.age>=18);assert(s.messages.length>0);assert.equal(s.examples.length,3);assert(feedbackSchema.safeParse(demoFeedback(s,s.examples[0],false)).success);}
  for(const mood of ['积极','中性','消极'])assert(coreScenarios.some(s=>s.mood===mood));
});
test('尊重明确边界，沉默与持续追问不会被同样评估',()=>{
  const s=getScenario('35')!;const silence=demoFeedback(s,'',true);const pressure=demoFeedback(s,'但是你必须给我一个机会，怎么不回我？',false);
  assert(silence.scores.find(s=>s.dimension==='分寸与边界')!.value>pressure.scores.find(s=>s.dimension==='分寸与边界')!.value);
  assert(pressure.issues.includes('邀约分寸'));assert(!silence.issues.length);
  assert(demoFeedback(getScenario('02')!,'你在哪？做什么？为什么？什么时候？',false).issues.includes('连续提问'));
});
test('正常表达好感不扣边界分，一个嗯不自动判定拒绝',()=>{
  const feedback=demoFeedback(getScenario('16')!,'和你聊天很开心，我期待下次见。',false);
  assert(!feedback.issues.includes('邀约分寸'));
  const recap=demoRecap([{role:'me',text:'今天看了场电影。'},{role:'other',text:'嗯'}],'review');
  assert.notEqual(recap.next.action,'结束交流');assert(recap.uncertainties.length>0);
  assert.notEqual(demoRecap([{role:'me',text:'一起约会？'},{role:'other',text:'我想先多聊聊，暂时不约。'}],'review').next.action,'结束交流');
  assert.equal(demoRecap([{role:'other',text:'上午很忙'},{role:'me',text:'最近喜欢看什么？'},{role:'other',text:'最近看了一部电影，结尾挺有意思。'}],'review').next.action,'继续聊');
});
test('角色分支保持固定事实，尊重拒绝，完成5轮并复盘',()=>{
  const config:SimConfig={background:'活动认识',familiarity:'刚认识',personaId:'quiet',goal:'延续话题',coach:true,rounds:5};
  const messages:Message[]=[{role:'other',text:'今天在改图，刚忙完。'}];
  const lines=['最近看什么电影？','我也喜欢日常题材电影。','你周末有什么兴趣？','周六下午一起散步吗？','好，那周六下午见。'];
  for(const text of lines){messages.push({role:'me',text});const turn=demoTurn(config,messages);messages.push({role:'other',text:turn.message});}
  assert(messages.some(m=>m.text.includes('《完美的日子》')));assert(messages.some(m=>m.text.includes('城西')));assert.equal(messages.filter(m=>m.role==='me').length,5);
  assert(recapSchema.safeParse(demoRecap(messages,'simulation')).success);
  const early=demoTurn(config,[{role:'me',text:'一起约会吧？'}]);assert(early.message.includes('暂时不约'));
  const stop=demoTurn(config,[{role:'me',text:'你必须给我机会'}]);assert.equal(stop.suggestedEnd,true);
});
test('导入验证版本和内容，格式不明的文本需要手工标记',()=>{
  assert.deepEqual(parseImport(JSON.stringify(emptyStore())),emptyStore());
  assert.throws(()=>parseImport('{"version":999}'));
  assert.throws(()=>parseImport('x'.repeat(5_000_001)));
  assert.equal(parseChat('我：你好\n对方：你好').unmarked,false);
  assert.equal(parseChat('你好\n她：你好').unmarked,true);
  assert.equal(parseChat('me: hi\nother: hello').messages[1].role,'other');
});
