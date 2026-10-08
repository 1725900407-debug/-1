import { useEffect, useState } from 'react';
import { ArrowRight, Bookmark, Check, ChevronRight, Clock, CornerDownLeft, Lightbulb, RotateCcw, Search, Send } from 'lucide-react';
import { useApp } from './context';
import { coreScenarios, getScenario, scenarios } from '../shared/scenarios';
import { skills, feedbackSchema } from '../shared/types';
import type { Draft } from '../shared/types';
import { BubbleList, CharacterAvatar, Empty, FeedbackView, Notice, PageTitle } from './components';
import { request } from './api';

export default function Practice(){
  const {store,setStore,notify,openPractice,go,aiReady}=useApp();
  const [level,setLevel]=useState('全部');const [search,setSearch]=useState('');const [focus,setFocus]=useState('全部');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [revision,setRevision]=useState('');const [revisionSilence,setRevisionSilence]=useState(false);const [now,setNow]=useState(Date.now());
  const d=store.draft;const s=d?getScenario(d.scenarioId):undefined;
  useEffect(()=>{setRevision('');setRevisionSilence(false);setError('');},[d?.scenarioId]);
  useEffect(()=>{if(!store.timerEnd)return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[store.timerEnd]);
  const remaining=store.timerEnd?Math.max(0,Math.ceil((store.timerEnd-now)/1000)):0;
  const patch=(p:Partial<Draft>)=>setStore(prev=>({...prev,draft:prev.draft?{...prev.draft,...p}:undefined}));
  const submit=async(revise=false)=>{
    if(!d||!s)return;
    const answer=revise?revision:d.answer,silence=revise?revisionSilence:d.silence;
    if(!silence&&!answer.trim()){setError('写一句你会发送的话，或选择不继续发消息。');return;}
    if(answer.length>1000){setError('回复最多 1000 字，请先缩短。');return;}
    if(store.settings.mode==='ai'&&!store.settings.externalConsent){setError('AI 模式会把输入发送到外部服务，请先在设置中确认，或切回演示模式。');return;}
    setBusy(true);setError('');
    try{
      const feedback=await request('practice',{scenarioId:s.id,answer,silence,mode:store.settings.mode,consent:store.settings.externalConsent},feedbackSchema);
      const result={...d,answer:answer.trim(),silence,feedback,revised:revise,revealed:revise,mode:store.settings.mode,...(revise&&d.feedback?{original:{answer:d.silence?'（选择不继续发消息）':d.answer,feedback:d.feedback}}:{})};
      if(revise)save(result);else patch(result);
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  };
  const save=(draft:Draft)=>{
    if(!draft.feedback||draft.savedId)return;
    const id=crypto.randomUUID();
    setStore(prev=>({...prev,draft:{...draft,revealed:true,savedId:id},records:[...prev.records,{id,at:new Date().toISOString(),scenarioId:draft.scenarioId,answer:draft.answer,silence:draft.silence,hints:draft.hints,feedback:draft.feedback!,original:draft.original,mode:draft.mode??prev.settings.mode}]}));
    notify('本次练习已记录；提示使用与修改前后结果一起保存。');
  };
  const toggleFavorite=()=>{if(!s)return;setStore(prev=>({...prev,favorites:prev.favorites.includes(s.id)?prev.favorites.filter(id=>id!==s.id):[...prev.favorites,s.id]}));};
  const list=(focus==='全部'?coreScenarios:scenarios.filter(s=>s.focus===focus)).filter(s=>(level==='全部'||s.level===level)&&(!search||`${s.title}${s.category}${s.goal}`.includes(search)));
  const completed=new Set(store.records.map(r=>r.scenarioId));
  return <><PageTitle eyebrow="SCENARIO PRACTICE" title="先从一句话开始" description="读懂情境，写下你真的会发送的回复。也可以选择留白。" action={store.timerEnd?<span className="timer"><Clock size={16}/>{remaining>0?`${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`:'10 分钟已到，可继续或休息'}</span>:undefined}/>
    <div className="practice-layout"><aside className="catalog"><div className="catalog-head"><strong>情境题库</strong><span>{coreScenarios.length} 道 + 7 道迁移题</span></div><label className="search-box"><Search size={16}/><input placeholder="搜索情境或话题" aria-label="搜索情境" value={search} onChange={e=>setSearch(e.target.value)}/></label><div className="level-pills">{['全部','基础','进阶','综合'].map(l=><button key={l} onClick={()=>setLevel(l)} className={level===l?'active':''}>{l}</button>)}</div><label className="field-label">专项方向<select value={focus} onChange={e=>setFocus(e.target.value)}><option>全部</option>{skills.map(t=><option key={t}>{t}</option>)}</select></label><div className="scenario-list">{list.map(q=><button disabled={busy} onClick={()=>openPractice(q.id)} key={q.id} className={s?.id===q.id?'selected':''}><span className="scenario-index">{completed.has(q.id)?<Check size={14}/>:q.id}</span><span><strong>{q.title}</strong><small>{q.level} · {q.category}{q.transfer?' · 新情境':''}</small></span><ChevronRight size={14}/></button>)}{!list.length&&<p className="muted">没有符合条件的情境。</p>}</div></aside>
    <div className="practice-content">{!s||!d?<Empty title="选一个情境，试着回一句" text="基础、进阶与综合各 12 道，从你熟悉的小事开始。" action={<button className="primary" onClick={()=>openPractice()}>开始练习 <ArrowRight size={16}/></button>}/>:<>
    <section className="scene-card"><div className="scene-top"><span className="tag green">{s.level} · {s.category}</span><button className={`icon-button favorite ${store.favorites.includes(s.id)?'saved':''}`} aria-label={store.favorites.includes(s.id)?'取消收藏':'收藏本题'} onClick={toggleFavorite}><Bookmark size={19} fill={store.favorites.includes(s.id)?'currentColor':'none'}/></button></div><h2>{s.title}</h2><p>{s.background}</p><div className="profile-row"><CharacterAvatar name={s.name} className="profile-avatar"/><div><strong>{s.name} <small>{s.age} 岁 · 虚构角色</small></strong><span>{s.personality}</span></div><span className={`tag ${s.mood==='积极'?'green':s.mood==='消极'?'sand':''}`}>{s.familiarity}</span></div><div className="training-goal"><Lightbulb size={16}/><span><strong>本题目标</strong> {s.goal}</span></div></section>
    <section className="chat-card"><div className="chat-card-head"><span className="status-dot"/><strong>最近的聊天</strong><small>情境示例</small></div><BubbleList messages={s.messages} name={s.name}/>{d.feedback&&<BubbleList messages={[{role:'me',text:d.silence?'（选择不继续发消息）':d.answer}]} name={s.name}/>}
    {!d.feedback&&<div className="composer"><label htmlFor="practice-answer">轮到你了，你会怎么回复？</label><textarea id="practice-answer" value={d.answer} disabled={d.silence||busy} maxLength={1000} onChange={e=>patch({answer:e.target.value})} placeholder="不用追求完美，写你平时会说的话…" rows={4}/><div className="composer-options"><label className="checkbox"><input type="checkbox" checked={d.silence} onChange={e=>patch({silence:e.target.checked})} disabled={busy}/>我选择不继续发消息</label><small>{d.answer.length}/1000</small></div><div className="composer-actions"><button className="secondary" onClick={()=>patch({hints:Math.min(3,d.hints+1)})} disabled={d.hints>=3||busy}><Lightbulb size={16}/>{d.hints===0?'给我一点提示':d.hints<3?'再给一步提示':'已使用三级提示'}</button><button className="primary" onClick={()=>submit()} disabled={busy}>{busy?'正在分析…':'提交回复'}<Send size={16}/></button></div>{d.hints>0&&<div className="hints">{s.hints.slice(0,d.hints).map((hint,i)=><p key={i}><span>提示 {i+1}</span>{hint}</p>)}<small>本次会记录为“借助提示完成”。</small></div>}</div>}
    </section>
    {error&&<Notice type="error">{error}<button className="text-button" onClick={()=>d.feedback?submit(true):submit()} disabled={busy}>重试</button>{store.settings.mode==='ai'&&<button className="text-button" onClick={()=>go('settings')}>打开设置</button>}</Notice>}
    {d.feedback&&<><FeedbackView feedback={d.feedback} original={d.original?.feedback} full={d.revealed} source={d.mode??'demo'}/>{!d.revealed&&<section className="revision-panel"><div className="section-label"><CornerDownLeft size={17}/>先自己修改一次</div><h3>看过问题，再试一种表达</h3><p>完整参考暂时收起。先按自己的理解改一句，再比较变化。</p><label className="sr-only" htmlFor="revision-answer">修改后的回复</label><textarea id="revision-answer" value={revision} maxLength={1000} rows={3} disabled={revisionSilence||busy} placeholder="这一次，你会怎么说？" onChange={e=>setRevision(e.target.value)}/><div className="composer-options"><label className="checkbox"><input type="checkbox" checked={revisionSilence} onChange={e=>setRevisionSilence(e.target.checked)} disabled={busy}/>修改为不继续发消息</label><small>{revision.length}/1000</small></div><div className="composer-actions"><button className="text-button" disabled={busy} onClick={()=>save(d)}>直接看完整参考并记录</button><button className="primary" disabled={busy} onClick={()=>submit(true)}>{busy?'正在比较…':'提交修改并比较'}<ArrowRight size={16}/></button></div></section>}
      {d.revealed&&<div className="practice-done"><span><Check size={17}/>已记入学习记录 · {d.hints===0?'独立完成':'使用了 '+d.hints+' 级提示'}</span><div><button className="secondary" onClick={()=>openPractice(s.id)}><RotateCcw size={15}/>重做本题</button><button className="primary" onClick={()=>{const next=coreScenarios.find(q=>!completed.has(q.id)&&q.id!==s.id)??coreScenarios[(coreScenarios.findIndex(q=>q.id===s.id)+1)%coreScenarios.length];openPractice(next.id);}}>下一道题<ArrowRight size={16}/></button></div></div>}
    </>}
    </>}</div></div>
  </>;
}
