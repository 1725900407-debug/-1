import type { Feedback, Message, Recap, Scenario, SimConfig, Turn, Skill } from '../shared/types';
import { dimensions } from '../shared/types';
import { getPersona } from '../shared/personas';

export function demoFeedback(s: Scenario, answer: string, silence: boolean): Feedback {
  const text = silence ? '（选择不继续发消息）' : answer.trim();
  const questions = (text.match(/[？?]/g) ?? []).length;
  const pressure = /必须|给个机会|不回我|怎么不回|为什么不回|不准|就这一次|别拒绝|我都.*了|请不要再发.*但是/.test(text);
  const insult = /舔狗|蠢|笨蛋|真笨|废物|没救|活该|丑|胖子/.test(text);
  const mindReading = /肯定.*喜欢|一定.*喜欢|秒回.*喜欢|回得慢.*讨厌|故意.*不回|朋友圈.*不回/.test(text);
  const apologyOverload = (text.match(/对不起|抱歉/g) ?? []).length > 2;
  const boundary = s.id === '35';
  const tooEarly = (s.category === '破冰' || s.familiarity === '刚认识') && /约会|做我女朋友|在一起|我爱你|宝贝|老婆/.test(text);
  const missedCue = !silence && !s.cues.some(c=>text.includes(c));
  const long = text.length > 180;
  const issues: Skill[] = [];
  if (questions > 2) issues.push('连续提问');
  if (long || apologyOverload) issues.push('解释过多');
  if (insult) issues.push('玩笑尺度');
  if (pressure || tooEarly || (boundary && !silence)) issues.push('邀约分寸');
  if (mindReading) issues.push('解读速度');
  if (missedCue && /我.{5,}/.test(text) && s.category === '回应情绪') issues.push('只谈自己');
  if (text === '随便' || text === '都行' || text === '你决定吧') issues.push('表达想法');
  const quote = text.length > 100 ? text.slice(0,100) : text;
  let finding = '这条回复表达了一个想法；演示规则还不能判断它是否准确接住了上下文。';
  let explanation = '这段是你的实际输入。演示模式只检查字数、问号和部分词语，语气、反讽和真实关系需要人工结合背景判断。';
  if (silence) { finding=s.allowSilence?'选择留出空间，符合这题的练习方向。':'这题有主动表达的空间；选择暂不回复也可以，但会少一次交流机会。'; explanation=s.allowSilence?'背景允许等待或结束，不需要用补发消息证明关心。':'对方提供了可接住的信息；不发送也是选择，需要考虑自己是否还想交流。'; }
  else if (boundary) { finding='对方已经明确要求停止，此时继续发送会越过她表达的边界。'; explanation='无论措辞是否客气，对方已经说了“请不要再发”，更合适的行动是停止发送。'; }
  else if (pressure) { finding='部分措辞可能让对方觉得需要解释或答应你，建议先减轻压力。'; explanation='这里触发了催促或要求的关键词。它也可能是引用或玩笑，需结合整句话复核；若确实在要求答复，换成可选择的提议更稳妥。'; }
  else if (insult) { finding='这句里有容易被理解为贬低的词，先检查玩笑是否针对了人。'; explanation='关系尚未建立时，贬低词可能比玩笑意图更显眼。即便关系熟悉，也需要看对方是否接受。'; }
  else if (questions > 2) { finding='一次放了多个问题，对方可能不知道先回答哪一个。'; explanation=`检测到 ${questions} 个问号，连续提问可能像面试；可以保留最贴近当前信息的一个。问号计数不等于语义判断。`; }
  else if (long) { finding='信息量较多，可以挑一件最想说的事，让回复容易被接住。'; explanation=`本次输入 ${text.length} 字。长回复并非错误，但在不熟悉的聊天里，多个重点可能增加回应负担。`; }
  else if (!missedCue) { finding='回复提到了本题的具体信息，有一个可以继续交流的落点。'; explanation='检测到与情境相关的词。这是有限的词语匹配，不保证整句话的语气或含义合适。'; }
  const score = (n:number) => Math.max(1,Math.min(5,n));
  const values = silence ? (s.allowSilence?[5,4,4,5,4]:[2,3,2,4,2]) : [missedCue?2:4,long?2:4,missedCue?2:4,boundary||pressure||insult||tooEarly?1:4,questions>2||long?2:4];
  const reasons = silence ? ['考虑了当前互动是否需要继续。','不需要为了练习强行发言。','没有回应文字，但给了空间。','尊重对方的自主选择。','“便于继续”也包括恰当地暂停或结束。'] : [missedCue?'未匹配到本题线索词，需要人工看是否回应了语义。':'出现了情境线索词，仍需看完整意思。',long?'信息量偏多，可尝试缩短。':'长度适中；演示规则不能判断全部口语风格。',missedCue?'暂未识别出对对方信息的回应。':'有具体落点，不只是笼统寒暄。',boundary?'对方已要求停止，应选择不发送。':pressure||insult||tooEarly?'触发了边界相关词语，请结合原句确认。':'未触发明显催促或贬低关键词；不代表所有边界都已检查。',questions>2?'多个问题可能增加回应负担。':'有可回应的内容，也允许对方暂时不接。'];
  const stylePrefix = !silence && !issues.length && /^你好/.test(text) && !s.examples[0].startsWith('你好') ? '你好，' : '';
  const evidence=[{quote,explanation}];
  const pressureWord=text.match(/必须|给个机会|怎么不回|为什么不回|不回我|不准|就这一次|别拒绝/)?.[0];
  const insultWord=text.match(/舔狗|蠢|笨蛋|真笨|废物|没救|活该|丑|胖子/)?.[0];
  const matchedCue=s.cues.find(c=>text.includes(c));
  if(!silence&&pressureWord)evidence.push({quote:pressureWord,explanation:`“${pressureWord}”可能把愿不愿意回应变成需要满足你的要求。若是在引用或否定这种说法，演示规则可能误判，请看完整语义。`});
  else if(!silence&&insultWord)evidence.push({quote:insultWord,explanation:`“${insultWord}”容易让注意力落在被评价或被贬低上，而不是玩笑中的共同经历。是否合适还要看对方是否接得住。`});
  else if(!silence&&matchedCue)evidence.push({quote:matchedCue,explanation:`“${matchedCue}”和当前情境有具体联系，可以成为落点；词语匹配本身不能保证你已经回应了对方的意思。`});
  return {
    summary:finding,evidence,
    scores:dimensions.map((dimension,i)=>({dimension,value:score(values[i]),reason:reasons[i]})),
    interpretations:[
      {tone:'积极',text:silence?'可能感到自己的时间和选择被尊重。':'可能理解为你在认真接话，愿意分享真实感受。',dependsOn:'取决于此前互动是否顺畅，以及她此刻是否有交流意愿。'},
      {tone:'中性',text:silence?'也可能只是忙自己的事，并未对沉默作特别解读。':'可能只是把它当作普通聊天，并不赋予关系上的含义。',dependsOn:`角色的习惯是“${s.personality}”；字数和回复速度不能单独代表态度。`},
      {tone:'不太舒服',text:issues.length?'可能觉得被催促、被评价，或一次需要回应太多内容。':'如果此刻很忙，也可能觉得暂时没有精力接话。',dependsOn:'这些只是可能性，需看具体用词、熟悉程度和连续互动，不能由本工具判断真实内心。'},
    ],
    rewrites:s.examples.map((example,i)=>({style:(['保留表达风格','自然简洁','轻松一点／稳妥回应'] as const)[i],text:i===0?stylePrefix+example:example,improvement:i===0?'保留直接表达的方向，并贴近情境；演示模式只能做有限风格适配。':i===1?'集中到一个重点，降低对方接话的负担。':s.category==='回应情绪'||s.mood==='消极'||s.allowSilence?'此处优先稳妥回应或留白，不强加幽默。':'围绕共同事件增加一点轻松感，不拿对方的人格或外貌开玩笑。'})),
    principle:s.principle,issues:[...new Set(issues)],strengths:[silence?'愿意把“等待或结束”也作为选择。':questions<=1?'没有连续抛出多个问题。':'愿意把真实会发送的文字拿来练习。'],
  };
}

