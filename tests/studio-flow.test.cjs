const {test,before,after} = require("node:test");
const assert = require("node:assert/strict");
const {chromium} = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const base = process.env.APP_BASE_URL || "http://127.0.0.1:8876";
let browser;
const fixtures = {
  ncstudios_bookings_v1:[
    {id:"a",clientName:"Alex + Jamie",eventDate:"2030-06-10",status:"confirmed",packagePrice:2000,depositPaid:500,contactEmail:"alex@example.com",updatedAt:"2026-09-01"},
    {id:"a-copy",clientName:"Alex and Jamie",eventDate:"2030-06-10",status:"confirmed",packagePrice:2000,depositPaid:500,updatedAt:"2026-08-01"},
    {id:"b",clientName:"Morgan + Taylor",eventDate:"2030-07-12",status:"enquiry",packagePrice:1000},
    {id:"c",clientName:"Alex + Jamie",eventDate:"2030-05-10",status:"completed",pipelineStage:"delivered",packagePrice:600,totalPaid:600},
    {id:"d",clientName:"Casey + Drew",eventDate:"2030-08-10",status:"postponed"}
  ],
  ncstudios_finance_v1:[{id:"deposit-a",client:"Alex + Jamie",bookingId:"a",type:"income",amount:500,status:"paid",date:"2026-09-01"}],
  ncstudios_lists_v1:[{id:"task-a",project:"Alex + Jamie",bookingId:"a",title:"Confirm venue",status:"open",dueDate:"2020-01-01"}],
  ncstudios_delivery_v1:[{id:"delivery-c",client:"Alex + Jamie",bookingId:"c",projectName:"Alex + Jamie",stage:"delivered",progress:100}],
  ncstudios_messages_v1:[{id:"message-b",clientName:"Morgan + Taylor",linkedBookingId:"b",subject:"Our wedding",message:"Can we book?",status:"new"}]
};
const fakeSupabase = `
window.ncSupabase={
  auth:{
    getSession:async()=>({data:{session:localStorage.getItem("test_signed_in")?{access_token:"test"}:null}}),
    signInWithPassword:async()=>({data:{},error:null})
  },
  from(table){
    const query={
      key:null,
      select(){return this},eq(field,key){this.key=key;return this},
      is(){return this},order(){return this},like(){return this},update(){return this},in(){return this},delete(){return this},
      async maybeSingle(){
        const remote=JSON.parse(localStorage.getItem("test_remote") || "{}");
        return {data:remote[this.key]?{data:remote[this.key]}:null,error:null};
      },
      async upsert(row){
        if(localStorage.getItem("test_save_fails"))return {error:{message:"offline"}};
        const remote=JSON.parse(localStorage.getItem("test_remote") || "{}");
        remote[row.app_key]=row.data;localStorage.setItem("test_remote",JSON.stringify(remote));
        return {data:null,error:null};
      },
      then(resolve,reject){return Promise.resolve({data:[],error:null}).then(resolve,reject)}
    };
    return query;
  }
};`;
async function contextPage(viewport={width:1365,height:900}){
  const context=await browser.newContext({viewport,serviceWorkers:"block"});
  await context.route("**/supabase-config.js*",route=>route.fulfill({contentType:"application/javascript",body:fakeSupabase}));
  await context.route("https://cdn.jsdelivr.net/**",route=>route.abort());
  await context.addInitScript(data=>{
    if(localStorage.getItem("test_seeded"))return;
    Object.entries(data).forEach(([key,value])=>localStorage.setItem(key,JSON.stringify(value)));
    localStorage.setItem("test_seeded","yes");
  },fixtures);
  const page=await context.newPage();
  const errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  return {context,page,errors};
}
async function workspace(viewport={width:1365,height:900}){
  const {context,page,errors}=await contextPage(viewport);
  await page.goto(base+"/crm.html");
  await page.waitForSelector("#flowResults");
  const local=page.locator(".ncSyncLocalOnly");
  if(await local.isVisible())await local.click();
  return {context,page,errors};
}
async function waitForApp(page,selector){
  try{await page.waitForSelector(selector,{timeout:5000});}
  catch{await page.reload();await page.waitForSelector(selector,{timeout:30000});}
}
before(async()=>{browser=await chromium.launch({channel:"chrome",headless:true});});
after(async()=>{await browser?.close();});

test("Existing records group duplicates, retain separate dates and do not double-count deposits",async()=>{
  const {context,page,errors}=await workspace();
  const records=await page.evaluate(()=>window.NCFlow.buildRecords().map(item=>({id:item.id,name:item.name,balance:item.balance,paid:item.paid,stage:item.stage,tasks:item.tasks.length})));
  assert.equal(records.length,4);
  assert.equal(records.find(item=>item.id==="a").balance,1500);
  assert.equal(records.find(item=>item.id==="a").paid,500);
  assert.equal(records.find(item=>item.id==="a").tasks,1);
  assert.equal(records.find(item=>item.id==="c").tasks,0);
  assert.equal(records.find(item=>item.id==="d").stage,"postponed");
  assert.deepEqual(errors,[]);
  await context.close();
});

