import { z } from 'zod';
import { feedbackSchema, recapSchema } from '../shared/types';
import type { Draft, PracticeRecord, ReviewRecord, SessionRecord, Settings, SimConfig, Message } from '../shared/types';
export const STORAGE_KEY='chat-practice-room:v1';
const message=z.object({role:z.enum(['me','other']),text:z.string().min(1).max(4000)});
const mode=z.enum(['demo','ai']);
const config=z.object({background:z.enum(['朋友介绍','活动认识','成人校园社团','线下聚会']),familiarity:z.enum(['刚认识','聊过几次','见过两次']),personaId:z.enum(['warm','quiet','direct']),goal:z.enum(['破冰','延续话题','回应情绪','自然邀约']),coach:z.boolean(),rounds:z.number().int().min(5).max(12)});
const original=z.object({answer:z.string().max(1000),feedback:feedbackSchema});
const draft=z.object({scenarioId:z.string(),answer:z.string().max(1000),silence:z.boolean(),hints:z.number().int().min(0).max(3),feedback:feedbackSchema.optional(),original:original.optional(),revised:z.boolean(),revealed:z.boolean(),savedId:z.string().optional(),mode:mode.optional()});
const record=z.object({id:z.string(),scenarioId:z.string(),at:z.string().datetime(),answer:z.string().max(1000),silence:z.boolean(),hints:z.number().int().min(0).max(3),feedback:feedbackSchema,original:original.optional(),mode});
const sim=z.object({config,messages:z.array(message).max(25),hints:z.array(z.string().max(1200)).max(12),mode,ended:z.boolean(),recap:recapSchema.optional(),savedId:z.string().optional()});
export const storeSchema=z.object({version:z.literal(1),records:z.array(record).max(5000),favorites:z.array(z.string()).max(500),sessions:z.array(z.object({id:z.string(),at:z.string().datetime(),config,messages:z.array(message).max(25),recap:recapSchema,mode})).max(1000),reviews:z.array(z.object({id:z.string(),at:z.string().datetime(),messages:z.array(message).max(100),recap:recapSchema,mode})).max(500),settings:z.object({mode,externalConsent:z.boolean(),reducedMotion:z.boolean()}),draft:draft.optional(),sim:sim.optional(),timerEnd:z.number().optional()});
export type SimDraft={config:SimConfig;messages:Message[];hints:string[];mode:'demo'|'ai';ended:boolean;recap?:z.infer<typeof recapSchema>;savedId?:string};
export type Store={version:1;records:PracticeRecord[];favorites:string[];sessions:SessionRecord[];reviews:ReviewRecord[];settings:Settings;draft?:Draft;sim?:SimDraft;timerEnd?:number};
export function emptyStore():Store{return {version:1,records:[],favorites:[],sessions:[],reviews:[],settings:{mode:'demo',externalConsent:false,reducedMotion:false}};}
export function readStore():{store:Store;error?:string}{
  try{const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return {store:emptyStore()};const parsed=storeSchema.safeParse(JSON.parse(raw));if(!parsed.success)return {store:emptyStore(),error:'浏览器记录格式异常，原数据未覆盖。请先导出原始数据备份，再清空或导入有效记录。'};return {store:parsed.data};}
  catch{return {store:emptyStore(),error:'无法读取浏览器记录。可以继续练习，但需允许本地存储才能保存。'};}
}
export function parseImport(raw:string):Store{if(raw.length>5_000_000)throw new Error('文件超过 5 MB，请缩减后再导入。');const parsed=storeSchema.safeParse(JSON.parse(raw));if(!parsed.success)throw new Error('记录文件格式或版本不正确，没有替换当前记录。');return parsed.data;}
export function parseChat(raw:string):{messages:Message[];unmarked:boolean}{
  let unmarked=false;
  const messages=raw.split(/\r?\n/).filter(l=>l.trim()).map(line=>{const match=line.match(/^\s*(我|自己|me|对方|她|ta|other)\s*[:：]\s*(.*)$/i);if(!match){unmarked=true;return {role:'me' as const,text:line.trim()};}return {role:/^(我|自己|me)$/i.test(match[1])?'me' as const:'other' as const,text:match[2].trim()};});
  return {messages,unmarked};
}
