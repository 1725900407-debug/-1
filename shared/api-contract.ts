import { z } from 'zod';
import { personas } from './personas';

const mode = z.enum(['demo', 'ai']);
const message = z.object({role:z.enum(['me','other']),text:z.string().trim().min(1).max(4000)});
export const messagesSchema = z.array(message).min(1).max(100).refine(a=>a.reduce((n,m)=>n+m.text.length,0)<=20000,'聊天文本最多 20000 字');
export const configSchema = z.object({
  background:z.enum(['朋友介绍','活动认识','成人校园社团','线下聚会']),
  familiarity:z.enum(['刚认识','聊过几次','见过两次']),
  personaId:z.enum(personas.map(p=>p.id) as ['warm','quiet','direct']),
  goal:z.enum(['破冰','延续话题','回应情绪','自然邀约']),
  coach:z.boolean(),rounds:z.number().int().min(5).max(12),
});
export const practiceInput = z.object({mode,scenarioId:z.string(),answer:z.string().trim().max(1000),silence:z.boolean(),consent:z.boolean().optional()});
export const simulationInput = z.object({mode,config:configSchema,messages:messagesSchema,consent:z.boolean().optional()});
export const recapInput = z.object({mode,kind:z.enum(['simulation','review']),messages:messagesSchema,config:configSchema.optional(),consent:z.boolean().optional()});
