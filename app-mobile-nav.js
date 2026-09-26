(function(){
  "use strict";

  const LINKS = [
    { label:"Home", path:"dashboard.html", route:"dashboard" },
    { label:"PA", path:"studio-assistant.html", route:"studio-assistant" },
    { label:"CRM", path:"crm.html", route:"crm" },
    { label:"Calls", path:"consultations.html", route:"consultations" },
    { label:"Tasks", path:"lists.html", route:"lists" }
  ];

  function pageRoute(){
    const page = window.location.pathname.split("/").filter(Boolean).pop() || "dashboard";
    return page.replace(/\.html$/i, "") || "dashboard";
  }

  function appHref(path){
    if(window.location.protocol === "file:"){
      return path;
    }

    if(window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost"){
      return path;
    }

    return "/" + path.replace(/\.html$/i, "");
  }

  function shouldSkip(){
    return Boolean(
      document.querySelector(".bottomRow") ||
      document.querySelector(".assistant-bottom-nav") ||
      document.querySelector(".funds-bottom-nav") ||
      document.querySelector(".ncMobileDock")
    );
  }

  function createDock(){
    if(shouldSkip()) return;

    const current = pageRoute();
    const nav = document.createElement("nav");
    nav.className = "ncMobileDock";
    nav.setAttribute("aria-label", "Mobile app navigation");
    nav.innerHTML = LINKS.map(link => `
      <a href="${appHref(link.path)}" class="${current === link.route ? "active" : ""}">${link.label}</a>
    `).join("");

    document.body.classList.add("has-nc-mobile-dock");
    document.body.appendChild(nav);
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", createDock);
  }else{
    createDock();
  }
})();
