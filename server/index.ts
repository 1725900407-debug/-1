import 'dotenv/config';
import express from 'express';
import { timingSafeEqual } from 'node:crypto';
import { createServer as createHttpServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { z } from 'zod';
import { getScenario } from '../shared/scenarios';
import { getPersona, personas } from '../shared/personas';
import { feedbackSchema, recapSchema, turnSchema, dimensions, skills } from '../shared/types';
import { demoFeedback, demoRecap, demoTurn } from './demo';
import { aiConfigured, ApiError, callAI } from './ai';

export const app=express();
app.disable('x-powered-by');
app.use(express.json({limit:'80kb'}));
app.use((_req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');next();});
app.get('/api/status',(_req,res)=>res.json({app:'chat-practice-room',aiConfigured:aiConfigured(),accessRequired:!!process.env.APP_ACCESS_TOKEN,mode:aiConfigured()?'available':'demo'}));
const modeSchema=z.enum(['demo','ai']);
const msgSchema=z.object({role:z.enum(['me','other']),text:z.string().trim().min(1).max(4000)});
const messagesSchema=z.array(msgSchema).min(1).max(100).refine(a=>a.reduce((n,m)=>n+m.text.length,0)<=20000,'聊天文本最多 20000 字');
const configSchema=z.object({background:z.enum(['朋友介绍','活动认识','成人校园社团','线下聚会']),familiarity:z.enum(['刚认识','聊过几次','见过两次']),personaId:z.enum(personas.map(p=>p.id) as ['warm','quiet','direct']),goal:z.enum(['破冰','延续话题','回应情绪','自然邀约']),coach:z.boolean(),rounds:z.number().int().min(5).max(12)});
const feedbackShape={summary:'一句总评',evidence:[{quote:'用户原句',explanation:'具体分析'}],scores:dimensions.map(d=>({dimension:d,value:'整数1-5',reason:'简短依据，仅练习比较'})),interpretations:[{tone:'积极/中性/不太舒服',text:'可能理解',dependsOn:'影响判断的背景'}],rewrites:['保留表达风格','自然简洁','轻松一点／稳妥回应'].map(style=>({style,text:'参考改写，不适合幽默则稳妥回应或不发',improvement:'改善了什么'})),principle:'可迁移小原则',issues:skills,strengths:['实际优点']};
const recapShape={summary:'实际发生了什么',observations:['可观察的信息'],uncertainties:['推测与未知'],moments:[{quote:'确切原句',explanation:'关键转折'}],strengths:['本来没问题的地方'],improvements:['一两处改进'],next:{action:'继续聊/等待/换话题/邀约/结束交流',reason:'理由',reply:'可参考回复或不发送'}};

// 简单本机应用不引入账号；公开部署用访问口令，AI 接口限制并发和请求频率。
const traffic=new Map<string,{at:number;count:number}>();let concurrent=0;
app.use('/api',(req,res,next)=>{
  if(req.method!=='POST')return next();
  const origin=req.get('origin');
  if(origin){try{if(new URL(origin).host!==req.get('host'))return res.status(403).json({error:'仅接受当前站点发起的请求。'});}catch{return res.status(403).json({error:'来源无效。'});}}
  if(req.body?.mode!=='ai')return next();
  const token=process.env.APP_ACCESS_TOKEN;
  if(token){const supplied=Buffer.from(req.get('x-app-token')??'');const expected=Buffer.from(token);if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))return res.status(401).json({error:'需要服务访问口令，请在设置页输入。'});}
  const key=req.ip??'local',now=Date.now();
  for(const [k,v] of traffic)if(now-v.at>60000)traffic.delete(k);
  const v=traffic.get(key)??{at:now,count:0};v.count++;traffic.set(key,v);
  if(v.count>15||concurrent>=4)return res.status(429).json({error:'请求较多，请稍后重试。'});
  concurrent++;res.on('finish',()=>{concurrent--;});next();
});
function parse<T>(schema:z.ZodType<T>,input:unknown):T {const result=schema.safeParse(input);if(!result.success)throw new ApiError(400,'输入为空、过长或格式不正确，请检查后再提交。');return result.data;}
app.post('/api/practice',async(req,res)=>{
  const data=parse(z.object({mode:modeSchema,scenarioId:z.string(),answer:z.string().trim().max(1000),silence:z.boolean(),consent:z.boolean().optional()}),req.body);
  const s=getScenario(data.scenarioId);if(!s)throw new ApiError(404,'题目不存在。');
  if(!data.silence&&!data.answer)throw new ApiError(400,'写一句你会发送的话，或选择不继续发消息。');
  if(data.mode==='ai'&&!data.consent)throw new ApiError(400,'请先确认将输入发送给外部 AI 服务。');
  const feedback=data.mode==='demo'?demoFeedback(s,data.answer,data.silence):await callAI('分析情境回复，给3种解读和3种改写。各评分1至5。若选择沉默分析这一行动；引用必须来自用户输入。', {scenario:s,answer:data.silence?'（选择不继续发消息）':data.answer},feedbackSchema,feedbackShape);
  const source=data.silence?'（选择不继续发消息）':data.answer;
  if(data.mode==='ai'&&feedback.evidence.some(e=>!source.includes(e.quote)))throw new ApiError(502,'AI 引用了输入中不存在的文字，请重试。');
  res.json({mode:data.mode,data:feedback});
});
app.post('/api/simulation',async(req,res)=>{
  const data=parse(z.object({mode:modeSchema,config:configSchema,messages:messagesSchema,consent:z.boolean().optional()}),req.body);
  if(data.messages[data.messages.length-1].role!=='me')throw new ApiError(400,'请先发送你的回复。');
  if(data.messages.filter(m=>m.role==='me').length>data.config.rounds)throw new ApiError(400,'已达到本次轮数，请结束并复盘。');
  if(data.mode==='ai'&&!data.consent)throw new ApiError(400,'请先确认将聊天发送给外部 AI 服务。');
  const result=data.mode==='demo'?demoTurn(data.config,data.messages):await callAI('进行一轮虚构成人角色模拟。保持角色事实和历史一致，回应最新用户消息。有自己的节奏，不每次热情或自动答应邀约，也不故意刁难。coach是给用户的简短训练提示；若对话应自然结束，suggestedEnd为true。',{config:data.config,persona:getPersona(data.config.personaId),messages:data.messages},turnSchema,{message:'角色回复',coach:'简短提示',suggestedEnd:'布尔值'});
  res.json({mode:data.mode,data:result});
});
app.post('/api/recap',async(req,res)=>{
  const data=parse(z.object({mode:modeSchema,kind:z.enum(['simulation','review']),messages:messagesSchema,config:configSchema.optional(),consent:z.boolean().optional()}),req.body);
  if(!data.messages.some(m=>m.role==='me')||!data.messages.some(m=>m.role==='other'))throw new ApiError(400,'请至少标记一条“我”和一条“对方”的消息。');
  if(data.mode==='ai'&&!data.consent)throw new ApiError(400,'提交前需要明确确认发送聊天文本到外部 AI 服务。');
  const result=data.mode==='demo'?demoRecap(data.messages,data.kind):await callAI('复盘聊天。先概括事实，区分观察和推测。引用关键转折，说明做得好的地方、一两处改进及后续选择。数据不足必须说明，不推测喜欢概率。',{kind:data.kind,messages:data.messages,config:data.config,persona:data.config?getPersona(data.config.personaId):undefined},recapSchema,recapShape);
  if(data.mode==='ai'&&result.moments.some(m=>!data.messages.some(line=>line.text.includes(m.quote))))throw new ApiError(502,'AI 复盘引用了文本中不存在的内容，请重试。');
  res.json({mode:data.mode,data:result});
});
app.use('/api',(_req,res)=>res.status(404).json({error:'接口不存在。'}));
app.use((err:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{
  if(err instanceof ApiError)return res.status(err.status).json({error:err.message});
  if(err instanceof SyntaxError)return res.status(400).json({error:'请求内容格式不正确。'});
  if((err as {type?:string})?.type==='entity.too.large')return res.status(413).json({error:'文本太长，请缩短后重试。'});
  // 不记录原文、外部响应或密钥。
  res.status(500).json({error:'服务暂时出现问题，请重试。'});
});
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function startServer(){
  const httpServer=createHttpServer(app);
  let vite:import('vite').ViteDevServer|undefined;
  if(process.env.NODE_ENV==='production'){app.use(express.static(path.join(root,'dist')));app.get('/{*path}',(_req,res)=>res.sendFile(path.join(root,'dist/index.html')));}
  else {const {createServer}=await import('vite');vite=await createServer({root,server:{middlewareMode:true,hmr:{server:httpServer}},appType:'spa'});app.use(vite.middlewares);}
  const port=Number(process.env.PORT)||3000;
  try{await new Promise<void>((resolve,reject)=>{httpServer.once('error',reject);httpServer.listen(port,process.env.HOST??'0.0.0.0',resolve);});}
  catch(error){await vite?.close();throw error;}
  console.log(`聊天练习室已启动，端口 ${port}，${aiConfigured()?'AI 可配置启用':'演示模式'}`);
  const shutdown=()=>{httpServer.close(()=>process.exit(0));void vite?.close();setTimeout(()=>process.exit(0),2000).unref();};
  process.once('SIGINT',shutdown);process.once('SIGTERM',shutdown);
  return httpServer;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))startServer().catch(error=>{console.error((error as NodeJS.ErrnoException).code==='EADDRINUSE'?'启动失败：端口已被占用，请确认现有服务或设置其他 PORT。':'服务启动失败，请检查配置。');process.exitCode=1;});
