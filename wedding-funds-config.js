/*
  Wedding Funds Roadmap defaults.

  Change payment amounts/dates, targets, estimates, notes and starting statuses
  here. Changes appear immediately for a new browser; use "Reset from roadmap
  plan" on the page to apply these defaults to a browser that already has saved
  roadmap data.
*/
window.NC_WEDDING_FUNDS_DEFAULTS = {
  dataVersion:2,
  currency:"GBP",
  rentalTarget:300,
  rentalWarningAt:300,
  emergencyTarget:100,
  emergencyWarningAt:75,
  currentPriority:"Protect rental money first",
  nextWedding:{
    client:"Simi and Kiefah",
    date:"2026-08-22"
  },

  ownedKit:[
    {id:"samyang-35",name:"Samyang 35mm lens",quantity:1,status:"owned"},
    {id:"portkeys-pt5",name:"Portkeys PT5 II monitor",quantity:1,status:"owned"},
    {id:"dji-mic-3",name:"DJI Mic 3",quantity:1,status:"owned"},
    {id:"np-f550",name:"NP F550 monitor battery",quantity:1,status:"owned"},
    {id:"kf-nd",name:"K&F ND filter",quantity:1,status:"owned",notes:"Use for now."},
    {id:"sd-cards",name:"SD cards",quantity:2,status:"owned",notes:"Two cards for now."},
    {id:"dji-mic-1",name:"DJI Mic 1",quantity:1,status:"sell-later",notes:"Sell after testing DJI Mic 3."}
  ],

  // EDIT PAYMENT AMOUNTS, EXPECTED DATES, WEDDING DATES AND STARTING STATUSES HERE.
  payments:[
    {
      id:"marvin-blessing-july",
      client:"Marvin and Blessing",
      amount:595,
      expectedDate:"2026-07-04",
      weddingDate:"",
      weddingStatus:"completed",
      noCostsRemaining:true,
      purpose:"Remaining wedding balance. No wedding costs remain to be paid.",
      status:"pending",
      notes:"Wedding complete. Waiting for the final £595 balance; leave it unallocated until it is received."
    },
    {
      id:"simi-kiefah-august",
      client:"Simi and Kiefah",
      amount:375,
      expectedDate:"2026-08-15",
      weddingDate:"2026-08-22",
      purpose:"Final rental money, travel and emergency buffer.",
      status:"pending",
      notes:"This payment arrives one week before the wedding."
    }
  ],

  // EDIT ALLOCATION ESTIMATES, PRIORITIES, NOTES AND STARTING STATUSES HERE.
  allocations:[
    {
      id:"august-rental-balance",
      paymentId:"simi-kiefah-august",
      name:"Rental balance",
      category:"Protected rental money",
      priority:"essential",
      estimatedCost:250,
      estimatedMax:250,
      status:"planned",
      notes:"Up to £250. Keep the full amount available until the final rental invoice is known.",
      protected:true
    },
    {
      id:"august-travel",
      paymentId:"simi-kiefah-august",
      name:"Travel and parking",
      category:"Travel",
      priority:"essential",
      estimatedCost:50,
      status:"planned",
      notes:"Keep separate from buying money.",
      buffer:true
    },
    {
      id:"august-emergency",
      paymentId:"simi-kiefah-august",
      name:"Wedding day emergency buffer",
      category:"Buffer",
      priority:"essential",
      estimatedCost:75,
      status:"planned",
      notes:"Do not spend before the wedding day.",
      buffer:true
    },
    {
      id:"august-mixer",
      paymentId:"simi-kiefah-august",
      name:"Mixer recorder fund",
      category:"Audio",
      priority:"later",
      estimatedCost:88,
      estimatedMax:168,
      status:"moved-later",
      notes:"Only activate after rentals, travel and the emergency buffer are fully protected.",
      buyListId:"zoom-recorder"
    },
    {
      id:"august-cfexpress",
      paymentId:"simi-kiefah-august",
      name:"CFexpress fund",
      category:"Media",
      priority:"later",
      estimatedCost:0,
      status:"moved-later",
      notes:"Leftover only after rentals are safe.",
      buyListId:"cfexpress-card"
    }
  ],

  // EDIT RENTAL ITEMS AND THEIR STARTING STATUSES HERE.
  rentals:[
    {id:"rental-a7iv",name:"Second Sony A7 IV body",status:"needed",notes:"Match the main body and test all recording modes."},
    {id:"rental-24-70",name:"Sony 24-70mm f2.8 GM II",status:"needed",notes:"Primary flexible coverage lens."},
    {id:"rental-70-200",name:"Sony 70-200mm f2.8 GM II",status:"needed",notes:"Ceremony and candid reach."}
  ],

  // EDIT THE AFTER-RENTALS BUYING ORDER AND ESTIMATES HERE.
  buyList:[
    {id:"ssd-1tb",rank:1,name:"1TB SSD",category:"Storage + backup",priority:"urgent",status:"needed",estimate:70,notes:"Buy after the £300 rental pot is protected."},
    {id:"np-f550-second",rank:2,name:"Second NP F550 battery",category:"Camera + filming",priority:"urgent",status:"needed",estimate:15,notes:"Required because only one is currently owned."},
    {id:"short-hdmi",rank:3,name:"Short flexible HDMI cable",category:"Camera + filming",priority:"soon",status:"research",estimate:15,notes:"Buy only if the rig test confirms it is needed."},
    {id:"monitor-arm",rank:4,name:"Monitor arm",category:"Camera + filming",priority:"soon",status:"research",estimate:30,notes:"Buy only if the current rig is missing support."},
    {id:"zoom-recorder",rank:5,name:"Zoom H1 Essential or Zoom H4 Essential",category:"Audio",priority:"future",status:"later",estimate:88,estimateMax:168,notes:"Mixer audio upgrade after protected funds are safe."},
    {id:"cfexpress-card",rank:6,name:"CFexpress Type A card",category:"Storage + backup",priority:"future",status:"later",estimate:0,notes:"Use leftover funds only."},
    {id:"cfexpress-reader",rank:7,name:"CFexpress Type A reader",category:"Storage + backup",priority:"future",status:"later",estimate:0,notes:"Buy with the card, not before it."},
    {id:"nisi-nd",rank:8,name:"NiSi True Color 82mm ND filter",category:"Camera + filming",priority:"future",status:"later",estimate:0,notes:"Upgrade after current wedding needs are covered."},
    {id:"smallrig-4469",rank:9,name:"SmallRig 4469 battery",category:"Camera + filming",priority:"future",status:"later",estimate:0,notes:"Future power upgrade."},
    {id:"samyang-24-70",rank:10,name:"Samyang 24-70mm f2.8",category:"Future weddings",priority:"future",status:"later",estimate:0,notes:"Longer-term owned lens option."},
    {id:"samyang-35-150",rank:11,name:"Samyang 35-150mm f2-2.8",category:"Future weddings",priority:"future",status:"later",estimate:0,notes:"Longer-term owned lens option."}
  ],

  // EDIT WEDDING-WEEK TASKS AND DUE DATES HERE.
  weddingWeek:[
    {id:"confirm-rentals",name:"Confirm rentals by 15 August",dueDate:"2026-08-15",done:false},
    {id:"receive-rentals",name:"Receive or collect rentals by 20 or 21 August",dueDate:"2026-08-21",done:false},
    {id:"test-rentals",name:"Test rented body and lenses",dueDate:"2026-08-21",done:false},
    {id:"format-cards",name:"Format cards",dueDate:"2026-08-21",done:false},
    {id:"prepare-folders",name:"Prepare folders",dueDate:"2026-08-21",done:false},
    {id:"charge-batteries",name:"Charge all batteries",dueDate:"2026-08-21",done:false},
    {id:"test-dji-mic",name:"Test DJI Mic 3 internal recording",dueDate:"2026-08-21",done:false},
    {id:"pack-zoom",name:"Pack Zoom recorder if bought",dueDate:"2026-08-21",done:false},
    {id:"shoot-wedding",name:"Shoot wedding on 22 August",dueDate:"2026-08-22",done:false},
    {id:"backup-twice",name:"Back up footage twice",dueDate:"2026-08-23",done:false},
    {id:"return-rentals",name:"Return rentals immediately after",dueDate:"2026-08-23",done:false}
  ]
};
