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
    ["ownedKit","payments","allocations","rentals","buyList","weddingWeek"].forEach(key => {
      const savedItems = Array.isArray(saved[key]) ? saved[key] : [];
      const savedMap = new Map(savedItems.map(item => [item.id,item]));
      const defaultIds = new Set((defaults[key] || []).map(item => item.id));
      const configured = (defaults[key] || []).map(item => ({...clone(item),...(savedMap.get(item.id) || {})}));
      const custom = savedItems.filter(item => item.id && !defaultIds.has(item.id));
      merged[key] = configured.concat(custom);
    });
    merged.nextWedding = {...clone(defaults.nextWedding),...(saved.nextWedding || {})};
    return merged;
  }

  function migrateState(saved){
    if(!saved || typeof saved !== "object") return saved;
    const migrated = clone(saved);
    const version = Number(migrated.dataVersion || 1);

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
      migrated.dataVersion = 2;
      localStorage.setItem(STORAGE_KEY,JSON.stringify([migrated]));
    }

    return migrated;
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
    document.getElementById("resetRoadmap").addEventListener("click",resetRoadmap);
    document.getElementById("editForm").addEventListener("submit",saveEdit);
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
    renderWarnings(totals);
    renderProgress(totals);
    renderPayments();
    renderAllocations();
    renderRentals();
    renderBuyOrder();
    renderOwnedKit();
    renderWeddingWeek();
  }

  function calculateTotals(){
    const totalIncoming = sum(state.payments,item => item.amount);
    const received = sum(state.payments,item => item.status === "pending" ? 0 : item.amount);
    const allocatedPaymentIds = new Set(state.payments.filter(item => item.status === "allocated").map(item => item.id));
    const activeAllocations = state.allocations.filter(item => !["skipped","moved-later"].includes(effectiveAllocationStatus(item)));
    const allocated = sum(activeAllocations,item => allocatedPaymentIds.has(item.paymentId) ? item.estimatedCost : 0);
    const spent = sum(state.allocations,item => effectiveAllocationStatus(item) === "bought" ? item.estimatedCost : 0);
    const rentalSaved = sum(activeAllocations,item => item.protected && allocatedPaymentIds.has(item.paymentId) ? item.estimatedCost : 0);
    const emergencySaved = sum(activeAllocations,item => item.buffer && allocatedPaymentIds.has(item.paymentId) ? item.estimatedCost : 0);
    const flexible = Math.max(0,received - allocated);

    return {totalIncoming,received,allocated,spent,rentalSaved,emergencySaved,flexible};
  }

  function renderHero(totals){
    setText("heroPriority",state.currentPriority);
    setText("heroRentalCopy",`${money(totals.rentalSaved)} of ${money(state.rentalTarget)} rental pot protected`);
    document.getElementById("heroRentalBar").style.width = percent(totals.rentalSaved,state.rentalTarget) + "%";
  }

  function renderOverview(totals){
    const cards = [
      {label:"Total incoming funds",value:money(totals.totalIncoming),note:`${state.payments.length} client payments`},
      {label:"Rental pot target",value:money(state.rentalTarget),note:"Protect before extra kit"},
      {label:"Emergency + travel target",value:money(state.emergencyTarget),note:`Warning below ${money(state.emergencyWarningAt)}`},
      {label:"Next wedding",value:state.nextWedding.client,note:niceDate(state.nextWedding.date),priority:true},
      {label:"Current priority",value:state.currentPriority,note:"Rentals before upgrades",priority:true}
    ];
    document.getElementById("overviewCards").innerHTML = cards.map(card => `
      <article class="overview-card${card.priority ? " priority" : ""}">
        <span>${escapeHTML(card.label)}</span>
        <strong>${escapeHTML(card.value)}</strong>
        <small>${escapeHTML(card.note)}</small>
      </article>
    `).join("");
  }

  function renderWarnings(totals){
    const warnings = [];
    const rentalConfirmed = state.rentals.length > 0 && state.rentals.every(item => ["reserved","received","returned"].includes(item.status));
    const weddingDays = daysUntil(state.nextWedding.date);
    const battery = state.ownedKit.find(item => item.id === "np-f550");
    const ssd = state.buyList.find(item => item.id === "ssd-1tb");
    const ssdBought = ssd && effectiveBuyStatus(ssd) === "bought";

    if(totals.rentalSaved < state.rentalWarningAt){
      warnings.push({title:`Rental pot is ${money(state.rentalWarningAt - totals.rentalSaved)} short`,copy:`Keep ${money(state.rentalWarningAt)} protected before optional kit.`});
    }
    if(totals.emergencySaved < state.emergencyWarningAt){
      warnings.push({title:"Emergency buffer is below the safe minimum",copy:`Protect at least ${money(state.emergencyWarningAt)} for travel and wedding-day surprises.`});
    }
    if(weddingDays >= 0 && weddingDays <= 14 && !rentalConfirmed){
      warnings.push({title:"Wedding is within 14 days and rentals are not confirmed",copy:"Reserve all three rental items now and check the final VAT, waiver and delivery total."});
    }
    if(!ssdBought){
      warnings.push({title:"Wedding storage is not marked bought",copy:"The 1TB SSD is still needed before the August wedding."});
    }
    if(Number(battery?.quantity || 0) <= 1){
      warnings.push({title:"Only one NP F550 battery is owned",copy:"Keep the second battery high on the list after the rental pot is protected."});
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
      {label:"Total spent",value:totals.spent,target:totals.totalIncoming},
      {label:"Rental pot saved",value:totals.rentalSaved,target:state.rentalTarget},
      {label:"Emergency buffer saved",value:totals.emergencySaved,target:state.emergencyTarget},
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

  function renderPayments(){
    document.getElementById("paymentTimeline").innerHTML = state.payments
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
  }

  function renderAllocations(){
    document.getElementById("allocationPlans").innerHTML = state.payments.map(payment => {
      const items = state.allocations.filter(item => item.paymentId === payment.id);
      const activeTotal = sum(items,item => ["skipped","moved-later"].includes(effectiveAllocationStatus(item)) ? 0 : item.estimatedCost);
      const difference = Number(payment.amount || 0) - activeTotal;
      return `
        <section class="allocation-group">
          <div class="allocation-group-heading"><div><span>${escapeHTML(shortDate(payment.expectedDate))} funds</span><h3>${escapeHTML(payment.client)}</h3></div><strong>${money(payment.amount)}</strong></div>
          <div class="allocation-list">${items.length ? items.map(renderAllocationCard).join("") : `<div class="allocation-empty"><strong>No wedding costs remaining</strong><span>${escapeHTML(payment.client)}'s wedding is complete. The balance stays unallocated until it is received.</span></div>`}</div>
          <div class="allocation-summary"><span>${payment.noCostsRemaining ? "Wedding costs" : "Active plan"}</span><strong>${payment.noCostsRemaining ? `${money(0)} · ${money(payment.amount)} pending balance` : `${money(activeTotal)}${difference === 0 ? " · fully assigned" : difference > 0 ? ` · ${money(difference)} open` : ` · ${money(Math.abs(difference))} over`}`}</strong></div>
        </section>
      `;
    }).join("");
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
    document.getElementById("rentalList").innerHTML = state.rentals.map(rental => `
      <article class="rental-card">
        <div class="rental-top"><h3>${escapeHTML(rental.name)}</h3><span class="status-badge">${escapeHTML(labelFor(RENTAL_STATUSES,rental.status))}</span></div>
        <p>${escapeHTML(rental.notes || "No notes.")}</p>
        <div class="card-controls">
          <div class="quick-status"><label for="rental-${escapeAttribute(rental.id)}">Rental status</label><select id="rental-${escapeAttribute(rental.id)}" data-rental-status="${escapeAttribute(rental.id)}">${optionsHTML(RENTAL_STATUSES,rental.status)}</select></div>
          <button class="ghost-btn edit-link" type="button" data-edit-kind="rental" data-edit-id="${escapeAttribute(rental.id)}">Edit</button>
        </div>
      </article>
    `).join("");
  }

  function renderBuyOrder(){
    document.getElementById("buyOrder").innerHTML = state.buyList
      .slice()
      .sort((a,b) => Number(a.rank || 999) - Number(b.rank || 999))
      .map(item => {
        const status = effectiveBuyStatus(item);
        const estimate = item.estimateMax && item.estimateMax !== item.estimate
          ? `${money(item.estimate)}–${money(item.estimateMax)}`
          : item.estimate > 0 ? money(item.estimate) : "Estimate later";
        return `
          <article class="buy-order-card">
            <span class="buy-rank">${Number(item.rank || 0)}</span>
            <div><h3>${escapeHTML(item.name)}</h3><p>${escapeHTML(item.notes || "")} · ${escapeHTML(estimate)}</p></div>
            <div class="buy-status-control"><select aria-label="${escapeAttribute(item.name)} status" data-buy-status="${escapeAttribute(item.id)}">${optionsHTML(BUY_STATUSES,status)}</select><button class="ghost-btn edit-link" type="button" data-edit-kind="buy" data-edit-id="${escapeAttribute(item.id)}">Edit</button></div>
          </article>
        `;
      }).join("");
  }

  function renderOwnedKit(){
    document.getElementById("ownedKit").innerHTML = state.ownedKit.map(item => `
      <article class="owned-card"><strong>${escapeHTML(item.name)}</strong><span>${item.status === "sell-later" ? "Sell after test" : `Owned${Number(item.quantity || 1) > 1 ? ` · ${Number(item.quantity)} total` : ""}`}</span>${item.notes ? `<p>${escapeHTML(item.notes)}</p>` : ""}</article>
    `).join("");
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

  function collectionFor(kind){
    if(kind === "payment") return state.payments;
    if(kind === "allocation") return state.allocations;
    if(kind === "rental") return state.rentals;
    if(kind === "buy") return state.buyList;
    return [];
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
