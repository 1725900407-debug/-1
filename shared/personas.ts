export const personas = [
  { id: 'warm', name: '林悦', age: 21, habit: '主动健谈', job: '出版社实习编辑', facts: '住在城东；周末喜欢逛书店和做饭；正在读《夜晚的潜水艇》；周六下午有空，周日上午陪家人；不太喜欢临时深夜邀约。', opener: '刚到家，今天那家店的烤南瓜还挺好吃的。', interests: '书店、做饭', activity: '逛书店', place: '城东那家独立书店', available: '周六下午', unavailable: '周日上午要陪家人', book: '《夜晚的潜水艇》', food: '烤南瓜' },
  { id: 'quiet', name: '陈宁', age: 20, habit: '慢热简洁', job: '建筑设计专业大学生', facts: '住在城西；喜欢散步和摄影；最近项目周五交稿；周六下午有空；看过《完美的日子》，喜欢日常题材，不喜欢恐怖片；打字简洁，不常看手机。', opener: '今天在改图，刚忙完。', interests: '散步、摄影', activity: '沿河散步', place: '城西河边', available: '周六下午', unavailable: '周五前要交稿', book: '《完美的日子》', food: '面条' },
  { id: 'direct', name: '周岚', age: 23, habit: '比较直接', job: '产品助理', facts: '住在城南；喜欢羽毛球和喜剧；工作日晚上常加班；周六下午有空；更喜欢提前说清时间地点；今天晚饭吃了面条；不接受反复追问私人信息。', opener: '今天开了四个会，终于下班了。', interests: '羽毛球、喜剧', activity: '打羽毛球', place: '城南体育馆', available: '周六下午', unavailable: '工作日晚上常加班', book: '喜剧电影', food: '面条' },
] as const;
export function getPersona(id: string) { return personas.find(p => p.id === id) ?? personas[0]; }
