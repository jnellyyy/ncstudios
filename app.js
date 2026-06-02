const NC = (() => {
  const prefix = "nc_";

  const modules = [
    { href:"bookings.html", title:"Bookings", copy:"Enquiries, dates, deposits and balances." },
    { href:"clients.html", title:"Clients", copy:"Couple details, contacts and notes." },
    { href:"finance.html", title:"Finance", copy:"Income, expenses, payment status and profit." },
    { href:"quick-capture.html", title:"Quick Capture", copy:"Fast inbox for notes, ideas, money and changes." },
    { href:"projects.html", title:"Projects", copy:"One couple hub across the whole app." },
    { href:"call-sheet.html", title:"Call Sheet", copy:"Shoot day contacts, venue and key names." },
    { href:"shot-lists.html", title:"Shot Lists", copy:"Wedding filming plans and shot priorities." },
    { href:"timeline.html", title:"Timeline", copy:"Shoot day run sheets and live timing." },
    { href:"gear.html", title:"Gear", copy:"Pack checks, batteries, cards and rentals." },
    { href:"lists.html", title:"Lists", copy:"Business checklists and quick tasks." },
    { href:"delivery.html", title:"Delivery", copy:"Editing stages, deadlines and handover." },
    { href:"templates.html", title:"Templates", copy:"Reusable messages, emails and client replies." }
  ];

  function key(name){
    return prefix + name;
  }

  function uid(){
    if(window.crypto && crypto.randomUUID){
      return crypto.randomUUID();
    }
    return "id_" + Date.now() + "_" + Math.random().toString(16).slice(2);
  }

  function get(name){
    try{
      const raw = localStorage.getItem(key(name));
      return raw ? JSON.parse(raw) : [];
    }catch(error){
      console.warn(error);
      return [];
    }
  }

  function set(name,data){
    localStorage.setItem(key(name),JSON.stringify(data));
  }

  function esc(value){
    return String(value ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  function money(value){
    const number = Number(value || 0);
    return number.toLocaleString("en-GB",{style:"currency",currency:"GBP"});
  }

  function niceDate(value){
    if(!value) return "Not set";
    const date = new Date(value + "T00:00:00");
    if(Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"});
  }

  function todayISO(){
    return new Date().toISOString().slice(0,10);
  }

  function badgeClass(value){
    const v = String(value || "").toLowerCase();
    if(["paid","confirmed","complete","completed","delivered","sent","done","yes"].some(x => v.includes(x))) return "green";
    if(["overdue","cancelled","unpaid","urgent","no"].some(x => v.includes(x))) return "red";
    if(["pending","editing","in progress","active","enquiry"].some(x => v.includes(x))) return "gold";
    return "blue";
  }

  function pageChrome(activeHref){
    const nav = document.querySelector("[data-nav]");
    if(!nav) return;
    nav.innerHTML = [
      `<a class="pill" href="dashboard.html">Dashboard</a>`,
      ...modules.map(item => `<a class="pill" href="${item.href}">${item.title}</a>`)
    ].join("");
  }

  function renderDashboard(){
    pageChrome("dashboard.html");

    const bookings = get("bookings");
    const finance = get("finance");
    const delivery = get("delivery");
    const lists = get("lists");

    const income = finance
      .filter(item => String(item.type).toLowerCase() === "income")
      .reduce((sum,item) => sum + Number(item.amount || 0),0);

    const expenses = finance
      .filter(item => String(item.type).toLowerCase() === "expense")
      .reduce((sum,item) => sum + Number(item.amount || 0),0);

    const balances = bookings
      .filter(item => !String(item.status || "").toLowerCase().includes("cancel"))
      .reduce((sum,item) => sum + Number(item.balance || 0),0);

    const activeDeliveries = delivery
      .filter(item => !String(item.status || "").toLowerCase().includes("complete") && !String(item.status || "").toLowerCase().includes("deliver"))
      .length;

    const stats = [
      { label:"Bookings", value:bookings.length },
      { label:"Balance due", value:money(balances) },
      { label:"Profit logged", value:money(income - expenses) },
      { label:"Active delivery", value:activeDeliveries }
    ];

    const statsWrap = document.querySelector("[data-dashboard-stats]");
    if(statsWrap){
      statsWrap.innerHTML = stats.map(item => `
        <article class="stat-card">
          <span>${esc(item.label)}</span>
          <strong>${esc(item.value)}</strong>
        </article>
      `).join("");
    }

    const linkWrap = document.querySelector("[data-module-links]");
    if(linkWrap){
      linkWrap.innerHTML = modules.map(item => `
        <a class="module-card" href="${item.href}">
          <div>
            <b>${esc(item.title)}</b>
            <span>${esc(item.copy)}</span>
          </div>
          <span>Open</span>
        </a>
      `).join("");
    }

    const upcomingBookings = bookings
      .filter(item => item.date && item.date >= todayISO())
      .sort((a,b) => a.date.localeCompare(b.date))
      .slice(0,5);

    const dueDelivery = delivery
      .filter(item => item.deadline && item.deadline >= todayISO())
      .sort((a,b) => a.deadline.localeCompare(b.deadline))
      .slice(0,5);

    const todayWrap = document.querySelector("[data-today-list]");
    if(todayWrap){
      const bookingRows = upcomingBookings.map(item => `
        <div class="small-row">
          <div><b>${esc(item.client || item.title || "Booking")}</b><br><span>${esc(item.package || item.status || "Wedding")}</span></div>
          <span>${niceDate(item.date)}</span>
        </div>
      `).join("");

      const deliveryRows = dueDelivery.map(item => `
        <div class="small-row">
          <div><b>${esc(item.project || "Delivery")}</b><br><span>${esc(item.status || "In progress")}</span></div>
          <span>${niceDate(item.deadline)}</span>
        </div>
      `).join("");

      todayWrap.innerHTML = bookingRows + deliveryRows || `<div class="empty-state">Nothing urgent yet. Add your next booking or delivery deadline.</div>`;
    }

    const taskWrap = document.querySelector("[data-task-list]");
    if(taskWrap){
      const openTasks = lists
        .filter(item => !String(item.status || "").toLowerCase().includes("done"))
        .slice(0,6);
      taskWrap.innerHTML = openTasks.map(item => `
        <div class="small-row">
          <div><b>${esc(item.title || "Task")}</b><br><span>${esc(item.category || "Business")}</span></div>
          <span>${esc(item.status || "Open")}</span>
        </div>
      `).join("") || `<div class="empty-state">No open business tasks yet.</div>`;
    }
  }

  function fieldHtml(field,value=""){
    const id = `field_${field.name}`;
    const wide = field.type === "textarea" || field.wide ? " wide" : "";
    const required = field.required ? " required" : "";
    const label = `<label for="${id}">${esc(field.label)}</label>`;

    if(field.type === "textarea"){
      return `<div class="field${wide}">${label}<textarea id="${id}" name="${field.name}" placeholder="${esc(field.placeholder || "")}"${required}>${esc(value)}</textarea></div>`;
    }

    if(field.type === "select"){
      const options = (field.options || []).map(option => {
        const selected = String(option) === String(value) ? " selected" : "";
        return `<option value="${esc(option)}"${selected}>${esc(option)}</option>`;
      }).join("");
      return `<div class="field${wide}">${label}<select id="${id}" name="${field.name}"${required}>${options}</select></div>`;
    }

    const type = field.type || "text";
    const step = type === "number" ? " step=\"0.01\"" : "";
    return `<div class="field${wide}">${label}<input id="${id}" name="${field.name}" type="${type}" value="${esc(value)}" placeholder="${esc(field.placeholder || "")}"${step}${required}></div>`;
  }

  function recordTitle(config,item){
    const primary = item[config.titleField] || item.title || item.client || item.project || item.name || "Untitled";
    const secondary = config.subtitleField ? item[config.subtitleField] : "";
    return secondary ? `${primary} · ${secondary}` : primary;
  }

  function renderMeta(config,item){
    return (config.cardFields || [])
      .filter(name => name !== config.titleField)
      .map(name => {
        const field = config.fields.find(f => f.name === name) || {label:name,name};
        let value = item[name];
        if(field.type === "date") value = niceDate(value);
        if(field.currency) value = money(value);
        return `<div class="meta-row"><span>${esc(field.label)}</span><b>${esc(value || "Not set")}</b></div>`;
      }).join("");
  }

  function renderRecords(config,records,filter=""){
    const wrap = document.querySelector("[data-records]");
    if(!wrap) return;

    const q = filter.trim().toLowerCase();
    const filtered = records.filter(item => JSON.stringify(item).toLowerCase().includes(q));

    if(!filtered.length){
      wrap.innerHTML = `<div class="empty-state">No records yet. Add your first one above.</div>`;
      return;
    }

    wrap.innerHTML = filtered.map(item => {
      const statusValue = item.status || item.paymentStatus || item.stage || item.type || "Saved";
      const noteField = config.noteField || "notes";
      return `
        <article class="record-card">
          <div>
            <div class="record-top">
              <div class="record-title">${esc(recordTitle(config,item))}</div>
              <span class="badge ${badgeClass(statusValue)}">${esc(statusValue)}</span>
            </div>
            <div class="meta-list">${renderMeta(config,item)}</div>
            ${item[noteField] ? `<div class="note-box">${esc(item[noteField])}</div>` : ""}
          </div>
          <div class="card-actions">
            <button class="ghost-btn" data-edit="${item.id}">Edit</button>
            <button class="danger-btn" data-delete="${item.id}">Delete</button>
          </div>
        </article>
      `;
    }).join("");
  }

  function downloadJson(filename,data){
    const blob = new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function setupCrud(config){
    pageChrome(location.pathname.split("/").pop());

    const title = document.querySelector("[data-page-title]");
    const subtitle = document.querySelector("[data-page-subtitle]");
    if(title) title.textContent = config.title;
    if(subtitle) subtitle.textContent = config.subtitle;

    const form = document.querySelector("[data-form]");
    const search = document.querySelector("[data-search]");
    const importBox = document.querySelector("[data-import-box]");
    const importText = document.querySelector("[data-import-text]");
    const importButton = document.querySelector("[data-import-button]");
    const toggleImport = document.querySelector("[data-toggle-import]");
    const exportButton = document.querySelector("[data-export]");
    const clearButton = document.querySelector("[data-clear-form]");

    let records = get(config.key);
    let editingId = null;

    function renderForm(item={}){
      form.innerHTML = `
        <div class="form-grid">
          ${config.fields.map(field => fieldHtml(field,item[field.name] || "")).join("")}
        </div>
        <div class="form-actions">
          <button class="btn" type="submit">${editingId ? "Save Changes" : config.addButton || "Add Record"}</button>
          <button class="ghost-btn" type="button" data-cancel-edit>Clear</button>
        </div>
      `;
      const cancel = form.querySelector("[data-cancel-edit]");
      cancel.addEventListener("click",() => {
        editingId = null;
        renderForm();
      });
    }

    renderForm();
    renderRecords(config,records);

    form.addEventListener("submit",event => {
      event.preventDefault();
      const formData = new FormData(form);
      const payload = {};
      config.fields.forEach(field => {
        payload[field.name] = formData.get(field.name) || "";
      });
      payload.updatedAt = new Date().toISOString();

      if(editingId){
        records = records.map(item => item.id === editingId ? {...item,...payload} : item);
        editingId = null;
      }else{
        records.unshift({id:uid(),createdAt:new Date().toISOString(),...payload});
      }

      set(config.key,records);
      renderForm();
      renderRecords(config,records,search ? search.value : "");
    });

    document.addEventListener("click",event => {
      const editId = event.target.closest("[data-edit]")?.dataset.edit;
      const deleteId = event.target.closest("[data-delete]")?.dataset.delete;

      if(editId){
        const item = records.find(record => record.id === editId);
        if(item){
          editingId = editId;
          renderForm(item);
          window.scrollTo({top:0,behavior:"smooth"});
        }
      }

      if(deleteId){
        const ok = confirm("Delete this record?");
        if(ok){
          records = records.filter(record => record.id !== deleteId);
          set(config.key,records);
          renderRecords(config,records,search ? search.value : "");
        }
      }
    });

    if(search){
      search.addEventListener("input",() => renderRecords(config,records,search.value));
    }

    if(exportButton){
      exportButton.addEventListener("click",() => downloadJson(`ncstudios-${config.key}.json`,records));
    }

    if(toggleImport && importBox){
      toggleImport.addEventListener("click",() => importBox.classList.toggle("active"));
    }

    if(importButton && importText){
      importButton.addEventListener("click",() => {
        try{
          const parsed = JSON.parse(importText.value);
          const imported = Array.isArray(parsed) ? parsed : [parsed];
          const cleaned = imported.map(item => ({id:item.id || uid(),createdAt:item.createdAt || new Date().toISOString(),...item}));
          records = [...cleaned,...records];
          set(config.key,records);
          importText.value = "";
          importBox.classList.remove("active");
          renderRecords(config,records,search ? search.value : "");
        }catch(error){
          alert("That import did not work. Paste valid JSON only.");
        }
      });
    }

    if(clearButton){
      clearButton.addEventListener("click",() => {
        editingId = null;
        renderForm();
      });
    }

    if(config.key === "templates"){
      setupStarterTemplates(records,config,search);
    }
  }

  function setupStarterTemplates(records,config,search){
    const starter = document.querySelector("[data-starter-templates]");
    if(!starter) return;
    starter.addEventListener("click",() => {
      const templates = [
        {
          id:uid(),
          title:"New enquiry reply",
          type:"Enquiry",
          status:"Ready",
          content:"Hi lovely, thank you so much for enquiring with NC Studios. I would love to hear more about your day. Please send your date, venue, coverage hours and the kind of film you are hoping for."
        },
        {
          id:uid(),
          title:"Balance reminder",
          type:"Payment",
          status:"Ready",
          content:"Hi lovely, just a gentle reminder that your remaining balance is due before delivery. Once payment is complete, I will be able to release your final films."
        },
        {
          id:uid(),
          title:"Planning form follow up",
          type:"Planning",
          status:"Ready",
          content:"Hi lovely, please could you complete the planning form when you get a moment. It helps me prepare your shot list, timings and key family details properly."
        }
      ];
      const current = get(config.key);
      set(config.key,[...templates,...current]);
      renderRecords(config,get(config.key),search ? search.value : "");
    });
  }

  function exportAll(){
    const all = {
      bookings:get("bookings"),
      clients:get("clients"),
      finance:get("finance"),
      shots:get("shots"),
      lists:get("lists"),
      delivery:get("delivery"),
      templates:get("templates"),
      exportedAt:new Date().toISOString()
    };
    downloadJson("ncstudios-full-backup.json",all);
  }

  function importAll(raw){
    const parsed = JSON.parse(raw);
    ["bookings","clients","finance","shots","lists","delivery","templates"].forEach(name => {
      if(Array.isArray(parsed[name])) set(name,parsed[name]);
    });
  }

  function setupGlobalTools(){
    const exportButton = document.querySelector("[data-export-all]");
    const importButton = document.querySelector("[data-import-all]");
    const importText = document.querySelector("[data-import-all-text]");
    const importBox = document.querySelector("[data-import-all-box]");
    const toggle = document.querySelector("[data-toggle-import-all]");

    if(exportButton) exportButton.addEventListener("click",exportAll);
    if(toggle && importBox) toggle.addEventListener("click",() => importBox.classList.toggle("active"));
    if(importButton && importText){
      importButton.addEventListener("click",() => {
        try{
          importAll(importText.value);
          alert("Imported. Refreshing now.");
          location.reload();
        }catch(error){
          alert("That import did not work. Paste a full NC Studios backup JSON file.");
        }
      });
    }
  }

  function init(){
    setupGlobalTools();

    if(document.body.dataset.page === "dashboard"){
      renderDashboard();
    }

    if(window.NC_PAGE){
      setupCrud(window.NC_PAGE);
    }
  }

  return { init, get, set, exportAll };
})();

document.addEventListener("DOMContentLoaded",NC.init);