export function demoTurn(config: SimConfig, messages: Message[]): Turn {
  const p = getPersona(config.personaId);
  const last = [...messages].reverse().find(m=>m.role==='me')?.text ?? '';
  const n = messages.filter(m=>m.role==='me').length;
  const quiet = p.id==='quiet';
  const otherTexts=messages.filter(m=>m.role==='other').map(m=>m.text);
  const mentionedBook=otherTexts.some(t=>t.includes(p.book));
  const agreed=otherTexts.some(t=>t.includes('周六下午可以'));
  let message=''; let coach='先接住对方刚说的一件事，再决定是否分享或提问。'; let suggestedEnd=false;
  if (/不回我|怎么不回|必须|给个机会|笨蛋|活该|蠢/.test(last)) {message='这句话让我有点压力，我们先聊到这里吧。';coach='对方表达了边界，停止推进比继续解释更合适。';suggestedEnd=true;}
  else if (/晚安|先忙|先休息|拜拜|再见|下次聊/.test(last)) {message=quiet?'嗯，下次聊。':'好呀，那今天先这样，下次聊。';suggestedEnd=true;coach='自然结束也属于完成一次交流。';}
  else if (/抱歉|对不起/.test(last)) {message=quiet?'好，没事。我们换个话题吧。':'谢谢你说清楚，那我们换个轻松的话题吧。';coach='道歉被接住后，不需要重复索取原谅。';}
  else if (agreed&&/周六.*见|那就.*定|好的.*见/.test(last)){message='好，周六下午见。有变动我们提前说。';coach='安排已经确认，可以在这里自然结束。';suggestedEnd=n>=5;}
  else if (/周五|工作日|今晚.*(见|吃|约)/.test(last)) {message=`${p.unavailable}，那个时间不太方便。`;coach='这是时间信息，不能直接推断为关系上的拒绝。可以接受，也可以问一次替代安排。';}
  else if (/周六|周日|一起|要不要.*(去|吃|看|打)|约/.test(last)) {
    if(n<3 && config.familiarity==='刚认识') {message=quiet?'我想先多聊聊，暂时不约。':'我们还不太熟，我想先聊聊，见面以后再说吧。';coach='这里拒绝的是当前邀约。接受她的节奏，不需要说服。';}
    else if(/周六.*(下午|三点|两点)|下午.*周六/.test(last)){message=`周六下午可以。${p.place}对我挺方便的，时间提前说好就行。`;coach='已有具体安排，可以确认一次，随后回到普通聊天。';}
    else {message=`我${p.available}有空，不过你具体想去哪儿？`;coach='把时间地点说清，保留对方调整或拒绝的空间。';}
  }
  else if (/书|电影|看什么|喜欢什么/.test(last)||mentionedBook&&/那部|这部|哪段|结尾/.test(last)) {
    if(mentionedBook)message=quiet?'我喜欢它把普通日子拍得很认真，车里听音乐那几段也很舒服。':p.id==='warm'?'我喜欢那些有一点奇妙、又和生活连着的故事。不是每篇都看懂，不过挺有意思的。':'喜剧让我下班后能放松点，不太想再看沉重的。';
    else message=quiet?`最近看过${p.book}，挺喜欢的。`:`最近比较喜欢${p.book}，你有看过吗？`;
  }
  else if (/饭|吃|做菜|饿/.test(last)) {message=quiet?`今天吃了${p.food}。`:`今天吃了${p.food}，挺满足的。你晚饭吃什么了？`;}
  else if (/忙|工作|累|辛苦|会|项目|休息/.test(last)) {message=quiet?`最近项目赶进度，周五前要交稿。`:`是有点累，今天想早点休息。周末一般会去${p.activity}放松一下。`;coach='回应疲惫时不一定要追问；留出空间也是一种支持。';}
  else if (/散步|摄影|羽毛球|书店|周末|兴趣/.test(last)) {message=`我挺喜欢${p.interests}，${p.place}经常去。`;}
  else if (/哪里|住哪|地址/.test(last)) {message=`我在${p.place.slice(0,2)}这边，具体住址就先不聊啦。`;coach='泛泛聊区域与索取住址的分寸不同。';}
  else if (/喜欢你|聊.*(舒服|开心)|好感/.test(last)) {message=quiet?'谢谢，和你聊天也挺轻松的。':'谢谢你直接说，能聊得舒服我也很开心。我们慢慢了解吧。';coach='表达好感可以正常接住，不等于已经建立恋爱关系。';}
  else if ((last.match(/[?？]/g)??[]).length>2) {message='一下问了好多，我先说周末吧，我一般会去'+p.activity+'。';coach='保留一个问题，先回应她选择说的部分。';}
  else {const fallback=quiet?['嗯，明白。','我平时回复比较短，不太常看手机。',`最近会去${p.activity}放松。`]:['听起来挺有意思的，你可以再说一点。',`我平时比较喜欢${p.interests}，你呢？`,'这个我不太了解，不过你刚说的我听到了。'];message=fallback[(n-1)%fallback.length];coach='本轮未匹配到演示分支，使用了有限的兜底回复；真实自由对话需启用 AI。';}
  if (n>=config.rounds) suggestedEnd=true;
  return {message,coach,suggestedEnd};
}

