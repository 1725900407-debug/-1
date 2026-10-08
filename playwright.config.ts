import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./tests/e2e',timeout:30000,expect:{timeout:7000},fullyParallel:false,workers:1,
  use:{baseURL:'http://127.0.0.1:3100',headless:true,trace:'retain-on-failure',launchOptions:{executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']}},
  webServer:{command:'npm run start',url:'http://127.0.0.1:3100/api/status',timeout:30000,reuseExistingServer:false,env:{PORT:'3100',AI_API_KEY:'',APP_ACCESS_TOKEN:''}},
  reporter:'list',
});
