import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

test('单文件便携网页：断网完成修改、多轮复盘、保存与手机布局',async({page,context})=>{
  test.skip(!process.env.PORTABLE_TEST,'仅便携版验证');
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'今天，也给表达一点时间'})).toBeVisible();
  await context.setOffline(true);
  const external:string[]=[];page.on('request',req=>{if(/^https?:/.test(req.url()))external.push(req.url());});
  await page.getByRole('button',{name:'开始 10 分钟练习'}).click();await page.getByLabel('收藏本题').click();
  await page.getByLabel('轮到你了，你会怎么回复？').fill('你做什么工作？你住哪里？几岁？');await page.getByRole('button',{name:'提交回复',exact:true}).click();
  await page.getByLabel('修改后的回复').fill('你好，我是刚才桌游的阿川，那局太好玩了。');await page.getByRole('button',{name:'提交修改并比较'}).click();await expect(page.getByText('修改前后比较')).toBeVisible();
  await context.setOffline(false);await page.reload();await expect(page.getByText('已记入学习记录',{exact:false})).toBeVisible();await expect(page.getByLabel('取消收藏')).toBeVisible();await context.setOffline(true);external.length=0;
  await page.getByRole('link',{name:'多轮模拟'}).click();await page.getByRole('button',{name:/陈宁/}).click();await page.getByLabel('熟悉程度').selectOption('聊过几次');await page.getByLabel('目标轮数').selectOption('5');await page.getByRole('button',{name:'开始模拟'}).click();
  for(const text of ['最近看什么电影？','那部电影哪段你印象比较深？','周末喜欢散步吗？','周六下午一起散步吗？','好，周六下午见。']){await page.getByLabel('你的回复',{exact:true}).fill(text);await page.getByRole('button',{name:'发送',exact:true}).click();await expect(page.getByRole('button',{name:'对方正在回应…'})).toHaveCount(0);}
  await expect(page.getByText('最近看过《完美的日子》，挺喜欢的。')).toBeVisible();await page.getByRole('button',{name:'查看本次复盘'}).click();await expect(page.getByRole('heading',{name:'可以观察到'})).toBeVisible();
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const store=await page.evaluate(()=>JSON.parse(localStorage.getItem('chat-practice-room:v1')!));expect(store.records).toHaveLength(1);expect(store.sessions).toHaveLength(1);
  expect(external).toEqual([]);expect(errors).toEqual([]);
  await page.screenshot({path:'test-results/offline-mobile.png',fullPage:true});
});

test('file:// 直接打开便携文件',async({page})=>{
  test.skip(!process.env.PORTABLE_TEST,'仅便携版验证');
  try{await page.goto(pathToFileURL(path.resolve('portable/index.html')).href);}catch(error){
    test.skip(String(error).includes('ERR_BLOCKED_BY_ADMINISTRATOR'),'云环境浏览器策略禁止 file://；Python 地址已单独完整验收');throw error;
  }
  await expect(page.getByRole('heading',{name:'今天，也给表达一点时间'})).toBeVisible();
  await page.getByRole('button',{name:'开始 10 分钟练习'}).click();await page.getByLabel('轮到你了，你会怎么回复？').fill('你好，我是阿川。');await page.getByRole('button',{name:'提交回复',exact:true}).click();await expect(page.getByText('先自己修改一次')).toBeVisible();
});