export function demoRecap(messages: Message[], kind: 'simulation'|'review'): Recap {
  const mine=messages.filter(m=>m.role==='me'); const theirs=messages.filter(m=>m.role==='other');
  const last=messages[messages.length-1];
  const refusal=theirs.find(m=>/不想继续|不要再发|不想.*聊|先聊到这里|不再联系/.test(m.text));
  const busy=theirs.find(m=>/忙|累|不想说|休息|发烧/.test(m.text));
  const alternative=theirs.find(m=>/周[六日].*(可以|有空)|可以.*周[六日]/.test(m.text));
  const lastOther=last.role==='other'?last:undefined;
  const pressure=mine.find(m=>/不回我|怎么不回|必须|给个机会|故意|朋友圈.*不回/.test(m.text));
  const many=mine.find(m=>(m.text.match(/[?？]/g)??[]).length>2 || m.text.length>180);
  const observable=[`文本中有 ${mine.length} 条“我”的消息、${theirs.length} 条“对方”的消息。`,refusal?`对方原句：“${refusal.text}”。`:busy?`对方提到了自己的状态：“${busy.text}”。`:alternative?`对方提供了具体安排：“${alternative.text}”。`:'当前文本没有识别到明确拒绝或关系承诺。'];
  let action:Recap['next']['action']='继续聊'; let reason='最后一条有可回应的信息，可以轻量接一句；也可以先停。';let reply='你刚才说的那件事我有点好奇，可以再说一点吗？';
  if(refusal){action='结束交流';reason='文本中出现了明确边界，接受它，停止推进或发送。';reply='不继续发送消息。';}
  else if(lastOther&&/忙|累|不想说|休息|发烧/.test(lastOther.text)){action='等待';reason='对方最近一条提到忙碌或疲惫，先给空间。忙碌不能自动解释为讨厌。';reply='好，你先忙，有空再聊。';}
  else if(last.role==='me'){action='等待';reason='最后一条是你发出的消息，目前没有新的回应；先等，不用连续补发。';reply='先不补发消息。';}
  else if(lastOther&&/暂时不约|先.*聊|时间不太方便|再说吧|不确定|没有这方面|普通朋友/.test(lastOther.text)){action='等待';reason='对方没有接受当前邀约或关系推进。先停下邀约，不能据此断定她拒绝所有普通交流。';reply='好，明白，那这次先不安排。';}
  else if(lastOther&&/下次聊|周六.*见|今天先这样/.test(lastOther.text)){action='结束交流';reason='本轮聊天已有自然的结束点，可以先停；这不等于永久停止关系。';reply='好，那下次聊。';}
  else if(lastOther&&/周[六日].*(可以|有空)|可以.*周[六日]/.test(lastOther.text)){action='邀约';reason='对方最近一条给出了具体可用时间，可以确认一次时间和地点。';reply='这个时间我也方便，我们再确认一下地点？';}
  return {summary:`${kind==='simulation'?'本次模拟':'这段文本'}展示了 ${mine.length} 次你的表达。以下是有限关键词规则的观察，不构成真实关系判断。`,
    observations:observable,uncertainties:['没有完整的语气、认识经历和全部上下文，不能据此断言对方的内心。','未标注时间的文本不能用来判断回复速度或聊天频率；短回复不等于不愿交流。'],
    moments:[{quote:(pressure??many??last).text,explanation:pressure?'检测到可能催促的用词，建议复核是否在要求对方回应。':many?'信息或问题较多，试着一次保留一个重点。':'这是最后一个可观察的交流落点，后续选择需要结合它和背景判断。'}],
    strengths:[mine.some(m=>/你|辛苦|休息/.test(m.text))?'有尝试回应或关心对方的表达；具体是否接住仍需结合全文。':'愿意练习并检查自己的表达。'],
    improvements:pressure?['把要求回应改成可选择的提议，或直接留出空间。']:many?['缩短解释或减少并列问题，给对方更容易接住的一句。']:['检查是否回应了对方刚说的具体内容，不必每轮都推进关系。'],next:{action,reason,reply}};
}
