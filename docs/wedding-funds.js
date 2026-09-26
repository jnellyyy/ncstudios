(function(){
  "use strict";

  const STORAGE_KEY = "ncstudios_wedding_funds_v1";
  const FINANCE_KEY = "ncstudios_finance_v1";
  const BUY_LIST_KEY = "ncstudios_buylist_v1";
  const BUY_LIST_SEED_KEY = "ncstudios_wedding_funds_buylist_seeded_v1";
  const defaults = window.NC_WEDDING_FUNDS_DEFAULTS;

  if(!defaults){
    console.error("Wedding Funds Roadmap: default data did not load.");
    return;
  }

  const PAYMENT_STATUSES = [
    ["pending","Waiting for payment"],
    ["received","Received"],
    ["allocated","Allocated"]
  ];
  const ALLOCATION_STATUSES = [
    ["planned","Planned"],
    ["reserve","Reserve"],
    ["bought","Bought / paid"],
    ["skipped","Skipped"],
    ["moved-later","Moved later"]
  ];
  const RENTAL_STATUSES = [
    ["needed","Need to book"],
    ["reserved","Confirmed"],
    ["received","Received"],
    ["returned","Returned"]
  ];
  const BUY_STATUSES = [
    ["needed","Need now"],
    ["research","Research"],
    ["ordered","Ordered"],
    ["later","Save for later"],
    ["bought","Bought"],
    ["skip","Not buying"]
  ];

  let state = loadState();
  let toastTimer = null;

  if(!localStorage.getItem(BUY_LIST_SEED_KEY)){
    syncAllBuyList(false);
    localStorage.setItem(BUY_LIST_SEED_KEY,"yes");
  }

  reconcileBoughtItems();
  bindEvents();
  renderAll();

  function clone(value){
    return JSON.parse(JSON.stringify(value));
  }

  function readJSON(key,fallback){
    try{
      const saved = JSON.parse(localStorage.getItem(key));
      return saved == null ? fallback : saved;
    }catch(error){
      return fallback;
    }
  }

  function readArray(key){
    const value = readJSON(key,[]);
    return Array.isArray(value) ? value : [];
  }

  function loadState(){
    const raw = readJSON(STORAGE_KEY,[]);
    const stored = Array.isArray(raw) ? raw[0] : raw;
    const saved = migrateState(stored);
    if(!saved || typeof saved !== "object") return clone(defaults);

    const merged = {...clone(defaults),...saved};
    const deletedItems = normaliseDeletedItems(saved.deletedItems);
    merged.deletedItems = deletedItems;
    ["ownedKit","payments","allocations","rentals","buyList","weddingWeek"].forEach(key => {
      const savedItems = Array.isArray(saved[key]) ? saved[key] : [];
      const savedMap = new Map(savedItems.map(item => [item.id,item]));
      const defaultIds = new Set((defaults[key] || []).map(item => item.id));
      const deleted = new Set(deletedItems[key] || []);
      const configured = (defaults[key] || [])
        .filter(item => !deleted.has(item.id))
        .map(item => ({...clone(item),...(savedMap.get(item.id) || {})}));
      const custom = savedItems.filter(item => item.id && !defaultIds.has(item.id) && !deleted.has(item.id));
      merged[key] = configured.concat(custom);
    });
    merged.nextWedding = {...clone(defaults.nextWedding),...(saved.nextWedding || {})};
    return merged;
  }

  function migrateState(saved){
    if(!saved || typeof saved !== "object") return saved;
    const migrated = clone(saved);
    const version = Number(migrated.dataVersion || 1);
    let changed = false;

    if(version < 2){
      const payment = (migrated.payments || []).find(item => item.id === "marvin-blessing-july");
      const configured = defaults.payments.find(item => item.id === "marvin-blessing-july");
      if(payment && configured){
        payment.status = "pending";
        payment.weddingStatus = "completed";
        payment.noCostsRemaining = true;
        payment.purpose = configured.purpose;
        payment.notes = configured.notes;
      }
      migrated.allocations = (migrated.allocations || []).filter(item => item.paymentId !== "marvin-blessing-july");
      changed = true;
    }

    if(version < 3){
      migrated.deletedItems = normaliseDeletedItems(migrated.deletedItems);
      changed = true;
    }

    if(version < 4){
      migrated.rentalTarget = defaults.rentalTarget;
      migrated.rentalWarningAt = defaults.rentalWarningAt;

      const savedRental = (migrated.allocations || []).find(item => item.id === "august-rental-balance");
      const defaultRental = defaults.allocations.find(item => item.id === "august-rental-balance");
      if(savedRental && defaultRental){
        savedRental.estimatedCost = defaultRental.estimatedCost;
        savedRental.estimatedMax = defaultRental.estimatedMax;
        savedRental.notes = defaultRental.notes;
      }
      changed = true;
    }

    if(version < 5){
      migrated.rentalTarget = defaults.rentalTarget;
      migrated.rentalWarningAt = defaults.rentalWarningAt;
      migrated.emergencyTarget = defaults.emergencyTarget;
      migrated.emergencyWarningAt = defaults.emergencyWarningAt;
      migrated.currentPriority = defaults.currentPriority;
      migrated.nextWedding = clone(defaults.nextWedding);
      migrated.financeNotes = clone(defaults.financeNotes || []);
      migrated.deletedItems = normaliseDeletedItems(migrated.deletedItems);

      Object.keys(migrated.deletedItems).forEach(key => {
        const defaultIds = new Set((defaults[key] || []).map(item => item.id));
        migrated.deletedItems[key] = migrated.deletedItems[key].filter(id => !defaultIds.has(id));
      });

      migrated.ownedKit = replaceConfiguredCollection(migrated.ownedKit,defaults.ownedKit);
      migrated.payments = replaceConfiguredCollection(migrated.payments,defaults.payments);
      migrated.allocations = replaceConfiguredCollection(
        (migrated.allocations || []).filter(item => !["marvin-blessing-july","simi-kiefah-august"].includes(item.paymentId)),
        defaults.allocations
      );
      migrated.rentals = clone(defaults.rentals);
      migrated.buyList = replaceConfiguredCollection(migrated.buyList,defaults.buyList);
      migrated.weddingWeek = replaceConfiguredCollection(migrated.weddingWeek,defaults.weddingWeek);
      changed = true;
    }

    if(version < 6){
      changed = true;
    }

    if(version < 7){
      migrated.rentalTarget = defaults.rentalTarget;
      migrated.rentalWarningAt = defaults.rentalWarningAt;
      migrated.emergencyTarget = defaults.emergencyTarget;
      migrated.emergencyWarningAt = defaults.emergencyWarningAt;
      migrated.flexibleHoldTarget = defaults.flexibleHoldTarget;
      migrated.currentPriority = defaults.currentPriority;
      migrated.nextWedding = clone(defaults.nextWedding);
      migrated.financeNotes = clone(defaults.financeNotes || []);
      migrated.deletedItems = normaliseDeletedItems(migrated.deletedItems);

      Object.keys(migrated.deletedItems).forEach(key => {
        const defaultIds = new Set((defaults[key] || []).map(item => item.id));
        migrated.deletedItems[key] = migrated.deletedItems[key].filter(id => !defaultIds.has(id));
      });

      migrated.ownedKit = replaceConfiguredCollection(migrated.ownedKit,defaults.ownedKit);
      migrated.payments = replaceConfiguredCollection(migrated.payments,defaults.payments);
      migrated.allocations = replaceConfiguredCollection(
        (migrated.allocations || []).filter(item => !["marvin-blessing-july","simi-kiefah-august"].includes(item.paymentId)),
        defaults.allocations
      );
      migrated.rentals = clone(defaults.rentals);
      migrated.buyList = replaceConfiguredCollection(migrated.buyList,defaults.buyList);
      migrated.weddingWeek = replaceConfiguredCollection(migrated.weddingWeek,defaults.weddingWeek);
      changed = true;
    }

    if(version < 8){
      migrated.rentalTarget = defaults.rentalTarget;
      migrated.rentalFlatBudget = defaults.rentalFlatBudget;
      migrated.rentalWarningAt = defaults.rentalWarningAt;
      migrated.emergencyTarget = defaults.emergencyTarget;
      migrated.emergencyWarningAt = defaults.emergencyWarningAt;
      migrated.flexibleHoldTarget = defaults.flexibleHoldTarget;
      migrated.currentPriority = defaults.currentPriority;
      migrated.nextWedding = clone(defaults.nextWedding);
      migrated.financeNotes = clone(defaults.financeNotes || []);
      migrated.deletedItems = normaliseDeletedItems(migrated.deletedItems);
      migrated.ownedKit = mergeDefaultItemDetails(migrated.ownedKit,defaults.ownedKit,["quantity","status","updatedAt"]);
      migrated.rentals = mergeDefaultItemDetails(migrated.rentals,defaults.rentals,["status","updatedAt"]);
      migrated.buyList = mergeDefaultItemDetails(migrated.buyList,defaults.buyList,["status","updatedAt"]);
      migrated.allocations = mergeDefaultItemDetails(migrated.allocations,defaults.allocations,["status","updatedAt"]);
      changed = true;
    }

    migrated.dataVersion = Number(defaults.dataVersion || 8);
    if(changed) localStorage.setItem(STORAGE_KEY,JSON.stringify([migrated]));

    return migrated;
  }

  function mergeDefaultItemDetails(savedItems,defaultItems,preserveFields){
    const saved = Array.isArray(savedItems) ? savedItems : [];
    const savedMap = new Map(saved.map(item => [item.id,item]));
    const defaultIds = new Set((defaultItems || []).map(item => item.id));
    const mergedDefaults = (defaultItems || []).map(item => {
      const savedItem = savedMap.get(item.id) || {};
      const next = {...clone(item),...savedItem};
      preserveFields.forEach(field => {
        if(savedItem[field] !== undefined) next[field] = savedItem[field];
      });
      return next;
    });
    const custom = saved.filter(item => item.id && !defaultIds.has(item.id));
    return mergedDefaults.concat(custom);
  }

  function replaceConfiguredCollection(savedItems,defaultItems){
    const saved = Array.isArray(savedItems) ? savedItems : [];
    const configured = Array.isArray(defaultItems) ? clone(defaultItems) : [];
    const configuredIds = new Set(configured.map(item => item.id));
    return configured.concat(saved.filter(item => item.id && !configuredIds.has(item.id)));
  }

  function normaliseDeletedItems(value){
    const source = value && typeof value === "object" ? value : {};
    return {
      payments:Array.isArray(source.payments) ? source.payments : [],
      allocations:Array.isArray(source.allocations) ? source.allocations : [],
      rentals:Array.isArray(source.rentals) ? source.rentals : [],
      buyList:Array.isArray(source.buyList) ? source.buyList : []
    };
  }

  function saveState(){
    state.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY,JSON.stringify([state]));
  }

  function bindEvents(){
    document.addEventListener("change",event => {
      const control = event.target;

      if(control.matches("[data-payment-status]")){
        const payment = state.payments.find(item => item.id === control.dataset.paymentStatus);
        if(!payment) return;
        payment.status = control.value;
        payment.updatedAt = new Date().toISOString();
        saveState();
        syncPaymentToFinance(payment);
        renderAll();
        showToast(`${payment.client} marked ${labelFor(PAYMENT_STATUSES,payment.status).toLowerCase()}.`);
      }

      if(control.matches("[data-allocation-status]")){
        const item = state.allocations.find(entry => entry.id === control.dataset.allocationStatus);
        if(!item) return;
        item.status = control.value;
        item.updatedAt = new Date().toISOString();
        saveState();
        if(item.buyListId) syncAllocationToBuyList(item);
        renderAll();
        showToast(`${item.name} updated.`);
      }

      if(control.matches("[data-rental-status]")){
        const rental = state.rentals.find(item => item.id === control.dataset.rentalStatus);
        if(!rental) return;
        rental.status = control.value;
        rental.updatedAt = new Date().toISOString();
        saveState();
        renderAll();
        showToast(`${rental.name} updated.`);
      }

      if(control.matches("[data-buy-status]")){
        const item = state.buyList.find(entry => entry.id === control.dataset.buyStatus);
        if(!item) return;
        item.status = control.value;
        item.updatedAt = new Date().toISOString();
        saveState();
        syncSingleBuyItem(item,true);
        reconcileAllocationFromBuyItem(item);
        renderAll();
        showToast(`${item.name} updated in the roadmap and Buy List.`);
      }

      if(control.matches("[data-week-check]")){
        const item = state.weddingWeek.find(entry => entry.id === control.dataset.weekCheck);
        if(!item) return;
        item.done = control.checked;
        item.updatedAt = new Date().toISOString();
        saveState();
        renderAll();
      }
    });

    document.addEventListener("click",event => {
      const editButton = event.target.closest("[data-edit-kind]");
      if(editButton){
        openEditDialog(editButton.dataset.editKind,editButton.dataset.editId);
      }
    });

    document.getElementById("syncBuyList").addEventListener("click",() => {
      const result = syncAllBuyList(true);
      renderAll();
      showToast(result.added ? `${result.added} missing items added to Buy List.` : "Buy List is already in sync.");
    });

    document.getElementById("exportRoadmap").addEventListener("click",exportRoadmap);
    document.getElementById("exportKitList").addEventListener("click",exportKitList);
    document.getElementById("printKitList").addEventListener("click",() => window.print());
    document.getElementById("resetRoadmap").addEventListener("click",resetRoadmap);
    document.getElementById("editForm").addEventListener("submit",saveEdit);
    document.getElementById("deleteEntry").addEventListener("click",deleteCurrentEntry);
    document.getElementById("closeDialog").addEventListener("click",closeEditDialog);
    document.getElementById("cancelDialog").addEventListener("click",closeEditDialog);

    window.addEventListener("storage",event => {
      if(event.key === STORAGE_KEY || event.key === BUY_LIST_KEY){
        state = loadState();
        reconcileBoughtItems();
        renderAll();
      }
    });
  }

  function renderAll(){
    const totals = calculateTotals();
    renderHero(totals);
    renderOverview(totals);
    renderFinanceNotes();
    renderMoneyFlow(totals);
    renderWarnings(totals);
    renderProgress(totals);
    renderMoneyMap(totals);
    renderPayments();
    renderAllocations();
    renderRentals();
    renderBuyOrder();
    renderOwnedKit();
    renderKitDocument();
    renderWeddingWeek();
  }

  function calculateTotals(){
    const roadmapPaymentIds = new Set(state.payments.filter(isRoadmapPayment).map(item => item.id));
    const totalIncoming = sum(state.payments.filter(isRoadmapPayment),item => item.amount);
    const received = sum(state.payments.filter(isRoadmapPayment),item => item.status === "pending" ? 0 : item.amount);
    const allocatedPaymentIds = new Set(state.payments.filter(item => item.status === "allocated").map(item => item.id));
    const activeAllocations = state.allocations.filter(item => !["skipped","moved-later"].includes(effectiveAllocationStatus(item)));
    const roadmapAllocations = activeAllocations.filter(item => roadmapPaymentIds.has(item.paymentId));
    const allocated = sum(roadmapAllocations,item => allocatedPaymentIds.has(item.paymentId) ? item.estimatedCost : 0);
    const planned = sum(roadmapAllocations,item => item.estimatedCost);
    const spent = sum(roadmapAllocations,item => effectiveAllocationStatus(item) === "bought" ? item.estimatedCost : 0);
    const rentalSaved = sum(activeAllocations,item => isRentalAllocation(item) && allocatedPaymentIds.has(item.paymentId) ? item.estimatedCost : 0);
    const emergencySaved = sum(roadmapAllocations,item => isProtectedReserveAllocation(item) && allocatedPaymentIds.has(item.paymentId) ? item.estimatedCost : 0);
    const flexible = Math.max(0,received - allocated);

    return {totalIncoming,received,allocated,planned,spent,rentalSaved,emergencySaved,flexible};
  }

  function renderHero(totals){
    setText("heroPriority",state.currentPriority);
    setText("heroRentalCopy",`${money(totals.emergencySaved)} of ${money(state.emergencyTarget)} wedding buffer protected · rentals ${money(totals.rentalSaved)} paid`);
    document.getElementById("heroRentalBar").style.width = percent(totals.emergencySaved,state.emergencyTarget) + "%";
  }

  function renderOverview(totals){
    const cards = [
      {label:"Money arriving 24 July",value:money(totals.totalIncoming),note:"Marvin balance + late fee"},
      {label:"Rentals booked",value:money(totals.rentalSaved),note:`Flat rental budget ${money(state.rentalFlatBudget || state.rentalTarget)}`},
      {label:"Protected reserve",value:money(state.emergencyTarget),note:`Plus ${money(state.flexibleHoldTarget || 0)} untouched flexible buffer`},
      {label:"Next wedding",value:state.nextWedding.client,note:niceDate(state.nextWedding.date),priority:true},
      {label:"Current priority",value:state.currentPriority,note:"No CFexpress before 22 August",priority:true}
    ];
    document.getElementById("overviewCards").innerHTML = cards.map(card => `
      <article class="overview-card${card.priority ? " priority" : ""}">
        <span>${escapeHTML(card.label)}</span>
        <strong>${escapeHTML(card.value)}</strong>
        <small>${escapeHTML(card.note)}</small>
      </article>
    `).join("");
  }

  function renderFinanceNotes(){
    const notes = Array.isArray(state.financeNotes) ? state.financeNotes : [];
    document.getElementById("financeNotes").innerHTML = notes.length ? notes.map(note => `
      <article class="finance-note-card">
        <div><span>${escapeHTML(note.category || "Note")}</span><h3>${escapeHTML(note.title || "Finance note")}</h3></div>
        <strong>${note.amount !== undefined ? money(note.amount) : escapeHTML(note.status || "")}</strong>
        <p>${escapeHTML(note.notes || "")}</p>
      </article>
    `).join("") : `<div class="roadmap-empty">No finance notes added.</div>`;
  }

  function renderMoneyFlow(totals){
    const roadmapPaymentIds = new Set(state.payments.filter(isRoadmapPayment).map(item => item.id));
    const closedPaymentIds = new Set(state.payments.filter(item => !isRoadmapPayment(item)).map(item => item.id));
    const activeAllocations = state.allocations.filter(item => !["skipped","moved-later"].includes(effectiveAllocationStatus(item)));
    const roadmapAllocations = activeAllocations.filter(item => roadmapPaymentIds.has(item.paymentId));
    const closedAllocations = activeAllocations.filter(item => closedPaymentIds.has(item.paymentId));
    const protectedAllocations = roadmapAllocations.filter(item => isBufferAllocation(item));
    const purchaseAllocations = roadmapAllocations.filter(item => item.buyListId && !isBufferAllocation(item));
    const plannedProtection = sum(protectedAllocations,item => item.estimatedCost);
    const plannedPurchases = sum(purchaseAllocations,item => item.estimatedCost);
    const closedTotal = sum(closedAllocations,item => item.estimatedCost);
    const unassigned = Math.max(0,totals.totalIncoming - plannedProtection - plannedPurchases);

    const columns = [
      {
        title:"Money in",
        total:sum(state.payments,item => item.amount),
        note:"All tracked client money. Marvin is the active wedding-prep source; Simi is already handled.",
        rows:state.payments.map(payment => ({
          name:payment.client,
          amount:payment.amount,
          status:isRoadmapPayment(payment) ? labelFor(PAYMENT_STATUSES,payment.status) : "Paid and already handled",
          note:payment.purpose || payment.notes || ""
        }))
      },
      {
        title:"Money out / already handled",
        total:closedTotal,
        note:"Money that is already spent, closed or no longer usable.",
        rows:closedAllocations.map(item => ({
          name:item.name,
          amount:item.estimatedCost,
          status:labelFor(ALLOCATION_STATUSES,effectiveAllocationStatus(item)),
          note:item.notes || item.category || ""
        }))
      },
      {
        title:"Marvin allocation",
        total:plannedProtection + plannedPurchases + unassigned,
        note:"How the £445 due on 24 July is split.",
        rows:[
          {name:"Protected wedding reserve",amount:plannedProtection,status:"Do not spend",note:"Travel, food, emergency and untouched buffer before 22 August."},
          {name:"Need to buy before wedding",amount:plannedPurchases,status:"Purchase plan",note:"Storage, audio, battery and small cable/adapters."},
          {name:"Unassigned money",amount:unassigned,status:unassigned ? "Available" : "Fully assigned",note:unassigned ? "No job set yet." : "Every pound has a job."}
        ]
      }
    ];

    document.getElementById("moneyFlow").innerHTML = columns.map(column => `
      <article class="money-flow-card">
        <div class="money-flow-head">
          <div><span>${escapeHTML(column.title)}</span><strong>${money(column.total)}</strong></div>
          <p>${escapeHTML(column.note)}</p>
        </div>
        <div class="money-flow-rows">
          ${column.rows.map(row => `
            <div class="money-flow-row">
              <div><b>${escapeHTML(row.name)}</b><small>${escapeHTML(row.status)}</small></div>
              <strong>${money(row.amount)}</strong>
              ${row.note ? `<p>${escapeHTML(row.note)}</p>` : ""}
            </div>
          `).join("")}
        </div>
      </article>
    `).join("");
  }

  function renderWarnings(totals){
    const warnings = [];
    const rentalConfirmed = state.rentals.length === 0 || state.rentals.every(item => ["reserved","received","returned"].includes(item.status));
    const weddingDays = daysUntil(state.nextWedding.date);
    const battery = state.ownedKit.find(item => item.id === "np-f550");
    const ssd = state.buyList.find(item => item.id === "ssd-1tb");
    const ssdBought = ssd && effectiveBuyStatus(ssd) === "bought";

    if(totals.rentalSaved < state.rentalWarningAt){
      warnings.push({title:`Rental booking money is ${money(state.rentalWarningAt - totals.rentalSaved)} short`,copy:`Keep the ${money(state.rentalWarningAt)} booked rental amount covered before optional kit.`});
    }
    if(totals.emergencySaved < state.emergencyWarningAt){
      warnings.push({title:"Wedding buffer is not fully protected yet",copy:`Keep ${money(state.emergencyWarningAt)} untouched for travel, food, parking and wedding-day surprises.`});
    }
    if(weddingDays >= 0 && weddingDays <= 14 && !rentalConfirmed){
      warnings.push({title:"Wedding is within 14 days and rentals are not confirmed",copy:`Reserve all three rental items and confirm the ${money(state.rentalFlatBudget || state.rentalTarget)} flat rental booking.`});
    }
    if(!ssdBought && !state.deletedItems.buyList.includes("ssd-1tb")){
      warnings.push({title:"Wedding storage is not marked bought",copy:"The 1TB SSD is still needed before the August wedding."});
    }
    if(Number(battery?.quantity || 0) <= 1 && !state.deletedItems.buyList.includes("np-f550-second")){
      warnings.push({title:"Only one NP F550 battery is owned",copy:"Keep the second battery high on the list after the £90 rental total is protected."});
    }

    const wrap = document.getElementById("warningList");
    wrap.innerHTML = warnings.length ? warnings.map(item => `
      <div class="warning-badge"><div><strong>${escapeHTML(item.title)}</strong><span>${escapeHTML(item.copy)}</span></div></div>
    `).join("") : `<div class="all-clear">No active money or wedding-prep warnings.</div>`;
  }

  function renderProgress(totals){
    const rows = [
      {label:"Total received",value:totals.received,target:totals.totalIncoming},
      {label:"Total allocated",value:totals.allocated,target:totals.totalIncoming},
      {label:"Total planned",value:totals.planned,target:totals.totalIncoming},
      {label:"Total spent",value:totals.spent,target:totals.totalIncoming},
      {label:"Rental money saved",value:totals.rentalSaved,target:state.rentalTarget},
      {label:"Wedding buffer saved",value:totals.emergencySaved,target:state.emergencyTarget},
      {label:"Flexible balance",value:totals.flexible,target:totals.received || totals.totalIncoming,noOf:true}
    ];
    document.getElementById("progressGrid").innerHTML = rows.map(item => `
      <article class="progress-item">
        <div class="progress-top"><span>${escapeHTML(item.label)}</span><strong>${money(item.value)}</strong></div>
        <div class="progress-track"><span style="width:${percent(item.value,item.target)}%"></span></div>
        <small>${item.noOf ? "Unassigned received money" : `${money(item.value)} of ${money(item.target)}`}</small>
      </article>
    `).join("");
  }

  function renderMoneyMap(totals){
    const groups = new Map();
    const active = state.allocations.filter(item => !["skipped","moved-later"].includes(effectiveAllocationStatus(item)));
    const roadmapPaymentIds = new Set(state.payments.filter(isRoadmapPayment).map(item => item.id));
    const roadmapActive = active.filter(item => roadmapPaymentIds.has(item.paymentId));

    roadmapActive.forEach(item => {
      const group = allocationGroup(item);
      const current = groups.get(group.key) || {...group,amount:0};
      current.amount += Number(item.estimatedCost || 0);
      groups.set(group.key,current);
    });

    const planned = sum([...groups.values()],item => item.amount);
    const unallocated = Math.max(0,totals.totalIncoming - planned);
    const over = Math.max(0,planned - totals.totalIncoming);
    const chartTotal = Math.max(totals.totalIncoming,planned,1);
    const order = ["personal","rentals","travel","buffer","flexible","audio","storage","battery","cfexpress","purchase","other"];
    const segments = order.map(key => groups.get(key)).filter(item => item && item.amount > 0);
    if(unallocated > 0) segments.push({key:"unallocated",label:"Unallocated",amount:unallocated});

    document.getElementById("moneyMapSummary").innerHTML = `
      <div><strong>${money(totals.totalIncoming)}</strong><span>Active wedding-prep amount</span></div>
      <b>${money(planned)} planned · ${money(unallocated)} unallocated${over ? ` · ${money(over)} over plan` : ""}</b>
    `;

    const bar = document.getElementById("moneyMapBar");
    bar.setAttribute("aria-label",`${money(totals.totalIncoming)} expected. ${money(planned)} planned and ${money(unallocated)} unallocated.`);
    bar.innerHTML = segments.length ? segments.map(item => `
      <span class="money-map-segment ${escapeAttribute(item.key)}" style="width:${item.amount / chartTotal * 100}%" title="${escapeAttribute(item.label)}: ${escapeAttribute(money(item.amount))}"></span>
    `).join("") : `<span class="money-map-segment unallocated" style="width:100%"></span>`;

    document.getElementById("moneyMapLegend").innerHTML = segments.length ? segments.map(item => `
      <div class="money-legend-item"><i class="money-swatch ${escapeAttribute(item.key)}" aria-hidden="true"></i><span>${escapeHTML(item.label)}</span><strong>${money(item.amount)}</strong></div>
    `).join("") : `<div class="roadmap-empty">Add a payment to start the allocation map.</div>`;

    document.getElementById("moneyMapPayments").innerHTML = state.payments.length ? state.payments.map(payment => {
      const allItems = state.allocations.filter(item => item.paymentId === payment.id);
      const items = active.filter(item => item.paymentId === payment.id);
      const paymentPlanned = sum(items,item => item.estimatedCost);
      const open = Math.max(0,Number(payment.amount || 0) - paymentPlanned);
      const paymentOver = Math.max(0,paymentPlanned - Number(payment.amount || 0));
      return `
        <article class="money-payment-row">
          <div class="money-payment-copy"><strong>${escapeHTML(payment.client)}</strong><span>${money(payment.amount)}</span></div>
          <div>
            <div class="money-payment-track"><span style="width:${percent(paymentPlanned,payment.amount)}%"></span></div>
            <div class="money-payment-detail"><span>${payment.noCostsRemaining ? "No wedding costs" : `${money(paymentPlanned)} planned`}</span><span>${paymentOver ? `${money(paymentOver)} over` : `${money(open)} unallocated`}</span></div>
            <div class="money-payment-allocations">${allItems.length ? allItems.map(renderAllocationPill).join("") : `<span class="allocation-pill empty">No allocations yet</span>`}</div>
          </div>
        </article>
      `;
    }).join("") : `<div class="roadmap-empty">No incoming payments are currently tracked.</div>`;
  }

  function allocationGroup(item){
    const category = String(item.category || "").toLowerCase();
    const name = String(item.name || "").toLowerCase();
    if(category.includes("personal") || name.includes("council tax")) return {key:"personal",label:"Personal"};
    if(isRentalAllocation(item)) return {key:"rentals",label:"Rentals"};
    if(category.includes("travel") || category.includes("food") || name.includes("travel") || name.includes("parking") || name.includes("food")) return {key:"travel",label:"Travel, parking + food"};
    if(category.includes("flexible") || name.includes("additional untouched")) return {key:"flexible",label:"Untouched flexible buffer"};
    if(isBufferAllocation(item)) return {key:"buffer",label:"Wedding buffer"};
    if(category.includes("audio") || name.includes("tascam")) return {key:"audio",label:"Audio"};
    if(category.includes("storage") || name.includes("ssd")) return {key:"storage",label:"Storage"};
    if(category.includes("battery") || name.includes("np-f550") || name.includes("np f550")) return {key:"battery",label:"Battery"};
    if(category.includes("cfexpress") || name.includes("cfexpress")) return {key:"cfexpress",label:"CFexpress fund"};
    if(item.buyListId || ["media","monitor support","rig support"].some(value => category.includes(value))) return {key:"purchase",label:"Equipment"};
    return {key:"other",label:"Other planned money"};
  }

  function renderAllocationPill(item){
    const status = effectiveAllocationStatus(item);
    const group = allocationGroup(item);
    return `<span class="allocation-pill ${escapeAttribute(group.key)} ${escapeAttribute(status)}"><b>${escapeHTML(item.name)}</b><em>${money(item.estimatedCost || 0)}</em><small>${escapeHTML(labelFor(ALLOCATION_STATUSES,status))}</small></span>`;
  }

  function isRentalAllocation(item){
    const category = String(item.category || "").toLowerCase();
    const name = String(item.name || "").toLowerCase();
    return Boolean(item.rental || category.includes("rental") || name.includes("rental"));
  }

  function isBufferAllocation(item){
    const category = String(item.category || "").toLowerCase();
    const name = String(item.name || "").toLowerCase();
    return Boolean(item.buffer || category.includes("buffer") || category.includes("reserve") || category.includes("wedding fund") || name.includes("wedding fund") || name.includes("emergency") || name.includes("untouched"));
  }

  function isProtectedReserveAllocation(item){
    const category = String(item.category || "").toLowerCase();
    const name = String(item.name || "").toLowerCase();
    if(category.includes("flexible") || name.includes("additional untouched")) return false;
    return isBufferAllocation(item);
  }

  function isRoadmapPayment(payment){
    return payment && payment.countsForRoadmap !== false;
  }

  function renderPayments(){
    const html = state.payments
      .slice()
      .sort((a,b) => String(a.expectedDate).localeCompare(String(b.expectedDate)))
      .map(payment => `
        <article class="payment-card">
          <div class="payment-top">
            <div><h3>${escapeHTML(payment.client)}</h3><div class="payment-meta"><span class="meta-chip">Due ${escapeHTML(shortDate(payment.expectedDate))}</span>${payment.weddingStatus === "completed" ? `<span class="meta-chip complete">Wedding complete</span>` : payment.weddingDate ? `<span class="meta-chip">Wedding ${escapeHTML(shortDate(payment.weddingDate))}</span>` : ""}</div></div>
            <strong class="payment-amount">${money(payment.amount)}</strong>
          </div>
          <p class="payment-purpose">${escapeHTML(payment.purpose || payment.notes || "No purpose added.")}</p>
          <div class="card-controls">
            <div class="quick-status"><label for="payment-${escapeAttribute(payment.id)}">Payment status</label><select id="payment-${escapeAttribute(payment.id)}" data-payment-status="${escapeAttribute(payment.id)}">${optionsHTML(PAYMENT_STATUSES,payment.status)}</select></div>
            <button class="ghost-btn edit-link" type="button" data-edit-kind="payment" data-edit-id="${escapeAttribute(payment.id)}">Edit details</button>
          </div>
        </article>
      `).join("");
    document.getElementById("paymentTimeline").innerHTML = html || `<div class="roadmap-empty">No payment entries. Reset the roadmap to restore the original plan.</div>`;
  }

  function renderAllocations(){
    const html = state.payments.map(payment => {
      const items = state.allocations.filter(item => item.paymentId === payment.id);
      const activeTotal = sum(items,item => ["skipped","moved-later"].includes(effectiveAllocationStatus(item)) ? 0 : item.estimatedCost);
      const difference = Number(payment.amount || 0) - activeTotal;
      return `
        <section class="allocation-group">
          <div class="allocation-group-heading"><div><span>${escapeHTML(shortDate(payment.expectedDate))} funds</span><h3>${escapeHTML(payment.client)}</h3></div><strong>${money(payment.amount)}</strong></div>
          <div class="allocation-list">${items.length ? items.map(renderAllocationCard).join("") : payment.noCostsRemaining ? `<div class="allocation-empty"><strong>No wedding costs remaining</strong><span>${escapeHTML(payment.client)}'s wedding is complete. The balance stays unallocated until it is received.</span></div>` : `<div class="allocation-empty"><strong>No allocations planned</strong><span>This payment is currently fully unallocated.</span></div>`}</div>
          <div class="allocation-summary"><span>${payment.noCostsRemaining ? "Wedding costs" : "Active plan"}</span><strong>${payment.noCostsRemaining ? `${money(0)} · ${money(payment.amount)} pending balance` : `${money(activeTotal)}${difference === 0 ? " · fully assigned" : difference > 0 ? ` · ${money(difference)} open` : ` · ${money(Math.abs(difference))} over`}`}</strong></div>
        </section>
      `;
    }).join("");
    document.getElementById("allocationPlans").innerHTML = html || `<div class="roadmap-empty">No allocation plans are currently attached to a payment.</div>`;
  }

  function renderAllocationCard(item){
    const status = effectiveAllocationStatus(item);
    const cost = item.estimatedMax && item.estimatedMax !== item.estimatedCost
      ? `${money(item.estimatedCost)}–${money(item.estimatedMax)}`
      : item.estimatedCost > 0 ? money(item.estimatedCost) : "Leftover only";
    return `
      <article class="allocation-card${item.protected ? " protected" : ""}">
        <div class="allocation-top"><h3>${escapeHTML(item.name)}</h3><strong class="allocation-cost">${escapeHTML(cost)}</strong></div>
        <div class="allocation-tags"><span class="priority-badge ${escapeAttribute(item.priority)}">${escapeHTML(item.priority)}</span><span class="meta-chip">${escapeHTML(item.category)}</span></div>
        <p class="allocation-notes">${escapeHTML(item.notes || "No notes.")}</p>
        <div class="card-controls">
          <div class="quick-status"><label for="allocation-${escapeAttribute(item.id)}">Status</label><select id="allocation-${escapeAttribute(item.id)}" data-allocation-status="${escapeAttribute(item.id)}">${optionsHTML(ALLOCATION_STATUSES,status)}</select></div>
          <button class="ghost-btn edit-link" type="button" data-edit-kind="allocation" data-edit-id="${escapeAttribute(item.id)}">Edit</button>
        </div>
      </article>
    `;
  }

  function renderRentals(){
    document.getElementById("rentalTargetLabel").innerHTML = `<span>Booked</span><strong>${money(state.rentalTarget)}</strong>`;
    document.getElementById("rentalProtectNote").innerHTML = `<strong>Rentals are booked for ${money(state.rentalTarget)}.</strong> Flat rental budget is ${money(state.rentalFlatBudget || state.rentalTarget)}. Keep the separate ${money(state.emergencyTarget)} wedding reserve and ${money(state.flexibleHoldTarget || 0)} flexible buffer untouched until after ${shortDate(state.nextWedding.date)}.`;

    const html = state.rentals.map(rental => `
      <article class="rental-card">
        <div class="rental-top"><h3>${escapeHTML(rental.name)}</h3><span class="status-badge">${escapeHTML(labelFor(RENTAL_STATUSES,rental.status))}</span></div>
        <div class="rental-meta"><span>${escapeHTML(rental.weddingClient || state.nextWedding.client)}</span><span>${escapeHTML(shortDate(rental.weddingDate || state.nextWedding.date))}</span>${Number(rental.cost || 0) > 0 ? `<span>${money(rental.cost)}</span>` : ""}</div>
        <p>${escapeHTML(rental.notes || "No notes.")}</p>
        <div class="card-controls">
          <div class="quick-status"><label for="rental-${escapeAttribute(rental.id)}">Rental status</label><select id="rental-${escapeAttribute(rental.id)}" data-rental-status="${escapeAttribute(rental.id)}">${optionsHTML(RENTAL_STATUSES,rental.status)}</select></div>
          <button class="ghost-btn edit-link" type="button" data-edit-kind="rental" data-edit-id="${escapeAttribute(rental.id)}">Edit</button>
        </div>
      </article>
    `).join("");
    document.getElementById("rentalList").innerHTML = html || `<div class="roadmap-empty">No rental entries are currently needed.</div>`;
  }

  function renderBuyOrder(){
    const groups = [
      {key:"before",title:"Need to buy before 22 August",note:"Use Marvin's purchase allocation only after the wedding reserve is protected."},
      {key:"might",title:"Might buy / save for later",note:"Wish-list items and upgrades. Do not buy before the next wedding unless the reserve is still safe."},
      {key:"done",title:"Already bought / not buying",note:"Completed or skipped items stay visible so the plan is easy to audit."}
    ];

    const sorted = state.buyList
      .slice()
      .sort((a,b) => Number(a.rank || 999) - Number(b.rank || 999));

    const html = groups.map(group => {
      const items = sorted.filter(item => buyBucket(item) === group.key);
      return `
        <section class="buy-status-group">
          <div class="buy-status-heading"><div><h3>${escapeHTML(group.title)}</h3><p>${escapeHTML(group.note)}</p></div><strong>${money(sum(items,item => Number(item.estimate || 0)))}</strong></div>
          <div class="buy-status-list">
            ${items.length ? items.map(item => {
        const status = effectiveBuyStatus(item);
        const estimate = estimateText(item);
        return `
          <article class="buy-order-card">
            <span class="buy-rank">${Number(item.rank || 0)}</span>
            <div><h3>${escapeHTML(item.name)}</h3><p>${escapeHTML(item.notes || "")} · ${escapeHTML(estimate)}</p></div>
            <div class="buy-status-control"><select aria-label="${escapeAttribute(item.name)} status" data-buy-status="${escapeAttribute(item.id)}">${optionsHTML(BUY_STATUSES,status)}</select><button class="ghost-btn edit-link" type="button" data-edit-kind="buy" data-edit-id="${escapeAttribute(item.id)}">Edit</button></div>
          </article>
        `;
            }).join("") : `<div class="roadmap-empty">No items in this group.</div>`}
          </div>
        </section>
      `;
    }).join("");
    document.getElementById("buyOrder").innerHTML = html || `<div class="roadmap-empty">No equipment or storage purchases are currently planned.</div>`;
  }

  function renderOwnedKit(){
    document.getElementById("ownedKit").innerHTML = state.ownedKit.map(item => `
      <article class="owned-card"><strong>${escapeHTML(item.name)}</strong><span>${item.status === "sell-later" ? "Sell after test" : `Owned${Number(item.quantity || 1) > 1 ? ` · ${Number(item.quantity)} total` : ""}`}</span>${item.notes ? `<p>${escapeHTML(item.notes)}</p>` : ""}</article>
    `).join("");
  }

  function renderKitDocument(){
    const groups = kitGroups();
    document.getElementById("kitDocument").innerHTML = `
      <article class="kit-doc-sheet">
        <header class="kit-doc-header">
          <div>
            <span>NC Studio kit list</span>
            <h3>${escapeHTML(state.nextWedding.client)} · ${escapeHTML(niceDate(state.nextWedding.date))}</h3>
          </div>
          <strong>Next wedding prep</strong>
        </header>

        ${renderKitSection("Current kit owned",groups.owned,"owned")}
        ${renderKitSection("Need to buy before 22 August",groups.mustBuy,"must")}
        ${renderKitSection("Rented for specific weddings",groups.rentals,"rental")}
        ${renderKitSection("Might buy / wish I had",groups.wishlist,"wish")}
        ${renderKitSection("Already bought from roadmap",groups.bought,"bought")}
      </article>
    `;
  }

  function renderKitSection(title,items,type){
    const total = sum(items,item => Number(item.amount || 0));
    return `
      <section class="kit-doc-section ${escapeAttribute(type)}">
        <div class="kit-doc-section-head"><h4>${escapeHTML(title)}</h4>${total > 0 ? `<strong>${money(total)}</strong>` : ""}</div>
        <div class="kit-doc-list">
          ${items.length ? items.map(item => `
            <div class="kit-doc-row">
              <div><b>${escapeHTML(item.name)}</b><small>${escapeHTML(item.status || "")}</small></div>
              <strong>${item.amount ? money(item.amount) : escapeHTML(item.price || "")}</strong>
              ${item.note ? `<p>${escapeHTML(item.note)}</p>` : ""}
            </div>
          `).join("") : `<div class="roadmap-empty">No items in this group.</div>`}
        </div>
      </section>
    `;
  }

  function kitGroups(){
    const sortedBuy = state.buyList.slice().sort((a,b) => Number(a.rank || 999) - Number(b.rank || 999));
    return {
      owned:state.ownedKit.map(item => ({
        name:item.name,
        status:item.status === "sell-later" ? "Sell after DJI Mic 3 testing" : `Owned${Number(item.quantity || 1) > 1 ? ` · ${Number(item.quantity)} total` : ""}`,
        price:"",
        note:item.notes || ""
      })),
      mustBuy:sortedBuy.filter(item => buyBucket(item) === "before").map(item => ({
        name:item.name,
        amount:Number(item.estimate || 0),
        status:labelFor(BUY_STATUSES,effectiveBuyStatus(item)),
        note:`${estimateText(item)}. ${item.notes || ""}`.trim()
      })),
      rentals:state.rentals.map(item => ({
        name:item.name,
        amount:Number(item.cost || 0),
        status:`${labelFor(RENTAL_STATUSES,item.status)} · ${item.weddingClient || state.nextWedding.client} · ${shortDate(item.weddingDate || state.nextWedding.date)}`,
        note:item.notes || ""
      })),
      wishlist:sortedBuy.filter(item => buyBucket(item) === "might").map(item => ({
        name:item.name,
        amount:Number(item.estimate || 0),
        status:labelFor(BUY_STATUSES,effectiveBuyStatus(item)),
        note:`${estimateText(item)}. ${item.notes || ""}`.trim()
      })),
      bought:sortedBuy.filter(item => buyBucket(item) === "done").map(item => ({
        name:item.name,
        amount:Number(item.estimate || 0),
        status:labelFor(BUY_STATUSES,effectiveBuyStatus(item)),
        note:item.notes || ""
      }))
    };
  }

  function renderWeddingWeek(){
    const complete = state.weddingWeek.filter(item => item.done).length;
    document.getElementById("weekProgress").innerHTML = `<span>Complete</span><strong>${complete}/${state.weddingWeek.length}</strong>`;
    document.getElementById("weekChecklist").innerHTML = state.weddingWeek.map(item => `
      <label class="week-item${item.done ? " done" : ""}"><input type="checkbox" data-week-check="${escapeAttribute(item.id)}"${item.done ? " checked" : ""}><strong>${escapeHTML(item.name)}</strong><span>${escapeHTML(shortDate(item.dueDate))}</span></label>
    `).join("");
  }

  function openEditDialog(kind,id){
    const collection = collectionFor(kind);
    const item = collection.find(entry => entry.id === id);
    if(!item) return;

    const isPayment = kind === "payment";
    const isAllocation = kind === "allocation";
    const isBuy = kind === "buy";

    document.getElementById("editKind").value = kind;
    document.getElementById("editId").value = id;
    document.getElementById("editTitle").textContent = `Edit ${isPayment ? "payment" : isAllocation ? "allocation" : isBuy ? "buy item" : "rental"}`;
    document.getElementById("editName").value = isPayment ? item.client || "" : item.name || "";
    document.getElementById("editAmount").value = isPayment ? Number(item.amount || 0) : isAllocation ? Number(item.estimatedCost || 0) : isBuy ? Number(item.estimate || 0) : "";
    document.getElementById("editMax").value = isAllocation ? Number(item.estimatedMax || 0) : isBuy ? Number(item.estimateMax || 0) : "";
    document.getElementById("editDate").value = isPayment ? item.expectedDate || "" : "";
    document.getElementById("editWeddingDate").value = isPayment ? item.weddingDate || "" : "";
    document.getElementById("editCategory").value = isPayment ? item.purpose || "" : item.category || "";
    document.getElementById("editPriority").value = item.priority || "";
    document.getElementById("editNotes").value = item.notes || "";
    document.getElementById("deleteEntry").textContent = `Delete ${kindLabel(kind)}`;

    toggleField("editAmount",isPayment || isAllocation || isBuy);
    toggleField("editMaxField",isAllocation || isBuy,true);
    toggleField("editDateField",isPayment,true);
    toggleField("editWeddingField",isPayment,true);
    toggleField("editCategoryField",isPayment || isAllocation || isBuy,true);
    toggleField("editPriorityField",isAllocation || isBuy,true);
    document.querySelector("#editCategoryField span").textContent = isPayment ? "Purpose" : "Category";

    const dialog = document.getElementById("editDialog");
    if(typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open","");
  }

  function toggleField(id,show,isContainer){
    const element = document.getElementById(id);
    const target = isContainer ? element : element.closest("label");
    target.hidden = !show;
  }

  function saveEdit(event){
    event.preventDefault();
    const kind = document.getElementById("editKind").value;
    const id = document.getElementById("editId").value;
    const item = collectionFor(kind).find(entry => entry.id === id);
    if(!item) return;

    const name = document.getElementById("editName").value.trim();
    if(kind === "payment"){
      item.client = name;
      item.amount = Number(document.getElementById("editAmount").value || 0);
      item.expectedDate = document.getElementById("editDate").value;
      item.weddingDate = document.getElementById("editWeddingDate").value;
      item.purpose = document.getElementById("editCategory").value.trim();
    }else{
      item.name = name;
      if(kind === "allocation") item.estimatedCost = Number(document.getElementById("editAmount").value || 0);
      if(kind === "buy") item.estimate = Number(document.getElementById("editAmount").value || 0);
      if(kind === "allocation" || kind === "buy"){
        const max = Number(document.getElementById("editMax").value || 0);
        if(kind === "allocation") item.estimatedMax = max;
        if(kind === "buy") item.estimateMax = max;
        item.category = document.getElementById("editCategory").value.trim();
        item.priority = document.getElementById("editPriority").value.trim();
      }
    }
    item.notes = document.getElementById("editNotes").value.trim();
    item.updatedAt = new Date().toISOString();
    saveState();

    if(kind === "payment" && item.status !== "pending") syncPaymentToFinance(item);
    if(kind === "allocation" && item.buyListId) syncAllocationToBuyList(item);
    if(kind === "buy") syncSingleBuyItem(item,true);

    closeEditDialog();
    renderAll();
    showToast("Roadmap details saved.");
  }

  function closeEditDialog(){
    const dialog = document.getElementById("editDialog");
    if(typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  function deleteCurrentEntry(){
    const kind = document.getElementById("editKind").value;
    const id = document.getElementById("editId").value;
    const item = collectionFor(kind).find(entry => entry.id === id);
    if(!item) return;

    const name = kind === "payment" ? item.client : item.name;
    const extra = kind === "payment" ? " Its linked allocations will also be removed." : kind === "buy" ? " Its linked allocation and Buy List copy will also be removed." : "";
    if(!confirm(`Delete ${name}?${extra} You can restore the original plan with Reset from roadmap plan.`)) return;

    state.deletedItems = normaliseDeletedItems(state.deletedItems);
    markDeleted(kind,id);

    if(kind === "payment"){
      const linked = state.allocations.filter(entry => entry.paymentId === id);
      linked.forEach(entry => markDeleted("allocation",entry.id));
      state.allocations = state.allocations.filter(entry => entry.paymentId !== id);
      state.payments = state.payments.filter(entry => entry.id !== id);
      removePaymentFromFinance(id);
    }

    if(kind === "allocation") state.allocations = state.allocations.filter(entry => entry.id !== id);
    if(kind === "rental") state.rentals = state.rentals.filter(entry => entry.id !== id);

    if(kind === "buy"){
      const linked = state.allocations.filter(entry => entry.buyListId === id);
      linked.forEach(entry => markDeleted("allocation",entry.id));
      state.allocations = state.allocations.filter(entry => entry.buyListId !== id);
      state.buyList = state.buyList.filter(entry => entry.id !== id);
      removeBuyListCopy(id);
    }

    saveState();
    closeEditDialog();
    renderAll();
    showToast(`${name} deleted from the roadmap.`);
  }

  function markDeleted(kind,id){
    const key = collectionKeyFor(kind);
    if(!key || !id) return;
    if(!state.deletedItems[key].includes(id)) state.deletedItems[key].push(id);
  }

  function collectionKeyFor(kind){
    return {payment:"payments",allocation:"allocations",rental:"rentals",buy:"buyList"}[kind] || "";
  }

  function kindLabel(kind){
    return {payment:"payment",allocation:"allocation",rental:"rental",buy:"buy item"}[kind] || "entry";
  }

  function collectionFor(kind){
    if(kind === "payment") return state.payments;
    if(kind === "allocation") return state.allocations;
    if(kind === "rental") return state.rentals;
    if(kind === "buy") return state.buyList;
    return [];
  }

  function removePaymentFromFinance(paymentId){
    const finance = readArray(FINANCE_KEY);
    const next = finance.filter(item => item.roadmapPaymentId !== paymentId);
    if(next.length !== finance.length) localStorage.setItem(FINANCE_KEY,JSON.stringify(next));
  }

  function removeBuyListCopy(buyId){
    const buyList = readArray(BUY_LIST_KEY);
    const next = buyList.filter(item => item.roadmapBuyId !== buyId);
    if(next.length !== buyList.length) localStorage.setItem(BUY_LIST_KEY,JSON.stringify(next));
  }

  function syncPaymentToFinance(payment){
    const finance = readArray(FINANCE_KEY);
    const index = finance.findIndex(item => item.roadmapPaymentId === payment.id || (
      normaliseName(item.client) === normaliseName(payment.client) && Number(item.amount || 0) === Number(payment.amount || 0)
    ));
    const existing = index >= 0 ? finance[index] : {};
    const entry = {
      ...existing,
      id:existing.id || `funds_${payment.id}`,
      roadmapPaymentId:payment.id,
      title:`Wedding payment from ${payment.client}`,
      type:"income",
      status:payment.status === "pending" ? "unpaid" : "paid",
      amount:Number(payment.amount || 0),
      date:payment.expectedDate || "",
      category:"balance",
      client:payment.client,
      notes:`Wedding Funds Roadmap: ${labelFor(PAYMENT_STATUSES,payment.status)}. ${payment.notes || payment.purpose || ""}`.trim(),
      updatedAt:new Date().toISOString()
    };
    if(index >= 0) finance[index] = entry;
    else finance.unshift(entry);
    localStorage.setItem(FINANCE_KEY,JSON.stringify(finance));
  }

  function syncAllBuyList(manual){
    let added = 0;
    state.buyList.forEach(item => {
      if(syncSingleBuyItem(item,false)) added++;
    });
    if(manual) localStorage.setItem(BUY_LIST_SEED_KEY,"yes");
    return {added};
  }

  function syncSingleBuyItem(item,updateExisting){
    const buyList = readArray(BUY_LIST_KEY);
    const index = buyList.findIndex(entry => entry.roadmapBuyId === item.id || normaliseItem(entry.itemName) === normaliseItem(item.name));
    const existing = index >= 0 ? buyList[index] : null;
    const next = {
      ...(existing || {}),
      id:existing?.id || `funds_buy_${item.id}`,
      roadmapBuyId:item.id,
      itemName:item.name,
      category:item.category || "Other",
      priority:normaliseBuyPriority(item.priority),
      status:updateExisting ? item.status : existing?.status || item.status,
      quantity:Number(existing?.quantity || 1),
      price:Number(item.estimate || existing?.price || 0),
      targetDate:existing?.targetDate || "",
      source:existing?.source || "Wedding Funds Roadmap",
      note:item.notes || existing?.note || "",
      updatedAt:new Date().toISOString()
    };
    if(index >= 0){
      if(!updateExisting) return false;
      buyList[index] = next;
    }else{
      buyList.push(next);
    }
    localStorage.setItem(BUY_LIST_KEY,JSON.stringify(buyList));
    return index < 0;
  }

  function syncAllocationToBuyList(allocation){
    const item = state.buyList.find(entry => entry.id === allocation.buyListId);
    if(!item) return;
    const map = {planned:item.status === "later" ? "later" : "needed",bought:"bought",skipped:"skip","moved-later":"later"};
    item.status = map[allocation.status] || item.status;
    item.updatedAt = new Date().toISOString();
    saveState();
    syncSingleBuyItem(item,true);
  }

  function reconcileAllocationFromBuyItem(item){
    const allocation = state.allocations.find(entry => entry.buyListId === item.id);
    if(!allocation) return;
    if(item.status === "bought") allocation.status = "bought";
    if(item.status === "skip") allocation.status = "skipped";
    if(item.status === "later") allocation.status = "moved-later";
    if(["needed","research","ordered"].includes(item.status) && ["bought","skipped"].includes(allocation.status)) allocation.status = "planned";
    saveState();
  }

  function reconcileBoughtItems(){
    const buyList = readArray(BUY_LIST_KEY);
    let changed = false;
    state.buyList.forEach(item => {
      const saved = buyList.find(entry => entry.roadmapBuyId === item.id || normaliseItem(entry.itemName) === normaliseItem(item.name));
      if(!saved) return;
      if(item.status !== saved.status){
        item.status = saved.status;
        changed = true;
      }
      const allocation = state.allocations.find(entry => entry.buyListId === item.id);
      if(allocation && saved.status === "bought" && allocation.status !== "bought"){
        allocation.status = "bought";
        changed = true;
      }
      if(allocation && saved.status === "skip" && allocation.status !== "skipped"){
        allocation.status = "skipped";
        changed = true;
      }
    });
    if(changed) saveState();
  }

  function effectiveBuyStatus(item){
    const saved = readArray(BUY_LIST_KEY).find(entry => entry.roadmapBuyId === item.id || normaliseItem(entry.itemName) === normaliseItem(item.name));
    return saved?.status || item.status;
  }

  function effectiveAllocationStatus(item){
    if(!item.buyListId) return item.status;
    const buyItem = state.buyList.find(entry => entry.id === item.buyListId);
    const status = buyItem ? effectiveBuyStatus(buyItem) : "";
    if(status === "bought") return "bought";
    if(status === "skip") return "skipped";
    return item.status;
  }

  function buyBucket(item){
    const status = effectiveBuyStatus(item);
    const category = String(item.category || "").toLowerCase();
    const priority = String(item.priority || "").toLowerCase();
    if(["bought","skip"].includes(status)) return "done";
    if(status === "later" || priority === "future" || category.includes("wish") || category.includes("do not buy")) return "might";
    return "before";
  }

  function estimateText(item){
    const estimate = Number(item.estimate || 0);
    const max = Number(item.estimateMax || 0);
    if(max > 0 && max !== estimate) return `${money(estimate)}-${money(max)}`;
    return estimate > 0 ? money(estimate) : "Estimate to add";
  }

  function normaliseBuyPriority(value){
    const map = {essential:"urgent",high:"urgent",medium:"soon",hold:"client",later:"future"};
    return map[value] || (["urgent","soon","client","future","optional"].includes(value) ? value : "soon");
  }

  function normaliseName(value){
    return String(value || "").toLowerCase().replace(/&|\+/g," and ").replace(/[^a-z0-9]+/g," ").split(/\s+/).filter(word => word && word !== "and").sort().join(" ");
  }

  function normaliseItem(value){
    return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
  }

  function resetRoadmap(){
    if(!confirm("Reset all roadmap payment, allocation, rental and checklist updates to the central plan?")) return;
    state = clone(defaults);
    saveState();
    renderAll();
    showToast("Roadmap reset from the central plan.");
  }

  function exportRoadmap(){
    const blob = new Blob([JSON.stringify({app:"NC Studio",type:"wedding-funds-roadmap",exportedAt:new Date().toISOString(),roadmap:state},null,2)],{type:"application/json"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "nc-studio-wedding-funds-roadmap.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportKitList(){
    const blob = new Blob([JSON.stringify({
      app:"NC Studio",
      type:"kit-list-document",
      wedding:state.nextWedding,
      exportedAt:new Date().toISOString(),
      kit:kitGroups()
    },null,2)],{type:"application/json"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "nc-studio-kit-list-22-august.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  function showToast(message){
    const toast = document.getElementById("fundsToast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"),2400);
  }

  function optionsHTML(options,selected){
    return options.map(([value,label]) => `<option value="${escapeAttribute(value)}"${value === selected ? " selected" : ""}>${escapeHTML(label)}</option>`).join("");
  }

  function labelFor(options,value){
    return options.find(option => option[0] === value)?.[1] || value || "Not set";
  }

  function sum(items,selector){
    return items.reduce((total,item) => total + Number(selector(item) || 0),0);
  }

  function percent(value,target){
    if(Number(target || 0) <= 0) return Number(value || 0) > 0 ? 100 : 0;
    return Math.max(0,Math.min(100,Math.round(Number(value || 0) / Number(target) * 100)));
  }

  function money(value){
    return new Intl.NumberFormat("en-GB",{style:"currency",currency:state.currency || "GBP",maximumFractionDigits:0}).format(Number(value || 0));
  }

  function parsedDate(value){
    if(!value) return null;
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function niceDate(value){
    const date = parsedDate(value);
    return date ? new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"long",year:"numeric"}).format(date) : "Date not set";
  }

  function shortDate(value){
    const date = parsedDate(value);
    return date ? new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short"}).format(date) : "Date not set";
  }

  function daysUntil(value){
    const target = parsedDate(value);
    if(!target) return Infinity;
    const today = new Date();
    today.setHours(12,0,0,0);
    return Math.ceil((target - today) / 86400000);
  }

  function setText(id,value){
    const element = document.getElementById(id);
    if(element) element.textContent = value;
  }

  function escapeHTML(value){
    return String(value ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
  }

  function escapeAttribute(value){
    return escapeHTML(value);
  }
})();