test("Client workspace saves stage, payment, task, delivery link and archive without deleting data",async()=>{
  const {context,page,errors}=await workspace();
  await page.locator('[data-open="a"]').click();
  await page.locator('[data-form="overview"] [name="pipelineStage"]').selectOption("planning");
  await page.locator('[data-form="overview"] [name="contractStatus"]').selectOption("signed");
  await page.getByRole("button",{name:"Save next step",exact:true}).click();
  await page.locator('[data-tab="payments"]').click();
  await page.locator('[data-form="payment"] [name="amount"]').fill("1500");
  await page.getByRole("button",{name:"Record payment",exact:true}).click();
  const money=await page.evaluate(()=>window.NCFlow.buildRecords().find(item=>item.id==="a"));
  assert.equal(money.balance,0);
  assert.equal(money.paid,2000);
  await page.locator('[data-tab="tasks"]').click();
  await page.locator('[data-form="task"] [name="title"]').fill("Send final timetable");
  await page.getByRole("button",{name:"Add task",exact:true}).click();
  const task=page.locator(".flow-task-row").filter({hasText:"Send final timetable"});
  await task.locator("input").check();
  assert.match(await task.getAttribute("class"),/done/);
  await page.locator('[data-tab="files"]').click();
  await page.locator('[name="vaultUrl"]').fill("https://ncstudiouk.co.uk/client-delivery.html?code=EXAMPLE");
  await page.locator('[data-form="files"] [name="stage"]').selectOption("review");
  await page.getByRole("button",{name:"Save delivery",exact:true}).click();
  assert.equal(await page.locator('a:has-text("Client delivery")').getAttribute("href"),"https://ncstudiouk.co.uk/client-delivery.html?code=EXAMPLE");
  await page.locator('[data-tab="overview"]').click();
  await page.getByRole("button",{name:"Archive project",exact:true}).click();
  assert.equal(await page.evaluate(()=>window.NCFlow.buildRecords().find(item=>item.id==="a").stage),"archived");
  await page.getByRole("button",{name:"Restore to pipeline",exact:true}).click();
  assert.equal(await page.evaluate(()=>window.NCFlow.buildRecords().find(item=>item.id==="a").stage),"review");
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem("ncstudios_bookings_v1")).length),5);
  await page.locator("[data-close]").click();
  await page.reload();
  await page.waitForSelector(".flow-project-card");
  assert.equal(await page.evaluate(()=>window.NCFlow.buildRecords().find(item=>item.id==="a").paid),2000);
  assert.deepEqual(errors,[]);
  await context.close();
});

test("New enquiries appear, duplicate creation opens existing project, stage moves and filters work",async()=>{
  const {context,page,errors}=await workspace();
  await page.locator("[data-new]").click();
  await page.locator('[name="clientName"]').fill("Jordan + Reese");
  await page.locator('[name="eventDate"]').fill("2030-09-12");
  await page.getByRole("button",{name:"Create project",exact:true}).click();
  await page.locator("[data-close]").click();
  await page.locator("#flowSearch").fill("Jordan");
  assert.equal(await page.locator(".flow-project-card").count(),1);
  const id=await page.locator("[data-stage-id]").getAttribute("data-stage-id");
  await page.locator("[data-stage-id]").selectOption("consultation");
  assert.equal(await page.evaluate(id=>window.NCFlow.buildRecords().find(item=>item.id===id).stage,id),"consultation");
  await page.locator("[data-new]").click();
  await page.locator('[name="clientName"]').fill("Jordan and Reese");
  await page.locator('[name="eventDate"]').fill("2030-09-12");
  await page.getByRole("button",{name:"Create project",exact:true}).click();
  assert.equal(await page.evaluate(()=>window.NCFlow.buildRecords().filter(item=>item.name.includes("Jordan")).length),1);
  await page.locator("[data-close]").click();
  await page.locator("#flowSearch").fill("");
  await page.locator('[data-filter="money"]').click();
  assert.equal(await page.locator(".flow-project-card").count(),2);
  await page.locator('[data-view="list"]').click();
  assert.equal(await page.locator(".flow-table tbody tr").count(),2);
  assert.deepEqual(errors,[]);
  await context.close();
});

