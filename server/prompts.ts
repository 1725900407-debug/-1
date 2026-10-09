import { dimensions, skills } from '../shared/types';

export const feedbackShape={summary:'一句总评',evidence:[{quote:'用户原句',explanation:'具体分析'}],scores:dimensions.map(d=>({dimension:d,value:'整数1-5',reason:'简短依据，仅练习比较'})),interpretations:[{tone:'积极/中性/不太舒服',text:'可能理解',dependsOn:'影响判断的背景'}],rewrites:['保留表达风格','自然简洁','轻松一点／稳妥回应'].map(style=>({style,text:'参考改写，不适合幽默则稳妥回应或不发',improvement:'改善了什么'})),principle:'可迁移小原则',issues:skills,strengths:['实际优点']};
export const recapShape={summary:'实际发生了什么',observations:['可观察的信息'],uncertainties:['推测与未知'],moments:[{quote:'确切原句',explanation:'关键转折'}],strengths:['本来没问题的地方'],improvements:['一两处改进'],next:{action:'继续聊/等待/换话题/邀约/结束交流',reason:'理由',reply:'可参考回复或不发送'}};
export const aiTasks={
  practice:{task:'分析情境回复，给3种解读和3种改写。各评分1至5。若选择沉默分析这一行动；引用必须来自用户输入。',shape:feedbackShape},
  simulation:{task:'进行一轮虚构成人角色模拟。保持角色事实和历史一致，回应最新用户消息。有自己的节奏，不每次热情或自动答应邀约，也不故意刁难。coach是给用户的简短训练提示；若对话应自然结束，suggestedEnd为true。',shape:{message:'角色回复',coach:'简短提示',suggestedEnd:'布尔值'}},
  recap:{task:'复盘聊天。先概括事实，区分观察和推测。引用关键转折，说明做得好的地方、一两处改进及后续选择。数据不足必须说明，不推测喜欢概率。',shape:recapShape},
};
