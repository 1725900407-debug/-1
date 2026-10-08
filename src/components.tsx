import { useState } from 'react';
import { ArrowUpRight, ChevronDown, Lightbulb, Sparkles, Check, MessageCircle, ShieldCheck } from 'lucide-react';
import type { Feedback, Message, Recap } from '../shared/types';

export function CharacterAvatar({name,style,className=''}:{name:string;style?:string;className?:string}){
  const variant=style??(name==='陈宁'?'quiet':name==='周岚'?'direct':'warm');
  return <span role="img" aria-label={`${name}的虚构角色头像`} className={`character-avatar ${variant} ${className}`}/>;
}
export function BubbleList({messages,name='对方'}:{messages:Message[];name?:string}){return <div className="messages">{messages.map((m,i)=><div className={`message ${m.role}`} key={i}>{m.role==='me'?<span className="avatar">我</span>:name==='对方'?<span className="avatar">对</span>:<CharacterAvatar name={name} className="bubble-avatar"/>}<div><span className="message-name">{m.role==='me'?'我':name}</span><div className="bubble">{m.text}</div></div></div>)}</div>;}
export function Empty({title,text,action}:{title:string;text:string;action?:React.ReactNode}){return <div className="empty"><MessageCircle size={32}/><h3>{title}</h3><p>{text}</p>{action}</div>;}
export function Notice({children,type='info'}:{children:React.ReactNode;type?:'info'|'error'|'success'}){return <div className={`notice ${type}`} role={type==='error'?'alert':undefined}>{type==='success'?<Check size={17}/>:type==='error'?<ShieldCheck size={17}/>:<Lightbulb size={17}/>}<div>{children}</div></div>;}
export function PageTitle({eyebrow,title,description,action}:{eyebrow:string;title:string;description:string;action?:React.ReactNode}){return <div className="page-title"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>;}
export function FeedbackView({feedback,original,full,source}:{feedback:Feedback;original?:Feedback;full:boolean;source:'demo'|'ai'}){
  const [tab,setTab]=useState('依据');
  const tabs=full?['依据','练习评分','可能解读','参考改写']:['依据','练习评分'];
  const active=tabs.includes(tab)?tab:'依据';
  return <section className="feedback-panel"><div className="section-label"><Sparkles size={16}/>本次反馈<span className="tag">{source==='demo'?'演示规则':'AI 分析'}</span></div><h3>{feedback.summary}</h3><div className="tabs" role="tablist">{tabs.map(t=><button key={t} role="tab" aria-selected={active===t} onClick={()=>setTab(t)}>{t}</button>)}</div>
    <div className="feedback-body" role="tabpanel">
      {active==='依据'&&<><div className="evidence-list">{feedback.evidence.map((e,i)=><div key={i}><blockquote>“{e.quote}”</blockquote><p>{e.explanation}</p></div>)}</div><div className="good-note"><Check size={16}/>{feedback.strengths.join(' ')}</div></>}
      {active==='练习评分'&&<><p className="muted tiny">1–5 分只用于本工具中的练习比较，不代表人格、真实情商或吸引力。</p>{feedback.scores.map(s=><div className="score-row" key={s.dimension}><div><strong>{s.dimension}</strong><p>{s.reason}</p></div><div className="score-dots" aria-label={`${s.value} 分`}>{[1,2,3,4,5].map(n=><i key={n} className={n<=s.value?'filled':''}/>)}</div><span className="score-value">{s.value}<small>/5</small></span></div>)}</>}
      {active==='可能解读'&&<><p className="muted tiny">下面是可能性，不能证明真实对方的内心。</p>{feedback.interpretations.map((m,i)=><div className="interpretation" key={i}><span className={`tag ${m.tone==='积极'?'green':m.tone==='不太舒服'?'sand':''}`}>{m.tone}</span><p>{m.text}</p><small>{m.dependsOn}</small></div>)}</>}
      {active==='参考改写'&&<><p className="muted tiny">挑一个适合自己的方向，再换成你平时会说的话。{source==='demo'&&'演示模式提供人工示例，只能有限适配表达风格。'}</p>{feedback.rewrites.map((r,i)=><div className="rewrite" key={i}><div><span className="number">0{i+1}</span><strong>{r.style}</strong></div><p className="rewrite-text">{r.text}</p><small>{r.improvement}</small><button className="text-button" onClick={()=>navigator.clipboard?.writeText(r.text).catch(()=>{})}>复制参考</button></div>)}</>}
    </div>
    {original&&<details className="comparison" open><summary>修改前后比较 <ChevronDown size={16}/></summary><div className="comparison-grid">{feedback.scores.map(s=>{const before=original.scores.find(b=>b.dimension===s.dimension)?.value??s.value;return <div key={s.dimension}><small>{s.dimension}</small><strong>{before} <ArrowUpRight size={13}/> {s.value}</strong><span>{s.value>before?'练习分提高':s.value<before?'换个方向再考虑':'练习分相同'}</span></div>;})}</div><p className="tiny muted">分数变化只反映本次评估；更值得看的是改动是否接住信息、减少压力。演示模式按有限规则比较。</p></details>}
    {full&&<div className="principle"><Lightbulb size={19}/><div><strong>带走一个小原则</strong><p>{feedback.principle}</p></div></div>}
  </section>;
}
export function RecapView({recap,demo}:{recap:Recap;demo:boolean}){return <section className="recap"><div className="section-label"><Sparkles size={16}/>{demo?'演示复盘':'交流复盘'}</div><h3>{recap.summary}</h3><div className="recap-grid"><div><h4>可以观察到</h4><ul>{recap.observations.map((x,i)=><li key={i}>{x}</li>)}</ul></div><div><h4>暂时不知道</h4><ul>{recap.uncertainties.map((x,i)=><li key={i}>{x}</li>)}</ul></div></div><details open><summary>关键转折</summary>{recap.moments.map((m,i)=><div className="moment" key={i}><blockquote>“{m.quote}”</blockquote><p>{m.explanation}</p></div>)}</details><div className="recap-grid"><div><h4>做得好的地方</h4><ul>{recap.strengths.map((x,i)=><li key={i}>{x}</li>)}</ul></div><div><h4>下一次可以调整</h4><ul>{recap.improvements.map((x,i)=><li key={i}>{x}</li>)}</ul></div></div><div className="next-step"><span className="tag green">建议：{recap.next.action}</span><p>{recap.next.reason}</p><blockquote>{recap.next.reply}</blockquote><small>参考方向，不是标准答案。用自己的语言表达。</small></div></section>;}