test("Unsynced edits and removals survive reload and merge with cloud records",async()=>{
  const {context,page,errors}=await workspace();
  await page.evaluate(()=>{
    const key="ncstudios_bookings_v1";
    const rows=JSON.parse(localStorage.getItem(key));
    rows.find(item=>item.id==="b").nextAction="Call Morgan after work";
    localStorage.setItem(key,JSON.stringify(rows.filter(item=>item.id!=="d")));
    const remote=rows.map(item=>item.id==="b"?{...item,nextAction:"Old cloud text"}:item);
    remote.push({id:"cloud-new",clientName:"New website couple",status:"enquiry"});
    localStorage.setItem("test_remote",JSON.stringify({[key]:remote}));
    localStorage.setItem("test_signed_in","yes");
    localStorage.setItem("test_save_fails","yes");
  });
  await page.reload();
  await page.waitForFunction(()=>document.getElementById("flowSync").textContent.includes("unavailable"));
  let rows=await page.evaluate(()=>JSON.parse(localStorage.getItem("ncstudios_bookings_v1")));
  assert.equal(rows.find(item=>item.id==="b").nextAction,"Call Morgan after work");
  assert.ok(rows.some(item=>item.id==="cloud-new"));
  assert.ok(!rows.some(item=>item.id==="d"));
  assert.ok(await page.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem("ncstudio_unsynced_changes_v1"))).length)>0);
  await page.evaluate(()=>localStorage.removeItem("test_save_fails"));
  await page.locator("[data-refresh]").click();
  await page.waitForFunction(()=>document.getElementById("flowSync").textContent.includes("Synced"));
  rows=await page.evaluate(()=>JSON.parse(localStorage.getItem("test_remote")).ncstudios_bookings_v1);
  assert.equal(rows.find(item=>item.id==="b").nextAction,"Call Morgan after work");
  assert.ok(!rows.some(item=>item.id==="d"));
  assert.deepEqual(errors,[]);
  await context.close();
});

test("Dashboard fits phone and desktop, widgets are equal, tools and all local navigation resolve",async()=>{
  fs.mkdirSync(path.join(process.cwd(),"work","app-flow-preview"),{recursive:true});
  for(const viewport of [{width:390,height:844},{width:320,height:568},{width:1365,height:900}]){
    const {context,page,errors}=await contextPage(viewport);
    await page.goto(base+"/dashboard.html");
    await waitForApp(page,".home-widget");
    const local=page.locator(".ncSyncLocalOnly");if(await local.isVisible())await local.click();
    const layout=await page.evaluate(()=>({
      height:document.documentElement.scrollHeight,width:document.documentElement.scrollWidth,
      viewportHeight:innerHeight,viewportWidth:innerWidth,
      widgets:[...document.querySelectorAll(".home-widget")].map(item=>({width:item.getBoundingClientRect().width,height:item.getBoundingClientRect().height}))
    }));
    assert.ok(layout.height<=layout.viewportHeight+1,JSON.stringify(layout));
    assert.ok(layout.width<=layout.viewportWidth+1,JSON.stringify(layout));
    assert.ok(layout.widgets.every(item=>item.height===layout.widgets[0].height && Math.abs(item.width-layout.widgets[0].width)<1));
    await page.screenshot({path:path.join(process.cwd(),"work","app-flow-preview","home-"+viewport.width+".png")});
    await page.locator(viewport.width<700?".flow-mobile-nav [data-tools]":".flow-nav [data-tools]").click();
    assert.ok(await page.locator("#flowTools").isVisible());
    const links=await page.locator("#flowTools a").evaluateAll(items=>items.map(item=>item.getAttribute("href")).filter(href=>!href.startsWith("https:")));
    for(const href of links)assert.equal((await page.request.get(base+"/"+href)).status(),200,href);
    await page.locator("#flowTools button").click();
    assert.deepEqual(errors,[]);
    await context.close();
  }
});

test("Legacy app tools share the dashboard theme on desktop and mobile",async()=>{
  const pages=["bookings.html","clients.html","finance.html","delivery.html","lists.html","shot-lists.html","messages.html","templates.html","admin.html"];
  for(const viewport of [{width:390,height:844},{width:1365,height:900}]){
    const {context,page}=await contextPage(viewport);
    for(const name of pages){
      await page.goto(base+"/"+name);
      await page.waitForFunction(()=>document.body.classList.contains("nc-unified-app"));
      await page.waitForFunction(()=>getComputedStyle(document.body).backgroundColor==="rgb(16, 16, 16)");
      const layout=await page.evaluate(()=>({
        width:document.documentElement.scrollWidth,
        viewportWidth:innerWidth,
        sidebar:getComputedStyle(document.querySelector(".flow-legacy-sidebar")).display,
        dock:getComputedStyle(document.querySelector(".flow-mobile-nav")).display,
        panelRadius:getComputedStyle(document.querySelector(".panel,.card,.ops-panel") || document.body).borderRadius,
        buttonRadius:getComputedStyle(document.querySelector("button")).borderRadius
      }));
      assert.ok(layout.width<=layout.viewportWidth+1,`${name}: ${JSON.stringify(layout)}`);
      assert.equal(viewport.width<700,layout.sidebar==="none",name);
      assert.equal(viewport.width<700,layout.dock!=="none",name);
      assert.ok(parseFloat(layout.buttonRadius)<=8,`${name}: ${layout.buttonRadius}`);
    }
    await context.close();
  }
});

test("Client vault and delivery load the matching white and gold theme",async()=>{
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:"block"});
  const page=await context.newPage();
  for(const name of ["client-vault.html","client-delivery.html"]){
    const response=await page.goto(base+"/docs/"+name);
    assert.equal(response.status(),200,name);
    await page.waitForFunction(()=>getComputedStyle(document.documentElement).getPropertyValue("--gold").trim()==="#d8b76e");
    assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),"rgb(16, 16, 16)");
  }
  await context.close();
});
