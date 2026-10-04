(function(){
  "use strict";
  const KEYS = {
    bookings:"ncstudios_bookings_v1", clients:"ncstudios_clients_v1",
    finance:"ncstudios_finance_v1", delivery:"ncstudios_delivery_v1",
    tasks:"ncstudios_lists_v1", messages:"ncstudios_messages_v1",
    profiles:"ncstudios_crm_profiles_v1", stages:"ncstudios_project_status_v1",
    consultations:"ncstudios_consultations_v1", admin:"ncStudiosAdminTrackerV1"
  };
  const STAGES = [
    ["enquiry","Enquiry"],["consultation","Consultation"],["proposal","Proposal / contract"],
    ["booked","Booked"],["planning","Planning"],["editing","Editing"],
    ["review","Client review"],["delivered","Delivered"],["postponed","Postponed"],["archived","Archived"]
  ];
  const LEGACY_STAGES = {
    "new-enquiry":"enquiry","availability-confirmed":"consultation","waiting-response":"proposal",
    "proposal-sent":"proposal","contract-sent":"proposal","deposit-requested":"proposal",
    "pre-wedding":"planning","final-consultation":"planning","wedding-completed":"editing",
    "completed":"editing","complete":"delivered","confirmed":"booked","active":"planning",
    "not-started":"booked","not-booking":"archived","cancelled":"archived"
  };
  const e = value => String(value ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
  const number = value => Math.max(0,Number(value) || 0);
  const cash = value => new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP",maximumFractionDigits:2}).format(number(value));
  const uid = () => crypto.randomUUID();
  const isoNow = () => new Date().toISOString();
  function today(){
    const date=new Date();
    return [date.getFullYear(),String(date.getMonth()+1).padStart(2,"0"),String(date.getDate()).padStart(2,"0")].join("-");
  }
  function niceDate(value){
    if(!value)return "Date to confirm";
    const date=new Date(String(value).slice(0,10)+"T12:00:00");
    return Number.isNaN(date.getTime())?"Date to confirm":date.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"});
  }
  function nameKey(value){
    return String(value || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
      .replace(/\b(and|the|wedding|film|films|project)\b/g," ").replace(/[^a-z0-9]/g," ")
      .trim().split(/\s+/).filter(Boolean).sort().join(" ");
  }
  function read(key){
    try{const value=JSON.parse(localStorage.getItem(key));return Array.isArray(value)?value:[];}
    catch{return [];}
  }
  function load(){return Object.fromEntries(Object.entries(KEYS).map(([name,key])=>[name,read(key)]));}
  function write(name,items){
    localStorage.setItem(KEYS[name],JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("nc:records-updated"));
  }
  const latest = items => [...items].sort((a,b)=>String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")))[0] || {};
  const label = stage => STAGES.find(item=>item[0]===stage)?.[1] || "Enquiry";
  const normalizeStage = stage => STAGES.some(item=>item[0]===stage)?stage:LEGACY_STAGES[stage];
  function httpUrl(value){
    if(!value)return "";
    try{const url=new URL(value);return ["https:","http:"].includes(url.protocol)?url.href:"";}catch{return "";}
  }
  const page = document.body.dataset.flowPage;
  const root = document.getElementById("flowApp");
  let records=[], selected="", activeTab="overview", search="", filter="active", view="board", toastTimer;
  const params=new URLSearchParams(location.search);
  const initialFilter=params.get("stage") || params.get("filter");
  if(initialFilter && (STAGES.some(stage=>stage[0]===initialFilter) || ["attention","money","all","active"].includes(initialFilter)))filter=initialFilter;
  try{view=localStorage.getItem("ncstudio_pipeline_view")==="list"?"list":"board";}catch{}
  const icon = name => window.NCNavigation.icon(name);

  function buildRecords(data=load()){
    const result=[];
    const ensure=(name,date="",booking=null)=>{
      const key=nameKey(name);
      if(!key || key==="business")return null;
      let record=result.find(item=>item.nameKey===key && item.date===date);
      if(!record){
        record={id:booking?.id || "client:"+key+":"+date,name,nameKey:key,aliasKeys:[key],date,bookings:[],clients:[],finance:[],delivery:[],tasks:[],messages:[],profiles:[],stages:[],consultations:[],admin:[]};
        result.push(record);
      }
      return record;
    };
    data.bookings.forEach(item=>{
      const record=ensure(item.clientName || item.eventName,item.eventDate || "",item);
      if(record){
        record.bookings.push(item);
        record.aliasKeys=[...new Set(record.aliasKeys.concat((item.projectAliases || []).map(nameKey)))];
      }
    });
    function attach(collection,getName){
      data[collection].forEach(item=>{
        const name=getName(item);
        const key=nameKey(name);
        if(!key || key==="business")return;
        const linked=result.find(record=>record.bookings.some(booking=>booking.id===(item.bookingId || item.linkedBookingId)));
        const candidates=result.filter(record=>record.aliasKeys.includes(key));
        const date=item.eventDate || item.weddingDate || "";
        const record=linked || candidates.find(record=>date && record.date===date) || (candidates.length===1?candidates[0]:null) || (!candidates.length?ensure(name,date):null);
        if(record)record[collection].push(item);
      });
    }
    attach("clients",item=>item.clientName || item.name || item.full_name);
    attach("delivery",item=>item.client || item.projectName);
    attach("profiles",item=>item.clientName);
    attach("stages",item=>item.project);
    attach("messages",item=>item.clientName || item.project);
    attach("tasks",item=>item.project);
    attach("finance",item=>item.client || item.project);
    attach("consultations",item=>item.project || item.contactName);
    attach("admin",item=>item.name || item.clientName);
    return result.map(record=>{
      const booking=latest(record.bookings),client=latest(record.clients),profile=latest(record.profiles),delivery=latest(record.delivery);
      record.booking=booking;record.client=client;record.profile=profile;record.deliveryJob=delivery;
      record.date=record.date || client.eventDate || latest(record.consultations).weddingDate || "";
      record.email=booking.contactEmail || profile.email || client.email || latest(record.messages).contactEmail || noteContact(booking.notes,"email");
      record.phone=booking.contactPhone || profile.phone || client.phone || latest(record.messages).contactPhone || noteContact(booking.notes,"phone");
      record.price=number(booking.packagePrice || profile.packagePrice || client.packagePrice);
      // Legacy deposits and paid finance rows often describe the same payment.
      const paidLedger=record.finance.filter(item=>item.type==="income" && item.status==="paid").reduce((sum,item)=>sum+number(item.amount),0);
      record.paid=Math.max(number(booking.totalPaid),number(booking.depositPaid),paidLedger);
      const unpaid=record.finance.filter(item=>item.type==="income" && !["paid","cancelled","void"].includes(item.status)).reduce((sum,item)=>sum+number(item.amount),0);
      record.balance=record.price?Math.max(0,record.price-record.paid):Math.max(unpaid,number(profile.balanceDue));
      record.contract=booking.contractStatus || profile.contractStatus || (latest(record.admin).checklist?.contractSigned?"signed":"not sent");
      let stage=normalizeStage(booking.pipelineStage);
      if(["cancelled","not-booking"].includes(booking.status))stage="archived";
      if(booking.status==="postponed")stage="postponed";
      if(!stage && ["delivered","completed"].includes(delivery.stage))stage="delivered";
      if(!stage && delivery.stage==="review")stage="review";
      if(!stage && ["editing","colour","sound","export","backup"].includes(delivery.stage))stage="editing";
      if(!stage)stage=normalizeStage(latest(record.stages).stage || latest(record.stages).status);
      record.stage=stage || normalizeStage(booking.status || client.status) || "enquiry";
      record.openMessages=record.messages.filter(item=>!["replied","archived"].includes(item.status));
      record.openTasks=record.tasks.filter(item=>!["done","completed","complete"].includes(item.status));
      record.action=nextAction(record);
      record.searchText=[record.name,record.email,record.phone,booking.eventName,booking.location,booking.notes,record.action].join(" ").toLowerCase();
      return record;
    }).sort((a,b)=>(a.date || "9999").localeCompare(b.date || "9999") || a.name.localeCompare(b.name));
  }
  function noteContact(notes,field){
    const pattern=field==="email"?/email\s*:\s*([^\s]+@[^\s]+)/i:/phone\s*:\s*([^\n]+)/i;
    return String(notes || "").match(pattern)?.[1]?.trim() || "";
  }
  function nextAction(record){
    if(["archived","delivered"].includes(record.stage))return record.stage==="delivered"?"Delivery complete":"Archived";
    const overdue=record.openTasks.find(task=>task.dueDate && task.dueDate<=today());
    if(overdue)return overdue.title || "Complete follow-up";
    if(record.openMessages.length)return "Reply to "+record.openMessages.length+" message"+(record.openMessages.length===1?"":"s");
    if(record.booking.nextAction)return record.booking.nextAction;
    if(record.balance>0 && record.booking.balanceDueDate && record.booking.balanceDueDate<=today())return "Chase payment: "+cash(record.balance);
    const defaults={enquiry:"Reply and check the date",consultation:"Arrange the consultation",proposal:record.contract==="signed"?"Confirm deposit received":"Send proposal / follow up contract",booked:"Confirm the planning details",planning:"Confirm timings and shot priorities",editing:"Edit and set the delivery date",review:"Get client approval",postponed:"Confirm the new date"};
    return record.deliveryJob.nextAction || defaults[record.stage] || "Set the next action";
  }
  function attention(){
    const items=[];
    records.filter(record=>!["archived","delivered"].includes(record.stage)).forEach(record=>{
      if(record.stage==="enquiry" && !record.openMessages.length)items.push({record,title:"Reply to "+record.name,detail:"New enquiry",rank:2});
      record.openMessages.forEach(message=>items.push({record,title:"Reply to "+record.name,detail:message.subject || "Client message",rank:1,href:"messages.html"}));
      record.openTasks.filter(task=>task.priority==="high" || (task.dueDate && task.dueDate<=today())).forEach(task=>items.push({record,title:task.title,detail:record.name+" · "+niceDate(task.dueDate),rank:0,taskId:task.id}));
      if(record.balance>0 && record.booking.balanceDueDate && record.booking.balanceDueDate<=today())items.push({record,title:cash(record.balance)+" due · "+record.name,detail:"Payment due "+niceDate(record.booking.balanceDueDate),rank:0,tab:"payments"});
      record.finance.filter(payment=>payment.type==="income" && ["waiting","unpaid"].includes(payment.status) && payment.date && payment.date<=today()).forEach(payment=>{
        items.push({record,title:cash(payment.amount)+" due · "+record.name,detail:payment.title || "Awaiting payment",rank:0,tab:"payments"});
      });
      if(record.booking.nextAction && record.booking.followUpDate && record.booking.followUpDate<=today())items.push({record,title:record.booking.nextAction,detail:record.name+" · follow-up due",rank:0});
      if(["booked","planning"].includes(record.stage) && record.contract!=="signed")items.push({record,title:"Contract · "+record.name,detail:"Signature still needed",rank:3});
      if(["booked","planning"].includes(record.stage) && record.date && record.date<today())items.push({record,title:"Update "+record.name,detail:"Shoot date passed · move to editing",rank:2});
      if(["editing","review"].includes(record.stage) && record.deliveryJob.dueDate && record.deliveryJob.dueDate<=today())items.push({record,title:"Delivery · "+record.name,detail:"Due "+niceDate(record.deliveryJob.dueDate),rank:0,tab:"files"});
    });
    load().tasks.filter(task=>(!task.project || task.project==="business") && task.status!=="done" && (task.priority==="high" || (task.dueDate && task.dueDate<=today()))).forEach(task=>items.push({title:task.title,detail:"Business · "+niceDate(task.dueDate),rank:0,href:"lists.html"}));
    return items.sort((a,b)=>a.rank-b.rank);
  }
  function nav(){
    return window.NCNavigation.primary.map(link=>'<a href="'+link.path+'" class="'+((page==="home" && link.label==="Home") || (page==="pipeline" && link.label==="Pipeline")?"active":"")+'">'+icon(link.icon)+'<span>'+link.label+'</span></a>').join("")+'<button type="button" data-tools>'+icon("grid-2x2")+'<span>Tools</span></button>';
  }
  function shell(){
    root.innerHTML='<div class="flow-shell"><aside class="flow-sidebar"><a class="flow-brand" href="dashboard.html"><img src="ncstudios-logo-mark-transparent.png" alt=""><span>nc studio</span></a><nav class="flow-nav" aria-label="App navigation">'+nav()+'</nav><div class="flow-sidebar-foot"><a href="https://ncstudiouk.co.uk/client-vault.html" target="_blank" rel="noopener">'+icon("folder-open")+'Client vault</a><a href="https://ncstudiouk.co.uk" target="_blank" rel="noopener">'+icon("arrow-up-right")+'Website</a></div></aside><main class="flow-main"><header class="flow-header"><div><p class="flow-eyebrow">NC Studio / '+(page==="home"?"Overview":"Client work")+'</p><h1>'+(page==="home"?"Your studio, today.":"Client pipeline")+'</h1></div><div class="flow-header-actions"><span class="flow-sync" id="flowSync" role="status">Saved on this device</span><button class="flow-icon-button" data-refresh title="Refresh enquiries and messages" aria-label="Refresh enquiries and messages">'+icon("refresh-cw")+'</button><button class="flow-primary flow-button" data-new>'+icon("plus")+'New project</button></div></header><div id="flowContent"></div></main></div><nav class="flow-mobile-nav" aria-label="Mobile app navigation">'+nav()+'</nav><dialog class="flow-dialog" id="flowProject" aria-labelledby="flowProjectTitle"></dialog><div class="flow-toast" id="flowToast" role="status" hidden></div>';
    if(page==="home")document.getElementById("flowContent").style.cssText="display:contents";
    root.addEventListener("click",onClick);
    root.addEventListener("change",onChange);
    root.addEventListener("submit",onSubmit);
    root.addEventListener("input",event=>{if(event.target.id==="flowSearch"){search=event.target.value;renderPipelineResults();}});
    const dialog=document.getElementById("flowProject");
    dialog.addEventListener("close",()=>{selected="";const url=new URL(location.href);url.searchParams.delete("client");history.replaceState(null,"",url);});
    root.addEventListener("dragstart",event=>{
      const card=event.target.closest("[data-drag-id]");
      if(card)event.dataTransfer.setData("text/plain",card.dataset.dragId);
    });
    root.addEventListener("dragover",event=>{const lane=event.target.closest("[data-lane]");if(lane){event.preventDefault();lane.classList.add("drag-over");}});
    root.addEventListener("dragleave",event=>event.target.closest("[data-lane]")?.classList.remove("drag-over"));
    root.addEventListener("drop",event=>{
      const lane=event.target.closest("[data-lane]");if(!lane)return;
      event.preventDefault();lane.classList.remove("drag-over");
      const record=records.find(item=>item.id===event.dataTransfer.getData("text/plain"));
      if(record)moveStage(record,lane.dataset.lane);
    });
  }
  function render(){
    records=buildRecords();
    if(page==="home")renderHome();else renderPipeline();
    icons();
  }
  function renderHome(){
    const active=records.filter(record=>!["archived","delivered"].includes(record.stage));
    const items=attention();
    const next=active.filter(record=>["booked","planning"].includes(record.stage) && record.date>=today())[0];
    const widgets=[
      ["New enquiries",active.filter(record=>record.stage==="enquiry").length,"crm.html?stage=enquiry","inbox"],
      ["Needs attention",items.length,"crm.html?filter=attention","circle-check"],
      ["Payments due",cash(active.reduce((sum,record)=>sum+record.balance,0)),"crm.html?filter=money","wallet"],
      ["In production",active.filter(record=>["editing","review"].includes(record.stage)).length,"delivery.html","film"],
      ["Shot lists","Shoot day",next?"shot-lists.html?project="+encodeURIComponent(next.booking.shootProjectName || next.name)+"#liveShots":"shot-lists.html","camera"],
      ["Client vault","Deliver","https://ncstudiouk.co.uk/client-vault.html","folder-open"]
    ];
    document.getElementById("flowContent").innerHTML='<section class="home-widgets" aria-label="Studio overview">'+widgets.map(widget=>'<a class="home-widget" href="'+widget[2]+'"><div class="home-widget-top"><span>'+widget[0]+'</span>'+icon(widget[3])+'</div><strong>'+e(widget[1])+'</strong></a>').join("")+'</section><div class="home-work"><section class="home-section"><div class="flow-section-head"><h2>Next actions</h2><a href="crm.html?filter=attention">View all</a></div><div class="home-actions">'+(items.length?items.map(item=>'<div class="flow-action-row"><div><strong>'+e(item.title)+'</strong><small>'+e(item.detail)+'</small></div>'+(item.href?'<a class="flow-button" href="'+item.href+'">Open</a>':'<button data-open="'+e(item.record.id)+'" data-open-tab="'+e(item.tab || "overview")+'" title="Open '+e(item.record.name)+'" aria-label="Open '+e(item.record.name)+'">'+icon("arrow-right")+'</button>')+'</div>').join(""):'<div class="flow-empty">You are up to date. Your next enquiry will appear here.</div>')+'</div></section><section class="home-section"><div class="flow-section-head"><h2>Next shoot</h2><a href="crm.html">Pipeline</a></div><div class="flow-next">'+(next?'<h3>'+e(next.name)+'</h3><p>'+niceDate(next.date)+' · '+e(next.booking.location || next.client.location || "Location to confirm")+'</p><div class="flow-links"><a class="flow-button flow-primary" href="shot-lists.html?project='+encodeURIComponent(next.name)+'#liveShots">'+icon("camera")+'Shot list</a><button data-open="'+e(next.id)+'">Client workspace</button></div>':'<p>No upcoming booked shoot.</p><a class="flow-button" href="shot-lists.html">'+icon("camera")+'Shot lists</a>')+'</div><div class="home-progress">'+["proposal","booked","planning","editing"].map(stage=>'<a href="crm.html?stage='+stage+'"><strong>'+active.filter(record=>record.stage===stage).length+'</strong>'+label(stage)+'</a>').join("")+'</div><div class="flow-links" style="margin-top:18px"><a class="flow-button" href="https://ncstudiouk.co.uk/client-vault.html" target="_blank" rel="noopener">'+icon("folder-open")+'Client vault</a><a class="flow-button" href="lists.html">'+icon("list-checks")+'Business tasks</a></div></section></div>';
  }
  function renderPipeline(){
    document.getElementById("flowContent").innerHTML='<div class="flow-toolbar"><input class="flow-search" id="flowSearch" type="search" placeholder="Search clients, venue or next action" aria-label="Search projects" value="'+e(search)+'"><select id="flowStageFilter" aria-label="Pipeline stage"><option value="active">Active projects</option><option value="all">All projects</option>'+STAGES.map(stage=>'<option value="'+stage[0]+'"'+(filter===stage[0]?" selected":"")+'>'+stage[1]+'</option>').join("")+'<option value="attention">Needs attention</option><option value="money">Money due</option></select><div class="flow-segments" aria-label="Pipeline view"><button data-view="board" title="Board view" aria-label="Board view" aria-pressed="'+(view==="board")+'" class="'+(view==="board"?"active":"")+'">'+icon("columns-3")+'</button><button data-view="list" title="List view" aria-label="List view" aria-pressed="'+(view==="list")+'" class="'+(view==="list"?"active":"")+'">'+icon("list")+'</button></div></div><div class="flow-filters">'+[["active","Active"],["enquiry","Enquiries"],["attention","Needs attention"],["money","Money due"],["postponed","Postponed"],["archived","Archived"]].map(item=>'<button data-filter="'+item[0]+'" aria-pressed="'+(filter===item[0])+'" class="'+(filter===item[0]?"active":"")+'">'+item[1]+'</button>').join("")+'</div><p class="flow-pipeline-count" id="flowCount"></p><div id="flowResults"></div>';
    document.getElementById("flowStageFilter").value=filter;
    renderPipelineResults();
  }
  function visibleRecords(){
    const needIds=new Set(attention().map(item=>item.record?.id));
    return records.filter(record=>record.searchText.includes(search.toLowerCase()) && (
      filter==="all" || (filter==="active" && record.stage!=="archived") ||
      (filter==="attention" && needIds.has(record.id)) ||
      (filter==="money" && record.balance>0 && record.stage!=="archived") || filter===record.stage
    ));
  }
  function stageSelect(record){
    return '<select data-stage-id="'+e(record.id)+'" aria-label="Stage for '+e(record.name)+'">'+options(STAGES,record.stage)+'</select>';
  }
  function renderPipelineResults(){
    const visible=visibleRecords();
    document.getElementById("flowCount").textContent=visible.length+" project"+(visible.length===1?"":"s")+" · "+cash(visible.reduce((sum,record)=>sum+record.balance,0))+" outstanding";
    if(!visible.length){document.getElementById("flowResults").innerHTML='<div class="flow-empty">No projects in this view.</div>';return;}
    if(view==="board"){
      const stages=STAGES.filter(stage=>filter==="all" || stage[0]!=="archived" || filter==="archived");
      document.getElementById("flowResults").innerHTML='<div class="flow-board">'+stages.map(stage=>{
        const group=visible.filter(record=>record.stage===stage[0]);
        return '<section class="flow-lane" data-lane="'+stage[0]+'"><h2>'+stage[1]+'<span>'+group.length+'</span></h2>'+(group.length?group.map(record=>'<article class="flow-project-card" draggable="true" data-drag-id="'+e(record.id)+'"><button class="flow-card-open" data-open="'+e(record.id)+'"><strong>'+e(record.name)+'</strong><span>'+niceDate(record.date)+'</span><span>'+e(record.booking.packageName || record.booking.eventName || "Client project")+'</span></button><p class="flow-card-action">'+e(record.action)+'</p><p style="font-size:12px;color:var(--flow-muted)">'+(record.balance?cash(record.balance)+" due":"No balance due")+'</p>'+stageSelect(record)+'</article>').join(""):'<div class="flow-empty">No projects</div>')+'</section>';
      }).join("")+'</div>';
    }else{
      document.getElementById("flowResults").innerHTML='<div class="flow-table-wrap"><table class="flow-table"><thead><tr><th>Client / project</th><th>Stage</th><th class="flow-table-secondary">Next action</th><th>Balance</th></tr></thead><tbody>'+visible.map(record=>'<tr><td><button data-open="'+e(record.id)+'"><strong>'+e(record.name)+'</strong><small>'+niceDate(record.date)+'</small></button></td><td>'+stageSelect(record)+'</td><td class="flow-table-secondary">'+e(record.action)+'</td><td>'+cash(record.balance)+'</td></tr>').join("")+'</tbody></table></div>';
    }
    icons();
  }
  function options(values,current){return values.map(item=>'<option value="'+e(item[0])+'"'+(item[0]===current?" selected":"")+'>'+e(item[1])+'</option>').join("");}
  function field(name,title,value="",type="text",extra=""){
    return '<label class="flow-field">'+title+'<input name="'+name+'" type="'+type+'" value="'+e(value)+'" '+extra+'></label>';
  }
  function selectField(name,title,values,current){return '<label class="flow-field">'+title+'<select name="'+name+'">'+options(values,current)+'</select></label>';}
  function textarea(name,title,value){return '<label class="flow-field flow-field-wide">'+title+'<textarea name="'+name+'">'+e(value)+'</textarea></label>';}
  function section(title,content){return '<section class="flow-detail-section"><h3>'+title+'</h3>'+content+'</section>';}
  function footer(text){return '<div class="flow-form-footer"><button class="flow-primary" type="submit">'+text+'</button></div>';}
  function openProject(id,tab="overview"){
    selected=id;activeTab=tab;
    const dialog=document.getElementById("flowProject");
    renderProject();
    if(!dialog.open)dialog.showModal();
    const url=new URL(location.href);url.searchParams.set("client",id);history.replaceState(null,"",url);
  }
  function renderProject(){
    const record=records.find(item=>item.id===selected);
    const isNew=selected==="new";
    if(!record && !isNew)return;
    const tabs=isNew?[]:[["overview","Overview"],["details","Details"],["payments","Payments"],["tasks","Tasks"],["files","Delivery"],["activity","Activity"]];
    document.getElementById("flowProject").innerHTML='<div class="flow-dialog-shell"><header class="flow-dialog-header"><div><p class="flow-eyebrow">'+(isNew?"New project":e(label(record.stage)))+'</p><h2 id="flowProjectTitle">'+(isNew?"Add a client project":e(record.name))+'</h2><p>'+(isNew?"":niceDate(record.date))+'</p></div><button class="flow-icon-button" data-close aria-label="Close client workspace" title="Close">'+icon("x")+'</button></header>'+(tabs.length?'<nav class="flow-tabs" aria-label="Client workspace">'+tabs.map(tab=>'<button data-tab="'+tab[0]+'" class="'+(activeTab===tab[0]?"active":"")+'" aria-pressed="'+(activeTab===tab[0])+'">'+tab[1]+'</button>').join("")+'</nav>':"")+'<div class="flow-dialog-body">'+(isNew?detailsForm(null):projectContent(record))+'</div></div>';
    icons();
  }
  function detailsForm(record){
    const booking=record?.booking || {};
    return '<form class="flow-form" data-form="details">'+
      field("clientName","Client / couple",record?.name || "","text","required")+
      field("eventName","Project title / shoot type",booking.eventName || "")+
      field("eventDate","Shoot date",record?.date || "","date")+
      field("location","Venue / location",booking.location || record?.client.location || "")+
      field("contactEmail","Email",record?.email || "","email")+
      field("contactPhone","Phone",record?.phone || "","tel")+
      field("packageName","Package name",booking.packageName || "")+
      field("packagePrice","Package total (£)",booking.packagePrice ?? "","number",'min="0" step="0.01"')+
      selectField("pipelineStage","Stage",STAGES,record?.stage || "enquiry")+
      field("nextAction","Next action",booking.nextAction || "")+
      field("followUpDate","Follow-up date",booking.followUpDate || "","date")+
      field("balanceDueDate","Balance due date",booking.balanceDueDate || "","date")+
      textarea("notes","Project notes",booking.notes || "")+footer(record?"Save details":"Create project")+'</form>';
  }
  function projectContent(record){
    const booking=record.booking;
    if(activeTab==="details")return detailsForm(record);
    if(activeTab==="payments")return paymentsContent(record);
    if(activeTab==="tasks")return tasksContent(record);
    if(activeTab==="files")return filesContent(record);
    if(activeTab==="activity")return activityContent(record);
    return '<div class="flow-summary"><div><span>Package total</span><strong>'+cash(record.price)+'</strong></div><div><span>Received</span><strong>'+cash(record.paid)+'</strong></div><div><span>Outstanding</span><strong>'+cash(record.balance)+'</strong></div></div><form class="flow-form" data-form="overview">'+
      selectField("pipelineStage","Stage",STAGES,record.stage)+
      selectField("contractStatus","Contract",[['not sent','Not sent'],['sent','Awaiting signature'],['signed','Signed']],record.contract)+
      field("nextAction","Next action",booking.nextAction || "")+
      field("followUpDate","Follow-up date",booking.followUpDate || "","date")+footer("Save next step")+'</form>'+
      '<div class="flow-checks">'+[["questionnaireReceived","Questionnaire received"],["timelineConfirmed","Timings confirmed"],["shotPlanReady","Shot plan ready"],["backupComplete","Footage backed up"]].map(item=>'<label><input type="checkbox" data-milestone="'+item[0]+'"'+(booking.milestones?.[item[0]]?" checked":"")+'>'+item[1]+'</label>').join("")+'</div>'+
      section("Contact",'<div class="flow-links">'+(record.email?'<a class="flow-button" href="mailto:'+e(encodeURIComponent(record.email))+'">'+icon("mail")+'Email client</a>':"")+(record.phone?'<a class="flow-button" href="tel:'+e(record.phone.replace(/[^+0-9]/g,""))+'">'+icon("phone")+'Call</a>':"")+'<a class="flow-button" href="consultations.html?project='+encodeURIComponent(record.name)+'">Consultation notes</a></div>')+
      section("Shoot day",'<div class="flow-links">'+[["Shot list","shot-lists.html"],["Call sheet","call-sheet.html"],["Timeline","timeline.html"],["Camera settings","shoot-settings.html"],["Gear","gear.html"]].map(item=>'<a class="flow-button" href="'+item[1]+'?project='+encodeURIComponent(record.name)+'">'+item[0]+'</a>').join("")+'</div>')+
      section("Project status",'<button type="button" data-archive>'+(record.stage==="archived"?"Restore to pipeline":"Archive project")+'</button>');
  }
  function paymentsContent(record){
    const rows=record.finance.filter(item=>item.type==="income").sort((a,b)=>String(b.date || "").localeCompare(String(a.date || "")));
    return '<div class="flow-summary"><div><span>Total</span><strong>'+cash(record.price)+'</strong></div><div><span>Received</span><strong>'+cash(record.paid)+'</strong></div><div><span>Due</span><strong>'+cash(record.balance)+'</strong></div></div><form class="flow-form" data-form="payment">'+
      field("title","Payment", "Balance payment","text","required")+
      field("amount","Amount (£)","","number",'required min="0.01" step="0.01"')+
      selectField("status","Status",[["paid","Received"],["waiting","Awaiting payment"],["hold","On hold"]],"paid")+
      field("date","Received / due date",today(),"date","required")+footer("Record payment")+'</form>'+
      section("Payment history",rows.length?rows.map(item=>'<div class="flow-action-row"><div><strong>'+e(item.title)+' · '+cash(item.amount)+'</strong><small>'+niceDate(item.date)+' · '+e(item.status)+'</small></div>'+(item.status!=="paid"?'<button data-paid="'+e(item.id)+'">Received</button>':"")+'</div>').join(""):'<p class="flow-empty">No payment entries yet. Any previously recorded deposit remains included above.</p>');
  }
  function tasksContent(record){
    return '<form class="flow-form" data-form="task">'+field("title","Next task","","text","required")+field("dueDate","Due date","","date")+footer("Add task")+'</form>'+
      section("Project tasks",record.tasks.length?record.tasks.map(task=>'<div class="flow-task-row '+(task.status==="done"?"done":"")+'"><label><input type="checkbox" data-task="'+e(task.id)+'"'+(task.status==="done"?" checked":"")+'>'+e(task.title)+'</label><small>'+niceDate(task.dueDate)+'</small></div>').join(""):'<p class="flow-empty">No tasks for this project yet.</p>');
  }
  function filesContent(record){
    const delivery=record.deliveryJob,url=httpUrl(record.booking.vaultUrl || record.profile.vaultUrl);
    return '<div class="flow-links"><a class="flow-button flow-primary" href="https://ncstudiouk.co.uk/client-vault.html" target="_blank" rel="noopener">'+icon("folder-open")+'Open client vault</a>'+(url?'<a class="flow-button" href="'+e(url)+'" target="_blank" rel="noopener">Client delivery</a><button data-copy-link>'+icon("copy")+'Copy link</button>':"")+'</div>'+
      section("Delivery details",'<form class="flow-form" data-form="files"><label class="flow-field flow-field-wide">Personal client delivery link<input name="vaultUrl" type="url" placeholder="https://ncstudiouk.co.uk/client-delivery.html?..." value="'+e(url)+'"></label>'+field("dueDate","Delivery due",delivery.dueDate || "","date")+
      selectField("stage","Editing status",[["not-started","Not started"],["editing","Editing"],["review","Client review"],["delivered","Delivered"]],delivery.stage || "not-started")+
      field("nextAction","Delivery next action",delivery.nextAction || "")+footer("Save delivery")+'</form>');
  }
  function activityContent(record){
    const activity=[
      ...(record.booking.activity || []).map(item=>({text:item.text,date:item.at})),
      ...record.messages.map(item=>({text:(item.subject?item.subject+": ":"")+(item.message || item.body || ""),date:item.createdAt || item.updatedAt})),
      ...record.finance.filter(item=>item.type==="income").map(item=>({text:(item.title || "Payment")+" · "+cash(item.amount)+" · "+item.status,date:item.updatedAt || item.createdAt || item.date}))
    ].sort((a,b)=>String(b.date || "").localeCompare(String(a.date || "")));
    return '<form class="flow-form" data-form="note">'+textarea("note","Add a project note","")+footer("Save note")+'</form>'+
      section("Activity",activity.length?activity.map(item=>'<article class="flow-activity"><p>'+e(item.text)+'</p><small>'+niceDate(item.date)+'</small></article>').join(""):'<p class="flow-empty">Project changes and client messages will appear here.</p>');
  }
  function statusFor(stage){return ({enquiry:"enquiry",consultation:"consultation",proposal:"consultation",booked:"confirmed",planning:"confirmed",editing:"completed",review:"completed",delivered:"completed",postponed:"postponed",archived:"cancelled"})[stage];}
  function updateBooking(record,patch,text){
    const data=load();
    const ids=new Set(record.bookings.map(item=>item.id));
    const existing=record.bookings.length?latest(record.bookings):{id:uid(),clientName:record.name,eventDate:record.date,createdAt:isoNow()};
    const item={...existing,...patch,updatedAt:isoNow()};
    if(text)item.activity=[...(existing.activity || []),{id:uid(),text,at:isoNow()}];
    if(ids.size){
      // Keep duplicate source rows intact, but give matching copies the same workflow.
      data.bookings=data.bookings.map(booking=>ids.has(booking.id)?{...booking,...patch,activity:item.activity,updatedAt:item.updatedAt}:booking);
    }else{data.bookings.push(item);selected=item.id;}
    write("bookings",data.bookings);
    return item;
  }
  function moveStage(record,stage){
    if(!normalizeStage(stage))return;
    updateBooking(record,{pipelineStage:stage,status:statusFor(stage)},"Moved to "+label(stage));
    render();if(document.getElementById("flowProject").open)renderProject();
    toast(record.name+" moved to "+label(stage));
  }
  function refreshAfterSave(message){render();if(document.getElementById("flowProject").open)renderProject();toast(message);}
  function recordPayment(record,item){
    const data=load();
    data.finance.push(item);
    if(item.status==="paid"){
      const totalPaid=Math.round((record.paid+number(item.amount))*100)/100;
      updateBooking(record,{totalPaid},"Payment received: "+cash(item.amount));
    }
    write("finance",data.finance);
  }
  function onSubmit(event){
    const form=event.target.closest("[data-form]");if(!form)return;
    event.preventDefault();
    const values=Object.fromEntries(new FormData(form));
    const record=records.find(item=>item.id===selected);
    try{
      switch(form.dataset.form){
        case "details":{
          if(!values.clientName.trim()){toast("Add the client name.");return;}
          const patch={...values,clientName:values.clientName.trim(),packagePrice:number(values.packagePrice),status:statusFor(values.pipelineStage)};
          if(record){
            if(nameKey(values.clientName)!==record.nameKey){
              patch.projectAliases=[...new Set([...(record.booking.projectAliases || []),record.name])];
              patch.shootProjectName=record.booking.shootProjectName || record.name;
            }
            updateBooking(record,patch,"Project details updated");
          }else{
            const duplicate=records.find(item=>item.aliasKeys.includes(nameKey(values.clientName)) && item.date===values.eventDate);
            if(duplicate){openProject(duplicate.id,"details");toast("That project already exists. Opened the existing record.");return;}
            const item={...patch,id:uid(),createdAt:isoNow(),updatedAt:isoNow(),activity:[{id:uid(),text:"Project created",at:isoNow()}]};
            const data=load();data.bookings.push(item);write("bookings",data.bookings);selected=item.id;activeTab="overview";
          }
          refreshAfterSave("Project saved.");break;
        }
        case "overview":
          updateBooking(record,{...values,status:statusFor(values.pipelineStage)},"Next step updated");
          refreshAfterSave("Next step saved.");break;
        case "payment":
          if(number(values.amount)<=0)return;
          recordPayment(record,{...values,id:uid(),type:"income",client:record.name,bookingId:record.booking.id || record.id,amount:number(values.amount),createdAt:isoNow(),updatedAt:isoNow()});
          refreshAfterSave("Payment recorded.");break;
        case "task":{
          if(!values.title.trim())return;
          const data=load();data.tasks.push({...values,title:values.title.trim(),id:uid(),project:record.name,bookingId:record.booking.id || record.id,category:"overall",status:"open",priority:"normal",createdAt:isoNow(),updatedAt:isoNow()});
          write("tasks",data.tasks);refreshAfterSave("Task added.");break;
        }
        case "files":{
          if(values.vaultUrl && !httpUrl(values.vaultUrl)){toast("Use a full http or https client link.");return;}
          updateBooking(record,{vaultUrl:values.vaultUrl,...(["editing","review","delivered"].includes(values.stage)?{pipelineStage:values.stage,status:statusFor(values.stage)}:{})},"Delivery details updated");
          const data=load(),id=record.deliveryJob.id || uid();
          const job={...record.deliveryJob,id,projectName:record.deliveryJob.projectName || record.name,client:record.name,bookingId:record.booking.id || selected,dueDate:values.dueDate,stage:values.stage,nextAction:values.nextAction,progress:({ "not-started":0,editing:40,review:80,delivered:100})[values.stage],updatedAt:isoNow()};
          data.delivery=data.delivery.filter(item=>item.id!==id);data.delivery.push(job);write("delivery",data.delivery);
          refreshAfterSave("Delivery saved.");break;
        }
        case "note":
          if(!values.note.trim())return;
          updateBooking(record,{},values.note.trim());refreshAfterSave("Note added.");break;
      }
    }catch(error){console.error(error);toast("Could not save. Your existing records are unchanged. Check device storage.");}
  }
  async function onClick(event){
    const button=event.target.closest("button,a");if(!button)return;
    if(button.hasAttribute("data-tools"))window.NCNavigation.openTools();
    if(button.hasAttribute("data-new"))openProject("new","details");
    if(button.dataset.open)openProject(button.dataset.open,button.dataset.openTab || "overview");
    if(button.hasAttribute("data-close"))document.getElementById("flowProject").close();
    if(button.dataset.tab){activeTab=button.dataset.tab;renderProject();}
    if(button.dataset.filter){filter=button.dataset.filter;renderPipeline();icons();}
    if(button.dataset.view){view=button.dataset.view;localStorage.setItem("ncstudio_pipeline_view",view);renderPipeline();icons();}
    if(button.hasAttribute("data-refresh"))await syncNow(button);
    const record=records.find(item=>item.id===selected);
    if(button.hasAttribute("data-archive") && record){
      const restored=record.booking.previousPipelineStage || "enquiry";
      updateBooking(record,record.stage==="archived"?{pipelineStage:restored,status:statusFor(restored)}:{previousPipelineStage:record.stage,pipelineStage:"archived",status:"cancelled"},record.stage==="archived"?"Project restored":"Project archived");
      refreshAfterSave(record.stage==="archived"?"Restored.":"Archived. All project records retained.");
    }
    if(button.dataset.paid && record){
      const data=load(),item=data.finance.find(row=>row.id===button.dataset.paid);
      if(!item || item.status==="paid")return;
      updateBooking(record,{totalPaid:Math.round((record.paid+number(item.amount))*100)/100},"Payment received: "+cash(item.amount));
      item.status="paid";item.updatedAt=isoNow();write("finance",data.finance);refreshAfterSave("Payment marked received.");
    }
    if(button.hasAttribute("data-copy-link") && record){
      const url=httpUrl(record.booking.vaultUrl || record.profile.vaultUrl);
      try{await navigator.clipboard.writeText(url);toast("Client link copied.");}
      catch{const input=document.querySelector('[name="vaultUrl"]');input.focus();input.select();toast("Select and copy the delivery link.");}
    }
  }
  function onChange(event){
    const target=event.target;
    if(target.id==="flowStageFilter"){filter=target.value;renderPipeline();icons();}
    if(target.dataset.stageId){const record=records.find(item=>item.id===target.dataset.stageId);if(record)moveStage(record,target.value);}
    const record=records.find(item=>item.id===selected);
    if(target.dataset.milestone && record){
      updateBooking(record,{milestones:{...record.booking.milestones,[target.dataset.milestone]:target.checked}},"Checklist updated");render();
    }
    if(target.dataset.task){
      const data=load();data.tasks=data.tasks.map(task=>task.id===target.dataset.task?{...task,status:target.checked?"done":"open",updatedAt:isoNow()}:task);
      write("tasks",data.tasks);refreshAfterSave(target.checked?"Task completed.":"Task reopened.");
    }
  }
  async function syncNow(button){
    button.disabled=true;
    setSync("Checking website enquiries...");
    try{
      if(!await window.NCSync.ensureSignedIn(true)){setSync("Device only · sign in to sync");return;}
      const succeeded=await window.NCSync.pullAllFromSupabase();
      render();
      if(succeeded){
        setSync("Synced · "+new Date().toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}));
        toast("Enquiries and messages refreshed.");
      }else{
        setSync("Saved on device · sync unavailable");
        toast("Sync is unavailable. Your local records are retained.");
      }
    }catch(error){console.warn(error);setSync("Sync unavailable · saved locally");toast("Could not refresh. Your local records are available.");}
    finally{button.disabled=false;}
  }
  function setSync(message){const element=document.getElementById("flowSync");if(element)element.textContent=message;}
  function icons(){window.lucide?.createIcons();}
  function toast(message){
    const element=document.getElementById("flowToast");element.textContent=message;element.hidden=false;
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>{element.hidden=true;},3600);
  }
  shell();render();
  const requested=params.get("client"),project=params.get("project");
  const initial=records.find(item=>item.id===requested || (project && item.nameKey===nameKey(project)));
  if(initial)openProject(initial.id);
  window.addEventListener("storage",event=>{if(Object.values(KEYS).includes(event.key))render();});
  window.addEventListener("nc:sync-complete",()=>{render();setSync("Synced");});
  window.addEventListener("nc:sync-status",event=>setSync(event.detail.message));
  window.addEventListener("nc:messages-imported",render);
  window.addEventListener("focus",render);
  window.NCFlow={buildRecords,nameKey,KEYS,STAGES};
})();
