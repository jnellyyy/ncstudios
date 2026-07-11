/*
  Wedding Funds Roadmap defaults.

  Change payment amounts/dates, targets, estimates, notes and starting statuses
  here. Changes appear immediately for a new browser; use "Reset from roadmap
  plan" on the page to apply these defaults to a browser that already has saved
  roadmap data.
*/
window.NC_WEDDING_FUNDS_DEFAULTS = {
  dataVersion:5,
  currency:"GBP",
  rentalTarget:90,
  rentalWarningAt:90,
  emergencyTarget:300,
  emergencyWarningAt:300,
  currentPriority:"Keep £300 wedding buffer untouched until 23 August",
  nextWedding:{
    client:"Simi and Kiefah",
    date:"2026-08-22"
  },

  financeNotes:[
    {
      id:"marvin-250-council-tax",
      title:"Marvin already paid £250",
      amount:250,
      category:"Personal / council tax",
      status:"used",
      notes:"This earlier £250 was used for council tax, so the active Marvin plan below focuses on the final balance plus late fee."
    },
    {
      id:"rentals-already-paid",
      title:"Rentals are paid",
      amount:90,
      category:"Rentals",
      status:"done",
      notes:"Simi and Kiefah rentals are confirmed at £90 flat. Keep the wedding buffer protected for travel, food, parking and emergencies."
    }
  ],

  // Deleted roadmap entries are tracked here so they stay deleted after reload.
  deletedItems:{payments:[],allocations:[],rentals:[],buyList:[]},

  ownedKit:[
    {id:"samyang-35",name:"Samyang 35mm lens",quantity:1,status:"owned"},
    {id:"portkeys-pt5",name:"Portkeys PT5 II monitor",quantity:1,status:"owned"},
    {id:"dji-mic-3",name:"DJI Mic 3",quantity:1,status:"owned"},
    {id:"tascam-dr10l",name:"Tascam DR-10L",quantity:1,status:"owned",notes:"Backup lav for ceremony and speeches."},
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
      amount:690,
      expectedDate:"2026-07-04",
      weddingDate:"",
      weddingStatus:"completed",
      purpose:"Final payment plus late fee: £595 balance + £95 late fee.",
      status:"pending",
      notes:"Wedding complete. Allocate this money to the protected wedding fund first, then the exact kit plan. The earlier £250 received was used for council tax."
    },
    {
      id:"simi-kiefah-august",
      client:"Simi and Kiefah",
      amount:375,
      expectedDate:"2026-08-15",
      weddingDate:"2026-08-22",
      purpose:"Paid in full. Rentals are done; £200 went personal and the rest is wedding buffer.",
      status:"allocated",
      notes:"Simi and Kiefah have paid in full. Allocation: £200 personal, £90 rentals paid, £85 held for wedding-day buffer."
    }
  ],

  // EDIT ALLOCATION ESTIMATES, PRIORITIES, NOTES AND STARTING STATUSES HERE.
  allocations:[
    {
      id:"simi-personal",
      paymentId:"simi-kiefah-august",
      name:"Personal transfer",
      category:"Personal",
      priority:"done",
      estimatedCost:200,
      status:"bought",
      notes:"£200 from the Simi and Kiefah payment went to personal money."
    },
    {
      id:"simi-rentals-paid",
      paymentId:"simi-kiefah-august",
      name:"Rentals paid",
      category:"Rentals",
      priority:"essential",
      estimatedCost:90,
      estimatedMax:90,
      status:"bought",
      notes:"All rentals are booked/paid. Rental total confirmed at £90 flat.",
      rental:true
    },
    {
      id:"simi-wedding-buffer-left",
      paymentId:"simi-kiefah-august",
      name:"Wedding buffer left from Simi payment",
      category:"Wedding buffer",
      priority:"essential",
      estimatedCost:85,
      status:"planned",
      notes:"Keep this available for travel, parking, food or wedding-day emergencies.",
      buffer:true
    },
    {
      id:"marvin-wedding-fund",
      paymentId:"marvin-blessing-july",
      name:"Wedding Fund",
      category:"Wedding fund",
      priority:"protect",
      estimatedCost:300,
      status:"planned",
      notes:"Do not touch this before 23 August. Covers any last rental issue, travel, parking, food and emergency purchases. If nothing happens, move it into CFexpress after the wedding.",
      buffer:true,
      protected:true
    },
    {
      id:"marvin-tascam-dr05xp",
      paymentId:"marvin-blessing-july",
      name:"Tascam DR-05XP",
      category:"Audio",
      priority:"essential",
      estimatedCost:95,
      status:"planned",
      notes:"Finishes the dedicated audio setup: DJI Mic 3, Tascam DR-10L, and DR-05XP for DJ feed, room ambience or emergency recording.",
      buyListId:"tascam-dr05xp"
    },
    {
      id:"marvin-ssd-1tb",
      paymentId:"marvin-blessing-july",
      name:"1TB SSD",
      category:"Storage + backup",
      priority:"urgent",
      estimatedCost:70,
      status:"planned",
      notes:"Needed before the next wedding. Wedding footage should never rely on a single drive.",
      buyListId:"ssd-1tb"
    },
    {
      id:"marvin-np-f550-second",
      paymentId:"marvin-blessing-july",
      name:"Second NP-F550 battery",
      category:"Camera + filming",
      priority:"urgent",
      estimatedCost:15,
      status:"planned",
      notes:"Lets the Portkeys monitor comfortably last the wedding day.",
      buyListId:"np-f550-second"
    },
    {
      id:"marvin-cfexpress-fund",
      paymentId:"marvin-blessing-july",
      name:"CFexpress fund",
      category:"CFexpress fund",
      priority:"hold",
      estimatedCost:210,
      status:"planned",
      notes:"Hold this. Do not buy yet. If the £300 wedding fund is untouched after 22 August, move that into CFexpress too.",
      buyListId:"cfexpress-card"
    }
  ],

  // EDIT RENTAL ITEMS AND THEIR STARTING STATUSES HERE.
  rentals:[
    {id:"rental-a7iv",name:"Second Sony A7 IV body",status:"reserved",notes:"Booked/paid as part of the £90 flat rental total. Test all recording modes when collected."},
    {id:"rental-24-70",name:"Sony 24-70mm f2.8 GM II",status:"reserved",notes:"Booked/paid. Primary flexible coverage lens."},
    {id:"rental-70-200",name:"Sony 70-200mm f2.8 GM II",status:"reserved",notes:"Booked/paid. Ceremony and candid reach."}
  ],

  // EDIT THE AFTER-RENTALS BUYING ORDER AND ESTIMATES HERE.
  buyList:[
    {id:"tascam-dr05xp",rank:1,name:"Tascam DR-05XP",category:"Audio",priority:"urgent",status:"needed",estimate:95,notes:"DJ feed, room ambience and emergency recorder."},
    {id:"ssd-1tb",rank:2,name:"1TB SSD",category:"Storage + backup",priority:"urgent",status:"needed",estimate:70,notes:"Buy before the next wedding; never rely on a single drive."},
    {id:"np-f550-second",rank:3,name:"Second NP-F550 battery",category:"Camera + filming",priority:"urgent",status:"needed",estimate:15,notes:"For a full day on the Portkeys monitor."},
    {id:"cfexpress-card",rank:4,name:"CFexpress Type A card",category:"Storage + backup",priority:"future",status:"later",estimate:210,notes:"Hold the £210 fund. Buy after the wedding buffer is safe or released."},
    {id:"cfexpress-reader",rank:5,name:"CFexpress Type A reader",category:"Storage + backup",priority:"future",status:"later",estimate:0,notes:"Buy with the CFexpress card."},
    {id:"nisi-nd",rank:6,name:"NiSi True Color 82mm ND filter",category:"Camera + filming",priority:"future",status:"later",estimate:0,notes:"Upgrade after current wedding needs are covered."},
    {id:"smallrig-4469",rank:7,name:"SmallRig 4469 battery",category:"Camera + filming",priority:"future",status:"later",estimate:0,notes:"Future power upgrade."},
    {id:"samyang-24-70",rank:8,name:"Samyang 24-70mm f2.8",category:"Future weddings",priority:"future",status:"later",estimate:0,notes:"Longer-term owned lens option."},
    {id:"samyang-35-150",rank:9,name:"Samyang 35-150mm f2-2.8",category:"Future weddings",priority:"future",status:"later",estimate:0,notes:"Longer-term owned lens option."}
  ],

  // EDIT WEDDING-WEEK TASKS AND DUE DATES HERE.
  weddingWeek:[
    {id:"confirm-rentals",name:"Confirm rentals by 15 August",dueDate:"2026-08-15",done:true},
    {id:"receive-rentals",name:"Receive or collect rentals by 20 or 21 August",dueDate:"2026-08-21",done:false},
    {id:"test-rentals",name:"Test rented body and lenses",dueDate:"2026-08-21",done:false},
    {id:"format-cards",name:"Format cards",dueDate:"2026-08-21",done:false},
    {id:"prepare-folders",name:"Prepare folders",dueDate:"2026-08-21",done:false},
    {id:"charge-batteries",name:"Charge all batteries",dueDate:"2026-08-21",done:false},
    {id:"test-dji-mic",name:"Test DJI Mic 3 internal recording",dueDate:"2026-08-21",done:false},
    {id:"pack-tascam",name:"Pack Tascam DR-05XP if bought",dueDate:"2026-08-21",done:false},
    {id:"shoot-wedding",name:"Shoot wedding on 22 August",dueDate:"2026-08-22",done:false},
    {id:"backup-twice",name:"Back up footage twice",dueDate:"2026-08-23",done:false},
    {id:"return-rentals",name:"Return rentals immediately after",dueDate:"2026-08-23",done:false}
  ]
};
