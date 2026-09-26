/*
  Central Studio Assistant rules.
  Edit package prices, pipeline labels and automation timing here.
*/
window.NC_STUDIO_ASSISTANT_CONFIG = {
  pipelineStages:[
    {id:"new-enquiry",label:"New enquiry",group:"Enquiries"},
    {id:"replied",label:"Replied",group:"Enquiries"},
    {id:"waiting-response",label:"Waiting for response",group:"Enquiries"},
    {id:"availability-confirmed",label:"Availability confirmed",group:"Booking"},
    {id:"package-chosen",label:"Package chosen",group:"Booking"},
    {id:"contract-sent",label:"Contract sent",group:"Booking"},
    {id:"deposit-requested",label:"Deposit requested",group:"Booking"},
    {id:"booked",label:"Booked",group:"Booked"},
    {id:"pre-wedding",label:"Pre-wedding stage",group:"Booked"},
    {id:"final-consultation",label:"Final consultation needed",group:"Booked"},
    {id:"wedding-completed",label:"Wedding completed",group:"Post-production"},
    {id:"editing",label:"Editing",group:"Post-production"},
    {id:"delivered",label:"Delivered",group:"Complete"},
    {id:"archived",label:"Archived",group:"Complete"}
  ],
  attentionCategories:["urgent","this-week","waiting","upcoming","completed"],
  automation:{
    staleReplyDays:3,
    finalConsultationDays:30,
    weddingPrepDays:7,
    balanceWarningDays:14
  },
  packages:{
    photography:[
      {id:"photo-mini",name:"Mini photography",shortName:"Mini",price:300,hours:"2–3 hours",deliverables:"75 edited images",fit:"Registry ceremonies and small weddings."},
      {id:"photo-half",name:"Half-day photography",shortName:"Half day",price:500,hours:"4–5 hours",deliverables:"150 edited images",fit:"Ceremony, portraits and the key reception moments."},
      {id:"photo-full",name:"Full-day photography",shortName:"Full day",price:null,hours:"Up to 8 hours",deliverables:"300 edited images",fit:"A complete wedding story with consultation and timeline support."}
    ],
    videography:[
      {id:"video-mini",name:"Mini videography",shortName:"Mini",price:350,hours:"Up to 2 hours",deliverables:"1–2 minute highlight film",fit:"Ceremony and couple shots with online delivery."},
      {id:"video-half",name:"Half-day videography",shortName:"Half day",price:500,hours:"Up to 5 hours",deliverables:"3–4 minute highlight and full ceremony",fit:"Ceremony, portraits and selected reception coverage."},
      {id:"video-full",name:"Full-day videography",shortName:"Full day",price:850,hours:"Up to 10 hours",deliverables:"6–8 minute highlight, full ceremony and speeches",fit:"The full day without rushing the key moments."}
    ]
  },
  weddingPrepTasks:[
    "Confirm timeline",
    "Confirm locations",
    "Check travel and parking",
    "Prepare batteries",
    "Prepare memory cards",
    "Prepare camera bodies and lenses",
    "Prepare audio, lights and support gear",
    "Pack backup gear",
    "Save timeline and emergency contacts",
    "Check weather",
    "Send final message to couple"
  ]
};
