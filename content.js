(function(){
  "use strict";
  const STORAGE_KEY = "ncstudios_content_v1";
  const DELIVERY_KEY = "ncstudios_delivery_v1";
  let plans = readData(STORAGE_KEY);
  let toastTimer = null;
  const form = document.getElementById("contentForm");

  form.addEventListener("submit",savePlan);
  document.getElementById("clearContentForm").addEventListener("click",resetForm);
  document.getElementById("focusContent").addEventListener("click",() => document.getElementById("clientName").focus());
  document.getElementById("importDelivered").addEventListener("click",importDelivered);
  document.getElementById("clearContentList").addEventListener("click",clearAll);
  ["contentSearch","permissionFilter","statusFilter"].forEach(id => document.getElementById(id).addEventListener(id === "contentSearch" ? "input" : "change",render));
  document.getElementById("contentList").addEventListener("click",handleListClick);
  render();

  function readData(key){try{const value=JSON.parse(localStorage.getItem(key))||[];return Array.isArray(value)?value:[]}catch(error){return[]}}
  function write(){localStorage.setItem(STORAGE_KEY,JSON.stringify(plans))}
  function id(){return window.crypto?.randomUUID?crypto.randomUUID():`content_${Date.now()}_${Math.random().toString(16).slice(2)}`}
  function value(field){return String(document.getElementById(field).value||"").trim()}

  function savePlan(event){
    event.preventDefault();
    const savedId=value("contentId")||id();
    const existing=plans.find(item=>item.id===savedId)||{};
    const plan={...existing,id:savedId,clientName:value("clientName"),weddingDate:value("weddingDate"),permission:value("permission"),status:value("status"),postDate:value("postDate"),bestImages:value("bestImages"),bestClips:value("bestClips"),reelIdea:value("reelIdea"),captionIdea:value("captionIdea"),notes:value("notes"),createdAt:existing.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
    if(!plan.clientName){alert("Add the client or wedding name first.");return}
    const index=plans.findIndex(item=>item.id===savedId);
    if(index>=0) plans[index]=plan; else plans.unshift(plan);
    write();resetForm();render();showToast("Content plan saved.");
  }

  function render(){
    plans=readData(STORAGE_KEY);
    const search=value("contentSearch").toLowerCase();
    const permission=value("permissionFilter");
    const status=value("statusFilter");
    const visible=plans.filter(item=>{
      if(search&&!JSON.stringify(item).toLowerCase().includes(search))return false;
      if(permission!=="all"&&item.permission!==permission)return false;
      if(status==="active"&&["posted","skip"].includes(item.status))return false;
      if(!["all","active"].includes(status)&&item.status!==status)return false;
      return true;
    }).sort((a,b)=>String(a.postDate||"9999").localeCompare(String(b.postDate||"9999"))||a.clientName.localeCompare(b.clientName));
    renderStats();
    const list=document.getElementById("contentList");
    list.innerHTML=visible.length?visible.map(card).join(""):`<div class="content-empty">No content plans in this view. Add one or import delivered projects.</div>`;
  }

  function renderStats(){
    const stats=[{label:"Can post",value:plans.filter(item=>item.permission==="yes").length},{label:"Waiting permission",value:plans.filter(item=>item.permission==="waiting").length},{label:"Ready",value:plans.filter(item=>item.status==="ready").length},{label:"Scheduled",value:plans.filter(item=>item.status==="scheduled").length}];
    document.getElementById("contentStats").innerHTML=stats.map(item=>`<article class="content-stat"><span>${item.label}</span><strong>${item.value}</strong></article>`).join("");
  }

  function card(item){
    return `<article class="content-card"><div class="content-card-top"><div><h3>${esc(item.clientName)}</h3><small>${item.weddingDate?niceDate(item.weddingDate):"Wedding date not set"}${item.postDate?` · Post ${niceDate(item.postDate)}`:""}</small></div><div class="content-badges"><span class="content-badge ${attr(item.permission)}">${permissionLabel(item.permission)}</span><span class="content-badge">${statusLabel(item.status)}</span></div></div><div class="content-details">${detail("Best images",item.bestImages)}${detail("Best clips",item.bestClips)}${detail("Reel idea",item.reelIdea)}${detail("Caption",item.captionIdea)}${detail("Notes",item.notes)}</div><div class="content-card-actions"><button class="ghost-btn" type="button" data-permission="${attr(item.id)}" data-value="yes">Can post</button><button class="ghost-btn" type="button" data-status="${attr(item.id)}" data-value="ready">Ready</button><button class="ghost-btn" type="button" data-status="${attr(item.id)}" data-value="posted">Posted</button>${item.captionIdea?`<button class="ghost-btn" type="button" data-copy="${attr(item.id)}">Copy caption</button>`:""}<button class="ghost-btn" type="button" data-edit="${attr(item.id)}">Edit</button><button class="danger-btn" type="button" data-delete="${attr(item.id)}">Delete</button></div></article>`;
  }

  function detail(label,text){return text?`<div class="content-detail"><span>${label}</span><p>${esc(text)}</p></div>`:""}

  function handleListClick(event){
    const button=event.target.closest("button");if(!button)return;
    const itemId=button.dataset.permission||button.dataset.status||button.dataset.copy||button.dataset.edit||button.dataset.delete;
    const item=plans.find(entry=>entry.id===itemId);if(!item)return;
    if(button.dataset.permission){item.permission=button.dataset.value;saveAndRender("Posting permission updated.");return}
    if(button.dataset.status){item.status=button.dataset.value;saveAndRender("Content status updated.");return}
    if(button.dataset.copy){navigator.clipboard?.writeText(item.captionIdea).then(()=>showToast("Caption copied."));return}
    if(button.dataset.edit){edit(item);return}
    if(button.dataset.delete&&confirm(`Delete the content plan for ${item.clientName}?`)){plans=plans.filter(entry=>entry.id!==item.id);saveAndRender("Content plan deleted.")}
  }

  function edit(item){
    ["contentId","clientName","weddingDate","permission","status","postDate","bestImages","bestClips","reelIdea","captionIdea","notes"].forEach(field=>{document.getElementById(field).value=item[field]||""});
    window.scrollTo({top:0,behavior:"smooth"});
  }

  function saveAndRender(message){write();render();showToast(message)}
  function resetForm(){form.reset();document.getElementById("contentId").value="";document.getElementById("permission").value="waiting";document.getElementById("status").value="idea"}

  function importDelivered(){
    const delivered=readData(DELIVERY_KEY).filter(item=>["delivered","completed"].includes(item.stage));let added=0;
    delivered.forEach(project=>{const name=project.client||project.projectName;if(!name||plans.some(item=>normalise(item.clientName)===normalise(name)))return;plans.push({id:id(),clientName:name,weddingDate:"",permission:"waiting",status:"idea",postDate:"",bestImages:"",bestClips:"",reelIdea:"",captionIdea:"",notes:`Added from delivered project: ${project.projectName||name}`,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});added++});
    if(added){write();render()}showToast(added?`${added} delivered ${added===1?"project":"projects"} added.`:"All delivered projects already have content plans.");
  }

  function clearAll(){if(!plans.length){showToast("There are no content plans to clear.");return}if(!confirm(`Clear all ${plans.length} content plans?`))return;if(!confirm("Are you sure? This cannot be undone."))return;plans=[];write();resetForm();render();showToast("Content plans cleared.")}
  function normalise(text){return String(text||"").toLowerCase().replace(/&|\+/g," and ").replace(/[^a-z0-9]+/g," ").trim()}
  function permissionLabel(value){return{yes:"Can post",no:"Cannot post",waiting:"Waiting"}[value]||"Waiting"}
  function statusLabel(value){return{idea:"Idea",selecting:"Selecting",ready:"Ready",scheduled:"Scheduled",posted:"Posted",skip:"Do not post"}[value]||"Idea"}
  function niceDate(value){const date=new Date(`${value}T12:00:00`);return Number.isNaN(date.getTime())?value:new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short",year:"numeric"}).format(date)}
  function showToast(message){const toast=document.getElementById("contentToast");toast.textContent=message;toast.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove("show"),2200)}
  function esc(value){return String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
  function attr(value){return esc(value)}
})();
