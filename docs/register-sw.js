(function(){
  async function clearOldServiceWorkers(){
    if(!("serviceWorker" in navigator)) return;

    try{
      const registrations = await navigator.serviceWorker.getRegistrations();

      for(const registration of registrations){
        await registration.unregister();
      }

      if(window.caches){
        const cacheNames = await caches.keys();

        for(const cacheName of cacheNames){
          await caches.delete(cacheName);
        }
      }

      console.log("NC Studios: service worker disabled and old cache cleared.");
    }catch(error){
      console.warn("NC Studios: could not clear service worker cache", error);
    }
  }

  window.addEventListener("load", clearOldServiceWorkers);
})();
