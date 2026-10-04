(function(){
  "use strict";
  const primary = [
    {label:"Home",path:"dashboard.html",icon:"house"},
    {label:"Pipeline",path:"crm.html",icon:"columns-3"},
    {label:"Inbox",path:"messages.html",icon:"inbox"},
    {label:"Money",path:"finance.html",icon:"wallet"}
  ];
  const groups = [
    {title:"Client work",links:[["Bookings","bookings.html"],["Contacts","clients.html"],["Consultations","consultations.html"],["Contracts & admin","admin.html"],["Client vault","https://ncstudiouk.co.uk/client-vault.html"],["Templates","templates.html"]]},
    {title:"Shoot day",links:[["Shot lists","shot-lists.html"],["Call sheets","call-sheet.html"],["Timeline","timeline.html"],["Camera settings","shoot-settings.html"],["Gear","gear.html"]]},
    {title:"Business",links:[["Tasks","lists.html"],["Editing & delivery","delivery.html"],["Funds roadmap","wedding-funds.html"],["Buy list","buy-list.html"],["Quick notes","quick-capture.html"],["Content","content.html"]]}
  ];
  const icon = name => '<i data-lucide="'+name+'" aria-hidden="true"></i>';
  const routeName = () => location.pathname.split("/").pop().replace(/\.html$/,"");
  const isPrimaryRoute = () => primary.some(link=>routeName()===link.path.replace(".html",""));
  const navLinks = (withIcons=false) => primary.map(link=>'<a href="'+link.path+'"'+(routeName()===link.path.replace(".html","")?' class="active" aria-current="page"':'')+'>'+(withIcons?icon(link.icon):'')+'<span>'+link.label+'</span></a>').join("");
  function refreshIcons(){
    if(window.lucide){window.lucide.createIcons();return;}
    if(document.querySelector('script[data-nc-icons]'))return;
    const script=document.createElement("script");
    script.src="assets/vendor/lucide.min.js";script.defer=true;script.dataset.ncIcons="";
    script.addEventListener("load",()=>window.lucide?.createIcons());
    document.head.appendChild(script);
  }
  function openTools(){
    let dialog=document.getElementById("flowTools");
    if(!dialog){
      dialog=document.createElement("dialog");
      dialog.id="flowTools";
      dialog.className="flow-tools-dialog";
      dialog.setAttribute("aria-labelledby","flowToolsTitle");
      dialog.innerHTML='<div class="flow-tools-head"><h2 id="flowToolsTitle">Studio tools</h2><button type="button" aria-label="Close tools" title="Close">'+icon("x")+'<span class="tool-close-fallback">Close</span></button></div>'+
        groups.map(group=>'<section class="flow-tool-group"><h3>'+group.title+'</h3><div class="flow-tool-links">'+group.links.map(link=>'<a href="'+link[1]+'"'+(link[1].startsWith("https:")?' target="_blank" rel="noopener"':'')+'>'+link[0]+'</a>').join("")+'</div></section>').join("");
      document.body.appendChild(dialog);
      dialog.querySelector("button").addEventListener("click",()=>dialog.close());
      dialog.addEventListener("click",event=>{if(event.target===dialog && event.offsetX<0)dialog.close();});
    }
    dialog.showModal();
    if(window.lucide){window.lucide.createIcons();dialog.querySelector(".tool-close-fallback").hidden=true;}
  }
  window.NCNavigation={primary,groups,icon,openTools};
  function setup(){
    refreshIcons();
    if(!document.body.classList.contains("flow-app")){
      const style=document.createElement("link");
      style.rel="stylesheet";style.href="studio-flow.css?v=flow-1";document.head.appendChild(style);
    }
    const theme=document.createElement("link");
    theme.rel="stylesheet";theme.href="app-unified.css?v=app-2";document.head.appendChild(theme);
    if(document.body.classList.contains("flow-app"))return;
    const links=navLinks(false)+'<button type="button" data-studio-tools>Tools</button>';
    document.querySelectorAll("nav.ops-nav, nav.nav, nav.content-bottom-nav, nav.funds-bottom-nav").forEach(nav=>{
      nav.innerHTML=links;nav.classList.add("flow-legacy-nav");
      nav.querySelector("[data-studio-tools]").addEventListener("click",openTools);
    });
    document.querySelectorAll('a[href="studio-assistant.html"]').forEach(link=>{link.href="crm.html";link.textContent="Pipeline";});
    const sidebar=document.createElement("aside");
    sidebar.className="flow-legacy-sidebar";
    sidebar.innerHTML='<a class="flow-brand" href="dashboard.html"><img src="ncstudios-logo-mark-transparent.png" alt=""><span>nc studio</span></a><nav class="flow-nav" aria-label="App navigation">'+navLinks(true)+'<button type="button" data-studio-tools class="'+(isPrimaryRoute()?"":"active")+'">'+icon("layout-grid")+'<span>Tools</span></button></nav><div class="flow-sidebar-foot"><a href="https://ncstudiouk.co.uk/client-vault.html" target="_blank" rel="noopener">'+icon("folder-open")+'Client vault</a><a href="https://ncstudiouk.co.uk" target="_blank" rel="noopener">'+icon("arrow-up-right")+'Website</a></div>';
    sidebar.querySelector("[data-studio-tools]").addEventListener("click",openTools);
    document.body.prepend(sidebar);
    const dock=document.createElement("nav");
    dock.className="flow-mobile-nav";dock.setAttribute("aria-label","App navigation");dock.innerHTML=navLinks(true)+'<button type="button" data-studio-tools class="'+(isPrimaryRoute()?"":"active")+'">'+icon("layout-grid")+'<span>Tools</span></button>';
    dock.querySelector("[data-studio-tools]").addEventListener("click",openTools);
    document.body.appendChild(dock);
    document.body.classList.add("has-nc-mobile-dock","nc-unified-app");
    window.lucide?.createIcons();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",setup);else setup();
})();
