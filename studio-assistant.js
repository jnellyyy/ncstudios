(function(){
  "use strict";

  const config = window.NC_STUDIO_ASSISTANT_CONFIG;
  if(!config){
    console.error("Studio Assistant configuration did not load.");
    return;
  }

  const KEYS = {
    bookings:"ncstudios_bookings_v1",
    clients:"ncstudios_clients_v1",
    tasks:"ncstudios_lists_v1",
    messages:"ncstudios_messages_v1",
    finance:"ncstudios_finance_v1",
    consultations:"ncstudios_consultations_v1",
    delivery:"ncstudios_delivery_v1",
    content:"ncstudios_content_v1",
    profiles:"ncstudios_crm_profiles_v1",
    admin:"ncStudiosAdminTrackerV1"
  };

  let data = loadAll();
  let records = [];
  let attention = [];
  let attentionFilter = "urgent";
  let calendarCursor = startOfMonth(new Date());
  let toastTimer = null;

  bindEvents();
  runDailyAutomations();
  renderAll();

  function loadAll(){
    return Object.fromEntries(Object.entries(KEYS).map(([name,key]) => [name,readData(key)]));
  }

  function readData(key){
    try{
      const value = JSON.parse(localStorage.getItem(key)) || [];
      return Array.isArray(value) ? value : [];
    }catch(error){
      return [];
    }
  }

  function writeData(name){
    localStorage.setItem(KEYS[name],JSON.stringify(data[name] || []));
  }

  function bindEvents(){
    document.getElementById("runAutomations").addEventListener("click",() => {
      data = loadAll();
      const added = runAutomations();
      renderAll();
      showToast(added ? `${added} smart ${added === 1 ? "task" : "tasks"} added.` : "Smart tasks are already up to date.");
    });

    document.getElementById("attentionFilters").addEventListener("click",event => {
      const button = event.target.closest("[data-attention-filter]");
      if(!button) return;
      attentionFilter = button.dataset.attentionFilter;
      renderAttentionFilters();
      renderAttentionList();
    });

    document.getElementById("attentionList").addEventListener("click",event => {
      const button = event.target.closest("[data-complete-task]");
      if(!button) return;
      const task = data.tasks.find(item => item.id === button.dataset.completeTask);
      if(!task) return;
      task.status = "done";
      task.updatedAt = new Date().toISOString();
      writeData("tasks");
      renderAll();
      showToast("Task marked complete.");
    });

    ["pipelineSearch","serviceFilter","paymentFilter","contractFilter"].forEach(id => {
      const element = document.getElementById(id);
      element.addEventListener(id === "pipelineSearch" ? "input" : "change",renderPipeline);
    });

    document.getElementById("pipelineBoard").addEventListener("change",event => {
      const select = event.target.closest("[data-pipeline-key]");
      if(!select) return;
      movePipelineStage(select.dataset.pipelineKey,select.value);
    });

    document.getElementById("calendarPrevious").addEventListener("click",() => {
      calendarCursor = new Date(calendarCursor.getFullYear(),calendarCursor.getMonth() - 1,1);
      renderCalendar();
    });
    document.getElementById("calendarNext").addEventListener("click",() => {
      calendarCursor = new Date(calendarCursor.getFullYear(),calendarCursor.getMonth() + 1,1);
      renderCalendar();
    });

    document.getElementById("packageForm").addEventListener("submit",event => {
      event.preventDefault();
      renderPackageSuggestion(suggestPackage());
    });

    window.addEventListener("storage",event => {
      if(Object.values(KEYS).includes(event.key)){
        data = loadAll();
        renderAll();
      }
    });
  }

  function renderAll(){
    data = loadAll();
    records = buildRecords();
    attention = buildAttention();
    renderBrief();
    renderStats();
    renderAttentionFilters();
    renderAttentionList();
    renderPipeline();
    renderCalendar();
  }

  function buildRecords(){
    const map = new Map();

    function ensure(name){
      const clean = displayName(name);
      const key = recordKey(clean);
      if(!key) return null;
      const existingKey = [...map.keys()].find(saved => keysMatch(saved,key));
      const matchedKey = existingKey || key;
      if(!map.has(matchedKey)){
        map.set(matchedKey,{key:matchedKey,name:clean,bookings:[],clients:[],messages:[],tasks:[],finance:[],consultations:[],delivery:[],admin:[],profiles:[]});
      }
      const record = map.get(matchedKey);
      if(clean.length > record.name.length && clean.length < 60) record.name = clean;
      return record;
    }

    function add(items,nameGetter,collection){
      items.forEach(item => {
        const record = ensure(nameGetter(item));
        if(record) record[collection].push(item);
      });
    }

    add(data.bookings,item => item.clientName || item.eventName,"bookings");
    add(data.clients,item => item.clientName || item.full_name,"clients");
    add(data.messages,item => item.clientName || item.project || item.subject,"messages");
    add(data.tasks,item => item.project,"tasks");
    add(data.finance,item => item.client || item.title,"finance");
    add(data.consultations,item => item.project || item.contactName,"consultations");
    add(data.delivery,item => item.client || item.projectName,"delivery");
    add(data.admin,item => item.name || item.clientName,"admin");
    add(data.profiles,item => item.clientName,"profiles");

    return [...map.values()].map(record => {
      record.booking = latest(record.bookings);
      record.client = latest(record.clients);
      record.consultation = latest(record.consultations);
      record.deliveryJob = latest(record.delivery);
      record.adminClient = latest(record.admin);
      record.profile = latest(record.profiles);
      record.stage = pipelineStage(record);
      record.service = serviceType(record);
      record.outstanding = outstandingFor(record);
      record.payment = paymentState(record);
      record.contract = contractState(record);
      record.searchText = JSON.stringify(record).toLowerCase();
      return record;
    }).sort((a,b) => {
      const dateA = recordDate(a) || "9999-12-31";
      const dateB = recordDate(b) || "9999-12-31";
      return dateA.localeCompare(dateB) || a.name.localeCompare(b.name);
    });
  }

  function pipelineStage(record){
    if(record.booking?.pipelineStage) return record.booking.pipelineStage;
    if(["delivered","completed"].includes(record.deliveryJob?.stage)) return "delivered";
    if(record.deliveryJob?.stage && record.deliveryJob.stage !== "not-started") return "editing";
    const status = String(record.booking?.status || record.client?.status || "").toLowerCase();
    const map = {
      enquiry:"new-enquiry",
      lead:"new-enquiry",
      consultation:"availability-confirmed",
      confirmed:"booked",
      active:"pre-wedding",
      completed:"wedding-completed",
      complete:"delivered",
      postponed:"waiting-response"
    };
    return map[status] || "new-enquiry";
  }

  function serviceType(record){
    const explicit = String(record.profile?.serviceType || record.booking?.serviceType || record.client?.serviceType || "").toLowerCase();
    if(explicit.includes("both") || (explicit.includes("photo") && explicit.includes("video"))) return "both";
    if(explicit.includes("photo")) return "photography";
    if(explicit.includes("video")) return "videography";
    const text = `${record.booking?.eventName || ""} ${record.deliveryJob?.packageType || ""}`.toLowerCase();
    if(text.includes("photography and videography")) return "both";
    if(text.includes("photo")) return "photography";
    return "videography";
  }

  function outstandingFor(record){
    const bookingBalance = Math.max(Number(record.booking?.packagePrice || 0) - Number(record.booking?.depositPaid || 0),0);
    const financeDue = record.finance
      .filter(item => item.type === "income" && ["waiting","unpaid","hold"].includes(item.status))
      .reduce((sum,item) => sum + Number(item.amount || 0),0);
    return Math.max(bookingBalance,financeDue,Number(record.profile?.balanceDue || 0));
  }

  function paymentState(record){
    const explicit = String(record.profile?.paymentStatus || record.booking?.paymentStatus || "").toLowerCase();
    if(explicit) return explicit;
    const price = Number(record.booking?.packagePrice || 0);
    const paid = Number(record.booking?.depositPaid || 0);
    if(price > 0 && paid >= price) return "paid in full";
    if(paid > 0) return "deposit paid";
    return "not requested";
  }

  function contractState(record){
    return String(record.profile?.contractStatus || record.booking?.contractStatus || record.adminClient?.contract || "not sent").toLowerCase();
  }

  function buildAttention(){
    const items = [];
    const today = todayISO();

    data.tasks.forEach(task => {
      const due = task.dueDate || "";
      if(task.status === "done"){
        items.push(attentionItem("completed",task.title,task.project || "Business task","Task completed",task.dueDate,"lists.html",task.id));
        return;
      }
      if(due && due < today){
        items.push(attentionItem("urgent",task.title,task.project || "Business task","Overdue task",due,"lists.html",task.id));
      }else if(due === today || task.priority === "high"){
        items.push(attentionItem("urgent",task.title,task.project || "Business task",due === today ? "Due today" : "High priority",due,"lists.html",task.id));
      }else if(due && daysUntil(due) <= 7){
        items.push(attentionItem("this-week",task.title,task.project || "Business task","Due this week",due,"lists.html",task.id));
      }else if(task.status === "waiting"){
        items.push(attentionItem("waiting",task.title,task.project || "Business task","Waiting",due,"lists.html",task.id));
      }
    });

    data.messages.filter(message => !["replied","archived"].includes(message.status)).forEach(message => {
      const stale = ageInDays(message.createdAt || message.updatedAt) >= config.automation.staleReplyDays;
      const category = message.status === "new" || stale ? "urgent" : "waiting";
      const item = attentionItem(category,`Reply to ${message.clientName || "website enquiry"}`,message.subject || "Client message",stale ? "Waiting 3+ days" : "Unread reply",message.createdAt || message.updatedAt,"messages.html");
      if(message.contactEmail) item.href = reminderMailto(message.contactEmail,message.clientName,"Following up on your NC Studio enquiry");
      items.push(item);
    });

    records.forEach(record => {
      const date = recordDate(record);
      const days = daysUntil(date);
      const booked = ["booked","pre-wedding","final-consultation"].includes(record.stage);

      if(booked && days < 0){
        items.push(attentionItem("urgent",`Update ${record.name}'s wedding stage`,"The wedding date has passed. Move the couple to Wedding completed so backup and editing tasks take over.","Pipeline",date,"#pipeline"));
      }

      if(booked && days >= 0 && !["signed","complete","completed"].some(value => record.contract.includes(value))){
        const email = recordEmail(record);
        const href = email
          ? reminderMailto(email,record.name,"NC Studio contract follow-up")
          : `crm.html#client-${encodeURIComponent(record.key)}`;
        items.push(attentionItem(days <= 30 ? "urgent" : "this-week",`Chase ${record.name}'s contract`,`Current status: ${titleCase(record.contract)}`,"Contract",date,href));
      }
      if(record.outstanding > 0 && booked){
        const category = days <= config.automation.balanceWarningDays ? "urgent" : "this-week";
        const email = recordEmail(record);
        const href = email
          ? reminderMailto(email,record.name,"NC Studio payment reminder")
          : "finance.html";
        items.push(attentionItem(category,`${record.name} owes ${money(record.outstanding)}`,"Confirm the payment date and send a clean reminder.","Payment",date,href));
      }
      if(booked && days >= 0 && days <= 30 && !record.consultation){
        items.push(attentionItem(days <= 14 ? "urgent" : "this-week",`Book final consultation with ${record.name}`,`${days} days until the wedding.`,"Consultation",date,"consultations.html"));
      }
      if(booked && days >= 0 && days <= 60){
        items.push(attentionItem(days <= 14 ? "urgent" : "upcoming",`${record.name}'s wedding is ${relativeDate(date)}`,record.booking?.location || record.client?.location || "Location not set","Wedding",date,"projects.html"));
      }
      if(record.stage === "editing" && record.deliveryJob){
        const due = record.deliveryJob.dueDate || "";
        items.push(attentionItem(due && due < today ? "urgent" : "this-week",`Continue editing ${record.name}`,record.deliveryJob.nextAction || titleCase(record.deliveryJob.stage),"Delivery",due,"delivery.html"));
      }
    });

    data.finance.filter(item => item.type === "income" && ["waiting","unpaid","hold"].includes(item.status) && item.date && item.date < today).forEach(item => {
      items.push(attentionItem("urgent",`Overdue: ${item.title || item.client || "client payment"}`,`${money(item.amount)} was due ${niceDate(item.date)}.`,"Payment",item.date,"finance.html"));
    });

    data.delivery.filter(item => !["delivered","completed"].includes(item.stage) && item.dueDate).forEach(item => {
      const days = daysUntil(item.dueDate);
      if(days <= 7){
        items.push(attentionItem(days < 0 ? "urgent" : "this-week",`${item.projectName || item.client} delivery ${days < 0 ? "is overdue" : "is due soon"}`,item.nextAction || titleCase(item.stage),"Delivery",item.dueDate,"delivery.html"));
      }
    });

    return dedupeAttention(items).sort((a,b) => attentionScore(a) - attentionScore(b) || String(a.date || "9999").localeCompare(String(b.date || "9999")));
  }

  function attentionItem(category,title,copy,type,date,href,taskId){
    return {category,title,copy,type,date:normaliseDate(date),href,taskId};
  }

  function dedupeAttention(items){
    const seen = new Set();
    return items.filter(item => {
      const key = `${item.category}|${item.title}`.toLowerCase();
      if(seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function attentionScore(item){
    return {urgent:0,"this-week":1,waiting:2,upcoming:3,completed:4}[item.category] ?? 5;
  }

  function renderBrief(){
    const urgent = attention.filter(item => item.category === "urgent");
    const replies = data.messages.filter(item => !["replied","archived"].includes(item.status)).length;
    const owed = records.reduce((sum,record) => sum + record.outstanding,0);
    const next = records.find(record => {
      const days = daysUntil(recordDate(record));
      return days >= 0 && ["booked","pre-wedding","final-consultation"].includes(record.stage);
    });

    let brief;
    if(urgent.length){
      brief = `Start with ${urgent[0].title.toLowerCase()}. You have ${replies} ${replies === 1 ? "reply" : "replies"} waiting and ${money(owed)} outstanding. ${next ? `${next.name} is the next wedding, ${relativeDate(recordDate(next))}.` : "There is no upcoming wedding date set."}`;
    }else if(attention.length){
      brief = `Nothing is on fire. Work through this week's list, then check anything waiting on a client. ${next ? `${next.name} is next, ${relativeDate(recordDate(next))}.` : "Add the next wedding date when it is confirmed."}`;
    }else{
      brief = "Your priority list is clear. Add the next enquiry or task when it lands.";
    }
    document.getElementById("assistantBrief").textContent = brief;
  }

  function renderStats(){
    const today = new Date();
    const monthlyIncome = data.finance
      .filter(item => item.type === "income" && item.status === "paid")
      .filter(item => {
        const date = parseDate(item.date);
        return date && date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth();
      })
      .reduce((sum,item) => sum + Number(item.amount || 0),0);
    const stats = [
      {label:"Urgent",value:attention.filter(item => item.category === "urgent").length,note:"Do these first"},
      {label:"Waiting replies",value:data.messages.filter(item => !["replied","archived"].includes(item.status)).length,note:"Client messages"},
      {label:"Outstanding",value:money(records.reduce((sum,record) => sum + record.outstanding,0)),note:"Across active couples"},
      {label:"This month",value:money(monthlyIncome),note:"Paid income logged"},
      {label:"Active pipeline",value:records.filter(record => !["delivered","archived"].includes(record.stage)).length,note:`${records.length} total couples`}
    ];
    document.getElementById("assistantStats").innerHTML = stats.map(item => `<article class="assistant-stat"><span>${escapeHTML(item.label)}</span><strong>${escapeHTML(item.value)}</strong><small>${escapeHTML(item.note)}</small></article>`).join("");
  }

  function renderAttentionFilters(){
    const labels = {urgent:"Urgent","this-week":"This week",waiting:"Waiting on client",upcoming:"Upcoming",completed:"Completed"};
    document.getElementById("attentionFilters").innerHTML = config.attentionCategories.map(category => {
      const count = attention.filter(item => item.category === category).length;
      return `<button type="button" class="ghost-btn attention-filter${category === attentionFilter ? " selected" : ""}" data-attention-filter="${category}">${labels[category]} · ${count}</button>`;
    }).join("");
  }

  function renderAttentionList(){
    const visible = attention.filter(item => item.category === attentionFilter).slice(0,16);
    const list = document.getElementById("attentionList");
    if(!visible.length){
      list.innerHTML = `<div class="assistant-empty">Nothing in ${attentionFilter === "this-week" ? "this week's" : titleCase(attentionFilter)} list right now.</div>`;
      return;
    }
    list.innerHTML = visible.map(item => `
      <article class="attention-item ${escapeAttribute(item.category)}">
        <span class="attention-dot" aria-hidden="true"></span>
        <div><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.copy || "")}</p><div class="attention-meta"><span>${escapeHTML(item.type || "Action")}</span>${item.date ? `<span>${escapeHTML(niceDate(item.date))}</span>` : ""}</div></div>
        ${item.taskId && item.category !== "completed" ? `<button class="ghost-btn attention-link" type="button" data-complete-task="${escapeAttribute(item.taskId)}">Done</button>` : item.href ? `<a class="ghost-btn attention-link" href="${escapeAttribute(item.href)}">${item.href.startsWith("mailto:") ? "Email" : "Open"}</a>` : ""}
      </article>
    `).join("");
  }

  function renderPipeline(){
    const query = document.getElementById("pipelineSearch").value.trim().toLowerCase();
    const service = document.getElementById("serviceFilter").value;
    const payment = document.getElementById("paymentFilter").value;
    const contract = document.getElementById("contractFilter").value;
    const visible = records.filter(record => {
      if(query && !record.searchText.includes(query)) return false;
      if(service !== "all" && record.service !== service) return false;
      if(payment === "outstanding" && record.outstanding <= 0) return false;
      if(payment === "paid" && record.outstanding > 0) return false;
      if(contract === "signed" && !record.contract.includes("signed")) return false;
      if(contract === "needs-chasing" && record.contract.includes("signed")) return false;
      return true;
    });

    const groups = ["Enquiries","Booking","Booked","Post-production","Complete"];
    document.getElementById("pipelineBoard").innerHTML = groups.map(group => {
      const groupStageIds = config.pipelineStages.filter(stage => stage.group === group).map(stage => stage.id);
      const groupRecords = visible.filter(record => groupStageIds.includes(record.stage));
      return `<section class="pipeline-lane"><div class="pipeline-lane-head"><h3>${escapeHTML(group)}</h3><span>${groupRecords.length}</span></div><div class="pipeline-cards">${groupRecords.length ? groupRecords.map(renderPipelineCard).join("") : `<div class="assistant-empty">No couples here.</div>`}</div></section>`;
    }).join("");
  }

  function renderPipelineCard(record){
    const date = recordDate(record);
    const packageName = record.profile?.packageName || record.booking?.packageName || record.booking?.eventName || record.deliveryJob?.packageType || "Package not set";
    return `
      <article class="pipeline-card">
        <h4>${escapeHTML(record.name)}</h4>
        <p>${escapeHTML(packageName)}${date ? ` · ${escapeHTML(niceDate(date))}` : ""}</p>
        <div class="pipeline-card-meta">
          <div><span>Payment</span><b>${record.outstanding > 0 ? `${money(record.outstanding)} due` : "Clear"}</b></div>
          <div><span>Contract</span><b>${escapeHTML(titleCase(record.contract))}</b></div>
          <div><span>Next</span><b>${escapeHTML(record.booking?.nextAction || record.deliveryJob?.nextAction || "Not set")}</b></div>
        </div>
        <select aria-label="Move ${escapeAttribute(record.name)} stage" data-pipeline-key="${escapeAttribute(record.key)}">${stageOptions(record.stage)}</select>
        <div class="pipeline-card-actions"><a class="ghost-btn" href="crm.html#client-${encodeURIComponent(record.key)}">CRM</a><a class="ghost-btn" href="projects.html">Project</a></div>
      </article>
    `;
  }

  function stageOptions(selected){
    return config.pipelineStages.map(stage => `<option value="${stage.id}"${stage.id === selected ? " selected" : ""}>${escapeHTML(stage.label)}</option>`).join("");
  }

  function movePipelineStage(key,stage){
    const record = records.find(item => item.key === key);
    if(!record) return;
    const booking = record.booking;
    const now = new Date().toISOString();
    if(booking){
      const index = data.bookings.findIndex(item => item.id === booking.id);
      data.bookings[index] = {...booking,pipelineStage:stage,status:legacyBookingStatus(stage),updatedAt:now};
    }else{
      data.bookings.unshift({
        id:makeId(),clientName:record.name,eventName:"Wedding",eventDate:recordDate(record),status:legacyBookingStatus(stage),pipelineStage:stage,packagePrice:0,depositPaid:0,location:record.client?.location || "",nextAction:"",notes:"Created from Studio Assistant",createdAt:now,updatedAt:now
      });
    }
    writeData("bookings");
    data = loadAll();
    const added = runAutomations();
    renderAll();
    showToast(`${record.name} moved to ${stageLabel(stage)}.${added ? ` ${added} smart tasks added.` : ""}`);
  }

  function legacyBookingStatus(stage){
    if(["new-enquiry","replied","waiting-response"].includes(stage)) return "enquiry";
    if(["availability-confirmed","package-chosen","contract-sent","deposit-requested"].includes(stage)) return "consultation";
    if(["booked","pre-wedding","final-consultation"].includes(stage)) return "confirmed";
    if(["wedding-completed","editing","delivered","archived"].includes(stage)) return "completed";
    return "enquiry";
  }

  function renderCalendar(){
    const events = calendarEvents();
    const year = calendarCursor.getFullYear();
    const month = calendarCursor.getMonth();
    document.getElementById("calendarMonth").textContent = new Intl.DateTimeFormat("en-GB",{month:"long",year:"numeric"}).format(calendarCursor);

    const first = new Date(year,month,1);
    const mondayOffset = (first.getDay() + 6) % 7;
    const gridStart = new Date(year,month,1 - mondayOffset);
    const weekdays = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
    let html = weekdays.map(day => `<div class="calendar-weekday">${day}</div>`).join("");

    for(let index = 0; index < 42; index++){
      const date = addDays(gridStart,index);
      const iso = dateISO(date);
      const dayEvents = events.filter(event => event.date === iso);
      const classes = [date.getMonth() !== month ? "outside" : "",iso === todayISO() ? "today" : ""].filter(Boolean).join(" ");
      html += `<div class="calendar-day ${classes}"><span class="calendar-number">${date.getDate()}</span>${dayEvents.slice(0,2).map(event => `<span class="calendar-event ${event.type}" title="${escapeAttribute(event.title)}">${escapeHTML(event.title)}</span>`).join("")}${dayEvents.length > 2 ? `<span class="calendar-more">+${dayEvents.length - 2}</span>` : ""}</div>`;
    }
    document.getElementById("calendarGrid").innerHTML = html;

    const monthEvents = events.filter(event => {
      const date = parseDate(event.date);
      return date && date.getFullYear() === year && date.getMonth() === month;
    }).sort((a,b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));

    document.getElementById("calendarAgenda").innerHTML = monthEvents.length ? monthEvents.map(event => `
      <article class="agenda-item ${event.type}"><span class="agenda-date">${escapeHTML(shortDate(event.date))}</span><span class="agenda-dot"></span><div class="agenda-copy"><strong>${escapeHTML(event.title)}</strong><span>${escapeHTML(event.detail || titleCase(event.type))}</span></div><a class="ghost-btn" href="${escapeAttribute(event.href)}">Open</a></article>
    `).join("") : `<div class="assistant-empty">No weddings, calls, payments, tasks or deadlines in this month.</div>`;
  }

  function calendarEvents(){
    const events = [];
    data.bookings.filter(item => item.eventDate).forEach(item => events.push({date:item.eventDate,type:"wedding",title:item.clientName || item.eventName || "Wedding",detail:item.location || item.eventName || "Wedding",href:"bookings.html"}));
    data.consultations.forEach(item => {
      if(item.callDate) events.push({date:item.callDate,type:"consultation",title:`Consultation: ${item.project || item.contactName || "Client"}`,detail:item.status || "Consultation",href:"consultations.html"});
      if(item.finalConsultationDate) events.push({date:item.finalConsultationDate,type:"consultation",title:`Final consultation: ${item.project || item.contactName || "Client"}`,detail:"Final consultation",href:"consultations.html"});
    });
    data.finance.filter(item => item.date).forEach(item => events.push({date:item.date,type:"payment",title:item.title || item.client || "Payment",detail:`${money(item.amount)} · ${titleCase(item.status)}`,href:"finance.html"}));
    data.tasks.filter(item => item.dueDate && item.status !== "done").forEach(item => events.push({date:item.dueDate,type:"task",title:item.title,detail:item.project || titleCase(item.category),href:"lists.html"}));
    data.delivery.filter(item => item.dueDate && !["delivered","completed"].includes(item.stage)).forEach(item => events.push({date:item.dueDate,type:"delivery",title:`Delivery: ${item.projectName || item.client}`,detail:item.nextAction || titleCase(item.stage),href:"delivery.html"}));
    data.content.filter(item => item.postDate && !["posted","skip"].includes(item.status)).forEach(item => events.push({date:item.postDate,type:"content",title:`Post: ${item.clientName || "Content"}`,detail:item.reelIdea || item.status || "Content",href:"content.html"}));
    return events.filter(item => /^\d{4}-\d{2}-\d{2}$/.test(item.date));
  }

  function suggestPackage(){
    const words = document.getElementById("clientWords").value.trim();
    const text = words.toLowerCase();
    const service = document.getElementById("suggestionService").value;
    const hours = Number(document.getElementById("coverageHours").value || 0);
    const budgetRaw = document.getElementById("clientBudget").value;
    const budget = budgetRaw === "" ? null : Number(budgetRaw || 0);
    const packages = config.packages[service];
    const miniSignal = /just (the )?ceremony|ceremony only|registry|small wedding|elopement|civil ceremony/.test(text);
    const fullSignal = /full (wedding )?day|morning to (night|evening)|getting ready|party|first dance|speeches|outfit change|all day/.test(text) || hours > 5;
    const halfSignal = /ceremony and reception|reception|couple portraits|family photos/.test(text) || (hours >= 3.5 && hours <= 5);
    const seriousSignal = /ready to book|secure the date|pay (the )?deposit|is the date available|want to book/.test(text);

    let index = miniSignal ? 0 : fullSignal ? 2 : halfSignal ? 1 : 1;
    if(budget !== null){
      const affordable = packages.map((item,i) => ({item,i})).filter(entry => entry.item.price !== null && entry.item.price <= budget);
      if(affordable.length && packages[index].price !== null && packages[index].price > budget){
        index = affordable[affordable.length - 1].i;
      }
    }

    const primary = packages[index];
    const alternatives = [];
    if(budget === null && !miniSignal && !fullSignal){
      alternatives.push(packages[0],packages[1]);
    }else{
      if(index > 0) alternatives.push(packages[index - 1]);
      if(index < packages.length - 1) alternatives.push(packages[index + 1]);
    }
    const reasons = [];
    if(miniSignal) reasons.push("They described a ceremony-only, registry or smaller wedding.");
    if(fullSignal) reasons.push("They want enough of the day that shorter coverage would feel rushed.");
    if(halfSignal && !fullSignal) reasons.push("Ceremony plus key reception moments fits a focused half day.");
    if(hours) reasons.push(`${hours} hours of coverage points to ${primary.shortName.toLowerCase()} coverage.`);
    if(budget !== null) reasons.push(`${money(budget)} is the budget currently mentioned.`);
    if(seriousSignal) reasons.push("They sound ready to move, so lead with one clear package and the deposit step.");
    if(!reasons.length) reasons.push("There is not enough detail for a hard sell, so lead with the most practical middle option and confirm timings.");

    return {primary,alternatives:uniqueById(alternatives),reasons,budgetUnknown:budget === null,next:"Confirm the date is available, agree the package, then send the contract and deposit request to secure the booking."};
  }

  function renderPackageSuggestion(result){
    const price = result.primary.price === null ? "Price to confirm" : money(result.primary.price);
    const alternatives = result.alternatives.length ? `<p><strong>Also show:</strong> ${result.alternatives.map(item => `${item.shortName}${item.price === null ? "" : ` (${money(item.price)})`}`).join(" and ")}.</p>` : "";
    document.getElementById("packageResult").innerHTML = `
      <p class="kicker">Best fit</p><h3>${escapeHTML(result.primary.name)}</h3><strong class="package-price">${escapeHTML(price)}</strong>
      <p>${escapeHTML(result.primary.hours)} · ${escapeHTML(result.primary.deliverables)}</p>
      <ul class="package-reasons">${result.reasons.map(reason => `<li>${escapeHTML(reason)}</li>`).join("")}</ul>
      ${alternatives}
      <div class="package-next"><strong>Next step:</strong> ${escapeHTML(result.next)}</div>
    `;
  }

  function runDailyAutomations(){
    const key = "ncstudios_assistant_last_automation";
    if(localStorage.getItem(key) === todayISO()) return;
    runAutomations();
    localStorage.setItem(key,todayISO());
  }

  function runAutomations(){
    data = loadAll();
    let added = 0;
    const now = new Date().toISOString();

    function addTask(automationKey,title,project,category,priority,dueDate,notes){
      if(data.tasks.some(item => item.automationKey === automationKey)) return;
      data.tasks.unshift({id:makeId(),automationKey,title,project,category,priority,dueDate,status:"open",notes,createdAt:now,updatedAt:now});
      added++;
    }

    data.bookings.forEach(booking => {
      const stage = booking.pipelineStage || legacyStage(booking.status);
      const slug = recordKey(booking.clientName || booking.eventName) || booking.id;
      const date = booking.eventDate || "";
      const days = daysUntil(date);

      if(stage === "new-enquiry") addTask(`enquiry-reply:${booking.id}`,"Reply to enquiry",booking.clientName,"client","high",todayISO(),"Check availability, answer warmly and guide them toward a package and deposit.");

      if(["booked","pre-wedding","final-consultation"].includes(stage) && days < 0){
        addTask(`past-wedding-stage:${booking.id}`,"Move wedding to completed stage",booking.clientName,"admin","high",todayISO(),"The wedding date has passed. Update the pipeline so backup and editing automations can start.");
      }

      if(["booked","pre-wedding","final-consultation"].includes(stage) && days >= 0){
        if(!String(booking.contractStatus || "").toLowerCase().includes("signed")) addTask(`contract:${booking.id}`,"Send or chase contract",booking.clientName,"admin","high",addDaysISO(todayISO(),1),"The date is not fully secure until the agreement is signed.");
        if(Number(booking.depositPaid || 0) <= 0) addTask(`deposit:${booking.id}`,"Request booking deposit",booking.clientName,"finance","high",addDaysISO(todayISO(),1),"Send the deposit details and make the payment deadline clear.");
        addTask(`consultation:${booking.id}`,"Schedule pre-wedding consultation",booking.clientName,"client","medium",date ? addDaysISO(date,-45) : addDaysISO(todayISO(),7),"Capture timings, locations, priorities and supplier details.");
      }

      if(days >= 0 && days <= config.automation.finalConsultationDays && ["booked","pre-wedding","final-consultation"].includes(stage)){
        addTask(`final-consultation:${booking.id}`,"Schedule final consultation",booking.clientName,"client","high",date ? addDaysISO(date,-14) : todayISO(),"Lock the timeline, addresses, ceremony time, reception time and family details.");
      }

      if(days >= 0 && days <= config.automation.weddingPrepDays && ["booked","pre-wedding","final-consultation"].includes(stage)){
        config.weddingPrepTasks.forEach((title,index) => addTask(`wedding-prep:${booking.id}:${index}`,title,booking.clientName,"shoot prep",index < 3 ? "high" : "medium",date ? addDaysISO(date,-1) : todayISO(),"Smart wedding-week checklist for " + (booking.clientName || slug) + "."));
      }

      if(stage === "wedding-completed"){
        addTask(`backup:${booking.id}`,"Back up footage twice",booking.clientName,"editing","high",date ? addDaysISO(date,1) : todayISO(),"Keep two verified copies before cards are reused.");
        addTask(`start-edit:${booking.id}`,"Start editing project",booking.clientName,"editing","medium",date ? addDaysISO(date,3) : addDaysISO(todayISO(),2),"Create the project, organise media and begin the first pass.");
      }
    });

    data.messages.filter(item => !["replied","archived"].includes(item.status) && ageInDays(item.createdAt || item.updatedAt) >= config.automation.staleReplyDays).forEach(message => {
      addTask(`stale-message:${message.id}`,`Follow up with ${message.clientName || "website enquiry"}`,message.clientName,"client","high",todayISO(),"No reply activity for three days. Keep the follow-up short and clear.");
    });

    data.finance.filter(item => item.type === "income" && ["waiting","unpaid","hold"].includes(item.status) && item.date && item.date < todayISO()).forEach(item => {
      addTask(`overdue-payment:${item.id}`,`Chase overdue payment: ${item.client || item.title}`,item.client,"finance","high",todayISO(),`${money(item.amount)} was due ${niceDate(item.date)}.`);
    });

    data.delivery.filter(item => ["delivered","completed"].includes(item.stage)).forEach(item => {
      addTask(`review:${item.id}`,"Ask for a review",item.client || item.projectName,"delivery","medium",addDaysISO(todayISO(),3),"Thank them, check they are happy and send the review link.");
      addTask(`posting:${item.id}`,"Ask permission to post",item.client || item.projectName,"content","low",addDaysISO(todayISO(),3),"Confirm whether images or film clips can be shared in the portfolio and on social media.");
    });

    if(added) writeData("tasks");
    return added;
  }

  function legacyStage(status){
    return {enquiry:"new-enquiry",consultation:"availability-confirmed",confirmed:"booked",completed:"wedding-completed",postponed:"waiting-response"}[status] || "new-enquiry";
  }

  function latest(items){
    return items.slice().sort((a,b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")))[0] || null;
  }

  function recordDate(record){
    return record.profile?.weddingDate || record.booking?.eventDate || record.client?.eventDate || record.client?.event_date || record.consultation?.weddingDate || "";
  }

  function stageLabel(id){
    return config.pipelineStages.find(stage => stage.id === id)?.label || titleCase(id);
  }

  function displayName(value){
    return String(value || "").replace(/\s+/g," ").trim().replace(/\s+(wedding|film|video|project)$/i,"").trim();
  }

  function recordKey(value){
    const noise = new Set(["and","the","of","for","wedding","film","films","video","videography","photography","shoot","project","couple","client"]);
    return String(value || "").toLowerCase().replace(/&|\+/g," and ").replace(/[^a-z0-9]+/g," ").trim().split(/\s+/).filter(word => word && !noise.has(word) && !/^\d{2,4}$/.test(word)).sort().join(" ");
  }

  function keysMatch(left,right){
    if(left === right) return true;
    const a = left.split(" ").filter(Boolean);
    const b = right.split(" ").filter(Boolean);
    if(!a.length || !b.length || Math.abs(a.length - b.length) > 1) return false;
    const shorter = a.length <= b.length ? a : b;
    const longer = a.length <= b.length ? b : a;
    const used = new Set();
    const matched = shorter.every(token => {
      const index = longer.findIndex((candidate,i) => !used.has(i) && tokenSimilar(token,candidate));
      if(index < 0) return false;
      used.add(index);
      return true;
    });
    return matched && (shorter.length > 1 || shorter[0].length >= 4);
  }

  function tokenSimilar(left,right){
    if(left === right) return true;
    if(left.length < 4 || right.length < 4) return false;
    if(left.startsWith(right) || right.startsWith(left)) return Math.abs(left.length - right.length) <= 2;
    const limit = Math.max(left.length,right.length) >= 7 ? 2 : 1;
    return editDistance(left,right,limit) <= limit;
  }

  function editDistance(left,right,limit){
    if(Math.abs(left.length - right.length) > limit) return limit + 1;
    let previous = Array.from({length:right.length + 1},(_,i) => i);
    for(let row = 1; row <= left.length; row++){
      const current = [row];
      let minimum = row;
      for(let col = 1; col <= right.length; col++){
        const cost = left[row - 1] === right[col - 1] ? 0 : 1;
        current[col] = Math.min(previous[col] + 1,current[col - 1] + 1,previous[col - 1] + cost);
        minimum = Math.min(minimum,current[col]);
      }
      if(minimum > limit) return limit + 1;
      previous = current;
    }
    return previous[right.length];
  }

  function uniqueById(items){
    return items.filter((item,index,array) => array.findIndex(candidate => candidate.id === item.id) === index);
  }

  function reminderMailto(email,name,subject){
    const body = `Hi ${firstName(name)},\n\nI just wanted to follow up and see whether you had any questions. I’m happy to help with the next step when you’re ready.\n\nNC Studio`;
    return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  function recordEmail(record){
    return String(record.profile?.email || record.client?.email || record.booking?.contactEmail || record.messages.find(item => item.contactEmail)?.contactEmail || "").trim();
  }

  function firstName(value){
    return String(value || "there").trim().split(/\s+|\+/)[0] || "there";
  }

  function makeId(){
    return window.crypto?.randomUUID ? crypto.randomUUID() : `assistant_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function parseDate(value){
    if(!value) return null;
    const clean = String(value).slice(0,10);
    const date = new Date(`${clean}T12:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function normaliseDate(value){
    return String(value || "").slice(0,10);
  }

  function todayISO(){
    return dateISO(new Date());
  }

  function dateISO(date){
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2,"0");
    const day = String(date.getDate()).padStart(2,"0");
    return `${year}-${month}-${day}`;
  }

  function startOfMonth(date){
    return new Date(date.getFullYear(),date.getMonth(),1);
  }

  function addDays(date,amount){
    const result = new Date(date);
    result.setDate(result.getDate() + amount);
    return result;
  }

  function addDaysISO(value,amount){
    const date = parseDate(value) || new Date();
    return dateISO(addDays(date,amount));
  }

  function daysUntil(value){
    const date = parseDate(value);
    if(!date) return Infinity;
    const today = parseDate(todayISO());
    return Math.ceil((date - today) / 86400000);
  }

  function ageInDays(value){
    const date = parseDate(value);
    if(!date) return 0;
    return Math.max(0,Math.floor((parseDate(todayISO()) - date) / 86400000));
  }

  function relativeDate(value){
    const days = daysUntil(value);
    if(days === 0) return "today";
    if(days === 1) return "tomorrow";
    if(days > 1) return `in ${days} days`;
    if(days === -1) return "yesterday";
    return `${Math.abs(days)} days ago`;
  }

  function niceDate(value){
    const date = parseDate(value);
    return date ? new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short",year:"numeric"}).format(date) : "No date";
  }

  function shortDate(value){
    const date = parseDate(value);
    return date ? new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short"}).format(date) : "No date";
  }

  function money(value){
    return new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP",maximumFractionDigits:0}).format(Number(value || 0));
  }

  function titleCase(value){
    return String(value || "Not set").replace(/[-_]+/g," ").replace(/\b\w/g,letter => letter.toUpperCase());
  }

  function showToast(message){
    const toast = document.getElementById("assistantToast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"),2300);
  }

  function escapeHTML(value){
    return String(value ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
  }

  function escapeAttribute(value){
    return escapeHTML(value);
  }
})();
