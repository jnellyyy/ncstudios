/*
  Wedding Funds Roadmap defaults.

  Change payment amounts/dates, targets, estimates, notes and starting statuses
  here. Changes appear immediately for a new browser; use "Reset from roadmap
  plan" on the page to apply these defaults to a browser that already has saved
  roadmap data.
*/
window.NC_WEDDING_FUNDS_DEFAULTS = {
  dataVersion:8,
  currency:"GBP",
  rentalTarget:85,
  rentalFlatBudget:90,
  rentalWarningAt:85,
  emergencyTarget:150,
  emergencyWarningAt:150,
  flexibleHoldTarget:75,
  currentPriority:"Use Marvin's £445 for wedding prep only",
  nextWedding:{
    client:"Simi and Kiefah",
    date:"2026-08-22"
  },

  financeNotes:[
    {
      id:"marvin-money-position",
      title:"Marvin and Blessing money position",
      amount:445,
      category:"Due 24 July",
      status:"pending",
      notes:"Total balance £595. Already paid £250. Remaining balance £345 plus £100 late fee means £445 is due on 24 July."
    },
    {
      id:"simi-money-position",
      title:"Simi and Kiefah paid in full",
      amount:0,
      category:"Usable balance",
      status:"done",
      notes:"They paid £375 in full. £207 went to a personal issue, £85 booked rentals and £83 is no longer available for wedding prep. Current usable balance is £0."
    },
    {
      id:"wedding-prep-source",
      title:"Wedding preparation source",
      amount:445,
      category:"Marvin only",
      status:"planned",
      notes:"The full Simi and Kiefah wedding preparation plan now comes from Marvin's £445 payment due on 24 July."
    }
  ],

  // Deleted roadmap entries are tracked here so they stay deleted after reload.
  deletedItems:{payments:[],allocations:[],rentals:[],buyList:[]},

  ownedKit:[
    {id:"sony-a7iv-main",name:"Sony A7 IV main body",quantity:1,status:"owned",notes:"Main camera body for weddings."},
    {id:"samyang-35",name:"Samyang 35mm lens",quantity:1,status:"owned"},
    {id:"portkeys-pt5",name:"Portkeys PT5 II monitor",quantity:1,status:"owned"},
    {id:"dji-mic-3",name:"DJI Mic 3",quantity:1,status:"owned"},
    {id:"np-f550",name:"NP F550 monitor battery",quantity:1,status:"owned"},
    {id:"kf-nd",name:"K&F ND filter",quantity:1,status:"owned",notes:"Use for now."},
    {id:"sd-cards",name:"SD cards",quantity:2,status:"owned",notes:"Use for now."},
    {id:"dji-mic-1",name:"DJI Mic 1",quantity:1,status:"sell-later",notes:"Sell after testing DJI Mic 3 properly."}
  ],

  // EDIT PAYMENT AMOUNTS, EXPECTED DATES, WEDDING DATES AND STARTING STATUSES HERE.
  payments:[
    {
      id:"marvin-blessing-july",
      client:"Marvin and Blessing",
      amount:445,
      expectedDate:"2026-07-24",
      weddingDate:"",
      weddingStatus:"completed",
      purpose:"Remaining balance £345 plus £100 late fee. This is the usable wedding-prep money.",
      status:"pending",
      notes:"Total balance was £595. £250 has already been paid and used for council tax. The £445 due on 24 July funds the wedding reserve, purchases and untouched buffer."
    },
    {
      id:"simi-kiefah-august",
      client:"Simi and Kiefah",
      amount:375,
      expectedDate:"2026-07-13",
      weddingDate:"2026-08-22",
      purpose:"Paid in full. £207 personal issue, £85 rentals booked and £83 no longer usable.",
      status:"allocated",
      notes:"Current usable balance from Simi and Kiefah is £0, so the wedding preparation plan uses Marvin's £445 instead.",
      countsForRoadmap:false
    }
  ],

  // EDIT ALLOCATION ESTIMATES, PRIORITIES, NOTES AND STARTING STATUSES HERE.
  allocations:[
    {
      id:"simi-personal",
      paymentId:"simi-kiefah-august",
      name:"Personal issue",
      category:"Personal",
      priority:"done",
      estimatedCost:207,
      status:"bought",
      notes:"£207 from the Simi and Kiefah payment was used for a personal issue."
    },
    {
      id:"simi-rentals-paid",
      paymentId:"simi-kiefah-august",
      name:"Rentals booked",
      category:"Rentals",
      priority:"essential",
      estimatedCost:85,
      estimatedMax:85,
      status:"bought",
      notes:"Camera and lens rentals are booked for £85.",
      rental:true
    },
    {
      id:"simi-remaining-unusable",
      paymentId:"simi-kiefah-august",
      name:"Remaining money no longer usable",
      category:"Used / closed",
      priority:"done",
      estimatedCost:83,
      status:"bought",
      notes:"The remaining £83 is no longer available for wedding prep. Current usable balance from this payment is £0."
    },
    {
      id:"marvin-travel-food",
      paymentId:"marvin-blessing-july",
      name:"Wedding travel, parking and food",
      category:"Travel + food reserve",
      priority:"protect",
      estimatedCost:70,
      status:"reserve",
      notes:"Sheffield to Birmingham plus movement between venues. Keep untouched until after 22 August.",
      buffer:true
    },
    {
      id:"marvin-emergency-buffer",
      paymentId:"marvin-blessing-july",
      name:"Emergency wedding buffer",
      category:"Emergency reserve",
      priority:"protect",
      estimatedCost:80,
      status:"reserve",
      notes:"For batteries, cables, replacement item, taxi or unexpected expense. Do not spend before the wedding.",
      buffer:true
    },
    {
      id:"marvin-tascam-dr05xp",
      paymentId:"marvin-blessing-july",
      name:"Tascam DR 05XP",
      category:"Audio",
      priority:"urgent",
      estimatedCost:93,
      status:"planned",
      notes:"Separate recorder for the mixer, speeches and backup audio.",
      buyListId:"tascam-dr05xp"
    },
    {
      id:"marvin-ssd-1tb",
      paymentId:"marvin-blessing-july",
      name:"1TB SSD",
      category:"Storage + backup",
      priority:"urgent",
      estimatedCost:70,
      estimatedMax:75,
      status:"planned",
      notes:"Dedicated working storage for the wedding. Expected range £60-£75.",
      buyListId:"ssd-1tb"
    },
    {
      id:"marvin-microsd-card",
      paymentId:"marvin-blessing-july",
      name:"microSD card for recorder",
      category:"Audio storage",
      priority:"urgent",
      estimatedCost:12,
      estimatedMax:15,
      status:"planned",
      notes:"Needed because the recorder does not include useful recording storage.",
      buyListId:"microsd-recorder"
    },
    {
      id:"marvin-rca-cable",
      paymentId:"marvin-blessing-july",
      name:"RCA to 3.5mm cable",
      category:"Audio cable",
      priority:"urgent",
      estimatedCost:10,
      estimatedMax:12,
      status:"planned",
      notes:"Connects a common mixer record output to the Tascam.",
      buyListId:"rca-35-cable"
    },
    {
      id:"marvin-np-f550-second",
      paymentId:"marvin-blessing-july",
      name:"Second NP-F550 battery",
      category:"Camera + filming",
      priority:"high",
      estimatedCost:15,
      estimatedMax:15,
      status:"planned",
      notes:"Backup power for the Portkeys monitor. Expected range £10-£15.",
      buyListId:"np-f550-second"
    },
    {
      id:"marvin-cable-adapter-allowance",
      paymentId:"marvin-blessing-july",
      name:"Small cable and adapter allowance",
      category:"Cable + adapter allowance",
      priority:"high",
      estimatedCost:20,
      estimatedMax:25,
      status:"planned",
      notes:"Spare HDMI, audio adapter or cable replacement. Expected range £15-£25.",
      buyListId:"small-cable-adapter"
    },
    {
      id:"marvin-additional-buffer",
      paymentId:"marvin-blessing-july",
      name:"Additional untouched buffer",
      category:"Flexible reserve",
      priority:"protect",
      estimatedCost:75,
      status:"reserve",
      notes:"Keep untouched until the wedding. Can cover rental deposit issues, delivery fees, extra transport, another monitor battery or anything that fails during testing.",
      buffer:true
    }
  ],

  // EDIT RENTAL ITEMS AND THEIR STARTING STATUSES HERE.
  rentals:[
    {id:"rental-a7iv",name:"Second Sony A7 IV body",status:"reserved",weddingClient:"Simi and Kiefah",weddingDate:"2026-08-22",cost:85,notes:"Booked as part of the £85 camera and lens rental total. Test all recording modes when collected."},
    {id:"rental-24-70",name:"Sony 24-70mm f2.8 GM II",status:"reserved",weddingClient:"Simi and Kiefah",weddingDate:"2026-08-22",cost:0,notes:"Booked. Primary flexible coverage lens."},
    {id:"rental-70-200",name:"Sony 70-200mm f2.8 GM II",status:"reserved",weddingClient:"Simi and Kiefah",weddingDate:"2026-08-22",cost:0,notes:"Booked. Ceremony and candid reach."}
  ],

  // EDIT THE AFTER-RENTALS BUYING ORDER AND ESTIMATES HERE.
  buyList:[
    {id:"ssd-1tb",rank:1,name:"1TB SSD",category:"Storage + backup",priority:"urgent",status:"needed",estimate:70,estimateMax:75,notes:"Dedicated working storage for the wedding."},
    {id:"tascam-dr05xp",rank:2,name:"Tascam DR 05XP",category:"Audio",priority:"urgent",status:"needed",estimate:93,notes:"Separate recorder for mixer, speeches and backup audio."},
    {id:"microsd-recorder",rank:3,name:"microSD card for recorder",category:"Audio storage",priority:"urgent",status:"needed",estimate:12,estimateMax:15,notes:"Recorder storage; expected range £10-£15."},
    {id:"rca-35-cable",rank:4,name:"RCA to 3.5mm cable",category:"Audio cable",priority:"urgent",status:"needed",estimate:10,estimateMax:12,notes:"Connect common mixer record output to the Tascam."},
    {id:"np-f550-second",rank:5,name:"Second NP-F550 battery",category:"Camera + filming",priority:"high",status:"needed",estimate:15,estimateMax:15,notes:"Backup power for the Portkeys monitor."},
    {id:"small-cable-adapter",rank:6,name:"Small cable and adapter allowance",category:"Camera + audio support",priority:"high",status:"needed",estimate:20,estimateMax:25,notes:"Spare HDMI, audio adapter or cable replacement."},
    {id:"cfexpress-card",rank:7,name:"CFexpress Type A card",category:"Wish list after 22 August",priority:"future",status:"later",estimate:170,estimateMax:260,notes:"Rough estimate only. Current SD cards have already covered two weddings, so buy after wedding funds are safe."},
    {id:"cfexpress-reader",rank:8,name:"CFexpress Type A reader",category:"Wish list after 22 August",priority:"future",status:"later",estimate:80,estimateMax:120,notes:"Rough estimate only. Only needed when the CFexpress card is bought."},
    {id:"nisi-nd",rank:9,name:"NiSi True Color 82mm ND filter",category:"Wish list after 22 August",priority:"future",status:"later",estimate:110,estimateMax:160,notes:"Rough estimate only. K&F version can cover this wedding."},
    {id:"smallrig-4469",rank:10,name:"SmallRig 4469 battery",category:"Wish list after 22 August",priority:"future",status:"later",estimate:70,estimateMax:100,notes:"Rough estimate only. Upgrade later; current NP-F550 setup works."},
    {id:"samyang-24-70",rank:11,name:"Samyang 24-70mm f2.8",category:"Wish list after 22 August",priority:"future",status:"later",estimate:700,estimateMax:850,notes:"Rough estimate only. Rentals are already booked for this wedding."},
    {id:"samyang-35-150",rank:12,name:"Samyang 35-150mm f2-2.8",category:"Wish list after 22 August",priority:"future",status:"later",estimate:1000,estimateMax:1200,notes:"Rough estimate only. Rentals are already booked for this wedding."},
    {id:"3d-printer",rank:13,name:"3D printer",category:"Wish list / not wedding prep",priority:"future",status:"later",estimate:180,estimateMax:400,notes:"Rough estimate only. Not part of wedding preparation."}
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
