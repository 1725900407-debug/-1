import { z } from 'zod';

export const dimensions = ['贴合上下文', '自然真实', '回应对方', '分寸与边界', '便于继续交流'] as const;
export const skills = ['连续提问', '只谈自己', '解释过多', '玩笑尺度', '邀约分寸', '解读速度', '表达想法'] as const;
export type Skill = typeof skills[number];
export type Message = { role: 'me' | 'other'; text: string };
export type Scenario = {
  id: string; title: string; level: '基础' | '进阶' | '综合'; category: string;
  name: string; age: number; personality: string; background: string; familiarity: string;
  goal: string; mood: '积极' | '中性' | '消极'; messages: Message[];
  cues: string[]; allowSilence: boolean; hints: [string, string, string];
  examples: [string, string, string]; principle: string; focus: Skill; transfer?: boolean;
};
const short = z.string().trim().min(1).max(1200);
export const feedbackSchema = z.object({
  summary: short,
  evidence: z.array(z.object({ quote: short, explanation: short })).min(1).max(5),
  scores: z.array(z.object({ dimension: z.enum(dimensions), value: z.number().int().min(1).max(5), reason: short })).length(5).refine(a => new Set(a.map(s => s.dimension)).size === 5, '评分维度必须唯一'),
  interpretations: z.array(z.object({ tone: z.enum(['积极', '中性', '不太舒服']), text: short, dependsOn: short })).min(2).max(3).refine(a=>new Set(a.map(s=>s.tone)).size===a.length,'解读角度必须不同'),
  rewrites: z.array(z.object({ style: z.enum(['保留表达风格', '自然简洁', '轻松一点／稳妥回应']), text: short, improvement: short })).length(3).refine(a => new Set(a.map(s => s.style)).size === 3, '改写风格必须唯一'),
  principle: short, issues: z.array(z.enum(skills)).max(7), strengths: z.array(short).min(1).max(5),
});
export type Feedback = z.infer<typeof feedbackSchema>;
export const recapSchema = z.object({
  summary: short, observations: z.array(short).min(1).max(8),
  uncertainties: z.array(short).min(1).max(5),
  moments: z.array(z.object({ quote: short, explanation: short })).min(1).max(5),
  strengths: z.array(short).min(1).max(4), improvements: z.array(short).max(3),
  next: z.object({ action: z.enum(['继续聊', '等待', '换话题', '邀约', '结束交流']), reason: short, reply: short }),
});
export type Recap = z.infer<typeof recapSchema>;
export const turnSchema = z.object({ message: short, coach: short, suggestedEnd: z.boolean() });
export type Turn = z.infer<typeof turnSchema>;
export type Mode = 'demo' | 'ai';
export type SimConfig = { background: string; familiarity: string; personaId: string; goal: string; coach: boolean; rounds: number };
export type PracticeRecord = { id: string; scenarioId: string; at: string; answer: string; silence: boolean; hints: number; feedback: Feedback; original?: { answer: string; feedback: Feedback }; mode: Mode };
export type SessionRecord = { id: string; at: string; config: SimConfig; messages: Message[]; recap: Recap; mode: Mode };
export type ReviewRecord = { id: string; at: string; messages: Message[]; recap: Recap; mode: Mode };
export type Draft = { scenarioId: string; answer: string; silence: boolean; hints: number; feedback?: Feedback; original?: { answer: string; feedback: Feedback }; revised: boolean; revealed: boolean; savedId?: string; mode?: Mode };
export type Settings = { mode: Mode; externalConsent: boolean; reducedMotion: boolean };
