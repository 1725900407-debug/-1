import { test, expect } from '@playwright/test';

test('核心闭环：作答、提示、修改、评分比较、收藏、刷新和迁移训练',async({page})=>{
  await page.goto('/');await expect(page.getByRole('heading',{name:'今天，也给表达一点时间'})).toBeVisible();
  await page.getByRole('button',{name:'开始 10 分钟练习'}).click();
  await expect(page.getByRole('heading',{name:'把线下的相遇接起来'})).toBeVisible();
  await page.getByLabel('收藏本题').click();await page.getByRole('button',{name:'给我一点提示'}).click();
  await page.getByLabel('轮到你了，你会怎么回复？').fill('你干什么工作？你住哪里？为什么这么晚？');
  await page.getByRole('button',{name:'提交回复',exact:true}).click();await expect(page.getByRole('heading',{name:'一次放了多个问题，对方可能不知道先回答哪一个。'})).toBeVisible();
  await expect(page.getByRole('tab',{name:'参考改写'})).toHaveCount(0);
  await page.getByLabel('修改后的回复').fill('你好，我是刚才桌游活动的阿川，那局真的很好玩。');await page.getByRole('button',{name:'提交修改并比较'}).click();
  await expect(page.getByText('修改前后比较')).toBeVisible();await page.getByRole('tab',{name:'参考改写'}).click();await expect(page.getByText('保留表达风格',{exact:true})).toBeVisible();
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('chat-practice-room:v1')!));expect(stored.records).toHaveLength(1);expect(stored.records[0].original).toBeTruthy();expect(stored.records[0].hints).toBe(1);
  await page.reload();await expect(page.getByText('已记入学习记录',{exact:false})).toBeVisible();await expect(page.getByLabel('取消收藏')).toBeVisible();
  await page.goto('/#progress');await expect(page.getByText('借助提示',{exact:false})).toHaveCount(0);await expect(page.getByText('使用 1 级提示',{exact:false})).toBeVisible();
  await page.goto('/#collection');await page.getByRole('button',{name:'收藏',exact:false}).last().click();await expect(page.getByRole('heading',{name:'把线下的相遇接起来'})).toBeVisible();
});
test('多轮模拟完成5轮，上下文、复盘和持久保存',async({page})=>{
  await page.goto('/#simulation');await page.getByRole('button',{name:/陈宁/}).click();await page.getByLabel('熟悉程度').selectOption('聊过几次');await page.getByLabel('目标轮数').selectOption('5');await page.getByRole('button',{name:'实战模式'}).click();await page.getByRole('button',{name:'开始模拟'}).click();
  for(const text of ['最近看什么电影？','我也喜欢日常题材电影。','你周末喜欢散步吗？','周六下午一起去散步吗？','好，周六下午见。']){await page.getByLabel('你的回复',{exact:true}).fill(text);await page.getByRole('button',{name:'发送',exact:true}).click();await expect(page.getByRole('button',{name:'对方正在回应…'})).toHaveCount(0);}
  await expect(page.getByText('最近看过《完美的日子》，挺喜欢的。')).toBeVisible();await expect(page.getByText(/城西河边对我挺方便/)).toBeVisible();
  await page.getByRole('button',{name:'查看本次复盘'}).click();await expect(page.getByRole('heading',{name:'可以观察到'})).toBeVisible();
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('chat-practice-room:v1')!));expect(stored.sessions).toHaveLength(1);expect(stored.sessions[0].messages.filter((m:{role:string})=>m.role==='me')).toHaveLength(5);
  await page.reload();await expect(page.getByText('已保存本次模拟')).toBeVisible();
  await page.screenshot({path:'test-results/simulation-desktop.png',fullPage:true});
});
test('错题专项迁移、独立完成和两次能力趋势',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'开始 10 分钟练习'}).click();await page.getByLabel('轮到你了，你会怎么回复？').fill('你住哪里？工作做什么？为什么？什么时候？');await page.getByRole('button',{name:'提交回复',exact:true}).click();await page.getByRole('button',{name:'直接看完整参考并记录'}).click();
  await page.goto('/#collection');await expect(page.getByRole('heading',{name:'把线下的相遇接起来'})).toBeVisible();
  await page.getByRole('button',{name:'换个相似情境'}).click();await expect(page.getByRole('heading',{name:'新的情境：接住宠物分享'})).toBeVisible();
  await page.getByLabel('轮到你了，你会怎么回复？').fill('这猫占的位置很稳，键盘又归它了。');await page.getByRole('button',{name:'提交回复',exact:true}).click();await page.getByRole('button',{name:'直接看完整参考并记录'}).click();
  await page.goto('/#progress');await expect(page.getByRole('img',{name:/贴合上下文最近2次评分/})).toBeVisible();await expect(page.getByRole('heading',{name:'连续提问',exact:true})).toBeVisible();
  await page.getByRole('button',{name:/连续提问.*用新情境检验/}).click();await expect(page.getByRole('heading',{name:'新的情境：接住宠物分享'})).toBeVisible();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('chat-practice-room:v1')!).records.filter((r:{hints:number})=>r.hints===0).length)).toBe(2);
});
test('手机完成练习与带头像的聊天，异常结构不进入历史',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');await page.getByRole('button',{name:'开始 10 分钟练习'}).click();
  await page.getByLabel('轮到你了，你会怎么回复？').fill('你好，我是刚才桌游的阿川。');await page.route('**/api/practice',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{summary:'不完整'}})}));await page.getByRole('button',{name:'提交回复',exact:true}).click();await expect(page.getByRole('alert')).toContainText('反馈内容不完整');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('chat-practice-room:v1')!).records.length)).toBe(0);await page.unroute('**/api/practice');await page.getByRole('button',{name:'重试',exact:true}).click();await page.getByRole('button',{name:'直接看完整参考并记录'}).click();await expect(page.getByText('已记入学习记录',{exact:false})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.goto('/#simulation');await expect(page.getByRole('img',{name:'林悦的虚构角色头像'})).toBeVisible();await page.getByRole('button',{name:'开始模拟'}).click();await page.getByLabel('你的回复',{exact:true}).fill('你好，我是上次聚会认识的阿川。');await page.getByRole('button',{name:'发送',exact:true}).click();await expect(page.getByRole('button',{name:'对方正在回应…'})).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/simulation-mobile.png',fullPage:true});
});
test('文本角色标记、事实与推测、默认不保存、主动保存',async({page})=>{
  await page.goto('/#review');await page.getByLabel('聊天文本',{exact:true}).fill('今天过得怎么样？\n对方：有点累。');await page.getByRole('button',{name:'解析并标记'}).click();
  await page.getByRole('button',{name:'开始复盘'}).click();await expect(page.getByRole('alert')).toContainText('角色未识别');
  await page.getByLabel('我已确认消息归属').check();await page.getByRole('button',{name:'开始复盘'}).click();await expect(page.getByText('建议：等待')).toBeVisible();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('chat-practice-room:v1')!).reviews.length)).toBe(0);
  await page.getByLabel('我主动选择把原文和复盘保存在当前浏览器').check();await page.getByRole('button',{name:'保存这次复盘'}).click();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('chat-practice-room:v1')!).reviews.length)).toBe(1);
  await page.goto('/#home');await page.goto('/#review');await expect(page.getByLabel('聊天文本',{exact:true})).toHaveValue('');
});
test('空输入、网络失败、重试保留输入、AI未配置、超长输入限制',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'开始 10 分钟练习'}).click();await page.getByRole('button',{name:'提交回复',exact:true}).click();await expect(page.getByRole('alert')).toContainText('写一句');
  await page.getByLabel('轮到你了，你会怎么回复？').fill('你好，我是刚才桌游活动的阿川。');await page.route('**/api/practice',route=>route.abort());await page.getByRole('button',{name:'提交回复',exact:true}).click();await expect(page.getByRole('alert')).toContainText('网络连接失败');await expect(page.getByLabel('轮到你了，你会怎么回复？')).toHaveValue('你好，我是刚才桌游活动的阿川。');
  await page.unroute('**/api/practice');await page.getByRole('button',{name:'重试',exact:true}).click();await expect(page.getByText('先自己修改一次')).toBeVisible();
  await page.goto('/#settings');await page.getByRole('button',{name:/AI 分析模式/}).click();await page.getByLabel('我了解情境输入').check();await page.goto('/#practice');await page.getByRole('button',{name:'第一句话',exact:false}).count();
  await page.getByRole('button',{name:/把线下的相遇接起来/}).click();await page.getByLabel('轮到你了，你会怎么回复？').fill('你好');await page.getByRole('button',{name:'提交回复',exact:true}).click();await expect(page.getByRole('alert')).toContainText('尚未配置 AI');
  await expect(page.getByLabel('轮到你了，你会怎么回复？')).toHaveAttribute('maxlength','1000');
});
test('导出导入、清空确认和收藏持久化',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'开始 10 分钟练习'}).click();await page.getByLabel('收藏本题').click();await page.goto('/#settings');
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'导出学习记录',exact:true}).click();const download=await downloadPromise;expect(download.suggestedFilename()).toContain('聊天练习室');
  page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:'清空学习记录'}).click();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('chat-practice-room:v1')!).favorites.length)).toBe(1);
  page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'清空学习记录'}).click();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('chat-practice-room:v1')!).favorites.length)).toBe(0);
  const filePath=await download.path();page.once('dialog',dialog=>dialog.accept());await page.getByLabel('导入记录文件').setInputFiles(filePath!);await expect(page.getByText('记录导入成功。')).toBeVisible();await page.reload();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('chat-practice-room:v1')!).favorites.length)).toBe(1);
});
test('手机布局、全部页面无横向溢出或浏览器错误',async({page})=>{
  await page.setViewportSize({width:390,height:844});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  for(const route of ['home','practice','simulation','review','collection','progress','settings']){await page.goto('/#'+route);await expect(page.locator('h1')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);}
  await page.getByLabel('打开菜单').click();await expect(page.getByRole('link',{name:'多轮模拟'})).toBeVisible();await page.getByRole('link',{name:'多轮模拟'}).click();await expect(page.getByRole('heading',{name:'把聊天慢慢接下去'})).toBeVisible();
  expect(errors).toEqual([]);await page.goto('/#home');await expect.poll(()=>page.locator('.sidebar').evaluate(el=>el.getBoundingClientRect().right)).toBeLessThanOrEqual(0);await page.screenshot({path:'test-results/mobile-home.png',fullPage:true});
});
test('桌面首页及学习趋势截图',async({page})=>{await page.setViewportSize({width:1440,height:1000});await page.goto('/');await page.screenshot({path:'test-results/desktop-home.png',fullPage:true});await expect(page.getByRole('button',{name:'开始 10 分钟练习'})).toBeVisible();});
