import { useState, useRef, useEffect, useCallback, Component } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── SUPABASE CLIENT ──────────────────────────────────────────────────────────
const SUPA_URL  = import.meta.env.VITE_SUPABASE_URL  || "";
const SUPA_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const supabase  = (SUPA_URL && SUPA_ANON)
  ? createClient(SUPA_URL, SUPA_ANON, { auth:{ persistSession:true, autoRefreshToken:true }})
  : null;

const SB_ENABLED = !!supabase; // false → falls back to localStorage demo mode

// ─── TOKENS ───────────────────────────────────────────────────────────────────
const G="#7ED957",GD="#5CB83A",GL="#f0fde9",GM="#d1fae5";
const DARK="#0f1c09",INK="#1a2e12",MUTED="#6b7280",BDR="#e8f0e5";
const FD="'Playfair Display',serif",FB="'DM Sans',sans-serif";
const GLSTYLE=`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500;600&family=Sora:wght@300;400&display=swap');*{box-sizing:border-box;margin:0;padding:0}@keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}@keyframes fadeIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}.fin{animation:fadeIn .2s ease}input::placeholder{color:rgba(255,255,255,0.25)}th{text-align:left;padding:10px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #e8f0e5}td{padding:11px 14px;font-size:13px;color:#374151;border-bottom:1px solid #f8faf6}.rh:hover{background:#fafff8!important;cursor:pointer}input,select,textarea{font-family:'DM Sans',sans-serif;outline:none}input:focus,select:focus,textarea:focus{border-color:#7ED957!important}select{appearance:none}@media(max-width:768px){.mob-hide{display:none!important}.mob-bottom-nav{display:flex!important}.mob-stack{flex-direction:column!important}.mob-full{width:100%!important}.mob-p-sm{padding:12px!important}.mob-grid-1{grid-template-columns:1fr!important}.mob-grid-2{grid-template-columns:1fr 1fr!important}.mob-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}th{padding:7px 8px;font-size:10px}td{padding:7px 8px;font-size:11px}}@media(max-width:480px){.mob-grid-2{grid-template-columns:1fr!important}.mob-hide-xs{display:none!important}}`;


// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmt   = n  => "₹"+Number(n).toLocaleString("en-IN");
const uid   = () => Math.random().toString(36).slice(2,9).toUpperCase();
const today = () => new Date().toISOString().slice(0,10);
const inits = nm => nm.trim().split(/\s+/).map(w=>w[0]).join("").toUpperCase().slice(0,2);
const isWknd= d  => { const day=new Date(d).getDay(); return day===0||day===6; };
const FX    = { USD:83.5, EUR:90.2, GBP:105.4, AED:22.7, SGD:62.1, INR:1 };

const SC={
  Approved:{c:"#16a34a",bg:"#dcfce7",icon:"✓"},
  Pending:{c:"#d97706",bg:"#fef3c7",icon:"⏳"},
  Rejected:{c:"#dc2626",bg:"#fee2e2",icon:"✗"},
  "Auto-Approved":{c:"#2563eb",bg:"#dbeafe",icon:"⚡"},
  Closed:{c:"#6b7280",bg:"#f3f4f6",icon:"🔒"},
  Active:{c:"#16a34a",bg:"#dcfce7",icon:"●"},
  Suspended:{c:"#dc2626",bg:"#fee2e2",icon:"⊘"},
};
const DEFAULT_DEPTS=["Sales","Marketing","Accounts","Procurement","Operations","HR","IT","Management"];
const CATS=["Travel","Meals","Accommodation","Office Supplies","Client Entertainment","Software","Training","Miscellaneous"];
const CI={Travel:"✈️",Meals:"🍽️",Accommodation:"🏨","Office Supplies":"📦","Client Entertainment":"🥂",Software:"💻",Training:"📚",Miscellaneous:"🗂️"};
// DEPTS is now dynamic — comes from company policy. Use DEFAULT_DEPTS as fallback.
const DEPTS=DEFAULT_DEPTS; // backward compat alias
const CURRENCIES=["INR","USD","EUR","GBP","AED","SGD"];
const ROLES=[
  {id:"manager", label:"Manager", color:"#7ED957", perms:["approve","view_all","manage_trips","manage_employees","export","submit"]},
  {id:"employee",label:"Employee",color:"#60a5fa", perms:["submit","view_own"]},
  {id:"auditor", label:"Auditor", color:"#f59e0b", perms:["view_all","export"]},
  {id:"approver",label:"Approver",color:"#a78bfa", perms:["approve","view_all","submit"]},
  {id:"finance", label:"Finance", color:"#f472b6", perms:["view_all","export","manage_trips","submit"]},
];
const TIERED=[{min:1,max:5,ppu:299},{min:6,max:20,ppu:249},{min:21,max:50,ppu:199},{min:51,max:999,ppu:149}];

// ─── SUPABASE DATA LAYER ──────────────────────────────────────────────────────
// Mappers: snake_case DB → camelCase app
const mapUser=r=>r?({id:r.id,cid:r.company_id,companyId:r.company_id,name:r.name,email:r.email||"",username:r.username||"",mobile:r.mobile||"",role:r.role,avatar:r.avatar,dept:r.dept,balance:parseFloat(r.balance)||0,reimbursable:parseFloat(r.reimbursable)||0,delegateTo:r.delegate_to||null,isSuspended:r.is_suspended||false,authType:r.auth_type||"custom"}):null;
const mapTrip=r=>r?({id:r.id,companyId:r.company_id,name:r.name,type:r.type,startDate:r.start_date,endDate:r.end_date,status:r.status,budget:parseFloat(r.budget)||0,spent:parseFloat(r.spent)||0,assignedTo:(r.trip_assignments||[]).map(a=>a.user_id)}):null;
const mapClaim=r=>r?({id:r.id,companyId:r.company_id,tripId:r.trip_id,empId:r.emp_id,date:r.date,category:r.category,desc:r.description,vendor:r.vendor,amount:parseFloat(r.amount)||0,origAmount:parseFloat(r.orig_amount)||0,origCur:r.orig_currency,status:r.status,autoApproved:r.auto_approved,remarks:r.remarks,flagged:r.flagged,anomaly:r.anomaly,anomalyReasons:r.anomaly_reasons||[],weekendFlag:r.weekend_flag,notes:r.notes,receipts:(r.receipts||[]).map(rc=>({id:rc.id,name:rc.file_name,storagePath:rc.storage_path,type:rc.mime_type,url:null})),comments:(r.claim_comments||[]).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at)).map(c=>({id:c.id,userId:c.user_id,name:c.user_name,text:c.text,time:new Date(c.created_at).toLocaleString()}))}):null;
const mapPolicy=r=>r?({autoApproveLimit:parseFloat(r.auto_approve_limit),reimbursementMode:r.reimbursement_mode,receiptMandatoryAbove:parseFloat(r.receipt_mandatory_above),weekendRequiresApproval:r.weekend_requires_approval,multiLevelApproval:r.multi_level_approval,approvalLevels:r.approval_levels,vendorWhitelist:r.vendor_whitelist||[],vendorBlacklist:r.vendor_blacklist||[],departmentBudgets:r.department_budgets||{},categoryPct:r.category_pct||{},scheduledReports:r.scheduled_reports||{}}):null;
const mapNotif=r=>r?({id:r.id,userId:r.user_id,text:r.text,type:r.type,read:r.read,time:new Date(r.created_at).toLocaleString()}):null;
const mapAudit=r=>r?({id:r.id,action:r.action,claimId:r.claim_id,by:r.by_user_id,byName:r.by_name,at:new Date(r.created_at).toLocaleString(),remarks:r.remarks}):null;
const mapTopup=r=>r?({id:r.id,empId:r.emp_id,amount:parseFloat(r.amount),reason:r.reason,date:r.date,status:r.status}):null;

// ─── SB: load full company data ───────────────────────────────────────────────
async function sbLoadCompany(cid){
  const [
    {data:meta},{data:users},{data:trips},{data:claims},
    {data:topups},{data:audit},{data:notifs},{data:policy}
  ]=await Promise.all([
    supabase.from("companies").select("*").eq("id",cid).single(),
    supabase.from("users").select("*").eq("company_id",cid),
    supabase.from("trips").select("*,trip_assignments(user_id)").eq("company_id",cid),
    supabase.from("claims").select("*,receipts(*),claim_comments(*)").eq("company_id",cid).order("created_at",{ascending:false}),
    supabase.from("topups").select("*").eq("company_id",cid).order("created_at",{ascending:false}),
    supabase.from("audit_log").select("*").eq("company_id",cid).order("created_at",{ascending:false}).limit(500),
    supabase.from("notifications").select("*").eq("company_id",cid).order("created_at",{ascending:false}).limit(300),
    supabase.from("policy").select("*").eq("company_id",cid).single(),
  ]);

  // Fetch signed URLs for all receipts in parallel so images show immediately
  const mappedClaims = await Promise.all((claims||[]).map(async claim => {
    const mappedReceipts = await Promise.all((claim.receipts||[]).map(async rc => {
      let url = null;
      if(rc.storage_path){
        try{
          const{data}=await supabase.storage.from("receipts").createSignedUrl(rc.storage_path, 3600);
          url = data?.signedUrl||null;
        }catch(e){ console.warn("Failed to get signed URL for",rc.storage_path); }
      }
      return{id:rc.id,name:rc.file_name,storagePath:rc.storage_path,type:rc.mime_type,url};
    }));
    return{...mapClaim(claim), receipts: mappedReceipts};
  }));

  return{
    meta:meta?{id:meta.id,name:meta.name,industry:meta.industry,plan:meta.plan,maxUsers:meta.max_users,status:meta.status,createdOn:meta.created_on}:null,
    users:(users||[]).map(mapUser),
    trips:(trips||[]).map(mapTrip),
    claims:mappedClaims,
    topups:(topups||[]).map(mapTopup),
    auditLog:(audit||[]).map(mapAudit),
    notifications:(notifs||[]).map(mapNotif),
    policy:mapPolicy(policy)||mkPolicy(),
  };
}

// ─── SB: get signed receipt URL ───────────────────────────────────────────────
async function sbGetReceiptUrl(storagePath){
  if(!supabase)return null;
  const{data}=await supabase.storage.from("receipts").createSignedUrl(storagePath,3600);
  return data?.signedUrl||null;
}

// ─── SB: upload receipt from base64 ──────────────────────────────────────────
async function sbUploadReceipt(claimId,cid,b64,mimeType,fileName){
  if(!supabase)return null;
  const binary=atob(b64);
  const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  const blob=new Blob([bytes],{type:mimeType});
  const ext=mimeType.includes("pdf")?"pdf":"jpg";
  const path=`${cid}/${claimId}/${Date.now()}.${ext}`;
  const{error:upErr}=await supabase.storage.from("receipts").upload(path,blob,{contentType:mimeType});
  if(upErr)throw upErr;
  await supabase.from("receipts").insert({claim_id:claimId,company_id:cid,file_name:fileName||`receipt.${ext}`,storage_path:path,mime_type:mimeType});
  return path;
}

// ─── DEFAULT POLICY ───────────────────────────────────────────────────────────
const mkPolicy=()=>({
  autoApproveLimit:5000,reimbursementMode:false,receiptMandatoryAbove:1000,
  weekendRequiresApproval:true,multiLevelApproval:false,
  approvalLevels:[{upTo:10000,role:"manager"},{upTo:50000,role:"manager"},{upTo:999999,role:"manager"}],
  vendorWhitelist:[],vendorBlacklist:[],
  departmentBudgets:{Sales:50000,Marketing:40000,Accounts:60000,Procurement:45000,Operations:45000,HR:20000,IT:55000,Management:80000},
  categoryLimits:{Travel:50000,Meals:15000,Accommodation:30000,"Office Supplies":5000,"Client Entertainment":25000,Software:20000,Training:30000,Miscellaneous:10000},
  categoryPct:{Travel:40,Meals:15,Accommodation:20,"Office Supplies":5,"Client Entertainment":20,Software:15,Training:25,Miscellaneous:10},
  scheduledReports:{enabled:false,frequency:"weekly",email:""},
  departments:[...DEFAULT_DEPTS],
  primaryColor:"#7ED957",
});

// ─── DEMO DATA (localStorage fallback when Supabase not configured) ───────────
const SA={id:"sa1",name:"Super Admin",email:"rushabh@rbshah.co.in",password:"superadmin@123",role:"superadmin",avatar:"SA"};
const STORAGE_KEY="claimx_v1_db";
const SESSION_KEY="claimx_v1_sess";
const loadDB=()=>{try{const r=localStorage.getItem(STORAGE_KEY);return r?JSON.parse(r):null;}catch{return null;}};
const saveDB=d=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(d));}catch(e){}};
const loadSess=()=>{try{const s=localStorage.getItem(SESSION_KEY);return s?JSON.parse(s):null;}catch{return null;}};
const saveSess=s=>{try{s?localStorage.setItem(SESSION_KEY,JSON.stringify(s)):localStorage.removeItem(SESSION_KEY);}catch{}};

const DB0={
  rbshah:{
    meta:{id:"rbshah",name:"R B Shah & Associates",industry:"CA Firm",plan:"Pro",maxUsers:20,status:"Active",createdOn:"2026-01-15"},
    users:[
      {id:"mgr1",cid:"rbshah",name:"Rushabh Shah",  email:"rushabh@rbshah.in",  password:"admin@123",   role:"manager", avatar:"RS",dept:"Management",balance:0,    reimbursable:0,delegateTo:null},
      {id:"emp1",cid:"rbshah",name:"Janvi Davda",   email:"janvi@rbshah.in",    password:"janvi@111",  role:"employee",avatar:"JD",dept:"Audit",      balance:25000,reimbursable:0,delegateTo:null},
      {id:"emp2",cid:"rbshah",name:"Rutvik C.",     email:"rutvik@rbshah.in",   password:"rutvik@222", role:"employee",avatar:"RC",dept:"Tax",        balance:18000,reimbursable:0,delegateTo:null},
      {id:"emp3",cid:"rbshah",name:"Drashti Patel", email:"drashti@rbshah.in",  password:"drashti@333",role:"employee",avatar:"DP",dept:"GST",        balance:12000,reimbursable:0,delegateTo:null},
      {id:"emp4",cid:"rbshah",name:"Anisha Desai",  email:"anisha@rbshah.in",   password:"anisha@444", role:"employee",avatar:"AD",dept:"Finance",    balance:20000,reimbursable:0,delegateTo:null},
      {id:"emp5",cid:"rbshah",name:"Ami Parekh",    email:"ami@rbshah.in",      password:"ami@555",    role:"employee",avatar:"AP",dept:"Billing",    balance:15000,reimbursable:0,delegateTo:null},
    ],
    trips:[
      {id:"TRP-001",name:"Mumbai Client Visit",type:"trip",  startDate:"2026-03-25",endDate:"2026-03-28",status:"closed",budget:50000, spent:43200,assignedTo:["emp1","emp2"]},
      {id:"TRP-002",name:"Q4 Operations",      type:"period",startDate:"2026-04-01",endDate:"2026-04-30",status:"active",budget:150000,spent:36950,assignedTo:["emp1","emp2","emp3","emp4","emp5"]},
    ],
    claims:[
      {id:"EXP-001",tripId:"TRP-001",empId:"emp1",date:"2026-03-26",category:"Travel",              desc:"Flight BOM-AMD",            amount:8500, origAmount:8500, origCur:"INR",status:"Approved",autoApproved:false,receipts:[],remarks:"Approved",      flagged:false,anomaly:false,anomalyReasons:[],comments:[],vendor:"IndiGo",  weekendFlag:false,notes:""},
      {id:"EXP-002",tripId:"TRP-001",empId:"emp1",date:"2026-03-26",category:"Meals",               desc:"Team dinner",               amount:3200, origAmount:3200, origCur:"INR",status:"Approved",autoApproved:true, receipts:[],remarks:"Auto-approved",flagged:false,anomaly:false,anomalyReasons:[],comments:[],vendor:"",        weekendFlag:false,notes:""},
      {id:"EXP-003",tripId:"TRP-002",empId:"emp2",date:"2026-04-02",category:"Software",            desc:"Zoho subscription",         amount:4999, origAmount:4999, origCur:"INR",status:"Approved",autoApproved:true, receipts:[],remarks:"Auto-approved",flagged:false,anomaly:false,anomalyReasons:[],comments:[],vendor:"Zoho",     weekendFlag:false,notes:""},
      {id:"EXP-004",tripId:"TRP-002",empId:"emp1",date:"2026-04-03",category:"Client Entertainment",desc:"Client dinner Roger Motors", amount:6800, origAmount:6800, origCur:"INR",status:"Pending", autoApproved:false,receipts:[],remarks:"",            flagged:true, anomaly:false,anomalyReasons:[],comments:[{userId:"mgr1",name:"Rushabh Shah",text:"Please share the bill",time:"2026-04-03 10:30"}],vendor:"Trident",weekendFlag:false,notes:""},
      {id:"EXP-005",tripId:"TRP-002",empId:"emp3",date:"2026-04-04",category:"Office Supplies",     desc:"Printer cartridges",        amount:1450, origAmount:1450, origCur:"INR",status:"Rejected",autoApproved:false,receipts:[],remarks:"Over cat %",   flagged:false,anomaly:false,anomalyReasons:[],comments:[],vendor:"",        weekendFlag:false,notes:""},
      {id:"EXP-006",tripId:"TRP-002",empId:"emp4",date:"2026-04-04",category:"Training",            desc:"GST certification",         amount:12000,origAmount:12000,origCur:"INR",status:"Pending", autoApproved:false,receipts:[],remarks:"",            flagged:false,anomaly:true, anomalyReasons:["Amount is 2.5× avg for Training"],comments:[],vendor:"ICAI",     weekendFlag:false,notes:""},
      {id:"EXP-007",tripId:"TRP-002",empId:"emp5",date:"2026-04-05",category:"Travel",              desc:"Cab to client office",      amount:850,  origAmount:850,  origCur:"INR",status:"Approved",autoApproved:true, receipts:[],remarks:"Auto-approved",flagged:false,anomaly:false,anomalyReasons:[],comments:[],vendor:"Ola",      weekendFlag:false,notes:""},
      {id:"EXP-008",tripId:"TRP-001",empId:"emp2",date:"2026-02-26",category:"Meals",               desc:"Team lunch",                amount:3200, origAmount:3200, origCur:"INR",status:"Approved",autoApproved:true, receipts:[],remarks:"Auto-approved",flagged:false,anomaly:false,anomalyReasons:[],comments:[],vendor:"",        weekendFlag:false,notes:""},
      {id:"EXP-009",tripId:"TRP-001",empId:"emp1",date:"2026-01-15",category:"Travel",              desc:"Flight AMD-BOM",            amount:7200, origAmount:7200, origCur:"INR",status:"Approved",autoApproved:false,receipts:[],remarks:"Approved",      flagged:false,anomaly:false,anomalyReasons:[],comments:[],vendor:"Air India",weekendFlag:false,notes:""},
    ],
    topups:[{id:"TUP-001",empId:"emp3",amount:5000,reason:"Additional travel needed",date:"2026-04-03",status:"Pending"}],
    auditLog:[
      {id:"AL-001",action:"Approved",     claimId:"EXP-001",by:"mgr1",byName:"Rushabh Shah",at:"2026-03-27 09:12",remarks:"Approved"},
      {id:"AL-002",action:"Auto-Approved",claimId:"EXP-002",by:"SYSTEM",byName:"System",   at:"2026-03-27 14:35",remarks:"Under limit"},
      {id:"AL-003",action:"Rejected",     claimId:"EXP-005",by:"mgr1",byName:"Rushabh Shah",at:"2026-04-05 11:20",remarks:"Over category %"},
    ],
    notifications:[
      {id:"N-001",userId:"emp1",text:"Your claim EXP-001 was approved",    type:"success",read:false,time:"2026-03-27 09:12"},
      {id:"N-002",userId:"emp3",text:"EXP-005 rejected: Over category %",  type:"error",  read:false,time:"2026-04-05 11:20"},
      {id:"N-003",userId:"mgr1",text:"New claim EXP-006 awaiting approval",type:"info",   read:false,time:"2026-04-04 09:00"},
    ],
    policy:mkPolicy(),
  },
  rogermot:{
    meta:{id:"rogermot",name:"Roger Motors Pvt. Ltd.",industry:"Automotive",plan:"Starter",maxUsers:5,status:"Active",createdOn:"2026-02-10"},
    users:[
      {id:"rm_mgr1",cid:"rogermot",name:"Rajesh Patel",email:"rajesh@rogermotors.in",password:"rajesh@123",role:"manager", avatar:"RP",dept:"Management",balance:0,    reimbursable:0,delegateTo:null},
      {id:"rm_emp1",cid:"rogermot",name:"Sneha Joshi", email:"sneha@rogermotors.in", password:"sneha@111", role:"employee",avatar:"SJ",dept:"Sales",      balance:10000,reimbursable:0,delegateTo:null},
    ],
    trips:[{id:"RM-T1",name:"Delhi Auto Expo",type:"trip",startDate:"2026-04-01",endDate:"2026-04-05",status:"active",budget:80000,spent:12400,assignedTo:["rm_emp1"]}],
    claims:[
      {id:"RM-E1",tripId:"RM-T1",empId:"rm_emp1",date:"2026-04-02",category:"Travel",       desc:"Train tickets Delhi",amount:4200,origAmount:4200,origCur:"INR",status:"Approved",autoApproved:true, receipts:[],remarks:"Auto-approved",flagged:false,anomaly:false,anomalyReasons:[],comments:[],vendor:"IRCTC",weekendFlag:false,notes:""},
      {id:"RM-E2",tripId:"RM-T1",empId:"rm_emp1",date:"2026-04-03",category:"Accommodation",desc:"Hotel 2 nights",    amount:8200,origAmount:8200,origCur:"INR",status:"Pending", autoApproved:false,receipts:[],remarks:"",           flagged:false,anomaly:false,anomalyReasons:[],comments:[],vendor:"OYO",  weekendFlag:false,notes:""},
    ],
    topups:[],auditLog:[],notifications:[],policy:mkPolicy(),
  },
};

// ─── EMAIL SIMULATION (replace with Resend/SendGrid in production) ────────────
const emailAlert=(to,sub,body)=>console.log(`[EMAIL→${to}] ${sub}\n${body}`);

// ─── PUSH NOTIFICATIONS HOOK ──────────────────────────────────────────────────
function usePush(){
  const[perm,setPerm]=useState(typeof Notification!=="undefined"?Notification.permission:"denied");
  const ask=async()=>{if(typeof Notification==="undefined")return;const p=await Notification.requestPermission();setPerm(p);};
  const send=(title,body)=>{if(perm==="granted"&&typeof Notification!=="undefined"){try{new Notification(title,{body});}catch{}}};
  return{perm,ask,send};
}

// ─── OFFLINE QUEUE HOOK ───────────────────────────────────────────────────────
function useOffline(){
  const[queue,setQueue]=useState([]);
  const[online,setOnline]=useState(typeof navigator!=="undefined"?navigator.onLine:true);
  useEffect(()=>{
    const up=()=>setOnline(true),dn=()=>setOnline(false);
    window.addEventListener("online",up);window.addEventListener("offline",dn);
    return()=>{window.removeEventListener("online",up);window.removeEventListener("offline",dn);};
  },[]);
  const enqueue=item=>setQueue(q=>[...q,item]);
  const flush=cb=>{queue.forEach(cb);setQueue([]);};
  return{queue,online,enqueue,flush};
}

// ─── ERROR BOUNDARY ───────────────────────────────────────────────────────────
class ErrorBoundary extends Component{
  constructor(p){super(p);this.state={error:null};}
  static getDerivedStateFromError(e){return{error:e};}
  componentDidCatch(e,i){console.error("ClaimX Error:",e,i);}
  render(){
    if(this.state.error){return(
      <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f5faf3",fontFamily:FB,padding:24}}>
        <div style={{maxWidth:480,textAlign:"center"}}>
          <div style={{fontSize:48,marginBottom:16}}>⚠️</div>
          <h2 style={{fontFamily:FD,fontSize:22,color:DARK,marginBottom:8}}>Something went wrong</h2>
          <p style={{color:MUTED,fontSize:14,marginBottom:6}}>{this.state.error?.message||"An unexpected error occurred."}</p>
          <p style={{color:"#9ca3af",fontSize:12,marginBottom:20,fontFamily:"monospace"}}>{this.state.error?.stack?.split('\n')[1]||""}</p>
          <button onClick={()=>{this.setState({error:null});window.location.reload();}} style={{padding:"10px 24px",background:G,border:"none",borderRadius:9,color:"#fff",fontFamily:FB,fontWeight:700,fontSize:14,cursor:"pointer"}}>↺ Reload</button>
        </div>
      </div>
    );}
    return this.props.children;
  }
}

// ─── ATOMS ────────────────────────────────────────────────────────────────────
const Badge=({s,sm})=>{const c=SC[s]||SC.Pending;return<span style={{display:"inline-flex",alignItems:"center",gap:3,padding:sm?"2px 7px":"3px 9px",borderRadius:20,fontSize:sm?10:11,fontWeight:700,background:c.bg,color:c.c,whiteSpace:"nowrap"}}>{c.icon} {s}</span>;};
const Card=({children,style})=><div style={{background:"#fff",borderRadius:14,border:`1px solid ${BDR}`,...style}}>{children}</div>;
const Btn=({children,onClick,v="primary",style,disabled,title})=>{
  const S={primary:{background:G,color:"#fff",border:"none",boxShadow:"0 2px 8px #7ed95740"},outline:{background:"transparent",color:INK,border:`1.5px solid ${BDR}`},danger:{background:"#ef4444",color:"#fff",border:"none"},ghost:{background:"transparent",color:MUTED,border:"none"},warning:{background:"#f59e0b",color:"#fff",border:"none"},blue:{background:"#3b82f6",color:"#fff",border:"none"},purple:{background:"#7c3aed",color:"#fff",border:"none"},dark:{background:DARK,color:"#fff",border:"none"}};
  return<button title={title} onClick={onClick} disabled={disabled} style={{padding:"9px 18px",borderRadius:9,fontFamily:FB,fontSize:13,fontWeight:600,cursor:disabled?"not-allowed":"pointer",opacity:disabled?.5:1,transition:"all .15s",...(S[v]||S.primary),...style}}>{children}</button>;
};
const PBar=({value,max,h=6,color=G})=><div style={{background:"#f3f4f6",borderRadius:4,height:h,overflow:"hidden"}}><div style={{width:`${Math.min(max>0?Math.round(value/max*100):0,100)}%`,background:value/max>.9?"#ef4444":value/max>.7?"#f59e0b":color,height:"100%",borderRadius:4,transition:"width .5s"}}/></div>;
const Toggle=({on,onClick,label,sub})=>(
  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"11px 0",borderBottom:`1px solid ${BDR}`}}>
    <div><div style={{fontSize:12,fontWeight:600,color:INK}}>{label}</div>{sub&&<div style={{fontSize:10,color:MUTED,marginTop:1}}>{sub}</div>}</div>
    <div onClick={onClick} style={{width:40,height:22,borderRadius:11,background:on?G:"#d1d5db",cursor:"pointer",position:"relative",transition:"background .2s",flexShrink:0}}>
      <div style={{position:"absolute",top:3,left:on?21:3,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left .2s",boxShadow:"0 1px 3px #0002"}}/>
    </div>
  </div>
);

// ─── LOGO ─────────────────────────────────────────────────────────────────────
const Logo=({width=200,dark=false})=>(
  <svg width={width} viewBox="0 0 680 220" xmlns="http://www.w3.org/2000/svg">
    <polygon points="90,48 126,27 162,48 162,90 126,111 90,90" fill="none" stroke="#7ED957" strokeWidth="2.2"/>
    <polygon points="98,53 126,36 154,53 154,85 126,102 98,85" fill="#7ED957" opacity="0.12"/>
    {[[126,69,90,48],[126,69,126,27],[126,69,162,48],[126,69,162,90],[126,69,126,111],[126,69,90,90]].map(([x1,y1,x2,y2],i)=>
      <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#7ED957" strokeWidth="1.5" strokeLinecap="round"/>)}
    <circle cx="126" cy="69" r="9" fill="#7ED957"/>
    <circle cx="126" cy="69" r="4" fill={dark?"#fff":"#1a1a1a"}/>
    {[[90,48,"#7ED957"],[126,27,"#5ab83e"],[162,48,"#7ED957"],[162,90,"#5ab83e"],[126,111,"#7ED957"],[90,90,"#5ab83e"]].map(([cx,cy,f],i)=>
      <circle key={i} cx={cx} cy={cy} r="4" fill={f}/>)}
    <text x="192" y="98"  fontFamily="'Playfair Display',serif" fontWeight="900" fontSize="58" fill={dark?"#fff":"#1a1a1a"} letterSpacing="-2">Claim</text>
    <text x="192" y="145" fontFamily="'Sora',sans-serif"         fontWeight="300" fontSize="42" fill="#7ED957" letterSpacing="4">X</text>
    <line x1="192" y1="158" x2="480" y2="158" stroke="#7ED957" strokeWidth="0.8" opacity="0.4"/>
    <text x="192" y="178" fontFamily="'Sora',sans-serif"         fontWeight="400" fontSize="13" fill="#7ED957" opacity="0.75" letterSpacing="3">by RB</text>
  </svg>
);


// ─── LOGIN ────────────────────────────────────────────────────────────────────
function Login({onLogin,DB,isPasswordRecovery=false}){
  const[login,  setLogin] =useState(""); // username, email, or mobile
  const[pass,   setPass]  =useState("");
  const[newPw,  setNewPw] =useState("");
  const[cfPw,   setCfPw]  =useState("");
  const[showPw, setSP]    =useState(false);
  const[err,    setErr]   =useState("");
  const[msg,    setMsg]   =useState("");
  const[busy,   setBusy]  =useState(false);
  const[gBusy,  setGB]    =useState(false);
  const[view,   setView]  =useState(isPasswordRecovery?"reset":"login");

  // ── Main sign-in ──────────────────────────────────────────────────────────
  const attempt=async(loginVal,pw)=>{
    setErr("");setBusy(true);
    try{
      const trimmed=loginVal.trim();

      if(SB_ENABLED){
        // Step 1: Try custom auth RPC (username/mobile/email for employees)
        const{data:customResult}=await supabase.rpc("authenticate_user",{
          p_login:trimmed, p_password:pw
        });
        if(customResult&&!customResult.error){
          // Custom auth success — build session without Supabase Auth JWT
          onLogin({
            id:customResult.id, name:customResult.name, email:customResult.email||"",
            username:customResult.username||"", mobile:customResult.mobile||"",
            role:customResult.role, avatar:customResult.avatar, dept:customResult.dept,
            balance:customResult.balance, reimbursable:customResult.reimbursable,
            delegateTo:customResult.delegate_to, isSuspended:false,
            authType:"custom", cid:customResult.company_id, companyId:customResult.company_id
          }, {id:customResult.company_id});
          return;
        }
        // If custom auth says user not found, try Supabase Auth (for SA / company admins)
        const isEmail=trimmed.includes("@");
        if(isEmail){
          const{error}=await supabase.auth.signInWithPassword({
            email:trimmed.toLowerCase(), password:pw
          });
          if(error){
            // Show the custom auth error if it was a password issue, otherwise show email error
            const customErr=customResult?.error;
            if(customErr&&customErr!=="User not found") throw new Error(customErr);
            throw new Error(
              error.message==="Invalid login credentials"?"Incorrect password or account not found.":
              error.message==="Email not confirmed"?"Please verify your email first — check your inbox.":
              error.message
            );
          }
          // Supabase Auth success — onAuthStateChange in Root handles redirect
          return;
        }
        // Non-email login that custom auth didn't find
        throw new Error(customResult?.error||"No account found with those credentials.");

      } else {
        // ── Demo / localStorage mode ──────────────────────────────────────
        await new Promise(r=>setTimeout(r,400));
        const e=trimmed.toLowerCase();
        // Check SA
        if((e===SA.email||e==="admin")&&pw===SA.password){onLogin(SA,null);return;}
        // Check all companies
        for(const cid of Object.keys(DB)){
          const co=DB[cid];
          if(co.meta.status==="Suspended")continue;
          const u=co.users.find(u=>
            u.email?.toLowerCase()===e ||
            u.username?.toLowerCase()===e ||
            u.mobile===trimmed
          );
          if(u){
            if(u.isSuspended) throw new Error("Account suspended. Contact your manager.");
            if(u.password!==pw&&u.password_hash!==pw) throw new Error("Incorrect password.");
            onLogin(u,co.meta);return;
          }
        }
        throw new Error("No account found. Check your username/email and try again.");
      }
    }catch(e){setErr(e.message||"Login failed.");}
    finally{setBusy(false);}
  };

  // ── Google OAuth ──────────────────────────────────────────────────────────
  const googleLogin=async()=>{
    setGB(true);setErr("");
    try{
      if(SB_ENABLED){
        const{error}=await supabase.auth.signInWithOAuth({
          provider:"google",
          options:{redirectTo:window.location.origin,queryParams:{access_type:"offline",prompt:"consent"}}
        });
        if(error)throw new Error(error.message);
      } else {
        await new Promise(r=>setTimeout(r,1200));
        await attempt("rushabh@rbshah.co.in","admin@123");
      }
    }catch(e){setErr(e.message);setGB(false);}
  };

  // ── Reset password (Supabase Auth users only) ─────────────────────────────
  const sendReset=async()=>{
    if(!login.trim()||!login.includes("@")){setErr("Enter your email address to reset password.");return;}
    setErr("");setBusy(true);
    try{
      if(SB_ENABLED){
        const{error}=await supabase.auth.resetPasswordForEmail(login.trim().toLowerCase(),
          {redirectTo:`${window.location.origin}/?reset=true`});
        if(error)throw new Error(error.message);
      }
      setView("forgot_sent");
    }catch(e){setErr(e.message);}
    finally{setBusy(false);}
  };

  const saveNewPassword=async()=>{
    setErr("");
    if(newPw.length<6){setErr("Password must be at least 6 characters.");return;}
    if(newPw!==cfPw){setErr("Passwords do not match.");return;}
    setBusy(true);
    try{
      if(SB_ENABLED){const{error}=await supabase.auth.updateUser({password:newPw});if(error)throw new Error(error.message);}
      setMsg("✓ Password updated! You can now sign in.");setView("login");setNewPw("");setCfPw("");
    }catch(e){setErr(e.message);}
    finally{setBusy(false);}
  };

  const inp={width:"100%",padding:"12px 14px",borderRadius:10,border:"1.5px solid rgba(255,255,255,0.15)",background:"rgba(255,255,255,0.07)",color:"#fff",fontFamily:FB,fontSize:14,outline:"none",boxSizing:"border-box"};

  return(
    <div style={{minHeight:"100vh",background:`linear-gradient(145deg,${DARK} 0%,#162e0d 45%,#0c1f08 100%)`,display:"flex",fontFamily:FB,position:"relative",overflow:"hidden"}}>
      <style>{GLSTYLE}</style>
      <div style={{position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(126,217,87,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(126,217,87,.025) 1px,transparent 1px)",backgroundSize:"44px 44px"}}/>

      {/* Left branding */}
      <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",padding:"60px 64px",position:"relative",zIndex:1}}>
        <div style={{marginBottom:40}}><Logo width={240} dark/></div>
        <h2 style={{fontFamily:FD,fontSize:28,fontWeight:700,color:"#fff",lineHeight:1.3,marginBottom:12}}>Smarter expense<br/>management for<br/>growing Indian teams.</h2>
        <p style={{color:"rgba(255,255,255,0.4)",fontSize:13,lineHeight:1.8,maxWidth:320,marginBottom:24}}>AI-powered invoice scanning, real-time approvals, trip-wise tracking, and one-click accounting exports.</p>
        {["⚡  Auto-approve within policy limits","🤖  Batch OCR · camera · handwritten bills","📊  Tally XML · Zoho Books · GSTR-2A","🌐  Multi-company, isolated data","📴  Offline mode — syncs on reconnect"].map(f=>(
          <div key={f} style={{display:"flex",alignItems:"center",gap:8,color:"rgba(255,255,255,0.5)",fontSize:13,marginBottom:8}}><span style={{color:G}}>{f.slice(0,2)}</span>{f.slice(4)}</div>
        ))}
        {SB_ENABLED
          ?null
          :null
        }
      </div>

      {/* Right form */}
      <div style={{width:460,display:"flex",flexDirection:"column",justifyContent:"center",padding:40,position:"relative",zIndex:1}}>
        <div style={{background:"rgba(255,255,255,0.04)",backdropFilter:"blur(24px)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:18,padding:"36px 32px",animation:"fadeUp .4s ease"}}>

          {/* ── RESET VIEW ── */}
          {view==="reset"&&(<>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",fontWeight:700,letterSpacing:2,textTransform:"uppercase",marginBottom:6}}>Set New Password</div>
            <p style={{color:"rgba(255,255,255,0.45)",fontSize:12,marginBottom:18,lineHeight:1.5}}>Choose a strong password for your account.</p>
            {[["New Password",newPw,setNewPw],["Confirm Password",cfPw,setCfPw]].map(([l,v,fn])=>(
              <div key={l} style={{marginBottom:12}}><label style={{display:"block",fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.4)",letterSpacing:1,textTransform:"uppercase",marginBottom:6}}>{l}</label><input type="password" value={v} onChange={e=>{fn(e.target.value);setErr("");}} placeholder="Min 6 characters" style={inp}/></div>
            ))}
            {err&&<div style={{color:"#f87171",fontSize:12,marginBottom:10}}>⚠ {err}</div>}
            <button onClick={saveNewPassword} disabled={busy||!newPw||!cfPw} style={{width:"100%",padding:"13px",background:G,border:"none",borderRadius:10,color:"#fff",fontFamily:FB,fontWeight:700,fontSize:15,cursor:"pointer"}}>
              {busy?"Saving…":"Save New Password →"}
            </button>
          </>)}

          {/* ── FORGOT SENT VIEW ── */}
          {view==="forgot_sent"&&(<>
            <div style={{textAlign:"center",padding:"10px 0"}}>
              <div style={{fontSize:44,marginBottom:12}}>📧</div>
              <div style={{fontFamily:FD,fontSize:18,fontWeight:700,color:"#fff",marginBottom:8}}>Check your inbox</div>
              <p style={{color:"rgba(255,255,255,0.5)",fontSize:13,lineHeight:1.6,marginBottom:20}}>A reset link was sent to <strong style={{color:"rgba(255,255,255,0.8)"}}>{login}</strong>. Check spam/junk if not seen.</p>
              <button onClick={()=>setView("login")} style={{background:"none",border:"1px solid rgba(255,255,255,0.15)",borderRadius:9,color:"rgba(255,255,255,0.5)",padding:"9px 20px",fontFamily:FB,fontSize:13,cursor:"pointer"}}>← Back to Sign In</button>
            </div>
          </>)}

          {/* ── FORGOT VIEW ── */}
          {view==="forgot"&&(<>
            <button onClick={()=>setView("login")} style={{background:"none",border:"none",color:"rgba(255,255,255,0.4)",fontFamily:FB,fontSize:12,cursor:"pointer",padding:0,marginBottom:14,display:"flex",alignItems:"center",gap:5}}>← Back</button>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",fontWeight:700,letterSpacing:2,textTransform:"uppercase",marginBottom:6}}>Reset Password</div>
            <p style={{color:"rgba(255,255,255,0.45)",fontSize:12,marginBottom:18,lineHeight:1.5}}>Enter your email address (for admin accounts only).</p>
            <div style={{marginBottom:16}}><label style={{display:"block",fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.4)",letterSpacing:1,textTransform:"uppercase",marginBottom:6}}>Email</label><input type="email" value={login} onChange={e=>{setLogin(e.target.value);setErr("");}} onKeyDown={e=>e.key==="Enter"&&sendReset()} placeholder="you@company.in" style={inp}/></div>
            {err&&<div style={{color:"#f87171",fontSize:12,marginBottom:10}}>⚠ {err}</div>}
            <button onClick={sendReset} disabled={busy||!login} style={{width:"100%",padding:"13px",background:G,border:"none",borderRadius:10,color:"#fff",fontFamily:FB,fontWeight:700,fontSize:15,cursor:"pointer"}}>{busy?"Sending…":"Send Reset Link →"}</button>
            <p style={{color:"rgba(255,255,255,0.3)",fontSize:11,marginTop:10}}>Note: password reset is only for admin accounts. For employee access, ask your manager to reset your password.</p>
          </>)}

          {/* ── MAIN LOGIN VIEW ── */}
          {view==="login"&&(<>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",fontWeight:700,letterSpacing:2,textTransform:"uppercase",marginBottom:20}}>Sign in to your workspace</div>
            {msg&&<div style={{background:"rgba(126,217,87,0.1)",border:"1px solid rgba(126,217,87,0.3)",borderRadius:8,padding:"9px 12px",marginBottom:14,fontSize:12,color:G}}>{msg}</div>}

            {/* Google */}
            <button onClick={googleLogin} disabled={gBusy} style={{width:"100%",padding:"11px",background:"rgba(255,255,255,0.08)",border:"1.5px solid rgba(255,255,255,0.15)",borderRadius:10,color:"#fff",fontFamily:FB,fontSize:14,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:14}}>
              {gBusy?<span style={{width:16,height:16,border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin .7s linear infinite",display:"inline-block"}}/>:<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>}
              {gBusy?"Connecting…":"Continue with Google"}
            </button>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}><div style={{flex:1,height:1,background:"rgba(255,255,255,0.1)"}}/><span style={{color:"rgba(255,255,255,0.25)",fontSize:11}}>or username / email / mobile</span><div style={{flex:1,height:1,background:"rgba(255,255,255,0.1)"}}/></div>

            <div style={{marginBottom:12}}>
              <label style={{display:"block",fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.4)",letterSpacing:1,textTransform:"uppercase",marginBottom:6}}>Username / Email / Mobile</label>
              <input type="text" value={login} onChange={e=>{setLogin(e.target.value);setErr("");}} onKeyDown={e=>e.key==="Enter"&&attempt(login,pass)} placeholder="janvi.davda  or  janvi@co.in  or  9876543210" style={inp} autoComplete="username"/>
            </div>
            <div style={{marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                <label style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.4)",letterSpacing:1,textTransform:"uppercase"}}>Password</label>
                <span onClick={()=>{setErr("");setMsg("");setView("forgot");}} style={{color:G,fontSize:11,cursor:"pointer",textDecoration:"underline"}}>Forgot?</span>
              </div>
              <div style={{position:"relative"}}>
                <input type={showPw?"text":"password"} value={pass} onChange={e=>{setPass(e.target.value);setErr("");}} onKeyDown={e=>e.key==="Enter"&&attempt(login,pass)} placeholder="••••••••" style={{...inp,paddingRight:44}} autoComplete="current-password"/>
                <button onClick={()=>setSP(!showPw)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"rgba(255,255,255,0.3)",cursor:"pointer",fontSize:16}}>{showPw?"🙈":"👁"}</button>
              </div>
            </div>
            {err&&<div style={{color:"#f87171",fontSize:12,marginBottom:8}}>⚠ {err}</div>}

            <button onClick={()=>attempt(login,pass)} disabled={busy||!login||!pass}
              style={{marginTop:12,width:"100%",padding:"13px",background:busy||!login||!pass?"rgba(126,217,87,0.3)":G,border:"none",borderRadius:10,color:"#fff",fontFamily:FB,fontWeight:700,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
              {busy&&<span style={{width:18,height:18,border:"2.5px solid rgba(255,255,255,0.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin .7s linear infinite",display:"inline-block"}}/>}
              {busy?"Signing in…":"Sign In →"}
            </button>

            {/* Demo accounts */}
            <div style={{marginTop:16,padding:"12px",background:"rgba(126,217,87,0.05)",border:"1px solid rgba(126,217,87,0.12)",borderRadius:10}}>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Demo accounts {SB_ENABLED?"(click to fill, then Sign In)":""}</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
                {[["🔑 Super Admin","rushabh@rbshah.co.in","(your password)"],["👔 Manager","rushabh@rbshah.in","admin@123"],["👤 Employee","janvi@rbshah.in","janvi@111"],["🚗 Roger Motors","rajesh@rogermotors.in","rajesh@123"]].map(([role,em,pw])=>(
                  <div key={em} onClick={()=>{setLogin(em);setPass(pw);setErr("");setMsg("");}} style={{cursor:"pointer",padding:"6px 8px",background:"rgba(255,255,255,0.04)",borderRadius:7,border:"1px solid rgba(255,255,255,0.07)"}}>
                    <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginBottom:1}}>{role}</div>
                    <div style={{fontSize:10,color:"rgba(255,255,255,0.55)",fontWeight:600}}>{em}</div>
                  </div>
                ))}
              </div>
            </div>
          </>)}
        </div>
        <div style={{marginTop:14,textAlign:"center",fontSize:10,color:"rgba(255,255,255,0.2)"}}>© 2026 ClaimX by RB · Privacy · Terms</div>
      </div>
    </div>
  );
}

// ─── EDIT COMPANY MODAL ───────────────────────────────────────────────────────
function EditCoModal({data,onClose,onSave}){
  const[name,setName]=useState(data.name);
  const[industry,setInd]=useState(data.industry||"");
  const[plan,setPlan]=useState(data.plan||"Starter");
  const[maxUsers,setMax]=useState(String(data.maxUsers||5));
  const inpS={padding:"9px 12px",border:`1.5px solid ${BDR}`,borderRadius:8,fontSize:13,background:"#fafff8",fontFamily:FB,width:"100%"};
  const save=()=>onSave({id:data.id,name,industry,plan,maxUsers:parseInt(maxUsers)||5});
  return(
    <div style={{position:"fixed",inset:0,background:"#00000060",display:"flex",alignItems:"center",justifyContent:"center",zIndex:510,backdropFilter:"blur(3px)"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:16,padding:28,width:480,boxShadow:"0 24px 60px #0003"}}>
        <h3 style={{fontFamily:FD,fontSize:18,fontWeight:700,color:INK,marginBottom:18}}>Edit Company</h3>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
          {[["Company Name","text",name,setName],["Industry","text",industry,setInd]].map(([l,t,v,fn])=>(
            <div key={l}><label style={{fontSize:10,color:MUTED,fontWeight:700,display:"block",marginBottom:4,textTransform:"uppercase"}}>{l}</label><input type={t} value={v} onChange={e=>fn(e.target.value)} style={inpS}/></div>
          ))}
          <div><label style={{fontSize:10,color:MUTED,fontWeight:700,display:"block",marginBottom:4,textTransform:"uppercase"}}>Plan</label><select value={plan} onChange={e=>setPlan(e.target.value)} style={{...inpS,appearance:"none"}}>{["Starter","Pro","Enterprise"].map(p=><option key={p}>{p}</option>)}</select></div>
          <div><label style={{fontSize:10,color:MUTED,fontWeight:700,display:"block",marginBottom:4,textTransform:"uppercase"}}>Max Users</label><input type="number" min="1" value={maxUsers} onChange={e=>setMax(e.target.value)} style={inpS}/></div>
        </div>
        <div style={{display:"flex",gap:9}}><Btn onClick={save} style={{flex:1,padding:11}}>Save Changes →</Btn><Btn v="outline" onClick={onClose}>Cancel</Btn></div>
      </div>
    </div>
  );
}

// ─── SUPER ADMIN ──────────────────────────────────────────────────────────────
function SuperAdmin({DB,setDB,onLogout,sbRefresh}){
  const[tab,setTab]=useState("companies");
  const[notif,setNtf]=useState(null);
  const[modal,setMdl]=useState(null);
  const[sbCoList,setSbCoList]=useState(null);
  const[loading,setLoading]=useState(false);
  const[form,setForm]=useState({name:"",industry:"",plan:"Starter",maxUsers:5,adminName:"",adminEmail:"",adminPw:""});
  const[userCounts,setUserCounts]=useState({});

  const toast=(msg,t="success")=>{setNtf({msg,t});setTimeout(()=>setNtf(null),3000);};
  const allCo=SB_ENABLED?(sbCoList||[]):Object.values(DB);
  const inpS={padding:"9px 12px",border:`1.5px solid ${BDR}`,borderRadius:8,fontSize:13,background:"#fafff8",fontFamily:FB,width:"100%"};

  useEffect(()=>{
    if(!SB_ENABLED)return;
    setLoading(true);
    supabase.from("companies").select("*").then(({data})=>{
      if(data)setSbCoList(data.map(c=>({meta:{id:c.id,name:c.name,industry:c.industry,plan:c.plan,maxUsers:c.max_users,status:c.status,createdOn:c.created_on},users:[]})));
      setLoading(false);
    });
  },[]);

  const createCo=async()=>{
    if(!form.name||!form.adminEmail||!form.adminPw){toast("Fill required fields","error");return;}
    const id=form.name.toLowerCase().replace(/\s+/g,"").replace(/[^a-z0-9]/g,"").slice(0,10)+uid().slice(0,4).toLowerCase();
    try{
      if(SB_ENABLED){
        // 1. Create company row
        const{error:coErr}=await supabase.from("companies").insert({id,name:form.name,industry:form.industry||"General",plan:form.plan,max_users:parseInt(form.maxUsers)||5,status:"Active"});
        if(coErr)throw new Error(coErr.message);
        // 2. Insert default policy
        await supabase.from("policy").insert({company_id:id});
        // 3. Insert manager directly into users table (custom auth — no Supabase Auth signUp needed)
        // Generate UUID for the new manager
        const{data:uuidData}=await supabase.rpc("gen_manager_uuid");
        const managerId=uuidData||crypto.randomUUID();
        const managerName=form.adminName||form.adminEmail.split("@")[0];
        const username=managerName.toLowerCase().replace(/\s+/g,".");
        const{data:hashData,error:hashErr}=await supabase.rpc("create_manager_account",{
          p_company_id:id, p_name:managerName, p_email:form.adminEmail,
          p_username:username, p_password:form.adminPw,
          p_mobile:null, p_avatar:inits(managerName)
        });
        if(hashErr)throw new Error(hashErr.message);
        if(hashData?.error)throw new Error(hashData.error);
        toast(`✓ ${form.name} created! Manager login: username="${username}", password as set`);
        // Refresh list
        const{data}=await supabase.from("companies").select("*");
        if(data)setSbCoList(data.map(c=>({meta:{id:c.id,name:c.name,industry:c.industry,plan:c.plan,maxUsers:c.max_users,status:c.status,createdOn:c.created_on},users:[]})));
      } else {
        // localStorage demo mode
        const mgr={id:"mgr_"+uid(),cid:id,name:form.adminName||form.adminEmail.split("@")[0],email:form.adminEmail,username:(form.adminName||form.adminEmail.split("@")[0]).toLowerCase().replace(/\s+/g,"."),password:form.adminPw,role:"manager",avatar:inits(form.adminName||form.adminEmail),dept:"Management",balance:0,reimbursable:0,delegateTo:null,isSuspended:false,authType:"custom"};
        setDB(p=>({...p,[id]:{meta:{id,name:form.name,industry:form.industry||"General",plan:form.plan,maxUsers:parseInt(form.maxUsers)||5,status:"Active",createdOn:today()},users:[mgr],trips:[],claims:[],topups:[],auditLog:[],notifications:[],policy:mkPolicy()}}));
        toast(`✓ ${form.name} created`);
      }
      setForm({name:"",industry:"",plan:"Starter",maxUsers:5,adminName:"",adminEmail:"",adminPw:""});
      setMdl(null);
    }catch(e){toast(e.message,"error");}
  };

  const toggleStatus=async(co)=>{
    const newStatus=co.meta.status==="Active"?"Suspended":"Active";
    if(SB_ENABLED){await supabase.from("companies").update({status:newStatus}).eq("id",co.meta.id);}
    else{setDB(p=>({...p,[co.meta.id]:{...p[co.meta.id],meta:{...p[co.meta.id].meta,status:newStatus}}}));}
    if(SB_ENABLED){const{data}=await supabase.from("companies").select("*");if(data)setSbCoList(data.map(c=>({meta:{id:c.id,name:c.name,industry:c.industry,plan:c.plan,maxUsers:c.max_users,status:c.status,createdOn:c.created_on},users:[]})));}
    toast("Status updated");
  };

  const deleteCo=async(cid)=>{
    if(SB_ENABLED){await supabase.from("companies").delete().eq("id",cid);}
    else{setDB(p=>{const n={...p};delete n[cid];return n;});}
    if(SB_ENABLED){const{data}=await supabase.from("companies").select("*");if(data)setSbCoList(data.map(c=>({meta:{id:c.id,name:c.name,industry:c.industry,plan:c.plan,maxUsers:c.max_users,status:c.status,createdOn:c.created_on},users:[]})));}
    setMdl(null);toast("Deleted","warn");
  };

  // Fetch users count per company for billing tab
  useEffect(()=>{
    if(!SB_ENABLED)return;
    supabase.from("users").select("company_id").then(({data})=>{
      if(data){const c={};data.forEach(u=>{c[u.company_id]=(c[u.company_id]||0)+1;});setUserCounts(c);}
    });
  },[]);

  return(
    <div style={{display:"flex",minHeight:"100vh",fontFamily:FB,background:"#f0f4f8"}}>
      <style>{GLSTYLE}</style>
      {notif&&<div style={{position:"fixed",top:20,right:20,zIndex:1000,padding:"12px 18px",borderRadius:12,fontWeight:600,fontSize:13,background:notif.t==="error"?"#fee2e2":"#dcfce7",color:notif.t==="error"?"#dc2626":"#15803d",boxShadow:"0 4px 20px #0002"}}>{notif.msg}</div>}
      {/* Sidebar */}
      <div style={{width:220,background:"#1e2736",display:"flex",flexDirection:"column",padding:"20px 12px",position:"sticky",top:0,height:"100vh"}}>
        <div style={{marginBottom:18}}><Logo width={140} dark/></div>
        <div style={{background:"#dc2626",borderRadius:8,padding:"4px 10px",marginBottom:14,fontSize:10,fontWeight:700,color:"#fff",letterSpacing:1,textTransform:"uppercase",textAlign:"center"}}>SUPER ADMIN</div>
        
        {[{id:"companies",i:"🏢",l:"Companies"},{id:"users",i:"👥",l:"All Users"},{id:"billing",i:"💳",l:"Billing"},{id:"audit",i:"📋",l:"Audit Log"},{id:"help",i:"❓",l:"Help"}].map(x=>(
          <button key={x.id} onClick={()=>setTab(x.id)} style={{display:"flex",alignItems:"center",gap:9,padding:"10px 12px",borderRadius:9,cursor:"pointer",border:"none",fontFamily:FB,fontSize:13,fontWeight:tab===x.id?600:400,background:tab===x.id?"#dc2626":"transparent",color:tab===x.id?"#fff":"rgba(255,255,255,0.5)",marginBottom:3,textAlign:"left",width:"100%"}}>
            <span>{x.i}</span><span>{x.l}</span>
          </button>
        ))}
        <div style={{marginTop:"auto",paddingTop:12,borderTop:"1px solid rgba(255,255,255,0.08)"}}>
          <div style={{color:"#fff",fontSize:12,fontWeight:600,padding:"0 6px",marginBottom:8}}>Super Admin</div>
          <button onClick={onLogout} style={{width:"100%",padding:"7px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:7,color:"rgba(255,255,255,0.4)",fontFamily:FB,fontSize:11,cursor:"pointer",marginBottom:6}}>Sign Out</button>
          <button onClick={()=>{if(window.confirm("Reset ALL demo data? (Supabase data unaffected)")){localStorage.removeItem(STORAGE_KEY);localStorage.removeItem(SESSION_KEY);window.location.reload();}}} style={{width:"100%",padding:"6px",background:"rgba(239,68,68,0.12)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:7,color:"rgba(239,68,68,0.7)",fontFamily:FB,fontSize:10,cursor:"pointer"}}>🗑 Reset Demo Data</button>
        </div>
      </div>
      {/* Content */}
      <div style={{flex:1,padding:"28px 32px",overflow:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
          <div><h1 style={{fontFamily:FD,fontSize:24,fontWeight:700,color:"#1e2736"}}>ClaimX Control Centre</h1><p style={{color:MUTED,fontSize:13,marginTop:3}}>Manage all companies, users and billing</p></div>
          {tab==="companies"&&<Btn onClick={()=>setMdl({type:"newCo"})}>＋ New Company</Btn>}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:22}}>
          {[{l:"Companies",v:allCo.length,i:"🏢",c:"#6366f1"},{l:"Active",v:allCo.filter(c=>c.meta.status==="Active").length,i:"✅",c:"#16a34a"},{l:"Total Users",v:SB_ENABLED?Object.values(userCounts).reduce((a,b)=>a+b,0):Object.values(DB).reduce((s,c)=>s+c.users.length,0),i:"👥",c:G},{l:"Status",v:"Active",i:"🟢",c:"#16a34a"}].map((s,i)=>(
            <Card key={i} style={{padding:18}}><div style={{fontSize:22}}>{s.i}</div><div style={{fontFamily:FD,fontSize:22,fontWeight:700,color:s.c,marginTop:4}}>{s.v}</div><div style={{fontSize:11,color:MUTED,marginTop:2}}>{s.l}</div></Card>
          ))}
        </div>
        {loading&&<div style={{textAlign:"center",padding:40,color:MUTED}}>Loading companies from Supabase…</div>}
        {tab==="companies"&&!loading&&<Card><table style={{width:"100%"}}>
          <thead><tr><th>Company</th><th>Industry</th><th>Plan</th><th>Max Users</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>{allCo.map(co=>(
            <tr key={co.meta.id} className="rh">
              <td><div style={{fontWeight:700,color:INK}}>{co.meta.name}</div><div style={{fontSize:10,color:MUTED,fontFamily:"monospace"}}>{co.meta.id}</div></td>
              <td style={{color:MUTED}}>{co.meta.industry}</td>
              <td><span style={{background:co.meta.plan==="Pro"?GL:"#eff6ff",color:co.meta.plan==="Pro"?GD:"#2563eb",padding:"2px 8px",borderRadius:6,fontSize:11,fontWeight:700}}>{co.meta.plan}</span></td>
              <td style={{fontWeight:600}}>
                <input type="number" defaultValue={co.meta.maxUsers} min="1" max="500"
                  onBlur={async e=>{
                    const val=parseInt(e.target.value)||5;
                    if(SB_ENABLED){await supabase.from("companies").update({max_users:val}).eq("id",co.meta.id);}
                    else{setDB(p=>({...p,[co.meta.id]:{...p[co.meta.id],meta:{...p[co.meta.id].meta,maxUsers:val}}}));}
                    toast("Max users updated");
                  }}
                  style={{width:60,padding:"4px 7px",border:`1.5px solid ${BDR}`,borderRadius:6,fontSize:12,textAlign:"center",fontWeight:700}}
                />
              </td>
              <td><Badge s={co.meta.status}/></td>
              <td style={{color:MUTED,fontSize:11}}>{co.meta.createdOn}</td>
              <td><div style={{display:"flex",gap:6}}>
                <Btn v="outline" onClick={()=>setMdl({type:"editCo",data:co.meta})} style={{padding:"4px 9px",fontSize:11}}>✏ Edit</Btn>
                <Btn v={co.meta.status==="Active"?"warning":"primary"} onClick={()=>toggleStatus(co)} style={{padding:"4px 9px",fontSize:11}}>{co.meta.status==="Active"?"Suspend":"Activate"}</Btn>
                <Btn v="danger" onClick={()=>setMdl({type:"delCo",data:co.meta})} style={{padding:"4px 9px",fontSize:11}}>✕</Btn>
              </div></td>
            </tr>
          ))}</tbody>
        </table></Card>}
        {tab==="users"&&<SaUsers DB={DB} userCounts={userCounts}/>}
        {tab==="billing"&&<SaBilling allCo={allCo} DB={DB} userCounts={userCounts}/>}
        {tab==="audit"&&<SaAudit DB={DB}/>}
        {tab==="help"&&<HelpManual userRole="superadmin" onClose={()=>setTab("companies")} inline={true}/>}
      </div>
      {/* Create Company Modal */}
      {modal?.type==="newCo"&&(
        <div style={{position:"fixed",inset:0,background:"#00000060",display:"flex",alignItems:"center",justifyContent:"center",zIndex:500,backdropFilter:"blur(3px)"}} onClick={()=>setMdl(null)}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:18,padding:30,width:560,maxHeight:"85vh",overflow:"auto",boxShadow:"0 24px 60px #0003"}}>
            <h3 style={{fontFamily:FD,fontSize:18,fontWeight:700,color:INK,marginBottom:16}}>Create New Company</h3>
            {SB_ENABLED&&<div style={{background:"#dbeafe",border:"1px solid #93c5fd",borderRadius:9,padding:"9px 13px",marginBottom:14,fontSize:12,color:"#1d4ed8"}}>ℹ️ The admin will receive a confirmation email from Supabase. They must verify their email before logging in.</div>}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
              {[["Company Name *","name","text","Acme Corp"],["Industry","industry","text","Finance"],["Max Users *","maxUsers","number","5"]].map(([l,k,t,ph])=>(
                <div key={k}><label style={{fontSize:10,color:MUTED,fontWeight:700,display:"block",marginBottom:4,textTransform:"uppercase"}}>{l}</label><input type={t} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} placeholder={ph} style={inpS}/></div>
              ))}
              <div><label style={{fontSize:10,color:MUTED,fontWeight:700,display:"block",marginBottom:4,textTransform:"uppercase"}}>Plan</label><select value={form.plan} onChange={e=>setForm({...form,plan:e.target.value})} style={{...inpS,appearance:"none"}}>{["Starter","Pro","Enterprise"].map(p=><option key={p}>{p}</option>)}</select></div>
            </div>
            <div style={{background:GL,borderRadius:10,padding:"12px 14px",marginBottom:12}}>
              <div style={{fontSize:10,fontWeight:700,color:GD,marginBottom:8,textTransform:"uppercase"}}>Admin Account</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:9}}>
                {[["Admin Name","adminName","text","Full name"],["Email *","adminEmail","email","admin@co.in"],["Password *","adminPw","password","min 8 chars"]].map(([l,k,t,ph])=>(
                  <div key={k}><label style={{fontSize:9,color:MUTED,fontWeight:700,display:"block",marginBottom:3,textTransform:"uppercase"}}>{l}</label><input type={t} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} placeholder={ph} style={inpS}/></div>
                ))}
              </div>
            </div>
            <div style={{display:"flex",gap:9}}><Btn onClick={createCo} style={{flex:1,padding:12}}>Create →</Btn><Btn v="outline" onClick={()=>setMdl(null)}>Cancel</Btn></div>
          </div>
        </div>
      )}
      {modal?.type==="editCo"&&<EditCoModal data={modal.data} onClose={()=>setMdl(null)} onSave={async(updates)=>{if(SB_ENABLED){await supabase.from("companies").update({name:updates.name,industry:updates.industry,plan:updates.plan,max_users:updates.maxUsers}).eq("id",updates.id);const{data}=await supabase.from("companies").select("*");if(data)setSbCoList(data.map(c=>({meta:{id:c.id,name:c.name,industry:c.industry,plan:c.plan,maxUsers:c.max_users,status:c.status,createdOn:c.created_on},users:[]})));}else{setDB(p=>({...p,[updates.id]:{...p[updates.id],meta:{...p[updates.id].meta,...updates}}}));}setMdl(null);toast("✓ Company updated");}}/>}
      {modal?.type==="delCo"&&(
        <div style={{position:"fixed",inset:0,background:"#00000060",display:"flex",alignItems:"center",justifyContent:"center",zIndex:500}} onClick={()=>setMdl(null)}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:16,padding:28,width:360,textAlign:"center"}}>
            <div style={{fontSize:34,marginBottom:8}}>⚠️</div>
            <div style={{fontFamily:FD,fontSize:17,fontWeight:700,color:INK,marginBottom:6}}>Delete {modal.data.name}?</div>
            <div style={{color:MUTED,fontSize:13,marginBottom:18}}>All data permanently deleted. This cannot be undone.</div>
            <div style={{display:"flex",gap:9,justifyContent:"center"}}><Btn v="danger" onClick={()=>deleteCo(modal.data.id)}>Yes, Delete</Btn><Btn v="outline" onClick={()=>setMdl(null)}>Cancel</Btn></div>
          </div>
        </div>
      )}
    </div>
  );
}

function SaUsers({DB,userCounts}){
  const allUsers=SB_ENABLED?[]:(Object.values(DB).flatMap(co=>co.users.map(u=>({...u,coName:co.meta.name}))));
  const[sbUsers,setSbUsers]=useState([]);
  const[editUser,setEditUser]=useState(null);
  const[editForm,setEditForm]=useState({name:"",role:"employee",dept:"",balance:0});
  useEffect(()=>{if(!SB_ENABLED)return;supabase.from("users").select("*,companies(name)").then(({data})=>{if(data)setSbUsers(data);});},[]);
  const rows=SB_ENABLED?sbUsers:allUsers;

  const openEdit=u=>{setEditUser(u);setEditForm({name:u.name,role:u.role,dept:u.dept,balance:u.balance||0});};
  const saveEdit=async()=>{
    if(SB_ENABLED){await supabase.from("users").update({name:editForm.name,role:editForm.role,dept:editForm.dept,balance:editForm.balance}).eq("id",editUser.id);const{data}=await supabase.from("users").select("*,companies(name)");if(data)setSbUsers(data);}
    setEditUser(null);
  };
  const inpS2={padding:"8px 11px",border:`1.5px solid ${BDR}`,borderRadius:8,fontSize:13,background:"#fafff8",fontFamily:FB,width:"100%"};

  return(<>
    <Card><table style={{width:"100%"}}><thead><tr><th>Name</th><th>Email</th><th>Company</th><th>Role</th><th>Dept</th><th>Balance</th><th>Edit</th></tr></thead>
      <tbody>{rows.map(u=><tr key={u.id} className="rh">
        <td><div style={{display:"flex",alignItems:"center",gap:7}}><div style={{width:28,height:28,borderRadius:"50%",background:GL,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,color:GD,fontSize:10}}>{u.avatar||inits(u.name)}</div><span style={{fontWeight:600,fontSize:13}}>{u.name}</span></div></td>
        <td style={{color:MUTED,fontSize:12}}>{u.email}</td>
        <td style={{fontSize:11}}>{u.coName||(u.companies?.name)||u.company_id||""}</td>
        <td style={{textTransform:"capitalize",color:MUTED,fontSize:12}}>{u.role}</td>
        <td style={{color:MUTED,fontSize:12}}>{u.dept}</td>
        <td style={{fontSize:12,fontWeight:600}}>₹{Number(u.balance||0).toLocaleString("en-IN")}</td>
        <td><Btn v="outline" onClick={()=>openEdit(u)} style={{padding:"3px 8px",fontSize:11}}>✏</Btn></td>
      </tr>)}</tbody>
    </table></Card>
    {editUser&&(
      <div style={{position:"fixed",inset:0,background:"#00000060",display:"flex",alignItems:"center",justifyContent:"center",zIndex:600,backdropFilter:"blur(3px)"}} onClick={()=>setEditUser(null)}>
        <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:16,padding:28,width:420,boxShadow:"0 24px 60px #0003"}}>
          <h3 style={{fontFamily:FD,fontSize:17,fontWeight:700,color:INK,marginBottom:16}}>Edit User — {editUser.email}</h3>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11,marginBottom:12}}>
            <div><label style={{fontSize:10,color:MUTED,fontWeight:700,display:"block",marginBottom:4,textTransform:"uppercase"}}>Name</label><input value={editForm.name} onChange={e=>setEditForm({...editForm,name:e.target.value})} style={inpS2}/></div>
            <div><label style={{fontSize:10,color:MUTED,fontWeight:700,display:"block",marginBottom:4,textTransform:"uppercase"}}>Department</label><select value={editForm.dept} onChange={e=>setEditForm({...editForm,dept:e.target.value})} style={{...inpS2,appearance:"none"}}>{DEPTS.map(d=><option key={d}>{d}</option>)}</select></div>
            <div><label style={{fontSize:10,color:MUTED,fontWeight:700,display:"block",marginBottom:4,textTransform:"uppercase"}}>Role</label><select value={editForm.role} onChange={e=>setEditForm({...editForm,role:e.target.value})} style={{...inpS2,appearance:"none"}}>{ROLES.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}</select></div>
            <div><label style={{fontSize:10,color:MUTED,fontWeight:700,display:"block",marginBottom:4,textTransform:"uppercase"}}>Wallet Balance ₹</label><input type="number" value={editForm.balance} onChange={e=>setEditForm({...editForm,balance:parseFloat(e.target.value)||0})} style={inpS2}/></div>
          </div>
          <div style={{display:"flex",gap:9}}><Btn onClick={saveEdit} style={{flex:1,padding:11}}>Save Changes</Btn><Btn v="outline" onClick={()=>setEditUser(null)}>Cancel</Btn></div>
        </div>
      </div>
    )}
  </>);
}
function SaBilling({allCo,DB,userCounts}){
  return(<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
    {allCo.map(co=>{const emps=SB_ENABLED?(userCounts[co.meta.id]||0):(DB[co.meta.id]?.users?.filter(u=>u.role==="employee").length||0);const tier=TIERED.find(t=>emps>=t.min&&emps<=t.max)||TIERED[0];return(
      <Card key={co.meta.id} style={{padding:20}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><div><div style={{fontWeight:700,color:INK}}>{co.meta.name}</div><div style={{fontSize:11,color:MUTED}}>{emps} employees</div></div><span style={{fontFamily:FD,fontSize:18,fontWeight:700,color:G}}>{fmt(emps*tier.ppu)}/mo</span></div></Card>
    );})}
    <Card style={{padding:20}}><div style={{fontFamily:FD,fontSize:13,fontWeight:700,color:INK,marginBottom:12}}>Pricing Tiers</div>
      <table style={{width:"100%"}}><thead><tr><th>Users</th><th>₹/user/mo</th></tr></thead><tbody>{TIERED.map(t=><tr key={t.min}><td style={{fontWeight:600,fontSize:12}}>{t.min}–{t.max===999?"50+":t.max}</td><td style={{color:GD,fontWeight:700,fontSize:12}}>{fmt(t.ppu)}</td></tr>)}</tbody></table>
    </Card>
  </div>);
}
function SaAudit({DB}){
  const[rows,setRows]=useState([]);
  useEffect(()=>{
    if(SB_ENABLED){supabase.from("audit_log").select("*,companies(name)").order("created_at",{ascending:false}).limit(500).then(({data})=>{if(data)setRows(data);});}
    else{setRows(Object.values(DB).flatMap(co=>(co.auditLog||[]).map(a=>({...a,coName:co.meta.name}))));}
  },[]);
  return(<Card><table style={{width:"100%"}}><thead><tr><th>Time</th><th>Company</th><th>Action</th><th>Claim ID</th><th>By</th><th>Remarks</th></tr></thead>
    <tbody>{rows.map(a=><tr key={a.id} className="rh"><td style={{fontSize:10,color:MUTED,fontFamily:"monospace"}}>{a.at||new Date(a.created_at).toLocaleString()}</td><td style={{fontSize:11}}>{a.coName||(a.companies?.name)||a.company_id||""}</td><td><Badge s={a.action?.includes("Approved")?"Approved":"Rejected"} sm/></td><td style={{fontFamily:"monospace",fontSize:11,color:GD,fontWeight:600}}>{a.claimId||a.claim_id}</td><td style={{fontWeight:600,fontSize:12}}>{a.byName||a.by_name}</td><td style={{color:MUTED,fontSize:11}}>{a.remarks||"—"}</td></tr>)}</tbody>
  </table></Card>);
}

// ─── CAMERA MODAL ─────────────────────────────────────────────────────────────
function CameraModal({onCapture,onClose}){
  const vidRef=useRef(null);
  const cnvRef=useRef(null);
  const [stream,setStream]=useState(null);
  const [captured,setCaptured]=useState(null);
  const [camErr,setCamErr]=useState("");
  const [facing,setFacing]=useState("environment");

  const startCam=useCallback(async(f)=>{
    if(stream){stream.getTracks().forEach(t=>t.stop());}
    try{
      const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:f,width:{ideal:1920},height:{ideal:1080}}});
      setStream(s);
      if(vidRef.current){vidRef.current.srcObject=s;vidRef.current.play();}
      setCamErr("");
    }catch(e){setCamErr("Camera unavailable. Use file upload below.");}
  },[]);

  useEffect(()=>{startCam(facing);return()=>{if(stream)stream.getTracks().forEach(t=>t.stop());};},[]);

  const flip=()=>{const nf=facing==="environment"?"user":"environment";setFacing(nf);startCam(nf);};
  const capture=()=>{
    if(!vidRef.current||!cnvRef.current)return;
    const v=vidRef.current,c=cnvRef.current;
    c.width=v.videoWidth;c.height=v.videoHeight;
    c.getContext("2d").drawImage(v,0,0);
    setCaptured(c.toDataURL("image/jpeg",0.92));
    if(stream)stream.getTracks().forEach(t=>t.stop());
  };
  const confirm=()=>{
    if(!captured)return;
    onCapture({url:captured,b64:captured.split(",")[1],type:"image/jpeg",name:`cam_${Date.now()}.jpg`});
    onClose();
  };

  return(
    <div style={{position:"fixed",inset:0,background:"#000",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:900}}>
      <div style={{width:"100%",maxWidth:520,padding:20,display:"flex",flexDirection:"column",alignItems:"center",gap:12}}>
        <div style={{display:"flex",justifyContent:"space-between",width:"100%"}}>
          <span style={{color:"#fff",fontFamily:FB,fontWeight:700,fontSize:15}}>📷 Capture Receipt</span>
          <button onClick={()=>{if(stream)stream.getTracks().forEach(t=>t.stop());onClose();}} style={{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:8,color:"#fff",padding:"5px 12px",fontFamily:FB,fontSize:12,cursor:"pointer"}}>✕ Close</button>
        </div>
        {camErr&&(
          <div style={{width:"100%",background:"#fee2e2",color:"#dc2626",padding:"10px 14px",borderRadius:9,fontSize:13,textAlign:"center"}}>
            {camErr}
            <div style={{marginTop:10}}>
              <label style={{padding:"8px 16px",background:G,borderRadius:8,color:"#fff",fontFamily:FB,fontWeight:600,fontSize:13,cursor:"pointer"}}>
                📁 Browse Files
                <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>{
                  const f=e.target.files[0];if(!f)return;
                  const r=new FileReader();r.onload=ev=>{onCapture({url:ev.target.result,b64:ev.target.result.split(",")[1],type:f.type,name:f.name});onClose();};r.readAsDataURL(f);
                }}/>
              </label>
            </div>
          </div>
        )}
        {!camErr&&!captured&&(
          <>
            <div style={{position:"relative",width:"100%",aspectRatio:"4/3",background:"#111",borderRadius:12,overflow:"hidden"}}>
              <video ref={vidRef} autoPlay playsInline muted style={{width:"100%",height:"100%",objectFit:"cover"}}/>
              <div style={{position:"absolute",inset:"10%",border:"2px solid rgba(126,217,87,.7)",borderRadius:8,pointerEvents:"none"}}>
                <div style={{position:"absolute",top:-1,left:-1,width:18,height:18,borderTop:`3px solid ${G}`,borderLeft:`3px solid ${G}`,borderRadius:"3px 0 0 0"}}/>
                <div style={{position:"absolute",top:-1,right:-1,width:18,height:18,borderTop:`3px solid ${G}`,borderRight:`3px solid ${G}`,borderRadius:"0 3px 0 0"}}/>
                <div style={{position:"absolute",bottom:-1,left:-1,width:18,height:18,borderBottom:`3px solid ${G}`,borderLeft:`3px solid ${G}`,borderRadius:"0 0 0 3px"}}/>
                <div style={{position:"absolute",bottom:-1,right:-1,width:18,height:18,borderBottom:`3px solid ${G}`,borderRight:`3px solid ${G}`,borderRadius:"0 0 3px 0"}}/>
              </div>
              <div style={{position:"absolute",bottom:10,left:0,right:0,textAlign:"center",color:"rgba(255,255,255,.6)",fontSize:11}}>Align receipt within frame</div>
            </div>
            <canvas ref={cnvRef} style={{display:"none"}}/>
            <div style={{display:"flex",gap:12,width:"100%"}}>
              <button onClick={flip} style={{flex:1,padding:"11px",background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.2)",borderRadius:9,color:"#fff",fontFamily:FB,fontSize:13,cursor:"pointer"}}>🔄 Flip</button>
              <button onClick={capture} style={{flex:2,padding:"11px",background:G,border:"none",borderRadius:9,color:"#fff",fontFamily:FB,fontWeight:700,fontSize:15,cursor:"pointer",boxShadow:`0 4px 20px ${G}60`}}>📸 Capture</button>
            </div>
          </>
        )}
        {captured&&(
          <>
            <img src={captured} alt="preview" style={{width:"100%",maxHeight:360,objectFit:"contain",borderRadius:12,border:`2px solid ${G}`}}/>
            <div style={{display:"flex",gap:12,width:"100%"}}>
              <button onClick={()=>{setCaptured(null);startCam(facing);}} style={{flex:1,padding:"11px",background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.2)",borderRadius:9,color:"#fff",fontFamily:FB,fontSize:13,cursor:"pointer"}}>🔄 Retake</button>
              <button onClick={confirm} style={{flex:2,padding:"11px",background:G,border:"none",borderRadius:9,color:"#fff",fontFamily:FB,fontWeight:700,fontSize:15,cursor:"pointer"}}>✓ Use This Photo</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── RECEIPT LIGHTBOX ─────────────────────────────────────────────────────────
function Lightbox({receipt,onClose}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.9)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:900}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{maxWidth:"90vw",maxHeight:"85vh",display:"flex",flexDirection:"column",alignItems:"center",gap:12}}>
        {receipt.type?.startsWith("image/")
          ?<img src={receipt.url} alt={receipt.name||"receipt"} style={{maxWidth:"88vw",maxHeight:"78vh",borderRadius:10,objectFit:"contain",boxShadow:"0 8px 40px #000a"}}/>
          :<div style={{background:"#fff",borderRadius:12,padding:28,textAlign:"center"}}><div style={{fontSize:48}}>📄</div><div style={{fontFamily:FB,fontSize:14,color:INK,marginTop:8}}>{receipt.name||"Document"}</div><div style={{fontSize:11,color:MUTED,marginTop:4}}>PDF — use download to open</div></div>
        }
        <div style={{display:"flex",gap:10}}>
          <a href={receipt.url} download={receipt.name||"receipt"} style={{padding:"9px 18px",background:G,borderRadius:9,color:"#fff",fontFamily:FB,fontWeight:700,fontSize:13,textDecoration:"none"}}>⬇ Download</a>
          <button onClick={onClose} style={{padding:"9px 18px",background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.2)",borderRadius:9,color:"#fff",fontFamily:FB,fontSize:13,cursor:"pointer"}}>✕ Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── PROFILE SETTINGS ─────────────────────────────────────────────────────────
function Profile({user,users,setUsers,onLogout,updateUserInSB}){
  const [form,setForm]=useState({name:user.name,email:user.email,dept:user.dept});
  const [pw,setPw]=useState({cur:"",nw:"",cf:""});
  const [pwErr,setPwErr]=useState("");
  const [saved,setSaved]=useState(false);
  const role=ROLES.find(r=>r.id===user.role)||ROLES[1];
  const inpS={width:"100%",padding:"10px 12px",border:`1.5px solid ${BDR}`,borderRadius:9,fontSize:13,background:"#fafff8"};

  const save=async()=>{
    if(!form.name||!form.email)return;
    if(updateUserInSB){try{await updateUserInSB(user.id,{name:form.name,dept:form.dept});}catch(e){return;}}
    setUsers(p=>p.map(u=>u.id===user.id?{...u,name:form.name,email:form.email,dept:form.dept,avatar:inits(form.name)}:u));
    setSaved(true);setTimeout(()=>setSaved(false),2000);
  };
  const changePw=async()=>{
    setPwErr("");
    if(pw.nw.length<6){setPwErr("Must be at least 6 characters");return;}
    if(pw.nw!==pw.cf){setPwErr("Passwords do not match");return;}
    if(SB_ENABLED&&supabase){
      const{error}=await supabase.auth.updateUser({password:pw.nw});
      if(error){setPwErr(error.message);return;}
    } else {
      const u=users.find(x=>x.id===user.id);
      if(!u||u.password!==pw.cur){setPwErr("Current password incorrect");return;}
      setUsers(p=>p.map(u=>u.id===user.id?{...u,password:pw.nw}:u));
    }
    setPw({cur:"",nw:"",cf:""});setPwErr("✓ Password updated");
  };

  return(
    <div style={{maxWidth:520,display:"flex",flexDirection:"column",gap:14}}>
      <h1 style={{fontFamily:FD,fontSize:20,fontWeight:700,color:INK}}>My Profile</h1>
      <Card style={{padding:20,display:"flex",alignItems:"center",gap:16}}>
        <div style={{width:60,height:60,borderRadius:"50%",background:`linear-gradient(135deg,${G},${GD})`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:"#fff",fontSize:20,flexShrink:0}}>{inits(form.name)}</div>
        <div><div style={{fontFamily:FD,fontSize:17,fontWeight:700,color:INK}}>{form.name}</div><div style={{fontSize:12,color:MUTED,marginTop:2}}>{form.email}</div><span style={{display:"inline-block",marginTop:5,background:role.color+"20",color:role.color,padding:"2px 9px",borderRadius:10,fontSize:11,fontWeight:700}}>{role.label}</span></div>
      </Card>
      <Card style={{padding:20}}>
        <div style={{fontFamily:FD,fontSize:13,fontWeight:700,color:INK,marginBottom:12}}>Edit Profile</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11,marginBottom:11}}>
          <div><label style={{fontSize:10,fontWeight:700,color:MUTED,display:"block",marginBottom:4,textTransform:"uppercase"}}>Full Name</label><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} style={inpS}/></div>
          <div><label style={{fontSize:10,fontWeight:700,color:MUTED,display:"block",marginBottom:4,textTransform:"uppercase"}}>Email</label><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} style={inpS}/></div>
        </div>
        <div style={{marginBottom:14}}><label style={{fontSize:10,fontWeight:700,color:MUTED,display:"block",marginBottom:4,textTransform:"uppercase"}}>Department</label>
          <select value={form.dept} onChange={e=>setForm({...form,dept:e.target.value})} style={{...inpS,appearance:"none",paddingRight:28}}>{DEPTS.map(d=><option key={d}>{d}</option>)}</select>
        </div>
        <Btn onClick={save} style={{padding:"9px 18px"}}>{saved?"✓ Saved!":"Save Changes"}</Btn>
      </Card>
      <Card style={{padding:20}}>
        <div style={{fontFamily:FD,fontSize:13,fontWeight:700,color:INK,marginBottom:12}}>Change Password</div>
        {[["Current","cur"],["New Password","nw"],["Confirm","cf"]].map(([l,k])=>(
          <div key={k} style={{marginBottom:11}}><label style={{fontSize:10,fontWeight:700,color:MUTED,display:"block",marginBottom:4,textTransform:"uppercase"}}>{l}</label><input type="password" value={pw[k]} onChange={e=>setPw({...pw,[k]:e.target.value})} style={inpS}/></div>
        ))}
        {pwErr&&<div style={{fontSize:12,marginBottom:9,color:pwErr.startsWith("✓")?"#16a34a":"#dc2626"}}>{pwErr}</div>}
        <Btn onClick={changePw} style={{padding:"9px 18px"}}>Update Password</Btn>
      </Card>
      <Card style={{padding:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><div style={{fontWeight:600,color:INK,fontSize:13}}>Sign Out</div><div style={{fontSize:11,color:MUTED}}>Sign out of this device</div></div>
        <Btn v="danger" onClick={onLogout} style={{padding:"8px 16px",fontSize:12}}>Sign Out</Btn>
      </Card>
    </div>
  );
}

// ─── COMPANY APP ──────────────────────────────────────────────────────────────
function CompanyApp({user,meta,DB,setDB,onLogout,sbReload}){
  const cid=meta?.id||"";

  // ── Data source: Supabase or localStorage ────────────────────────────────
  const[coData,setCoData]=useState(SB_ENABLED?null:(cid&&DB[cid]?DB[cid]:null));
  const[loadingData,setLoadingData]=useState(SB_ENABLED&&!!cid);
  const[sbError,setSbError]=useState(null);

  const loadFromSB=useCallback(async()=>{
    if(!SB_ENABLED||!cid)return;
    try{
      setLoadingData(true);setSbError(null);
      const data=await sbLoadCompany(cid);
      if(!data?.meta){
        setSbError("Company not found. Your account may not be fully set up yet.");
        return;
      }
      setCoData(data);
      // Also refresh edit requests after company data loads
      if(SB_ENABLED){
        const{data:erData}=await supabase.from("edit_requests").select("*").eq("company_id",cid).order("created_at",{ascending:false});
        if(erData)setEditRequests(erData);
      }
    }catch(e){setSbError(e.message);}
    finally{setLoadingData(false);}
  },[cid]);

  useEffect(()=>{
    if(!cid){setSbError("No company assigned to your account.");setLoadingData(false);return;}
    if(SB_ENABLED)loadFromSB();
    else setCoData(DB[cid]);
  },[cid]);

  useEffect(()=>{
    if(!SB_ENABLED&&cid)setCoData(DB[cid]);
  },[DB,cid]);

  // ── Supabase realtime subscription ───────────────────────────────────────
  useEffect(()=>{
    if(!SB_ENABLED||!cid)return;
    const channel=supabase.channel(`co:${cid}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"claims",filter:`company_id=eq.${cid}`},()=>loadFromSB())
      .on("postgres_changes",{event:"*",schema:"public",table:"notifications",filter:`company_id=eq.${cid}`},()=>loadFromSB())
      .on("postgres_changes",{event:"*",schema:"public",table:"topups",filter:`company_id=eq.${cid}`},()=>loadFromSB())
      .subscribe();
    return()=>supabase.removeChannel(channel);
  },[cid,loadFromSB]);

  // ── Local scoped setters (localStorage mode only) ─────────────────────────
  const set=(key,fn)=>setDB(p=>({...p,[cid]:{...p[cid],[key]:fn(p[cid][key])}}));
  const setUsers  =fn=>{set("users",fn);};
  const setClaims =fn=>{set("claims",fn);};
  const setTrips  =fn=>{set("trips",fn);};
  const setTopups =fn=>{set("topups",fn);};
  const setAudit  =fn=>{set("auditLog",fn);};
  const setNotifs =fn=>{set("notifications",fn);};
  const setPolicy =fn=>setDB(p=>({...p,[cid]:{...p[cid],policy:typeof fn==="function"?fn(p[cid].policy):fn}}));

  const[tab,setTab]      =useState("dashboard");
  const[sidebar,setSB]   =useState(true);
  const[notif,setNtf]    =useState(null);
  const[modal,setMdl]    =useState(null);
  const[showCam,setSCam] =useState(false);
  const[showProf,setSPro]=useState(false);
  const[showHelp,setSHelp]=useState(false);
  const[camFile,setCamF] =useState(null);
  const[editRequests,setEditRequests]=useState([]);
  const{queue,online,enqueue,flush}=useOffline();
  const{perm:pushPerm,ask:askPush,send:sendPush}=usePush();

  // toast must be defined before any useEffect that calls it
  const toast=(msg,t="success")=>{setNtf({msg,t});setTimeout(()=>setNtf(null),3200);};

  useEffect(()=>{if(typeof Notification!=="undefined"&&Notification.permission==="default")askPush();},[]);
  useEffect(()=>{
    if(online&&queue.length>0){
      flush(async item=>{
        if(item.type==="claim"){
          if(SB_ENABLED){try{await supabase.from("claims").insert(item.sbRow);}catch(e){console.error(e);}}
          else setClaims(p=>[item.data,...p]);
        }
      });
      toast(`✓ ${queue.length} offline claim(s) synced`);
    }
  },[online]);

  // Push notification on load — guarded so it only fires when co exists
  useEffect(()=>{
    if(!coData)return;
    const n=coData.claims.filter(c=>c.status==="Pending").length;
    const canApproveCheck=["manager","approver"].includes(user.role);
    if(n>0&&canApproveCheck)sendPush("ClaimX",`${n} claim${n!==1?"s":""} await your approval`);
  },[!!coData]);

  // ── ALL hooks above this line — early return is safe below ───────────────
  const co=coData;

  // Dynamic policy-driven values
  const primaryColor=co?.policy?.primaryColor||G;
  const companyDepts=co?.policy?.departments||DEFAULT_DEPTS;

  if(loadingData||!co)return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f5faf3",fontFamily:FB}}>
      <div style={{textAlign:"center",maxWidth:400,padding:24}}>
        {sbError?(
          <>
            <div style={{fontSize:44,marginBottom:16}}>⚠️</div>
            <div style={{fontFamily:FD,fontSize:20,fontWeight:700,color:INK,marginBottom:8}}>Account not fully set up</div>
            <p style={{color:MUTED,fontSize:14,lineHeight:1.6,marginBottom:8}}>{sbError}</p>
            <p style={{color:MUTED,fontSize:13,lineHeight:1.6,marginBottom:20}}>
              If you just verified your email, please ask your Super Admin to confirm your account is active in the system.
            </p>
            <div style={{display:"flex",gap:10,justifyContent:"center"}}>
              <Btn onClick={loadFromSB}>🔄 Try Again</Btn>
              <Btn v="outline" onClick={onLogout}>← Sign Out</Btn>
            </div>
          </>
        ):(
          <>
            <div style={{width:40,height:40,border:`3px solid ${GM}`,borderTopColor:G,borderRadius:"50%",animation:"spin .8s linear infinite",margin:"0 auto 14px"}}/>
            <div style={{color:MUTED,fontSize:13}}>Loading your workspace…</div>
            <button onClick={onLogout} style={{marginTop:16,background:"none",border:"none",color:MUTED,fontSize:12,cursor:"pointer",fontFamily:FB}}>← Sign out</button>
          </>
        )}
      </div>
    </div>
  );

  const getUser=id=>co.users.find(u=>u.id===id);
  // Use co.meta (loaded from Supabase) as the authoritative source — it has correct maxUsers etc.
  const activeMeta=SB_ENABLED&&co.meta?co.meta:meta;
  const myRole=ROLES.find(r=>r.id===user.role)||ROLES[1];
  const hasPerm=p=>myRole.perms.includes(p);
  const isManager=["manager","approver","finance"].includes(user.role);
  const canApprove=["manager","approver"].includes(user.role);
  const myUser=co.users.find(u=>u.id===user.id);
  const myNotifs=(co.notifications||[]).filter(n=>n.userId===user.id&&!n.read);
  const pendingClaims=co.claims.filter(c=>c.status==="Pending");
  const pendingTopups=co.topups.filter(t=>t.status==="Pending");

  // ── Helpers ───────────────────────────────────────────────────────────────
  const sbPushNotif=async(toUserId,text,type="info")=>{
    if(SB_ENABLED){
      await supabase.from("notifications").insert({company_id:cid,user_id:toUserId,text,type,read:false});
    } else {
      setNotifs(p=>[{id:"N-"+uid(),userId:toUserId,text,type,read:false,time:new Date().toLocaleString()},...(p||[])]);
    }
  };
  const sbAddAudit=async(action,claimId,remarks="")=>{
    if(SB_ENABLED){
      await supabase.from("audit_log").insert({company_id:cid,action,claim_id:claimId,by_user_id:user.id,by_name:user.name,remarks});
    } else {
      setAudit(p=>[{id:"AL-"+uid(),action,claimId,by:user.id,byName:user.name,at:new Date().toLocaleString(),remarks},...(p||[])]);
    }
  };
  const markRead=async()=>{
    if(SB_ENABLED){
      await supabase.from("notifications").update({read:true}).eq("company_id",cid).eq("user_id",user.id).eq("read",false);
      loadFromSB();
    } else {
      setNotifs(p=>(p||[]).map(n=>n.userId===user.id?{...n,read:true}:n));
    }
  };

  // ── Edit Request handlers ──────────────────────────────────────────────────
  const loadEditRequests=async()=>{
    if(!SB_ENABLED){return;}
    const{data}=await supabase.from("edit_requests").select("*").eq("company_id",cid).order("created_at",{ascending:false});
    if(data)setEditRequests(data);
  };

  const submitEditRequest=async(claim,reason)=>{
    const req={company_id:cid,claim_id:claim.id,requested_by:user.id,requester_name:user.name,reason,status:"Pending"};
    if(SB_ENABLED){
      await supabase.from("edit_requests").insert(req);
      // Notify managers
      const mgr=co.users.find(u=>u.role==="manager");
      if(mgr)await sbPushNotif(mgr.id,`Edit request for ${claim.id} from ${user.name}: "${reason}"`,"warn");
      await loadEditRequests();
    } else {
      setEditRequests(p=>[{...req,id:uid(),createdAt:new Date().toISOString()},...p]);
    }
    toast("✓ Edit request submitted — awaiting manager approval");
  };

  const approveEditRequest=async(req)=>{
    const expires=new Date(Date.now()+24*60*60*1000).toISOString(); // 24h window
    if(SB_ENABLED){
      await supabase.from("edit_requests").update({status:"Approved",reviewed_by:user.id,reviewer_name:user.name,window_open:true,window_expires:expires}).eq("id",req.id);
      // Notify employee
      await sbPushNotif(req.requested_by,`Your edit request for ${req.claim_id} was approved. You have 24 hours to edit.`,"success");
      await loadEditRequests();
    } else {
      setEditRequests(p=>p.map(r=>r.id===req.id?{...r,status:"Approved",reviewerName:user.name,windowOpen:true,windowExpires:expires}:r));
    }
    toast("✓ Edit window opened for 24 hours");
  };

  const rejectEditRequest=async(req)=>{
    if(SB_ENABLED){
      await supabase.from("edit_requests").update({status:"Rejected",reviewed_by:user.id,reviewer_name:user.name}).eq("id",req.id);
      await sbPushNotif(req.requested_by,`Your edit request for ${req.claim_id} was rejected.`,"error");
      await loadEditRequests();
    } else {
      setEditRequests(p=>p.map(r=>r.id===req.id?{...r,status:"Rejected",reviewerName:user.name}:r));
    }
    toast("Edit request rejected");
  };

  // Check if claim has an approved edit window open
  const hasEditWindow=(claimId)=>{
    const req=editRequests.find(r=>(r.claim_id||r.claimId)===claimId&&r.status==="Approved"&&(r.window_open||r.windowOpen));
    if(!req)return false;
    const expires=new Date(req.window_expires||req.windowExpires||0);
    return expires>new Date();
  };

  const catSpend=(empId,tripId,cat)=>co.claims.filter(c=>c.empId===empId&&c.tripId===tripId&&c.category===cat&&c.status!=="Rejected").reduce((s,c)=>s+c.amount,0);
  const tripSpend=(empId,tripId)=>co.claims.filter(c=>c.empId===empId&&c.tripId===tripId&&c.status!=="Rejected").reduce((s,c)=>s+c.amount,0);

  const detectAnomaly=(form,amount)=>{
    const reasons=[];
    if(form.vendor){const dup=co.claims.find(c=>c.vendor===form.vendor&&c.amount===amount&&c.date===form.date);if(dup)reasons.push("Possible duplicate — same vendor, amount, date");}
    const prev=co.claims.filter(c=>c.category===form.category&&c.status==="Approved").map(c=>c.amount);
    if(prev.length>2){const avg=prev.reduce((a,b)=>a+b)/prev.length;if(amount>avg*2.5)reasons.push(`Amount is 2.5× avg for ${form.category}`);}
    return{isAnomaly:reasons.length>0,reasons};
  };

  const submitClaim=async(form)=>{
    const amount=parseFloat(form.amount);
    const tripId=form.tripId||co.trips.find(t=>t.status==="active"&&(!t.assignedTo||t.assignedTo.includes(user.id)))?.id;
    if(!tripId){toast("No active trip assigned","error");return;}
    const claimDate=form.date||today();
    // Validate claim date is within trip date range
    if(tripId){
      const selectedTrip=co.trips.find(t=>t.id===tripId);
      if(selectedTrip?.startDate&&selectedTrip?.endDate){
        if(claimDate<selectedTrip.startDate||claimDate>selectedTrip.endDate){
          toast(`Expense date ${claimDate} is outside trip range (${selectedTrip.startDate} to ${selectedTrip.endDate})`,"error");
          return;
        }
      }
    }
    const weekend=co.policy.weekendRequiresApproval&&isWknd(claimDate);
    const noRcpt=co.policy.receiptMandatoryAbove>0&&amount>co.policy.receiptMandatoryAbove&&(!form.receipts||!form.receipts.length);
    const vLow=(form.vendor||"").toLowerCase();
    if(co.policy.vendorBlacklist?.some(v=>vLow.includes(v.toLowerCase()))){toast(`Vendor "${form.vendor}" is blacklisted`,"error");return;}
    const catEx=(()=>{
      const cur=co.claims.filter(c=>c.empId===user.id&&c.tripId===tripId&&c.category===form.category&&c.status!=="Rejected").reduce((s,c)=>s+c.amount,0);
      const tot=co.claims.filter(c=>c.empId===user.id&&c.tripId===tripId&&c.status!=="Rejected").reduce((s,c)=>s+c.amount,0)+amount;
      const nc=cur+amount;
      const al=co.policy.categoryPct[form.category]||100;
      return tot>0&&(nc/tot)*100>al;
    })();
    const auto=!catEx&&!weekend&&!noRcpt&&amount<=co.policy.autoApproveLimit;
    const{isAnomaly,reasons}=detectAnomaly(form,amount);
    const claimId="EXP-"+uid();

    const claimData={id:claimId,tripId,empId:user.id,date:claimDate,category:form.category,desc:form.desc,amount,origAmount:parseFloat(form.origAmount||amount),origCur:form.currency||"INR",status:auto?"Approved":"Pending",autoApproved:auto,receipts:form.receipts||[],remarks:auto?"Auto-approved":"",flagged:catEx,anomaly:isAnomaly,anomalyReasons:reasons,comments:[],vendor:form.vendor||"",weekendFlag:weekend,notes:form.notes||""};

    if(!online){
      if(SB_ENABLED){
        const sbRow={id:claimId,company_id:cid,trip_id:tripId,emp_id:user.id,date:claimDate,category:form.category,description:form.desc,vendor:form.vendor||"",amount,orig_amount:parseFloat(form.origAmount||amount),orig_currency:form.currency||"INR",status:auto?"Approved":"Pending",auto_approved:auto,remarks:auto?"Auto-approved":"",flagged:catEx,anomaly:isAnomaly,anomaly_reasons:reasons,weekend_flag:weekend,notes:form.notes||""};
        enqueue({type:"claim",data:claimData,sbRow});
      } else {
        enqueue({type:"claim",data:claimData});
      }
      toast("📴 Saved offline — will sync when connected","warn");
      return;
    }

    if(SB_ENABLED){
      // ── Supabase write path ──────────────────────────────────────────────
      const{error:claimErr}=await supabase.from("claims").insert({
        id:claimId,company_id:cid,trip_id:tripId,emp_id:user.id,
        date:claimDate,category:form.category,description:form.desc,
        vendor:form.vendor||"",amount,orig_amount:parseFloat(form.origAmount||amount),
        orig_currency:form.currency||"INR",status:auto?"Approved":"Pending",
        auto_approved:auto,remarks:auto?"Auto-approved":"",flagged:catEx,
        anomaly:isAnomaly,anomaly_reasons:reasons,weekend_flag:weekend,notes:form.notes||"",
      });
      if(claimErr){toast(claimErr.message,"error");return;}

      // Upload receipts to Supabase Storage
      for(const r of(form.receipts||[])){
        if(r.b64){
          try{await sbUploadReceipt(claimId,cid,r.b64,r.type,r.name);}
          catch(e){console.warn("Receipt upload failed:",e.message);}
        }
      }

      // Update trip spent + user balance via Supabase
      if(auto){
        await supabase.from("trips").update({spent:co.trips.find(t=>t.id===tripId)?.spent+amount||amount}).eq("id",tripId);
        if(!co.policy.reimbursementMode)await supabase.from("users").update({balance:Math.max(0,(myUser?.balance||0)-amount)}).eq("id",user.id);
        else await supabase.from("users").update({reimbursable:(myUser?.reimbursable||0)+amount}).eq("id",user.id);
        await sbAddAudit("Auto-Approved",claimId,"Under limit");
        toast("⚡ Auto-approved instantly!");
      } else {
        const approverId=user.delegateTo||co.users.find(u=>["manager","approver"].includes(u.role)&&u.id!==user.id)?.id;
        if(approverId)await sbPushNotif(approverId,`New claim ${claimId} from ${user.name} awaiting approval`,"info");
        toast(weekend?"⚠️ Weekend → manager":noRcpt?"⚠️ Receipt required":isAnomaly?"🔍 Anomaly flagged":catEx?"⚠️ Category % exceeded":"Claim submitted");
      }
      await loadFromSB();
    } else {
      // ── localStorage write path ──────────────────────────────────────────
      setClaims(p=>[claimData,...p]);
      if(!co.policy.reimbursementMode&&auto)setUsers(p=>p.map(u=>u.id===user.id?{...u,balance:Math.max(0,(u.balance||0)-amount)}:u));
      if(co.policy.reimbursementMode&&auto)setUsers(p=>p.map(u=>u.id===user.id?{...u,reimbursable:(u.reimbursable||0)+amount}:u));
      setTrips(p=>p.map(t=>t.id===tripId?{...t,spent:t.spent+(auto?amount:0)}:t));
      if(auto){setAudit(p=>[{id:"AL-"+uid(),action:"Auto-Approved",claimId,by:user.id,byName:user.name,at:new Date().toLocaleString(),remarks:"Under limit"},...(p||[])]);toast("⚡ Auto-approved instantly!");}
      else{const approverId=user.delegateTo||co.users.find(u=>["manager","approver"].includes(u.role)&&u.id!==user.id)?.id;if(approverId)sbPushNotif(approverId,`New claim ${claimId} from ${user.name} awaiting approval`,"info");toast(weekend?"⚠️ Weekend → manager":noRcpt?"⚠️ Receipt required":isAnomaly?"🔍 Anomaly flagged":catEx?"⚠️ Category % exceeded":"Claim submitted");}
    }
    setMdl(null);
  };

  const handleDecision=async(claimId,decision,remarks="")=>{
    const claim=co.claims.find(c=>c.id===claimId);
    if(!claim)return;
    if(SB_ENABLED){
      await supabase.from("claims").update({status:decision,remarks:remarks||decision}).eq("id",claimId);
      if(decision==="Approved"){
        if(!co.policy.reimbursementMode)await supabase.from("users").update({balance:Math.max(0,(co.users.find(u=>u.id===claim.empId)?.balance||0)-claim.amount)}).eq("id",claim.empId);
        else await supabase.from("users").update({reimbursable:(co.users.find(u=>u.id===claim.empId)?.reimbursable||0)+claim.amount}).eq("id",claim.empId);
        await supabase.from("trips").update({spent:(co.trips.find(t=>t.id===claim.tripId)?.spent||0)+claim.amount}).eq("id",claim.tripId);
      }
      await sbAddAudit(decision,claimId,remarks);
      await sbPushNotif(claim.empId,`Your claim ${claimId} was ${decision.toLowerCase()}${remarks?": "+remarks:""}`,decision==="Approved"?"success":"error");
      sendPush(decision==="Approved"?"✓ Claim Approved":"✗ Claim Rejected",`${fmt(claim.amount)} — ${claim.desc}`);
      emailAlert(getUser(claim.empId)?.email||"",`Claim ${decision} — ClaimX`,`${claimId} for ${fmt(claim.amount)} has been ${decision.toLowerCase()}.${remarks?" Remarks: "+remarks:""}`);
      await loadFromSB();
    } else {
      setClaims(p=>p.map(c=>c.id===claimId?{...c,status:decision,remarks:remarks||decision}:c));
      if(decision==="Approved"){
        if(!co.policy.reimbursementMode)setUsers(p=>p.map(u=>u.id===claim.empId?{...u,balance:Math.max(0,(u.balance||0)-claim.amount)}:u));
        else setUsers(p=>p.map(u=>u.id===claim.empId?{...u,reimbursable:(u.reimbursable||0)+claim.amount}:u));
        setTrips(p=>p.map(t=>t.id===claim.tripId?{...t,spent:t.spent+claim.amount}:t));
      }
      sbPushNotif(claim.empId,`Your claim ${claimId} was ${decision.toLowerCase()}${remarks?": "+remarks:""}`,decision==="Approved"?"success":"error");
      setAudit(p=>[{id:"AL-"+uid(),action:decision,claimId,by:user.id,byName:user.name,at:new Date().toLocaleString(),remarks},...(p||[])]);
      sendPush(decision==="Approved"?"✓ Claim Approved":"✗ Rejected",`${fmt(claim.amount)} — ${claim.desc}`);
      emailAlert(getUser(claim.empId)?.email||"",`Claim ${decision}`,`${claimId} ${decision.toLowerCase()}.`);
    }
    toast(decision==="Approved"?"✓ Approved":"Rejected",decision==="Approved"?"success":"error");
    setMdl(null);
  };

  const handleTopup=async(req,decision)=>{
    if(SB_ENABLED){
      await supabase.from("topups").update({status:decision}).eq("id",req.id);
      if(decision==="Approved")await supabase.from("users").update({balance:(co.users.find(u=>u.id===req.empId)?.balance||0)+req.amount}).eq("id",req.empId);
      await sbPushNotif(req.empId,`Top-up ${decision.toLowerCase()}${decision==="Approved"?": "+fmt(req.amount):""}`,decision==="Approved"?"success":"error");
      await loadFromSB();
    } else {
      setTopups(p=>p.map(t=>t.id===req.id?{...t,status:decision}:t));
      if(decision==="Approved")setUsers(p=>p.map(u=>u.id===req.empId?{...u,balance:(u.balance||0)+req.amount}:u));
      sbPushNotif(req.empId,`Top-up ${decision.toLowerCase()}${decision==="Approved"?": "+fmt(req.amount):""}`,decision==="Approved"?"success":"error");
    }
    toast(decision==="Approved"?`✓ Top-up approved`:"Rejected",decision==="Approved"?"success":"error");
    setMdl(null);
  };

  const closeTrip=async(tripId)=>{
    if(SB_ENABLED){await supabase.from("trips").update({status:"closed"}).eq("id",tripId);await loadFromSB();}
    else setTrips(p=>p.map(t=>t.id===tripId?{...t,status:"closed"}:t));
    toast("Trip closed");
  };

  const savePolicyToSB=async(newPolicy)=>{
    if(SB_ENABLED){
      await supabase.from("policy").upsert({company_id:cid,auto_approve_limit:newPolicy.autoApproveLimit,reimbursement_mode:newPolicy.reimbursementMode,receipt_mandatory_above:newPolicy.receiptMandatoryAbove,weekend_requires_approval:newPolicy.weekendRequiresApproval,multi_level_approval:newPolicy.multiLevelApproval,approval_levels:newPolicy.approvalLevels,vendor_whitelist:newPolicy.vendorWhitelist,vendor_blacklist:newPolicy.vendorBlacklist,department_budgets:newPolicy.departmentBudgets,category_pct:newPolicy.categoryPct,scheduled_reports:newPolicy.scheduledReports});
      await loadFromSB();
    }
  };

  const setCoPolicy=async(fn)=>{
    const newPol=typeof fn==="function"?fn(co.policy):fn;
    if(SB_ENABLED){setCoData(p=>({...p,policy:newPol}));}
    else setPolicy(()=>newPol);
  };

  const addUserToSB=async(userData,password)=>{
    if(!SB_ENABLED)return null;
    // Use create_employee RPC — bypasses Supabase Auth signUp entirely
    const{data,error}=await supabase.rpc("create_employee",{
      p_company_id: cid,
      p_name:       userData.name,
      p_username:   userData.username||(userData.name.toLowerCase().replace(/\s+/g,".")),
      p_password:   password,
      p_role:       userData.role||"employee",
      p_dept:       userData.dept||"Operations",
      p_balance:    userData.balance||0,
      p_email:      userData.email||null,
      p_mobile:     userData.mobile||null,
    });
    if(error)throw new Error(error.message);
    if(data?.error)throw new Error(data.error);
    await loadFromSB();
    return data?.id||null;
  };

  const updateUserInSB=async(userId,patch)=>{
    if(!SB_ENABLED)return;
    const targetUser=co.users.find(u=>u.id===userId);
    if(targetUser?.authType==="custom"||targetUser?.auth_type==="custom"){
      // Custom employee — use RPC
      const{error}=await supabase.rpc("update_employee",{
        p_user_id:   userId,
        p_name:      patch.name??null,
        p_role:      patch.role??null,
        p_dept:      patch.dept??null,
        p_balance:   patch.balance??null,
        p_suspended: patch.isSuspended??null,
        p_password:  patch.password??null,
        p_mobile:    patch.mobile??null,
      });
      if(error)throw new Error(error.message);
    } else {
      // Supabase Auth user — update users table directly
      const dbPatch={};
      if(patch.name!==undefined)       dbPatch.name=patch.name;
      if(patch.balance!==undefined)    dbPatch.balance=patch.balance;
      if(patch.dept!==undefined)       dbPatch.dept=patch.dept;
      if(patch.role!==undefined)       dbPatch.role=patch.role;
      if(patch.delegateTo!==undefined) dbPatch.delegate_to=patch.delegateTo;
      if(patch.isSuspended!==undefined)dbPatch.is_suspended=patch.isSuspended;
      await supabase.from("users").update(dbPatch).eq("id",userId);
    }
    await loadFromSB();
  };

  const addCommentToSB=async(claimId,text)=>{
    if(SB_ENABLED){
      await supabase.from("claim_comments").insert({claim_id:claimId,user_id:user.id,user_name:user.name,text});
      await loadFromSB();
    } else {
      // handled inline in ClaimModal
    }
  };

  // Exports
  const exportCSV=()=>{
    const rows=[["ID","Date","Employee","Dept","Vendor","Trip","Category","Description","Orig Amt","Orig Cur","INR Amt","Status","Auto","Anomaly","Remarks"]];
    co.claims.forEach(c=>{const e=getUser(c.empId);const t=co.trips.find(tr=>tr.id===c.tripId);rows.push([c.id,c.date,e?.name||"",e?.dept||"",c.vendor||"",t?.name||"",c.category,c.desc,c.origAmount||c.amount,c.origCur||"INR",c.amount,c.status,c.autoApproved?"Yes":"No",c.anomaly?"Yes":"No",c.remarks]);});
    const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download=`ClaimX_${cid}_${today()}.csv`;a.click();toast("📊 CSV exported");
  };
  const exportTally=()=>{
    const xml=`<?xml version="1.0" encoding="UTF-8"?>\n<ENVELOPE>\n  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>\n  <BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME></REQUESTDESC><REQUESTDATA>\n`+co.claims.filter(c=>c.status==="Approved").map(c=>{const e=getUser(c.empId);return`    <TALLYMESSAGE xmlns:UDF="TallyUDF"><VOUCHER VCHTYPE="Payment" ACTION="Create"><DATE>${c.date.replace(/-/g,"")}</DATE><NARRATION>${c.desc} - ${e?.name||""}</NARRATION><VOUCHERTYPENAME>Payment</VOUCHERTYPENAME><ALLLEDGERENTRIES.LIST><LEDGERNAME>${c.category}</LEDGERNAME><AMOUNT>-${c.amount}</AMOUNT></ALLLEDGERENTRIES.LIST></VOUCHER></TALLYMESSAGE>`;}).join("\n")+`\n  </REQUESTDATA></IMPORTDATA></BODY>\n</ENVELOPE>`;
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([xml],{type:"text/xml"}));a.download=`Tally_${cid}_${today()}.xml`;a.click();toast("📊 Tally XML exported");
  };
  const exportGSTR=()=>{
    const rows=[["GSTIN Supplier","Invoice No","Date","Value","Rate","Taxable","IGST","Category","Employee"]];
    co.claims.filter(c=>c.status==="Approved"&&c.notes?.includes("GSTIN")).forEach(c=>{const gstin=c.notes.match(/GSTIN:\s*([A-Z0-9]{15})/)?.[1]||"";const inv=c.notes.match(/Invoice:\s*([^\s|]+)/)?.[1]||"";const e=getUser(c.empId);const taxable=Math.round(c.amount/1.18);const igst=c.amount-taxable;rows.push([gstin,inv,c.date,c.amount,18,taxable,igst,c.category,e?.name||""]);});
    const csv=rows.map(r=>r.map(v=>`"${v}"`).join(",")).join("\n");
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download=`GSTR2A_${cid}_${today()}.csv`;a.click();toast("📊 GSTR-2A exported");
  };
  const exportZoho=()=>{
    const rows=[["ExpenseID","Date","MerchantName","Category","Amount","Currency","Description","ReimbursableExpense","EmployeeEmail"]];
    co.claims.filter(c=>c.status==="Approved").forEach(c=>{const e=getUser(c.empId);rows.push([c.id,c.date,c.vendor||c.desc,c.category,c.amount,"INR",c.desc,co.policy.reimbursementMode?"true":"false",e?.email||""]);});
    const csv=rows.map(r=>r.map(v=>`"${v}"`).join(",")).join("\n");
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download=`ZohoBooks_${cid}_${today()}.csv`;a.click();toast("📊 Zoho Books exported");
  };

  // ── SAP Export (FI-compatible CSV for journal entry upload) ──────────────
  const exportSAP=()=>{
    const month=new Date().toISOString().slice(0,7);
    // SAP FI format: posting date, document type, GL account, cost center, amount, text
    const rows=[
      ["Posting Date","Document Type","Company Code","Currency","GL Account","Cost Center","Profit Center","Amount","Tax Code","Reference","Assignment","Text","Employee","Vendor","Category","Trip"]
    ];
    co.claims.filter(c=>c.status==="Approved").forEach(c=>{
      const e=getUser(c.empId);
      const glMap={Travel:"40100001","Meals":"40100002","Accommodation":"40100003","Office Supplies":"40100004","Client Entertainment":"40100005","Software":"40100006","Training":"40100007","Miscellaneous":"40100009"};
      const gl=glMap[c.category]||"40100009";
      const costCenter=`CC_${(e?.dept||"OPS").toUpperCase().replace(/\s+/g,"_").slice(0,8)}`;
      rows.push([
        c.date.replace(/-/g,"/"),  // Posting date
        "KR",                       // Vendor invoice document type
        cid.toUpperCase().slice(0,4)||"CMPN", // Company code
        c.origCur||"INR",           // Currency
        gl,                         // GL Account
        costCenter,                 // Cost Center
        `PC_${(e?.dept||"OPS").slice(0,4).toUpperCase()}`, // Profit Center
        c.amount.toFixed(2),        // Amount
        c.origCur==="INR"?"V5":"V0",// Tax code
        c.id,                       // Reference document
        c.tripId||"",              // Assignment (trip)
        `${c.category}: ${c.desc}`.slice(0,50), // Text (max 50)
        e?.name||"",               // Employee name
        c.vendor||"",              // Vendor
        c.category,                // Category
        co.trips.find(t=>t.id===c.tripId)?.name||"", // Trip name
      ]);
    });
    // Also create balance sheet entry for employee payable
    const totalPayable=co.claims.filter(c=>c.status==="Approved"&&co.policy.reimbursementMode).reduce((s,c)=>s+c.amount,0);
    if(totalPayable>0){
      rows.push([today().replace(/-/g,"/"),"SA","CMPN","INR","20100001","","",totalPayable.toFixed(2),"","BAL_CTRL","","Employee Expense Payable "+month,"System","","",""]);}

    const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"})); // BOM for SAP
    a.download=`SAP_FI_${cid}_${month}.csv`;
    a.click();
    toast("📊 SAP FI export ready — import via SAP FB50/FAGLL03");
  };

  // ── Monthly digest + override summary for finance ────────────────────────
  const exportMonthlyDigest=()=>{
    const month=new Date().toISOString().slice(0,7);
    const approved=co.claims.filter(c=>c.status==="Approved");
    const overrides=editRequests.filter(r=>r.status==="Approved");
    const byDept={};
    approved.forEach(c=>{const e=getUser(c.empId);const d=e?.dept||"Unknown";byDept[d]=(byDept[d]||0)+c.amount;});
    const w=window.open("","_blank");
    w.document.write(`<!DOCTYPE html><html><head><title>ClaimX Monthly Digest ${month}</title>
    <style>body{font-family:sans-serif;max-width:800px;margin:30px auto;color:#111;font-size:13px}
    h1{font-size:20px;color:#0f1c09}h2{font-size:14px;margin:20px 0 8px;color:#5CB83A;border-bottom:2px solid #e8f0e5;padding-bottom:4px}
    table{width:100%;border-collapse:collapse;margin:10px 0}th{background:#f0fde9;padding:7px 10px;font-size:11px;text-align:left}
    td{padding:7px 10px;border-bottom:1px solid #f3f4f6;font-size:12px}.total{font-weight:700;color:#16a34a}
    .warn{background:#fef3c7;color:#92400e;padding:8px 12px;border-radius:6px;margin:8px 0;font-size:12px}
    .footer{font-size:10px;color:#9ca3af;margin-top:20px;border-top:1px solid #f3f4f6;padding-top:10px}</style></head><body>
    <h1>📊 ClaimX Monthly Digest — ${month}</h1>
    <p style="color:#6b7280">Company: ${activeMeta.name} · Generated: ${new Date().toLocaleString("en-IN")}</p>
    <h2>Summary</h2>
    <table><tr><th>Metric</th><th>Value</th></tr>
    <tr><td>Total Claims</td><td>${approved.length}</td></tr>
    <tr><td>Total Approved Amount</td><td class="total">₹${approved.reduce((s,c)=>s+c.amount,0).toLocaleString("en-IN")}</td></tr>
    <tr><td>Pending Claims</td><td>${co.claims.filter(c=>c.status==="Pending").length}</td></tr>
    <tr><td>Edit Overrides (Approved)</td><td style="color:${overrides.length>0?"#dc2626":"#16a34a"}">${overrides.length}</td></tr>
    </table>
    <h2>Spend by Department</h2>
    <table><tr><th>Department</th><th>Amount</th></tr>
    ${Object.entries(byDept).sort((a,b)=>b[1]-a[1]).map(([d,a])=>`<tr><td>${d}</td><td>₹${a.toLocaleString("en-IN")}</td></tr>`).join("")}
    </table>
    ${overrides.length>0?`<h2>⚠ Edit Overrides (Audit Trail)</h2>
    ${overrides.length>0?'<div class="warn">'+overrides.length+' expense edit(s) were approved by managers this period. See detail below.</div>':''}
    <table><tr><th>Claim ID</th><th>Requested By</th><th>Approved By</th><th>Reason</th><th>Date</th></tr>
    ${overrides.map(r=>`<tr><td>${r.claim_id||r.claimId}</td><td>${r.requester_name||r.requesterName}</td><td>${r.reviewer_name||r.reviewerName||"—"}</td><td>${r.reason}</td><td>${r.created_at?new Date(r.created_at).toLocaleDateString("en-IN"):""}</td></tr>`).join("")}
    </table>`:""}
    <div class="footer">ClaimX by RB · This digest should be reviewed by the Finance team. All override entries require supporting justification.</div>
    </body></html>`);
    w.document.close();w.print();
  };

  const printSummary=(claims,empUser,trip)=>{
    const approved=claims.filter(c=>c.status==="Approved");const total=approved.reduce((s,c)=>s+c.amount,0);
    const w=window.open("","_blank");
    w.document.write(`<html><head><title>Expense Summary</title><style>body{font-family:sans-serif;max-width:640px;margin:40px auto;color:#1a2e12}h1{font-size:22px}h2{font-size:13px;color:#6b7280;font-weight:400;margin-bottom:20px}table{width:100%;border-collapse:collapse;margin:14px 0}th{background:#f0fde9;padding:8px 12px;font-size:11px;text-align:left;text-transform:uppercase;color:#5CB83A}td{padding:8px 12px;border-bottom:1px solid #e8f0e5;font-size:12px}.tot{text-align:right;font-size:18px;font-weight:700;color:#7ED957;padding:12px;background:#f0fde9;border-radius:8px;margin-top:12px}</style></head><body><h1>ClaimX — Expense Summary</h1><h2>${empUser?.name||""} · ${trip?trip.name:"All Trips"} · ${new Date().toLocaleDateString("en-IN")}</h2><table><tr><th>Date</th><th>Description</th><th>Category</th><th>Vendor</th><th>Amount</th></tr>${approved.map(c=>`<tr><td>${c.date}</td><td>${c.desc}</td><td>${c.category}</td><td>${c.vendor||"—"}</td><td>₹${c.amount.toLocaleString("en-IN")}</td></tr>`).join("")}</table><div class="tot">Total: ₹${total.toLocaleString("en-IN")}</div><p style="font-size:10px;color:#9ca3af;margin-top:20px">ClaimX by RB · ${new Date().toISOString()}</p></body></html>`);
    w.document.close();w.print();
  };

  const navItems=[
    {id:"dashboard",icon:"▦",  label:"Dashboard"},
    {id:"claims",   icon:"📋", label:isManager?"All Claims":"My Claims"},
    ...(hasPerm("submit")?[{id:"submit",icon:"＋",label:"New Expense"}]:[]),
    {id:"trips",    icon:"🗂️", label:"Trips / Periods"},
    ...(canApprove?[{id:"approvals",icon:"✓",label:"Approvals",badge:pendingClaims.length+pendingTopups.length}]:[{id:"topup",icon:"💰",label:"Top-up"}]),
    ...(canApprove&&editRequests.filter(r=>r.status==="Pending").length>0?[{id:"editreqs",icon:"✏️",label:"Edit Requests",badge:editRequests.filter(r=>r.status==="Pending").length}]:[]),
    {id:"analytics",icon:"📊", label:"Analytics"},
    {id:"inbox",    icon:"🔔", label:"Inbox",badge:myNotifs.length},
    {id:"audit",    icon:"🗒️", label:"Audit Log"},
    ...(hasPerm("manage_employees")?[{id:"employees",icon:"👥",label:"Employees"},{id:"policy",icon:"⚙️",label:"Policy"}]:[]),
    {id:"help",     icon:"❓", label:"Help"},
  ];

  return(
    <div style={{display:"flex",minHeight:"100vh",fontFamily:FB,background:"#f5faf3"}}>
      <style>{GLSTYLE}</style>
      {notif&&<div style={{position:"fixed",top:20,right:20,zIndex:1000,padding:"12px 18px",borderRadius:12,fontWeight:600,fontSize:13,background:notif.t==="error"?"#fee2e2":notif.t==="warn"?"#fef3c7":"#dcfce7",color:notif.t==="error"?"#dc2626":notif.t==="warn"?"#92400e":"#15803d",boxShadow:"0 4px 20px #0002",maxWidth:320}}>{notif.msg}</div>}
      {!online&&<div style={{position:"fixed",bottom:0,left:0,right:0,background:"#92400e",color:"#fef3c7",textAlign:"center",padding:"7px",fontSize:12,fontWeight:600,zIndex:999}}>📴 Offline — claims queued ({queue.length}) · will sync when connected</div>}
      {showHelp&&<HelpManual userRole={user.role} onClose={()=>setSHelp(false)}/>}
      {showCam&&<CameraModal onCapture={f=>{setCamF(f);setSCam(false);setTab("submit");}} onClose={()=>setSCam(false)}/>}
      {showProf&&(
        <div style={{position:"fixed",inset:0,background:"#00000060",zIndex:800,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setSPro(false)}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#f5faf3",borderRadius:16,padding:28,width:580,maxHeight:"90vh",overflow:"auto",boxShadow:"0 20px 60px #0003"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <span style={{fontFamily:FD,fontSize:17,fontWeight:700,color:INK}}>Profile & Settings</span>
              <button onClick={()=>setSPro(false)} style={{background:"none",border:"none",fontSize:16,cursor:"pointer",color:MUTED}}>✕</button>
            </div>
            <Profile user={user} users={co.users} setUsers={fn=>{if(!SB_ENABLED)setUsers(fn);}} onLogout={onLogout} updateUserInSB={updateUserInSB}/>
          </div>
        </div>
      )}

      {/* SIDEBAR — desktop only */}
      <div className="mob-hide" style={{width:sidebar?222:60,background:DARK,display:"flex",flexDirection:"column",padding:sidebar?"20px 12px":"20px 8px",position:"sticky",top:0,height:"100vh",overflow:"hidden",transition:"width .22s ease",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:sidebar?"space-between":"center",marginBottom:14,minHeight:48}}>
          {sidebar&&<div style={{overflow:"hidden",width:140}}><Logo width={140} dark/></div>}
          <button onClick={()=>setSB(!sidebar)} style={{width:26,height:26,borderRadius:7,background:"rgba(255,255,255,.07)",border:"1px solid rgba(255,255,255,.1)",color:"rgba(255,255,255,.4)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,flexShrink:0}}>{sidebar?"◀":"▶"}</button>
        </div>
        {sidebar&&<div style={{background:"rgba(255,255,255,.06)",borderRadius:8,padding:"7px 10px",marginBottom:10}}><div style={{fontSize:9,color:G,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:1}}>Workspace</div><div style={{color:"#fff",fontSize:11,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{activeMeta.name}</div></div>}
        {sidebar&&<div style={{background:co.policy.reimbursementMode?"#1e3a5f":"#1a3510",border:`1px solid ${co.policy.reimbursementMode?"#3b82f6":G}`,borderRadius:7,padding:"4px 9px",marginBottom:6,fontSize:9,fontWeight:600,color:co.policy.reimbursementMode?"#93c5fd":G}}>{co.policy.reimbursementMode?"💳 Reimbursement Mode":"💼 Balance Mode"}</div>}
        
        <nav style={{display:"flex",flexDirection:"column",gap:2,overflow:"auto",flex:1}}>
          {navItems.map(item=>(
            <button key={item.id} onClick={()=>setTab(item.id)} title={!sidebar?item.label:""}
              style={{display:"flex",alignItems:"center",gap:sidebar?8:0,padding:sidebar?"9px 11px":"9px 0",justifyContent:sidebar?"flex-start":"center",borderRadius:8,cursor:"pointer",border:"none",fontFamily:FB,fontSize:12,fontWeight:tab===item.id?600:400,background:tab===item.id?primaryColor:"transparent",color:tab===item.id?"#fff":"rgba(255,255,255,.5)",transition:"all .15s",width:"100%",position:"relative"}}>
              <span style={{fontSize:14,width:17,textAlign:"center",flexShrink:0}}>{item.icon}</span>
              {sidebar&&<span style={{flex:1,whiteSpace:"nowrap",overflow:"hidden"}}>{item.label}</span>}
              {sidebar&&item.badge>0&&<span style={{background:"#ef4444",color:"#fff",fontSize:9,padding:"1px 5px",borderRadius:10,fontWeight:700}}>{item.badge}</span>}
              {!sidebar&&item.badge>0&&<span style={{position:"absolute",top:3,right:3,width:7,height:7,background:"#ef4444",borderRadius:"50%"}}/>}
            </button>
          ))}
        </nav>
        <div style={{paddingTop:10,borderTop:"1px solid rgba(255,255,255,.08)"}}>
          {sidebar?(
            <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:7,cursor:"pointer"}} onClick={()=>setSPro(true)}>
              <div style={{width:28,height:28,borderRadius:"50%",background:canApprove?G:"#334155",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:10,flexShrink:0}}>{user.avatar}</div>
              <div style={{overflow:"hidden"}}><div style={{color:"#fff",fontSize:11,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{user.name.split(" ")[0]}</div><div style={{color:"rgba(255,255,255,.35)",fontSize:9,textTransform:"capitalize"}}>{user.role}</div></div>
            </div>
          ):(
            <div style={{display:"flex",justifyContent:"center",marginBottom:7}} onClick={()=>setSPro(true)}>
              <div style={{width:26,height:26,borderRadius:"50%",background:canApprove?G:"#334155",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:9,cursor:"pointer"}}>{user.avatar}</div>
            </div>
          )}
          <button onClick={onLogout} style={{width:"100%",padding:"6px",background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:6,color:"rgba(255,255,255,.35)",fontFamily:FB,fontSize:10,cursor:"pointer"}}>{sidebar?"Sign Out":"↩"}</button>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{flex:1,padding:"16px 18px",overflow:"auto",minWidth:0,paddingBottom:72}} className="fin">
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,paddingBottom:12,borderBottom:`1px solid ${BDR}`}}>
          <div style={{display:"flex",alignItems:"center",gap:9}}>
            <div style={{width:30,height:30,borderRadius:8,background:GL,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:GD,fontSize:11}}>{inits(activeMeta.name)}</div>
            <div><div style={{fontWeight:700,color:INK,fontSize:14}}>{activeMeta.name}</div><div style={{fontSize:10,color:MUTED}}>{activeMeta.industry} · {activeMeta.plan} Plan{user.delegateTo?` · Delegating→${getUser(user.delegateTo)?.name}`:""}</div></div>
          </div>
          <div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap"}}>
            {hasPerm("export")&&<>
              <Btn v="outline" onClick={exportCSV}   style={{fontSize:10,padding:"5px 8px"}} className="mob-hide">⬇ CSV</Btn>
              <Btn v="outline" onClick={exportTally} style={{fontSize:10,padding:"5px 8px"}} className="mob-hide">⬇ Tally</Btn>
              <Btn v="outline" onClick={exportGSTR}  style={{fontSize:10,padding:"5px 8px"}} className="mob-hide">⬇ GSTR</Btn>
              <Btn v="outline" onClick={exportZoho}  style={{fontSize:10,padding:"5px 8px"}} className="mob-hide">⬇ Zoho</Btn>
              <Btn v="dark"    onClick={exportSAP}   style={{fontSize:10,padding:"5px 8px"}} className="mob-hide">⬇ SAP</Btn>
              {isManager&&<Btn v="outline" onClick={exportMonthlyDigest} style={{fontSize:10,padding:"5px 8px"}} className="mob-hide">📊 Digest</Btn>}
            </>}
            <button onClick={()=>setSCam(true)} title="Camera" style={{background:"none",border:`1px solid ${BDR}`,borderRadius:8,padding:"6px 9px",cursor:"pointer",fontSize:13}}>📷</button>
            <button onClick={()=>{setTab("inbox");markRead();}} style={{position:"relative",background:"none",border:`1px solid ${BDR}`,borderRadius:8,padding:"6px 9px",cursor:"pointer",fontSize:13}}>🔔{myNotifs.length>0&&<span style={{position:"absolute",top:-4,right:-4,width:16,height:16,background:"#ef4444",borderRadius:"50%",color:"#fff",fontSize:9,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>{myNotifs.length}</span>}</button>
            <button onClick={()=>setSHelp(true)} style={{background:"none",border:`1px solid ${BDR}`,borderRadius:8,padding:"6px 9px",cursor:"pointer",fontSize:13}}>❓</button>
            {SB_ENABLED&&<button onClick={loadFromSB} style={{background:"none",border:`1px solid ${BDR}`,borderRadius:8,padding:"6px 9px",cursor:"pointer",fontSize:13}}>🔄</button>}
          </div>
        </div>

        {/* TABS */}
        {tab==="dashboard" &&!isManager&&<EmpDash  user={user} myUser={myUser} co={co} setTab={setTab}/>}
        {tab==="dashboard" && isManager&&<MgrDash  co={co} meta={activeMeta} setTab={setTab} getUser={getUser}/>}
        {tab==="claims"              &&<ClaimsTab claims={isManager?co.claims:co.claims.filter(c=>c.empId===user.id)} trips={co.trips} isManager={isManager} getUser={getUser} setMdl={setMdl} submitEditRequest={submitEditRequest} hasEditWindow={hasEditWindow} userId={user.id}/>}
        {tab==="submit" &&hasPerm("submit")&&<SubmitTab user={user} co={co} submitClaim={submitClaim} camFile={camFile} clearCamFile={()=>setCamF(null)} onCam={()=>setSCam(true)}/>}
        {tab==="trips"               &&<TripsTab trips={co.trips} setTrips={fn=>{if(!SB_ENABLED)setTrips(fn);}} claims={co.claims} isManager={isManager} getUser={getUser} users={co.users} closeTrip={closeTrip} toast={toast} uid={user.id} sbCreateTrip={async(trip,assigned)=>{if(SB_ENABLED){await supabase.from("trips").insert({id:trip.id,company_id:cid,name:trip.name,type:trip.type,start_date:trip.startDate,end_date:trip.endDate,status:"active",budget:trip.budget,spent:0});if(assigned?.length)await supabase.from("trip_assignments").insert(assigned.map(uid=>({trip_id:trip.id,user_id:uid})));await loadFromSB();}}}/>}
        {tab==="approvals"&&canApprove&&<>
          <ApprovalsTab pendingClaims={pendingClaims} pendingTopups={pendingTopups} getUser={getUser} trips={co.trips} handleDecision={handleDecision} handleTopup={handleTopup} setMdl={setMdl}/>
          {editRequests.length>0&&<Card style={{padding:16,marginTop:16}}>
            <div style={{fontFamily:FD,fontSize:14,fontWeight:700,color:INK,marginBottom:12}}>✏ Edit Requests {editRequests.filter(r=>r.status==="Pending").length>0&&<span style={{background:"#fef3c7",color:"#92400e",fontSize:11,padding:"1px 7px",borderRadius:10,marginLeft:7,fontFamily:FB}}>{editRequests.filter(r=>r.status==="Pending").length} pending</span>}</div>
            <EditRequestsPanel editRequests={editRequests} claims={co.claims} getUser={getUser} cid={cid} toast={toast} sbEnabled={SB_ENABLED} onApprove={approveEditRequest} onReject={rejectEditRequest}/>
          </Card>}
        </>}
        {tab==="topup"   &&!canApprove&&<TopupTab user={user} topups={co.topups.filter(t=>t.empId===user.id)} setTopups={fn=>{if(!SB_ENABLED)setTopups(fn);}} toast={toast} sbCreateTopup={async(req)=>{if(SB_ENABLED){await supabase.from("topups").insert({id:req.id,company_id:cid,emp_id:req.empId,amount:req.amount,reason:req.reason,date:req.date,status:"Pending"});await loadFromSB();}}}/>}
        {tab==="analytics"           &&<Analytics claims={isManager?co.claims:co.claims.filter(c=>c.empId===user.id)} trips={co.trips} users={co.users} isManager={isManager} getUser={getUser} policy={co.policy} printSummary={printSummary} user={user}/>}
        {tab==="inbox"               &&<Inbox notifications={(co.notifications||[]).filter(n=>n.userId===user.id)} setNotifs={fn=>{if(!SB_ENABLED)setNotifs(fn);}} userId={user.id}/>}
        {tab==="audit"               &&<Audit auditLog={co.auditLog||[]} claims={co.claims} getUser={getUser}/>}
        {tab==="editreqs"            &&<EditRequestsTab editRequests={editRequests} claims={co.claims} getUser={getUser} isManager={canApprove} approveEditRequest={approveEditRequest} rejectEditRequest={rejectEditRequest} submitEditRequest={submitEditRequest} hasEditWindow={hasEditWindow} userId={user.id}/>}
        {tab==="employees"&&hasPerm("manage_employees")&&<Employees companyMeta={activeMeta} users={co.users} setUsers={fn=>{if(!SB_ENABLED)setUsers(fn);}} claims={co.claims} policy={co.policy} toast={toast} addUserToSB={addUserToSB} updateUserInSB={updateUserInSB} sbEnabled={SB_ENABLED} companyDepts={companyDepts}/>}
        {tab==="policy"  &&hasPerm("manage_employees")&&<Policy policy={co.policy} setPolicy={setCoPolicy} savePolicy={savePolicyToSB} toast={toast} users={co.users} sbEnabled={SB_ENABLED}/>}
        {tab==="help"                &&<HelpManual userRole={user.role} onClose={()=>setTab("dashboard")} inline={true}/>}
      </div>

      {modal?.type==="editRequest"&&<EditRequestModal claim={modal.data} userId={user.id} userName={user.name} cid={cid} onClose={()=>setMdl(null)} onSubmit={submitEditRequest} sbEnabled={SB_ENABLED}/>}
      {modal&&modal.type!=="editRequest"&&<ClaimModal modal={modal} setMdl={setMdl} handleDecision={handleDecision} getUser={getUser} trips={co.trips} claims={co.claims} setClaims={fn=>{if(!SB_ENABLED)setClaims(fn);}} userId={user.id} userName={user.name} addCommentToSB={addCommentToSB} sbEnabled={SB_ENABLED} cid={cid} editRequests={editRequests} onEditRequest={submitEditRequest} onApproveEditRequest={approveEditRequest} onRejectEditRequest={rejectEditRequest}/>}

      {/* MOBILE BOTTOM NAV */}
      <div style={{display:"none",position:"fixed",bottom:0,left:0,right:0,background:DARK,borderTop:"1px solid rgba(255,255,255,.1)",padding:"6px 0 10px",zIndex:100,justifyContent:"space-around"}} className="mob-bottom-nav">
        {[
          {id:"dashboard",icon:"▦",label:"Home"},
          ...(hasPerm("submit")?[{id:"submit",icon:"＋",label:"Expense"}]:[]),
          ...(canApprove?[{id:"approvals",icon:"✓",label:"Approve",badge:pendingClaims.length+pendingTopups.length}]:[]),
          {id:"claims",icon:"📋",label:"Claims"},
          {id:"inbox",icon:"🔔",label:"Inbox",badge:myNotifs.length},
          {id:"more",icon:"⋯",label:"More"},
        ].map(item=>(
          <button key={item.id} onClick={()=>item.id==="more"?setSPro(true):setTab(item.id)}
            style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,background:"none",border:"none",cursor:"pointer",padding:"4px 2px",position:"relative",minWidth:0}}>
            <span style={{fontSize:17,lineHeight:1,color:tab===item.id?primaryColor:"rgba(255,255,255,.45)"}}>{item.icon}</span>
            <span style={{fontSize:9,color:tab===item.id?primaryColor:"rgba(255,255,255,.4)",fontFamily:FB,fontWeight:tab===item.id?700:400}}>{item.label}</span>
            {item.badge>0&&<span style={{position:"absolute",top:0,right:"25%",width:14,height:14,background:"#ef4444",borderRadius:"50%",color:"#fff",fontSize:8,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>{item.badge}</span>}
          </button>
        ))}
      </div>
    </div>
  );

}


// ─── EMPLOYEE DASHBOARD ───────────────────────────────────────────────────────
function EmpDash({user,myUser,co,setTab}){
  const claims=co.claims.filter(c=>c.empId===user.id);
  const approved=claims.filter(c=>c.status==="Approved").reduce((s,c)=>s+c.amount,0);
  const activeTrip=co.trips.find(t=>t.status==="active"&&(!t.assignedTo||t.assignedTo.includes(user.id)));
  const tripSpent=activeTrip?co.claims.filter(c=>c.tripId===activeTrip.id&&c.empId===user.id&&c.status!=="Rejected").reduce((s,c)=>s+c.amount,0):0;
  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18}}>
        <div><h1 style={{fontFamily:FD,fontSize:22,fontWeight:700,color:INK}}>Welcome back, {user.name.split(" ")[0]} 👋</h1><p style={{color:MUTED,fontSize:12,marginTop:2}}>{co.policy.reimbursementMode?"Reimbursement mode active":"Your wallet balance"}</p></div>
        <Btn onClick={()=>setTab("submit")}>＋ New Expense</Btn>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:12,marginBottom:14}}>
        <Card style={{padding:20,background:`linear-gradient(135deg,${DARK},#2d5a1b)`}}>
          <div style={{fontSize:10,color:"rgba(255,255,255,.45)",fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>{co.policy.reimbursementMode?"Pending Reimbursement":"Wallet Balance"}</div>
          <div style={{fontFamily:FD,fontSize:28,fontWeight:700,color:G,marginTop:5}}>{fmt(co.policy.reimbursementMode?myUser?.reimbursable||0:myUser?.balance||0)}</div>
          {!co.policy.reimbursementMode&&<div style={{marginTop:8}}><PBar value={approved} max={(myUser?.balance||0)+approved} h={3} color={G}/></div>}
        </Card>
        <Card style={{padding:16}}><div style={{fontSize:20}}>📋</div><div style={{fontFamily:FD,fontSize:20,fontWeight:700,color:INK,marginTop:3}}>{claims.length}</div><div style={{fontSize:11,color:MUTED}}>Total Claims</div></Card>
        <Card style={{padding:16}}><div style={{fontSize:20}}>⏳</div><div style={{fontFamily:FD,fontSize:20,fontWeight:700,color:"#f59e0b",marginTop:3}}>{claims.filter(c=>c.status==="Pending").length}</div><div style={{fontSize:11,color:MUTED}}>Pending</div></Card>
      </div>
      {activeTrip&&<Card style={{padding:16,marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><div><div style={{fontSize:10,color:MUTED,textTransform:"uppercase",letterSpacing:1}}>Active Trip</div><div style={{fontFamily:FD,fontSize:13,fontWeight:700,color:INK}}>{activeTrip.name}</div></div><Badge s="Active" sm/></div>
        <div style={{display:"flex",gap:16,marginBottom:6}}>{[["Budget",fmt(activeTrip.budget)],["Spent",fmt(tripSpent)],["Left",fmt(Math.max(0,activeTrip.budget-tripSpent))]].map(([k,v])=><div key={k}><div style={{fontSize:9,color:MUTED}}>{k}</div><div style={{fontWeight:700,color:INK,fontSize:12}}>{v}</div></div>)}</div>
        <PBar value={tripSpent} max={activeTrip.budget}/>
      </Card>}
      <Card>
        <div style={{padding:"12px 16px",borderBottom:`1px solid ${BDR}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontFamily:FD,fontSize:13,fontWeight:700,color:INK}}>Recent Claims</span><Btn v="outline" onClick={()=>setTab("claims")} style={{fontSize:10,padding:"4px 9px"}}>View All →</Btn></div>
        <table style={{width:"100%"}}>
          <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>{claims.slice(0,5).map(c=><tr key={c.id} className="rh">
            <td style={{color:MUTED,fontSize:11}}>{c.date}</td>
            <td style={{fontSize:12}}>{c.anomaly&&<span title="Anomaly" style={{marginRight:3}}>🔍</span>}{c.desc}</td>
            <td><span style={{background:GL,color:GD,padding:"1px 6px",borderRadius:4,fontSize:10,fontWeight:600}}>{c.category}</span></td>
            <td style={{fontWeight:700,fontSize:12}}>{fmt(c.amount)}</td>
            <td><Badge s={c.autoApproved&&c.status==="Approved"?"Auto-Approved":c.status} sm/></td>
          </tr>)}</tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── MANAGER DASHBOARD ────────────────────────────────────────────────────────
function MgrDash({co,meta,setTab,getUser}){
  const emps=co.users.filter(u=>u.role==="employee");
  const total=co.claims.filter(c=>c.status!=="Rejected").reduce((s,c)=>s+c.amount,0);
  const pending=co.claims.filter(c=>c.status==="Pending").length;
  const anomalies=co.claims.filter(c=>c.anomaly&&c.status==="Pending").length;
  const activeTrips=co.trips.filter(t=>t.status==="active");
  const activeTrip=activeTrips[0];
  const deptSpend={}; DEPTS.forEach(d=>{deptSpend[d]=co.claims.filter(c=>c.status!=="Rejected"&&getUser(c.empId)?.dept===d).reduce((s,c)=>s+c.amount,0);});
  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
        <div><h1 style={{fontFamily:FD,fontSize:22,fontWeight:700,color:INK}}>Organisation Dashboard</h1><p style={{color:MUTED,fontSize:12,marginTop:2}}>Full visibility — {meta.name}</p></div>
        <div style={{display:"flex",gap:8}}>
          {pending>0&&<Btn onClick={()=>setTab("approvals")} style={{background:"#ef4444",fontSize:11,padding:"7px 12px"}}>⏳ {pending} Pending</Btn>}
          {anomalies>0&&<Btn onClick={()=>setTab("approvals")} v="purple" style={{fontSize:11,padding:"7px 12px"}}>🔍 {anomalies} Anomalies</Btn>}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12,marginBottom:16}}>
        {[{l:"Total Spent",v:fmt(total),i:"💰",c:G},{l:"Pending",v:pending,i:"⏳",c:"#f59e0b"},{l:"Anomalies",v:anomalies,i:"🔍",c:"#7c3aed"},{l:"Employees",v:emps.length,i:"👥",c:"#60a5fa"},{l:"Active Trips",v:activeTrips.length,i:"🗂️",c:"#a78bfa"}].map((s,i)=>(
          <Card key={i} style={{padding:15}}><div style={{fontSize:20}}>{s.i}</div><div style={{fontFamily:FD,fontSize:19,fontWeight:700,color:s.c,marginTop:3}}>{s.v}</div><div style={{fontSize:10,color:MUTED,marginTop:1}}>{s.l}</div></Card>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1.4fr 1fr",gap:14}}>
        <Card>
          <div style={{padding:"12px 16px",borderBottom:`1px solid ${BDR}`}}><span style={{fontFamily:FD,fontSize:13,fontWeight:700,color:INK}}>Employee Balances</span></div>
          {emps.map(e=>{const spent=co.claims.filter(c=>c.empId===e.id&&c.status!=="Rejected").reduce((s,c)=>s+c.amount,0);const alloc=(e.balance||0)+spent;return(
            <div key={e.id} style={{padding:"9px 16px",borderBottom:`1px solid #f8faf6`,display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:28,height:28,borderRadius:"50%",background:GL,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,color:GD,fontSize:10}}>{e.avatar}</div>
              <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:INK}}>{e.name} <span style={{fontSize:10,color:MUTED}}>· {e.dept}</span></div><PBar value={spent} max={alloc||1} h={3}/></div>
              <div style={{textAlign:"right"}}><div style={{fontWeight:700,color:INK,fontSize:12}}>{co.policy.reimbursementMode?fmt(e.reimbursable||0):fmt(e.balance||0)}</div><div style={{fontSize:9,color:MUTED}}>{co.policy.reimbursementMode?"reimb.":"balance"}</div></div>
            </div>
          );})}
        </Card>
        <Card style={{padding:18}}>
          <div style={{fontFamily:FD,fontSize:13,fontWeight:700,color:INK,marginBottom:12}}>Department Budgets</div>
          {Object.entries(co.policy.departmentBudgets||{}).filter(([d,b])=>b>0&&(deptSpend[d]||0)>0).map(([dept,budget])=>(
            <div key={dept} style={{marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:2}}><span style={{color:MUTED}}>{dept}</span><span style={{fontWeight:600}}>{fmt(deptSpend[dept]||0)} / {fmt(budget)}</span></div>
              <PBar value={deptSpend[dept]||0} max={budget} h={5}/>
            </div>
          ))}
          {activeTrip&&<div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${BDR}`}}>
            <div style={{fontSize:11,fontWeight:700,color:MUTED,marginBottom:6}}>Active: {activeTrip.name}</div>
            <div style={{display:"flex",gap:14,marginBottom:5}}>{[["Budget",fmt(activeTrip.budget)],["Spent",fmt(activeTrip.spent)],["Left",fmt(Math.max(0,activeTrip.budget-activeTrip.spent))]].map(([k,v])=><div key={k}><div style={{fontSize:9,color:MUTED}}>{k}</div><div style={{fontWeight:700,fontSize:12,color:INK}}>{v}</div></div>)}</div>
            <PBar value={activeTrip.spent} max={activeTrip.budget}/>
          </div>}
        </Card>
      </div>
    </div>
  );
}

// ─── CLAIMS TAB ───────────────────────────────────────────────────────────────
function ClaimsTab({claims,trips,isManager,getUser,setMdl,submitEditRequest,hasEditWindow,userId}){
  const [filter,setFilter]=useState("All");
  const [search,setSearch]=useState("");
  const [anomalyOnly,setAO]=useState(false);
  const [reqEditClaim,setReqEdit]=useState(null);
  const [editReason,setEditReason]=useState("");
  const shown=claims.filter(c=>(filter==="All"||c.status===filter)&&(!anomalyOnly||c.anomaly)&&(c.desc.toLowerCase().includes(search.toLowerCase())||c.category.toLowerCase().includes(search.toLowerCase())));
  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
        <h1 style={{fontFamily:FD,fontSize:20,fontWeight:700,color:INK}}>{isManager?"All Claims":"My Claims"}</h1>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <label style={{display:"flex",alignItems:"center",gap:5,fontSize:12,color:MUTED,cursor:"pointer"}} className="mob-hide"><input type="checkbox" checked={anomalyOnly} onChange={e=>setAO(e.target.checked)} style={{accentColor:"#7c3aed"}}/>🔍 Anomalies</label>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search…" style={{padding:"7px 11px",border:`1.5px solid ${BDR}`,borderRadius:8,fontSize:12,width:150,background:"#fafff8"}}/>
        </div>
      </div>
      <div style={{display:"flex",gap:7,marginBottom:12,flexWrap:"wrap"}}>
        {["All","Pending","Approved","Rejected"].map(s=><button key={s} onClick={()=>setFilter(s)} style={{padding:"5px 13px",borderRadius:20,border:`1.5px solid ${filter===s?G:BDR}`,background:filter===s?G:"#fff",color:filter===s?"#fff":MUTED,fontFamily:FB,fontSize:11,fontWeight:600,cursor:"pointer"}}>{s}</button>)}
      </div>

      {/* Request edit modal */}
      {reqEditClaim&&(
        <div style={{position:"fixed",inset:0,background:"#00000055",display:"flex",alignItems:"center",justifyContent:"center",zIndex:600,backdropFilter:"blur(3px)"}} onClick={()=>setReqEdit(null)}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:14,padding:24,width:"min(420px,92vw)",boxShadow:"0 20px 60px #0003"}}>
            <h3 style={{fontFamily:FD,fontSize:16,fontWeight:700,color:INK,marginBottom:6}}>Request Edit — {reqEditClaim.id}</h3>
            <p style={{color:MUTED,fontSize:12,marginBottom:14,lineHeight:1.5}}>This expense is approved. Editing requires manager approval. Explain why you need to edit it.</p>
            <div style={{background:"#fef3c7",border:"1px solid #fcd34d",borderRadius:7,padding:"8px 12px",marginBottom:12,fontSize:11,color:"#92400e"}}>
              ⚠ All edit requests and approvals are permanently recorded in the audit trail.
            </div>
            <textarea value={editReason} onChange={e=>setEditReason(e.target.value)} rows={3} placeholder="Reason for edit request (e.g. wrong amount entered, receipt was corrected…)" style={{width:"100%",padding:"9px 11px",border:`1.5px solid ${BDR}`,borderRadius:8,fontFamily:FB,fontSize:12,resize:"none",marginBottom:12}}/>
            <div style={{display:"flex",gap:8}}>
              <Btn onClick={async()=>{if(!editReason.trim())return;await submitEditRequest(reqEditClaim,editReason);setReqEdit(null);setEditReason("");}} disabled={!editReason.trim()} style={{flex:1,padding:10}}>Submit Request →</Btn>
              <Btn v="outline" onClick={()=>setReqEdit(null)}>Cancel</Btn>
            </div>
          </div>
        </div>
      )}

      <Card>
        <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",minWidth:500}}>
          <thead><tr><th>ID</th><th>Date</th>{isManager&&<th>Employee</th>}<th className="mob-hide">Trip</th><th>Category</th><th>Description</th><th>Amount</th><th>Status</th><th>Act.</th></tr></thead>
          <tbody>{shown.map(c=>{
            const trip=trips.find(t=>t.id===c.tripId);const e=getUser(c.empId);
            const canRequestEdit=!isManager&&c.status==="Approved"&&!hasEditWindow(c.id);
            const editWindowOpen=!isManager&&hasEditWindow(c.id);
            return(<tr key={c.id} className="rh" onClick={()=>setMdl({type:"detail",data:c})}>
              <td style={{fontFamily:"monospace",color:GD,fontSize:10,fontWeight:600}}>{c.id}</td>
              <td style={{color:MUTED,fontSize:11}}>{c.date}</td>
              {isManager&&<td><div style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:22,height:22,borderRadius:"50%",background:GL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:700,color:GD}}>{e?.avatar}</div><span style={{fontSize:12}}>{e?.name}</span></div></td>}
              <td className="mob-hide" style={{fontSize:10,color:MUTED}}>{trip?.name?.slice(0,14)||"—"}</td>
              <td><span style={{background:GL,color:GD,padding:"1px 6px",borderRadius:4,fontSize:10,fontWeight:600}}>{CI[c.category]} {c.category}</span></td>
              <td style={{fontSize:12}}>{c.flagged&&<span title="Cat%" style={{marginRight:2}}>⚠️</span>}{c.anomaly&&<span title="Anomaly" style={{marginRight:2}}>🔍</span>}{c.weekendFlag&&<span title="Weekend" style={{marginRight:2}}>📅</span>}{c.desc}</td>
              <td style={{fontWeight:700,fontSize:12}}>{fmt(c.amount)}{c.origCur&&c.origCur!=="INR"&&<div style={{fontSize:9,color:MUTED}}>{c.origCur} {c.origAmount}</div>}</td>
              <td><Badge s={c.autoApproved&&c.status==="Approved"?"Auto-Approved":c.status} sm/></td>
              <td onClick={ev=>ev.stopPropagation()}>
                {isManager&&c.status==="Pending"&&<div style={{display:"flex",gap:3}}>
                  <Btn onClick={()=>setMdl({type:"approve",data:c})} style={{padding:"4px 8px",fontSize:10}}>✓</Btn>
                  <Btn v="danger" onClick={()=>setMdl({type:"reject",data:c})} style={{padding:"4px 8px",fontSize:10}}>✗</Btn>
                </div>}
                {canRequestEdit&&<button onClick={()=>{setReqEdit(c);setEditReason("");}} style={{background:"none",border:"1px solid #fcd34d",color:"#92400e",borderRadius:5,padding:"3px 7px",fontSize:10,cursor:"pointer"}} title="Request edit">✏ Edit</button>}
                {editWindowOpen&&<span style={{background:"#dcfce7",color:"#16a34a",padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:700}}>✓ Edit OK</span>}
              </td>
            </tr>);
          })}</tbody>
        </table>
        </div>
        {shown.length===0&&<div style={{padding:36,textAlign:"center",color:MUTED}}>No claims found</div>}
      </Card>
    </div>
  );
}

// ─── SUBMIT TAB (OCR fixed — no stale closures) ───────────────────────────────
function SubmitTab({user,co,submitClaim,camFile,clearCamFile,onCam}){
  const blankForm=()=>({id:uid(),date:today(),category:"",desc:"",amount:"",origAmount:"",currency:"INR",tripId:"",notes:"",vendor:"",receipts:[],ocrState:"idle",ocrData:null,scanning:false});
  const [forms,setForms]=useState([blankForm()]);
  const [idx,setIdx]=useState(0);
  const fileRefs=useRef({});
  const policy=co.policy;
  const myTrips=co.trips.filter(t=>t.status==="active"&&(!t.assignedTo||t.assignedTo.includes(user.id)));

  // ── upd & doOCR MUST be defined before any useEffect that calls them ──────

  // Updater — functional setState so it never reads stale forms
  const upd=useCallback((i,patch)=>setForms(prev=>prev.map((x,j)=>j===i?{...x,...patch}:x)),[]);

  // doOCR — receives an explicit `snapshot` of forms so it never closes over stale state
  const doOCR=useCallback(async(i,b64,mime,snapshot)=>{
    upd(i,{ocrState:"scanning",scanning:true,ocrData:null});
    try{
      const isImg=mime.startsWith("image/");
      // /api/anthropic proxied by Netlify function in production
      // and by Vite proxy in development
      const res=await fetch("/api/anthropic/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json","anthropic-version":"2023-06-01"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:900,
          system:`You are an invoice OCR assistant for an Indian business expense app. Analyse the receipt/invoice — including handwritten ones. Return ONLY a single valid JSON object, no markdown, no extra text. Keys: vendor(string), date(YYYY-MM-DD or ""), amount(number in detected currency), currency(ISO code), origAmount(number), description(5-8 words), category(one of: Travel|Meals|Accommodation|Office Supplies|Client Entertainment|Software|Training|Miscellaneous), invoice_number(string or ""), gst_number(string or ""), line_items(string[]), confidence("high"|"medium"|"low")`,
          messages:[{role:"user",content:isImg
            ?[{type:"image",source:{type:"base64",media_type:mime,data:b64}},{type:"text",text:"Extract expense data. ONLY JSON."}]
            :[{type:"document",source:{type:"base64",media_type:"application/pdf",data:b64}},{type:"text",text:"Extract expense data. ONLY JSON."}]
          }]
        })
      });
      if(!res.ok){
        let errMsg=`HTTP ${res.status}`;
        try{const errData=await res.json();errMsg=errData?.error?.message||errMsg;}catch{}
        throw new Error(errMsg);
      }
      const data=await res.json();
      if(data.error)throw new Error(data.error.message||"API error");
      const raw=(data.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("");
      if(!raw)throw new Error("Empty response");
      const clean=raw.replace(/^```(?:json)?\s*/m,"").replace(/\s*```$/m,"").trim();
      const s=clean.indexOf("{"), e=clean.lastIndexOf("}");
      if(s<0||e<0)throw new Error("No JSON in response");
      const p=JSON.parse(clean.slice(s,e+1));
      const rate=FX[p.currency]||1;
      const inr=p.currency&&p.currency!=="INR"?Math.round((p.origAmount||p.amount||0)*rate):(p.amount||0);
      const cur=snapshot?snapshot[i]:null;
      upd(i,{
        ocrState:"done",scanning:false,ocrData:p,
        date:       p.date||(cur?.date||today()),
        amount:     inr?String(inr):(cur?.amount||""),
        origAmount: p.origAmount?String(p.origAmount):String(p.amount||""),
        currency:   p.currency||"INR",
        desc:       [p.vendor,p.description].filter(Boolean).join(" — ")||(cur?.desc||""),
        vendor:     p.vendor||(cur?.vendor||""),
        category:   CATS.includes(p.category)?p.category:(cur?.category||""),
        notes:      [p.invoice_number?"Invoice: "+p.invoice_number:"",p.gst_number?"GSTIN: "+p.gst_number:"",p.line_items?.length?"Items: "+p.line_items.slice(0,3).join(", "):""].filter(Boolean).join(" | ")||(cur?.notes||""),
      });
    }catch(err){
      console.error("OCR:",err.message);
      upd(i,{ocrState:"error",scanning:false});
    }
  },[upd]);

  // ── useEffect calls — safe because upd/doOCR are defined above ────────────

  // When a camera file arrives: append new form tab and auto-OCR it
  useEffect(()=>{
    if(!camFile)return;
    setForms(prev=>{
      const newForm={...blankForm(),receipts:[camFile]};
      const updated=[...prev,newForm];
      const newIdx=updated.length-1;
      setIdx(newIdx);
      doOCR(newIdx,camFile.b64,camFile.type,updated);
      return updated;
    });
    if(clearCamFile)clearCamFile();
  },[camFile]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-OCR when a form's first receipt arrives without OCR having run yet
  useEffect(()=>{
    const fm=forms[idx];
    if(!fm||fm.receipts.length===0||fm.ocrState!=="idle")return;
    const r=fm.receipts[0];
    if(r?.b64)doOCR(idx,r.b64,r.type,forms);
  },[forms.length,idx]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─────────────────────────────────────────────────────────────────────────

  const handleFile=(i,files)=>{
    const f=files[0];if(!f)return;
    const reader=new FileReader();
    reader.onload=ev=>{
      const url=ev.target.result,b64=url.split(",")[1],mime=f.type||"image/jpeg";
      const receipt={name:f.name,url,b64,type:mime};
      setForms(prev=>{
        const updated=prev.map((x,j)=>j===i?{...x,receipts:[...x.receipts,receipt]}:x);
        // Trigger OCR immediately with fresh state snapshot
        doOCR(i,b64,mime,updated);
        return updated;
      });
    };
    reader.readAsDataURL(f);
  };

  const addForm=()=>{const nf=blankForm();setForms(p=>[...p,nf]);setIdx(forms.length);};
  const removeForm=i=>{if(forms.length===1)return;setForms(p=>p.filter((_,j)=>j!==i));setIdx(Math.max(0,idx-1));};
  const submitAll=()=>forms.filter(f=>f.category&&f.desc&&f.amount).forEach(f=>submitClaim(f));

  const fm=forms[idx]||forms[0];
  const amt=parseFloat(fm.amount)||0;
  const CONF={high:"#16a34a",medium:"#d97706",low:"#dc2626"};
  const inpS={width:"100%",padding:"9px 12px",border:`1.5px solid ${BDR}`,borderRadius:8,fontSize:13,background:"#fafff8"};

  return(
    <div style={{maxWidth:680}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div><h1 style={{fontFamily:FD,fontSize:20,fontWeight:700,color:INK}}>Submit Expense</h1><p style={{color:MUTED,fontSize:12}}>AI-powered · Batch scan · Camera capture · Multi-currency</p></div>
        <div style={{display:"flex",gap:8}}>
          <Btn v="outline" onClick={addForm} style={{fontSize:12}}>＋ Add</Btn>
          {forms.length>1&&<Btn onClick={submitAll} style={{fontSize:12}}>Submit All ({forms.filter(f=>f.category&&f.desc&&f.amount).length})</Btn>}
        </div>
      </div>

      {/* Batch tabs */}
      {forms.length>1&&<div style={{display:"flex",gap:6,marginBottom:12,overflowX:"auto",paddingBottom:3}}>
        {forms.map((f,i)=>(
          <div key={f.id} style={{display:"flex",alignItems:"center",gap:5,padding:"5px 12px",borderRadius:20,border:`1.5px solid ${idx===i?G:BDR}`,background:idx===i?G:"#fff",cursor:"pointer",flexShrink:0}} onClick={()=>setIdx(i)}>
            <span style={{fontSize:11,fontWeight:600,color:idx===i?"#fff":MUTED}}>#{i+1} {f.ocrState==="done"?"✓":f.ocrState==="scanning"?"⏳":f.ocrState==="error"?"⚠":""} {f.desc?.slice(0,10)||"New"}</span>
            {forms.length>1&&<button onClick={e=>{e.stopPropagation();removeForm(i);}} style={{background:"none",border:"none",color:idx===i?"rgba(255,255,255,.7)":MUTED,cursor:"pointer",fontSize:12,padding:0}}>×</button>}
          </div>
        ))}
      </div>}

      {/* OCR Card */}
      <Card style={{padding:16,marginBottom:12,borderColor:fm.ocrState==="done"?G:BDR}}>
        <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:10}}>
          <div style={{width:28,height:28,borderRadius:8,background:`linear-gradient(135deg,${G},${GD})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>🤖</div>
          <div style={{flex:1}}><div style={{fontWeight:700,color:INK,fontSize:13}}>AI Invoice Scanner</div><div style={{fontSize:11,color:MUTED}}>Upload · Drag & drop · Camera · Handwritten bills supported</div></div>
          {onCam&&<Btn v="dark" onClick={onCam} style={{padding:"6px 10px",fontSize:12}}>📷 Camera</Btn>}
          {fm.ocrState==="done"&&fm.ocrData&&<span style={{background:CONF[fm.ocrData.confidence]+"20",color:CONF[fm.ocrData.confidence],padding:"2px 8px",borderRadius:8,fontSize:10,fontWeight:700}}>{fm.ocrData.confidence==="high"?"✓ High":"~ Med"}</span>}
          {fm.ocrState==="error"&&<span style={{background:"#fee2e2",color:"#dc2626",padding:"2px 8px",borderRadius:8,fontSize:10,fontWeight:700}}>⚠ Failed — fill manually</span>}
          {fm.ocrState==="scanning"&&<span style={{color:GD,fontSize:11,display:"flex",alignItems:"center",gap:5}}><span style={{width:12,height:12,border:`2px solid ${GM}`,borderTopColor:G,borderRadius:"50%",animation:"spin .7s linear infinite",display:"inline-block"}}/> Scanning…</span>}
        </div>
        {/* Drop zone */}
        <div onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();handleFile(idx,e.dataTransfer.files);}} onClick={()=>fileRefs.current[idx]?.click()}
          style={{border:`2px dashed ${fm.receipts.length>0?G:GM}`,borderRadius:9,padding:fm.receipts.length>0?"10px":"16px",textAlign:"center",cursor:"pointer",background:fm.receipts.length>0?GL:"#fafff8",transition:"all .2s"}}>
          <input ref={r=>fileRefs.current[idx]=r} type="file" accept="image/*,application/pdf" multiple style={{display:"none"}} onChange={e=>handleFile(idx,e.target.files)}/>
          {fm.receipts.length>0?(
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              {fm.receipts.map((r,i)=>(
                <div key={i} style={{position:"relative"}}>
                  {r.type.startsWith("image/")?<img src={r.url} alt={r.name} style={{width:54,height:54,objectFit:"cover",borderRadius:7,border:`1px solid ${BDR}`}}/>:<div style={{width:54,height:54,background:"#fee2e2",borderRadius:7,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",border:"1px solid #fca5a5"}}><span style={{fontSize:18}}>📄</span><span style={{fontSize:8,color:"#dc2626"}}>PDF</span></div>}
                  <button onClick={ev=>{ev.stopPropagation();upd(idx,{receipts:fm.receipts.filter((_,j)=>j!==i)});}} style={{position:"absolute",top:-3,right:-3,width:13,height:13,background:"#ef4444",border:"none",borderRadius:"50%",color:"#fff",fontSize:9,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>×</button>
                  <a href={r.url} download={r.name||`receipt_${i+1}`} onClick={e=>e.stopPropagation()} style={{display:"block",fontSize:8,color:GD,textAlign:"center",marginTop:2}}>⬇</a>
                </div>
              ))}
              <div style={{width:34,height:34,border:`2px dashed ${GM}`,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",color:MUTED,fontSize:16}}>+</div>
            </div>
          ):(
            <><div style={{fontSize:24,marginBottom:4}}>📄</div><div style={{fontSize:13,fontWeight:600,color:INK}}>Upload receipt or invoice</div><div style={{fontSize:11,color:MUTED,marginTop:2}}>JPG · PNG · PDF · Handwritten — AI reads automatically</div></>
          )}
        </div>
        {fm.receipts.length>0&&fm.ocrState!=="done"&&!fm.scanning&&(
          <button onClick={()=>fm.receipts[0]&&doOCR(idx,fm.receipts[0].b64,fm.receipts[0].type,forms)} style={{marginTop:9,width:"100%",padding:10,background:`linear-gradient(135deg,${G},${GD})`,border:"none",borderRadius:8,color:"#fff",fontFamily:FB,fontWeight:700,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>
            🤖 Scan & Auto-Fill with AI
          </button>
        )}
        {fm.ocrState==="done"&&fm.ocrData&&(
          <div style={{marginTop:9,background:GL,borderRadius:8,padding:"10px 12px"}}>
            <div style={{fontSize:9,fontWeight:700,color:GD,marginBottom:6,textTransform:"uppercase",letterSpacing:.5}}>✓ Extracted — fields auto-filled below</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
              {[["Vendor",fm.ocrData.vendor],["Amount",fm.ocrData.amount?fmt(fm.ocrData.amount):"—"],["Date",fm.ocrData.date||"—"],["Category",fm.ocrData.category||"—"],["Invoice #",fm.ocrData.invoice_number||"—"],["GSTIN",fm.ocrData.gst_number||"—"],[fm.ocrData.currency&&fm.ocrData.currency!=="INR"?"FX Rate":null,fm.ocrData.currency&&fm.ocrData.currency!=="INR"?`1 ${fm.ocrData.currency} = ₹${FX[fm.ocrData.currency]||"?"}`:null]].filter(x=>x&&x[0]).map(([k,v])=>(
                <div key={k} style={{display:"flex",gap:3,fontSize:10}}><span style={{color:MUTED,minWidth:55}}>{k}:</span><span style={{fontWeight:600,color:INK}}>{v}</span></div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Alerts */}
      {amt>0&&amt<=policy.autoApproveLimit&&<div style={{background:"#dbeafe",border:"1px solid #93c5fd",borderRadius:9,padding:"9px 13px",marginBottom:10,fontSize:12,color:"#1d4ed8",fontWeight:600}}>⚡ This will be auto-approved instantly (under {fmt(policy.autoApproveLimit)})</div>}
      {fm.date&&isWknd(fm.date)&&policy.weekendRequiresApproval&&<div style={{background:"#fef3c7",border:"1px solid #fcd34d",borderRadius:9,padding:"9px 13px",marginBottom:10,fontSize:12,color:"#92400e"}}>📅 Weekend expense — requires manager approval per policy</div>}
      {amt>0&&policy.receiptMandatoryAbove>0&&amt>policy.receiptMandatoryAbove&&!fm.receipts.length&&<div style={{background:"#fee2e2",border:"1px solid #fca5a5",borderRadius:9,padding:"9px 13px",marginBottom:10,fontSize:12,color:"#dc2626"}}>📎 Receipt required for expenses above {fmt(policy.receiptMandatoryAbove)}</div>}

      {/* Form */}
      <Card style={{padding:22}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11,marginBottom:10}}>
          <div><label style={{fontSize:10,fontWeight:700,color:MUTED,display:"block",marginBottom:4,textTransform:"uppercase"}}>Date *</label><input type="date" value={fm.date} onChange={e=>upd(idx,{date:e.target.value})} style={{...inpS,borderColor:fm.ocrState==="done"&&fm.date?G:BDR}}/></div>
          <div><label style={{fontSize:10,fontWeight:700,color:MUTED,display:"block",marginBottom:4,textTransform:"uppercase"}}>Trip / Period *</label>
            <select value={fm.tripId||myTrips[0]?.id||""} onChange={e=>upd(idx,{tripId:e.target.value})} style={{...inpS,appearance:"none",paddingRight:28}}>
              {myTrips.length===0&&<option value="">No active trips</option>}
              {myTrips.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:11,marginBottom:10}}>
          <div><label style={{fontSize:10,fontWeight:700,color:MUTED,display:"block",marginBottom:4,textTransform:"uppercase"}}>Vendor / Merchant</label><input value={fm.vendor} onChange={e=>upd(idx,{vendor:e.target.value})} placeholder="Hotel / Airline / Restaurant" style={{...inpS,borderColor:fm.ocrState==="done"&&fm.vendor?G:BDR}}/></div>
          <div><label style={{fontSize:10,fontWeight:700,color:MUTED,display:"block",marginBottom:4,textTransform:"uppercase"}}>Currency</label>
            <select value={fm.currency} onChange={e=>{const cur=e.target.value;const rate=FX[cur]||1;upd(idx,{currency:cur,amount:fm.origAmount?String(Math.round(parseFloat(fm.origAmount)*rate)):fm.amount});}} style={{...inpS,appearance:"none",paddingRight:28}}>
              {CURRENCIES.map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
          <div><label style={{fontSize:10,fontWeight:700,color:MUTED,display:"block",marginBottom:4,textTransform:"uppercase"}}>Orig. Amount</label>
            <input type="number" value={fm.origAmount} onChange={e=>{const oa=e.target.value;const rate=FX[fm.currency]||1;upd(idx,{origAmount:oa,amount:oa?String(Math.round(parseFloat(oa)*rate)):""});}} placeholder="0.00" style={inpS}/>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11,marginBottom:10}}>
          <div><label style={{fontSize:10,fontWeight:700,color:MUTED,display:"block",marginBottom:4,textTransform:"uppercase"}}>Category *</label>
            <select value={fm.category} onChange={e=>upd(idx,{category:e.target.value})} style={{...inpS,appearance:"none",paddingRight:28,borderColor:fm.ocrState==="done"&&fm.category?G:BDR}}>
              <option value="">Select…</option>{CATS.map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
          <div><label style={{fontSize:10,fontWeight:700,color:MUTED,display:"block",marginBottom:4,textTransform:"uppercase"}}>Amount (₹) *</label>
            <input type="number" value={fm.amount} onChange={e=>upd(idx,{amount:e.target.value})} placeholder="0.00" style={{...inpS,borderColor:fm.ocrState==="done"&&fm.amount?G:BDR}}/>
            {fm.currency!=="INR"&&fm.amount&&<div style={{fontSize:9,color:MUTED,marginTop:2}}>≈ {fmt(parseFloat(fm.amount))} (converted from {fm.currency})</div>}
          </div>
        </div>
        <div style={{marginBottom:10}}><label style={{fontSize:10,fontWeight:700,color:MUTED,display:"block",marginBottom:4,textTransform:"uppercase"}}>Description *</label><input value={fm.desc} onChange={e=>upd(idx,{desc:e.target.value})} placeholder="Brief description" style={{...inpS,borderColor:fm.ocrState==="done"&&fm.desc?G:BDR}}/></div>
        <div style={{marginBottom:14}}><label style={{fontSize:10,fontWeight:700,color:MUTED,display:"block",marginBottom:4,textTransform:"uppercase"}}>Notes / Invoice / GSTIN</label><textarea value={fm.notes} onChange={e=>upd(idx,{notes:e.target.value})} rows={2} placeholder="Invoice no., GSTIN, additional info…" style={{...inpS,resize:"vertical"}}/></div>
        <div style={{display:"flex",gap:9}}>
          <Btn onClick={()=>submitClaim(fm)} style={{flex:1,padding:11}} disabled={!fm.category||!fm.desc||!fm.amount||!myTrips.length}>
            {amt>0&&amt<=policy.autoApproveLimit?"⚡ Submit & Auto-Approve":"Submit Claim →"}
          </Btn>
          <Btn v="outline" onClick={()=>setForms(p=>p.map((x,i)=>i===idx?blankForm():x))}>Clear</Btn>
        </div>
        {!myTrips.length&&<div style={{marginTop:8,fontSize:11,color:"#dc2626"}}>⚠ No active trips assigned to you. Go to Trips tab to create one.</div>}
      </Card>
    </div>
  );
}

// ─── TRIPS TAB ────────────────────────────────────────────────────────────────
function TripsTab({trips,setTrips,claims,isManager,getUser,users,closeTrip,toast,uid:userId,sbCreateTrip}){
  const [showNew,setShowNew]=useState(false);
  const [form,setForm]=useState({name:"",type:"trip",startDate:today(),endDate:"",budget:"",assignedTo:[]});
  const [expandedId,setExpId]=useState(null);
  const emps=users?.filter(u=>u.role==="employee")||[];
  const inpS={padding:"9px 12px",border:`1.5px solid ${BDR}`,borderRadius:8,fontSize:13,background:"#fafff8",width:"100%"};
  const toggle=id=>setForm(f=>({...f,assignedTo:f.assignedTo.includes(id)?f.assignedTo.filter(x=>x!==id):[...f.assignedTo,id]}));
  const create=async()=>{
    if(!form.name||!form.endDate||!form.budget){toast("Fill name, end date and budget","error");return;}
    const assigned=isManager?(form.assignedTo.length>0?form.assignedTo:emps.map(e=>e.id)):[userId];
    const newTrip={id:"TRP-"+uid(),name:form.name,type:form.type,startDate:form.startDate,endDate:form.endDate,status:"active",budget:parseFloat(form.budget),spent:0,assignedTo:assigned};
    if(sbCreateTrip){await sbCreateTrip(newTrip,assigned);}
    else{setTrips(p=>[newTrip,...p]);}
    setShowNew(false);setForm({name:"",type:"trip",startDate:today(),endDate:"",budget:"",assignedTo:[]});toast("✓ Trip created");
  };
  const visible=isManager?trips:trips.filter(t=>!t.assignedTo||t.assignedTo.includes(userId));
  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div><h1 style={{fontFamily:FD,fontSize:20,fontWeight:700,color:INK}}>Trips & Periods</h1>{!isManager&&<p style={{color:MUTED,fontSize:11,marginTop:2}}>Showing your assigned trips</p>}</div>
        <Btn onClick={()=>setShowNew(!showNew)}>{showNew?"✕ Cancel":"＋ New Trip / Period"}</Btn>
      </div>
      {showNew&&<Card style={{padding:20,marginBottom:12,borderColor:G,background:GL}}>
        <div style={{fontFamily:FD,fontSize:13,fontWeight:700,color:INK,marginBottom:12}}>New Trip / Period</div>
        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr",gap:10,marginBottom:10}}>
          <div><label style={{fontSize:10,color:MUTED,fontWeight:700,display:"block",marginBottom:3,textTransform:"uppercase"}}>Name *</label><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Delhi Trip Apr 2026" style={inpS}/></div>
          <div><label style={{fontSize:10,color:MUTED,fontWeight:700,display:"block",marginBottom:3,textTransform:"uppercase"}}>Type</label><select value={form.type} onChange={e=>setForm({...form,type:e.target.value})} style={{...inpS,appearance:"none"}}><option value="trip">Trip</option><option value="period">Period</option></select></div>
          <div><label style={{fontSize:10,color:MUTED,fontWeight:700,display:"block",marginBottom:3,textTransform:"uppercase"}}>Start Date *</label><input type="date" value={form.startDate} onChange={e=>setForm({...form,startDate:e.target.value})} style={inpS}/></div>
          <div><label style={{fontSize:10,color:MUTED,fontWeight:700,display:"block",marginBottom:3,textTransform:"uppercase"}}>End Date *</label><input type="date" value={form.endDate} min={form.startDate} onChange={e=>setForm({...form,endDate:e.target.value})} style={inpS}/></div>
          <div><label style={{fontSize:10,color:MUTED,fontWeight:700,display:"block",marginBottom:3,textTransform:"uppercase"}}>Budget ₹ *</label><input type="number" value={form.budget} onChange={e=>setForm({...form,budget:e.target.value})} style={inpS}/></div>
        </div>
        {isManager&&emps.length>0&&<div style={{marginBottom:12}}>
          <label style={{fontSize:10,color:MUTED,fontWeight:700,display:"block",marginBottom:7,textTransform:"uppercase"}}>Assign Employees (empty = all)</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
            {emps.map(e=>{const sel=form.assignedTo.includes(e.id);return(
              <div key={e.id} onClick={()=>toggle(e.id)} style={{display:"flex",alignItems:"center",gap:5,padding:"5px 11px",borderRadius:20,border:`1.5px solid ${sel?G:BDR}`,background:sel?G:"#fff",cursor:"pointer",transition:"all .15s"}}>
                <div style={{width:20,height:20,borderRadius:"50%",background:sel?"rgba(255,255,255,.3)":GL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:700,color:sel?"#fff":GD}}>{e.avatar}</div>
                <span style={{fontSize:11,fontWeight:600,color:sel?"#fff":INK}}>{e.name.split(" ")[0]}</span>
              </div>
            );})}
          </div>
        </div>}
        <div style={{display:"flex",gap:8}}><Btn onClick={create}>Create →</Btn><Btn v="outline" onClick={()=>setShowNew(false)}>Cancel</Btn></div>
      </Card>}
      {visible.length===0&&<Card style={{padding:36,textAlign:"center"}}><div style={{fontSize:26,marginBottom:6}}>🗂️</div><div style={{fontWeight:700,color:INK}}>{isManager?"No trips yet":"No trips assigned to you yet"}</div></Card>}
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {visible.map(t=>{
          const spent=isManager?claims.filter(c=>c.tripId===t.id&&c.status!=="Rejected").reduce((s,c)=>s+c.amount,0):claims.filter(c=>c.tripId===t.id&&c.empId===userId&&c.status!=="Rejected").reduce((s,c)=>s+c.amount,0);
          const assignedEmps=(t.assignedTo||[]).map(id=>getUser(id)).filter(Boolean);
          const exp=expandedId===t.id;
          return(<Card key={t.id} style={{padding:16}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
              <div style={{flex:1,cursor:"pointer"}} onClick={()=>setExpId(exp?null:t.id)}>
                <div style={{display:"flex",alignItems:"center",gap:7}}><span style={{fontFamily:FD,fontSize:14,fontWeight:700,color:INK}}>{t.name}</span><Badge s={t.status==="active"?"Active":"Closed"} sm/><span style={{fontSize:9,background:"#f3f4f6",padding:"1px 5px",borderRadius:3,color:MUTED,textTransform:"capitalize"}}>{t.type}</span><span style={{fontSize:10,color:MUTED}}>{exp?"▲":"▼"}</span></div>
                <div style={{fontSize:10,color:MUTED,marginTop:1}}>{t.startDate} → {t.endDate}</div>
              </div>
              {isManager&&t.status==="active"&&<Btn v="warning" onClick={()=>closeTrip(t.id)} style={{fontSize:10,padding:"5px 10px"}}>🔒 Close</Btn>}
            </div>
            <div style={{display:"flex",gap:16,marginBottom:6,flexWrap:"wrap"}}>
              {[["Budget",fmt(t.budget)],["Spent",fmt(spent)],["Left",fmt(Math.max(0,t.budget-spent))],["Claims",claims.filter(c=>c.tripId===t.id).length]].map(([k,v])=>(
                <div key={k}><div style={{fontSize:9,color:MUTED,textTransform:"uppercase",letterSpacing:.5}}>{k}</div><div style={{fontWeight:700,fontSize:12,color:INK}}>{v}</div></div>
              ))}
            </div>
            <PBar value={spent} max={t.budget}/>
            {exp&&assignedEmps.length>0&&<div style={{marginTop:12,borderTop:`1px solid ${BDR}`,paddingTop:10}}>
              <div style={{fontSize:10,fontWeight:700,color:MUTED,textTransform:"uppercase",marginBottom:8}}>Assigned ({assignedEmps.length})</div>
              {assignedEmps.map(e=>{const es=claims.filter(c=>c.tripId===t.id&&c.empId===e.id&&c.status!=="Rejected").reduce((s,c)=>s+c.amount,0);return(
                <div key={e.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:`1px solid #f8faf6`}}>
                  <div style={{width:24,height:24,borderRadius:"50%",background:GL,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,color:GD,fontSize:9}}>{e.avatar}</div>
                  <div style={{flex:1}}><div style={{fontSize:11,fontWeight:600,color:INK}}>{e.name}</div><PBar value={es} max={t.budget/Math.max(assignedEmps.length,1)} h={3}/></div>
                  <div style={{fontWeight:700,fontSize:11,color:INK}}>{fmt(es)}</div>
                </div>
              );})}
            </div>}
          </Card>);
        })}
      </div>
    </div>
  );
}

// ─── APPROVALS TAB ────────────────────────────────────────────────────────────
function ApprovalsTab({pendingClaims,pendingTopups,getUser,trips,handleDecision,handleTopup,setMdl}){
  const [filter,setFilter]=useState("All");
  const [selected,setSelected]=useState(new Set());
  const shown=filter==="All"?pendingClaims:filter==="Anomaly"?pendingClaims.filter(c=>c.anomaly):pendingClaims.filter(c=>c.flagged||c.weekendFlag);

  const toggleSel=(id)=>setSelected(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n;});
  const toggleAll=()=>setSelected(p=>p.size===shown.length?new Set():new Set(shown.map(c=>c.id)));
  const bulkApprove=()=>{selected.forEach(id=>handleDecision(id,"Approved","Bulk approved"));setSelected(new Set());};
  const bulkReject =()=>{selected.forEach(id=>handleDecision(id,"Rejected","Bulk rejected"));setSelected(new Set());};
  return(
    <div>
      <h1 style={{fontFamily:FD,fontSize:20,fontWeight:700,color:INK,marginBottom:4}}>Approvals</h1>
      <p style={{color:MUTED,fontSize:12,marginBottom:12}}>{pendingClaims.length} claims · {pendingTopups.length} top-ups · {pendingClaims.filter(c=>c.anomaly).length} anomalies</p>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",gap:7}}>
          {["All","Anomaly","Flagged"].map(f=><button key={f} onClick={()=>{setFilter(f);setSelected(new Set());}} style={{padding:"5px 13px",borderRadius:20,border:`1.5px solid ${filter===f?G:BDR}`,background:filter===f?G:"#fff",color:filter===f?"#fff":MUTED,fontFamily:FB,fontSize:11,fontWeight:600,cursor:"pointer"}}>{f}</button>)}
        </div>
        {shown.length>0&&<div style={{display:"flex",gap:7,alignItems:"center"}}>
          <label style={{display:"flex",alignItems:"center",gap:5,fontSize:12,color:MUTED,cursor:"pointer"}}><input type="checkbox" checked={selected.size===shown.length&&shown.length>0} onChange={toggleAll} style={{accentColor:G,width:14,height:14}}/> Select all</label>
          {selected.size>0&&<><span style={{fontSize:11,color:MUTED}}>{selected.size} selected</span>
            <Btn onClick={bulkApprove} style={{padding:"5px 12px",fontSize:11}}>✓ Approve {selected.size}</Btn>
            <Btn v="danger" onClick={bulkReject} style={{padding:"5px 10px",fontSize:11}}>✗ Reject {selected.size}</Btn>
          </>}
        </div>}
      </div>
      {pendingTopups.length>0&&<div style={{marginBottom:16}}>
        <div style={{fontSize:10,fontWeight:700,color:"#d97706",textTransform:"uppercase",letterSpacing:1,marginBottom:7}}>💰 Top-Up Requests</div>
        {pendingTopups.map(req=>{const e=getUser(req.empId);return(
          <Card key={req.id} style={{padding:14,marginBottom:7,borderColor:"#fcd34d"}}>
            <div style={{display:"flex",alignItems:"center",gap:9}}>
              <div style={{width:30,height:30,borderRadius:"50%",background:"#fef3c7",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,color:"#d97706",fontSize:12}}>{e?.avatar}</div>
              <div style={{flex:1}}><div style={{fontWeight:600,color:INK,fontSize:13}}>{e?.name} — Top-Up Request</div><div style={{fontSize:11,color:MUTED}}>{req.reason} · {req.date}</div></div>
              <div style={{fontFamily:FD,fontSize:16,fontWeight:700,color:"#d97706",marginRight:7}}>{fmt(req.amount)}</div>
              <Btn onClick={()=>handleTopup(req,"Approved")} style={{padding:"5px 11px",fontSize:11}}>✓ Approve</Btn>
              <Btn v="danger" onClick={()=>handleTopup(req,"Rejected")} style={{padding:"5px 9px",fontSize:11}}>✗</Btn>
            </div>
          </Card>
        );})}
      </div>}
      {shown.length>0?(
        <div>
          <div style={{fontSize:10,fontWeight:700,color:MUTED,textTransform:"uppercase",letterSpacing:1,marginBottom:7}}>📋 Expense Claims</div>
          {shown.map(c=>{const e=getUser(c.empId);const trip=trips.find(t=>t.id===c.tripId);return(
            <Card key={c.id} style={{padding:14,marginBottom:8,borderColor:c.anomaly?"#c4b5fd40":c.flagged?"#fcd34d":BDR,borderLeft:selected.has(c.id)?`3px solid ${G}`:undefined}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:9}}>
                <input type="checkbox" checked={selected.has(c.id)} onChange={()=>toggleSel(c.id)} style={{accentColor:G,width:15,height:15,marginTop:3,flexShrink:0,cursor:"pointer"}}/>
                <div style={{fontSize:22,marginTop:2}}>{CI[c.category]||"📋"}</div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",gap:5,alignItems:"center",marginBottom:2,flexWrap:"wrap"}}>
                    <span style={{fontFamily:"monospace",fontSize:9,color:GD,fontWeight:600}}>{c.id}</span>
                    {c.anomaly&&<span style={{background:"#ede9fe",color:"#7c3aed",fontSize:9,padding:"1px 5px",borderRadius:4,fontWeight:700}}>🔍 ANOMALY</span>}
                    {c.flagged&&<span style={{background:"#fef3c7",color:"#92400e",fontSize:9,padding:"1px 5px",borderRadius:4,fontWeight:700}}>⚠️ CAT%</span>}
                    {c.weekendFlag&&<span style={{background:"#dbeafe",color:"#1d4ed8",fontSize:9,padding:"1px 5px",borderRadius:4,fontWeight:700}}>📅 WKD</span>}
                  </div>
                  <div style={{fontWeight:600,color:INK,fontSize:13}}>{c.desc}</div>
                  <div style={{fontSize:10,color:MUTED}}>{e?.name} · {c.category} · {trip?.name} · {c.date}</div>
                  {c.anomaly&&c.anomalyReasons?.length>0&&<div style={{fontSize:10,color:"#7c3aed",marginTop:3,background:"#ede9fe",padding:"3px 7px",borderRadius:5}}>⚠ {c.anomalyReasons.join(" · ")}</div>}
                  {c.receipts?.length>0&&<div style={{display:"flex",gap:5,marginTop:6,flexWrap:"wrap",alignItems:"center"}}>
                    {c.receipts.map((r,i)=>(
                      <div key={i} style={{display:"inline-flex",flexDirection:"column",alignItems:"center",gap:2}}>
                        {r.type?.startsWith("image/")?<img src={r.url} alt="receipt" style={{width:44,height:44,objectFit:"cover",borderRadius:5,border:`1px solid ${BDR}`,cursor:"pointer"}} onClick={()=>setMdl({type:"lightbox",data:r})}/>:<div onClick={()=>setMdl({type:"lightbox",data:r})} style={{width:44,height:44,background:"#fee2e2",borderRadius:5,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",border:"1px solid #fca5a5",cursor:"pointer"}}><span style={{fontSize:18}}>📄</span></div>}
                        <a href={r.url} download={r.name||`rcpt_${i+1}`} onClick={e=>e.stopPropagation()} style={{fontSize:8,color:GD,textDecoration:"none"}}>⬇</a>
                      </div>
                    ))}
                    <span style={{fontSize:10,color:MUTED}}>{c.receipts.length} receipt{c.receipts.length!==1?"s":""}</span>
                  </div>}
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontFamily:FD,fontSize:17,fontWeight:700,color:INK,marginBottom:3}}>{fmt(c.amount)}</div>
                  {c.origCur&&c.origCur!=="INR"&&<div style={{fontSize:9,color:MUTED,marginBottom:5}}>{c.origCur} {c.origAmount}</div>}
                  <div style={{display:"flex",gap:5}}>
                    <Btn onClick={()=>setMdl({type:"approve",data:c})} style={{padding:"6px 11px",fontSize:11}}>✓ Approve</Btn>
                    <Btn v="danger" onClick={()=>setMdl({type:"reject",data:c})} style={{padding:"6px 9px",fontSize:11}}>✗</Btn>
                  </div>
                </div>
              </div>
            </Card>
          );})}
        </div>
      ):(
        <Card style={{padding:40,textAlign:"center"}}><div style={{fontSize:32}}>🎉</div><div style={{fontFamily:FD,fontSize:16,fontWeight:700,color:INK,marginTop:8}}>All caught up!</div><div style={{color:MUTED,fontSize:12,marginTop:3}}>No pending approvals</div></Card>
      )}
    </div>
  );
}

// ─── TOPUP TAB ────────────────────────────────────────────────────────────────
function TopupTab({user,topups,setTopups,toast,sbCreateTopup}){
  const [form,setForm]=useState({amount:"",reason:""});
  const inpS={width:"100%",padding:"10px 12px",border:`1.5px solid ${BDR}`,borderRadius:9,fontSize:13,background:"#fafff8"};
  const submit=async()=>{if(!form.amount||!form.reason){toast("Fill all fields","error");return;}const req={id:"TUP-"+uid(),empId:user.id,amount:parseFloat(form.amount),reason:form.reason,date:today(),status:"Pending"};if(sbCreateTopup){await sbCreateTopup(req);}else{setTopups(p=>[...p,req]);}setForm({amount:"",reason:""});toast("Request sent to manager");};
  return(
    <div style={{maxWidth:480}}>
      <h1 style={{fontFamily:FD,fontSize:20,fontWeight:700,color:INK,marginBottom:4}}>Request Balance Top-Up</h1>
      <p style={{color:MUTED,fontSize:12,marginBottom:16}}>Request additional funds from your manager</p>
      <Card style={{padding:20,marginBottom:12}}>
        <div style={{marginBottom:12}}><label style={{fontSize:10,fontWeight:700,color:MUTED,display:"block",marginBottom:4,textTransform:"uppercase"}}>Amount (₹) *</label><input type="number" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} placeholder="e.g. 10000" style={inpS}/></div>
        <div style={{marginBottom:16}}><label style={{fontSize:10,fontWeight:700,color:MUTED,display:"block",marginBottom:4,textTransform:"uppercase"}}>Reason *</label><textarea value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})} rows={3} placeholder="Why do you need additional funds?" style={{...inpS,resize:"vertical"}}/></div>
        <Btn onClick={submit} style={{width:"100%",padding:11}}>Send Request</Btn>
      </Card>
      {topups.length>0&&<Card>{topups.map(t=><div key={t.id} style={{padding:"10px 14px",borderBottom:`1px solid #f8faf6`,display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{fontWeight:600,fontSize:12}}>{fmt(t.amount)}</div><div style={{fontSize:10,color:MUTED}}>{t.reason} · {t.date}</div></div><Badge s={t.status} sm/></div>)}</Card>}
    </div>
  );
}

// ─── ANALYTICS ────────────────────────────────────────────────────────────────
function Analytics({claims,trips,users,isManager,getUser,policy,printSummary,user}){
  const [from,setFrom]=useState("2026-01-01");
  const [to,setTo]=useState(today());
  const [empFilter,setEF]=useState("All");
  const emps=users.filter(u=>u.role==="employee");
  const filtered=claims.filter(c=>c.date>=from&&c.date<=to&&(empFilter==="All"||c.empId===empFilter));
  const approved=filtered.filter(c=>c.status==="Approved");
  const total=approved.reduce((s,c)=>s+c.amount,0);
  const byCat=CATS.map(cat=>({cat,amount:approved.filter(c=>c.category===cat).reduce((s,c)=>s+c.amount,0)})).filter(x=>x.amount>0).sort((a,b)=>b.amount-a.amount);
  const maxCat=Math.max(...byCat.map(d=>d.amount),1);
  const COLS=[G,"#34d399","#60a5fa","#f59e0b","#f472b6","#a78bfa","#fb923c","#94a3b8"];
  const months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const monthly=months.map((m,i)=>{const mn=String(i+1).padStart(2,"0");return{m,amount:approved.filter(c=>c.date.slice(5,7)===mn).reduce((s,c)=>s+c.amount,0)};}).filter(x=>x.amount>0);
  const maxM=Math.max(...monthly.map(d=>d.amount),1);
  const leaderboard=emps.map(e=>({e,spent:approved.filter(c=>c.empId===e.id).reduce((s,c)=>s+c.amount,0),n:approved.filter(c=>c.empId===e.id).length})).sort((a,b)=>b.spent-a.spent);
  const anomalies=claims.filter(c=>c.anomaly);
  const autoRate=claims.length?Math.round(claims.filter(c=>c.autoApproved).length/claims.length*100):0;
  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <h1 style={{fontFamily:FD,fontSize:20,fontWeight:700,color:INK}}>Analytics</h1>
        <div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap"}}>
          <button onClick={()=>printSummary(approved,isManager?null:user,null)} style={{padding:"6px 11px",background:"none",border:`1.5px solid ${BDR}`,borderRadius:8,cursor:"pointer",fontFamily:FB,fontSize:11,color:MUTED}}>🖨️ Print</button>
          <input type="date" value={from} onChange={e=>setFrom(e.target.value)} style={{padding:"6px 10px",border:`1.5px solid ${BDR}`,borderRadius:7,fontSize:12}}/>
          <span style={{fontSize:12,color:MUTED}}>–</span>
          <input type="date" value={to} onChange={e=>setTo(e.target.value)} style={{padding:"6px 10px",border:`1.5px solid ${BDR}`,borderRadius:7,fontSize:12}}/>
          {isManager&&<select value={empFilter} onChange={e=>setEF(e.target.value)} style={{padding:"6px 10px",border:`1.5px solid ${BDR}`,borderRadius:7,fontSize:12,appearance:"none",paddingRight:24}}>
            <option value="All">All Employees</option>
            {emps.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
          </select>}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:14}}>
        {[{l:"Total Spent",v:fmt(total),i:"💰"},{l:"Avg Claim",v:fmt(approved.length?Math.round(total/approved.length):0),i:"📊"},{l:"Anomalies",v:anomalies.length,i:"🔍"},{l:"Auto-Approved",v:`${autoRate}%`,i:"⚡"}].map((s,i)=>(
          <Card key={i} style={{padding:14}}><div style={{fontSize:20}}>{s.i}</div><div style={{fontFamily:FD,fontSize:17,fontWeight:700,color:INK,marginTop:3}}>{s.v}</div><div style={{fontSize:10,color:MUTED,marginTop:1}}>{s.l}</div></Card>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1.2fr 1fr",gap:12,marginBottom:12}}>
        <Card style={{padding:18}}>
          <div style={{fontFamily:FD,fontSize:13,fontWeight:700,color:INK,marginBottom:12}}>Spend by Category</div>
          {byCat.length===0?<div style={{color:MUTED,fontSize:12}}>No data for selected range</div>:byCat.map((d,i)=>(
            <div key={d.cat} style={{marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}><span style={{fontSize:12,color:"#374151"}}>{CI[d.cat]} {d.cat}</span><span style={{fontWeight:700,fontSize:12,color:INK}}>{fmt(d.amount)}</span></div>
              <div style={{background:"#f3f4f6",borderRadius:4,height:5,overflow:"hidden"}}><div style={{width:`${(d.amount/maxCat)*100}%`,background:COLS[i%COLS.length],height:"100%",borderRadius:4,transition:"width .6s"}}/></div>
            </div>
          ))}
        </Card>
        <Card style={{padding:18}}>
          <div style={{fontFamily:FD,fontSize:13,fontWeight:700,color:INK,marginBottom:12}}>Month-on-Month Trend</div>
          {monthly.length===0?<div style={{color:MUTED,fontSize:12}}>No data</div>:(
            <div style={{display:"flex",alignItems:"flex-end",gap:7,height:110}}>
              {monthly.map((d,i)=>(
                <div key={d.m} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                  <div style={{fontSize:9,color:MUTED,fontWeight:600}}>₹{Math.round(d.amount/1000)}k</div>
                  <div style={{width:"100%",background:i===monthly.length-1?G:"#d1fae5",borderRadius:"4px 4px 0 0",height:`${(d.amount/maxM)*85}px`,transition:"height .6s ease"}}/>
                  <div style={{fontSize:9,color:MUTED}}>{d.m}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
      {isManager&&leaderboard.some(r=>r.spent>0)&&<Card style={{padding:18,marginBottom:12}}>
        <div style={{fontFamily:FD,fontSize:13,fontWeight:700,color:INK,marginBottom:12}}>Employee Spend Leaderboard</div>
        <table style={{width:"100%"}}>
          <thead><tr><th>#</th><th>Employee</th><th>Dept</th><th>Claims</th><th>Total</th><th>vs Dept Budget</th></tr></thead>
          <tbody>{leaderboard.filter(r=>r.spent>0).map((row,i)=>(
            <tr key={row.e.id} className="rh">
              <td style={{fontWeight:700,color:i===0?"#f59e0b":i===1?"#9ca3af":i===2?"#b45309":MUTED,fontSize:14}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${i+1}`}</td>
              <td><div style={{display:"flex",alignItems:"center",gap:7}}><div style={{width:24,height:24,borderRadius:"50%",background:GL,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,color:GD,fontSize:9}}>{row.e.avatar}</div><span style={{fontWeight:600,fontSize:12}}>{row.e.name}</span></div></td>
              <td style={{color:MUTED,fontSize:11}}>{row.e.dept}</td>
              <td style={{fontWeight:600}}>{row.n}</td>
              <td style={{fontWeight:700,color:INK}}>{fmt(row.spent)}</td>
              <td style={{width:120}}><PBar value={row.spent} max={policy.departmentBudgets?.[row.e.dept]||50000} h={5}/></td>
            </tr>
          ))}</tbody>
        </table>
      </Card>}
      {anomalies.length>0&&<Card style={{padding:18}}>
        <div style={{fontFamily:FD,fontSize:13,fontWeight:700,color:"#7c3aed",marginBottom:10}}>🔍 Anomaly Report</div>
        {anomalies.map(c=>{const e=getUser(c.empId);return(<div key={c.id} style={{padding:"8px 0",borderBottom:`1px solid #f3f4f6`,display:"flex",gap:9,alignItems:"flex-start"}}>
          <span style={{fontFamily:"monospace",fontSize:10,color:GD,fontWeight:600,flexShrink:0}}>{c.id}</span>
          <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:INK}}>{c.desc} — {e?.name}</div><div style={{fontSize:10,color:"#7c3aed",marginTop:2}}>{(c.anomalyReasons||[]).join(" · ")}</div></div>
          <div style={{fontWeight:700,fontSize:12,color:INK,flexShrink:0}}>{fmt(c.amount)}</div>
          <Badge s={c.autoApproved&&c.status==="Approved"?"Auto-Approved":c.status} sm/>
        </div>);})}
      </Card>}
      <Card style={{padding:18,marginTop:12}}>
        <div style={{fontFamily:FD,fontSize:13,fontWeight:700,color:INK,marginBottom:12}}>Trip Summary</div>
        {trips.map(t=>{const s=claims.filter(c=>c.tripId===t.id&&c.status!=="Rejected").reduce((a,c)=>a+c.amount,0);return(
          <div key={t.id} style={{marginBottom:12,paddingBottom:12,borderBottom:`1px solid ${BDR}`}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:12,fontWeight:600,color:INK}}>{t.name}</span><Badge s={t.status==="active"?"Active":"Closed"} sm/></div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:MUTED,marginBottom:3}}><span>{fmt(s)} spent</span><span>of {fmt(t.budget)}</span></div>
            <PBar value={s} max={t.budget} h={4}/>
          </div>
        );})}
      </Card>
    </div>
  );
}

// ─── INBOX ────────────────────────────────────────────────────────────────────
function Inbox({notifications,setNotifs,userId}){
  const mine=notifications.filter(n=>n.userId===userId);
  const markAll=()=>setNotifs(p=>p.map(n=>n.userId===userId?{...n,read:true}:n));
  const TC={success:"#dcfce7",error:"#fee2e2",info:"#dbeafe",warn:"#fef3c7"};
  const TX={success:"#15803d",error:"#dc2626",info:"#1d4ed8",warn:"#92400e"};
  return(
    <div style={{maxWidth:560}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <h1 style={{fontFamily:FD,fontSize:20,fontWeight:700,color:INK}}>Notifications Inbox</h1>
        {mine.some(n=>!n.read)&&<Btn v="outline" onClick={markAll} style={{fontSize:11,padding:"5px 10px"}}>Mark all read</Btn>}
      </div>
      {mine.length===0?(<Card style={{padding:40,textAlign:"center"}}><div style={{fontSize:28}}>🔔</div><div style={{fontWeight:700,color:INK,marginTop:8}}>No notifications yet</div></Card>):(
        <div style={{display:"flex",flexDirection:"column",gap:7}}>
          {mine.map(n=><div key={n.id} style={{padding:"11px 14px",borderRadius:10,background:n.read?"#f9fafb":TC[n.type]||TC.info,border:`1px solid ${n.read?BDR:"transparent"}`,display:"flex",gap:9,alignItems:"flex-start"}}>
            <span style={{fontSize:16,flexShrink:0}}>{n.type==="success"?"✅":n.type==="error"?"❌":n.type==="warn"?"⚠️":"ℹ️"}</span>
            <div style={{flex:1}}><div style={{fontSize:12,fontWeight:n.read?400:600,color:n.read?MUTED:TX[n.type]||TX.info}}>{n.text}</div><div style={{fontSize:10,color:MUTED,marginTop:2}}>{n.time}</div></div>
            {!n.read&&<div style={{width:7,height:7,borderRadius:"50%",background:TX[n.type]||TX.info,flexShrink:0,marginTop:4}}/>}
          </div>)}
        </div>
      )}
    </div>
  );
}

// ─── AUDIT TAB ────────────────────────────────────────────────────────────────
function Audit({auditLog,claims,getUser}){
  return(
    <div>
      <h1 style={{fontFamily:FD,fontSize:20,fontWeight:700,color:INK,marginBottom:12}}>Audit Log</h1>
      <Card><table style={{width:"100%"}}>
        <thead><tr><th>Time</th><th>Action</th><th>Claim ID</th><th>Amount</th><th>By</th><th>Remarks</th></tr></thead>
        <tbody>{(auditLog||[]).length===0?<tr><td colSpan={6} style={{padding:36,textAlign:"center",color:MUTED}}>No audit entries yet</td></tr>:(auditLog||[]).map(a=>{
          const c=claims.find(x=>x.id===a.claimId);
          return(<tr key={a.id} className="rh">
            <td style={{fontSize:10,color:MUTED,fontFamily:"monospace"}}>{a.at}</td>
            <td><Badge s={a.action.includes("Approved")?"Approved":"Rejected"} sm/>{a.action==="Auto-Approved"&&<span style={{fontSize:9,color:MUTED,marginLeft:3}}>(auto)</span>}</td>
            <td style={{fontFamily:"monospace",fontSize:10,color:GD,fontWeight:600}}>{a.claimId}</td>
            <td style={{fontWeight:600,fontSize:12}}>{c?fmt(c.amount):"—"}</td>
            <td><div style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:20,height:20,borderRadius:"50%",background:a.by==="SYSTEM"?"#f3f4f6":GL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:700,color:GD}}>{a.by==="SYSTEM"?"⚡":getUser(a.by)?.avatar||"?"}</div><span style={{fontSize:11,fontWeight:600}}>{a.byName}</span></div></td>
            <td style={{color:MUTED,fontSize:11}}>{a.remarks||"—"}</td>
          </tr>);
        })}</tbody>
      </table></Card>
    </div>
  );
}

// ─── EMPLOYEES TAB ────────────────────────────────────────────────────────────
function Employees({companyMeta,users,setUsers,claims,policy,toast,addUserToSB,updateUserInSB,sbEnabled,companyDepts}){
  const depts=companyDepts||policy?.departments||DEFAULT_DEPTS;
  const emps=users.filter(u=>u.role!=="manager");
  const activeEmps=emps.filter(u=>!u.isSuspended);
  const maxUsers=companyMeta.maxUsers||0;
  const canAdd=activeEmps.length<maxUsers;
  const slotsLeft=Math.max(0,maxUsers-activeEmps.length);

  const[showAdd,  setShowAdd] =useState(false);
  const[editEmp,  setEditEmp] =useState(null);
  const[delEmp,   setDelEmp]  =useState(null);
  const[resetEmp, setResetEmp]=useState(null); // password reset
  const[newPwVal, setNewPwVal]=useState("");
  const[busy,     setBusy]    =useState(false);
  const[form,     setForm]    =useState({name:"",username:"",mobile:"",email:"",dept:depts[0]||"Operations",balance:"",password:"",role:"employee"});
  const[editForm, setEF]      =useState({});
  const inpS={padding:"9px 11px",border:`1.5px solid ${BDR}`,borderRadius:8,fontSize:13,background:"#fafff8",fontFamily:FB,width:"100%"};

  const handleNameChange=e=>{
    const n=e.target.value;
    setForm(f=>({...f,name:n,username:f.username||n.toLowerCase().replace(/\s+/g,".")}));
  };

  const add=async()=>{
    if(!form.name||!form.username||!form.password){toast("Name, username and password are required","error");return;}
    if(form.password.length<4){toast("Password must be at least 4 characters","error");return;}
    if(!canAdd){toast(`Active limit (${maxUsers}) reached. Suspend an existing employee to free a slot.`,"error");return;}
    if(users.find(u=>u.username?.toLowerCase()===form.username.toLowerCase())){toast("Username already taken","error");return;}
    setBusy(true);
    try{
      if(sbEnabled&&addUserToSB){
        await addUserToSB({name:form.name,username:form.username.toLowerCase().trim(),email:form.email||null,mobile:form.mobile||null,role:form.role,dept:form.dept,balance:parseFloat(form.balance)||0},form.password);
        toast("✓ "+form.name+" added — login: "+form.username.toLowerCase());
      } else {
        const newEmp={id:"emp_"+uid(),cid:companyMeta.id,name:form.name,username:form.username.toLowerCase().trim(),email:form.email||"",mobile:form.mobile||"",password:form.password,role:form.role,avatar:inits(form.name),dept:form.dept,balance:parseFloat(form.balance)||0,reimbursable:0,delegateTo:null,isSuspended:false,authType:"custom"};
        setUsers(p=>[...p,newEmp]);
        toast("✓ "+form.name+" added");
      }
      setForm({name:"",username:"",mobile:"",email:"",dept:depts[0]||"Operations",balance:"",password:"",role:"employee"});
      setShowAdd(false);
    }catch(e){toast(e.message,"error");}
    finally{setBusy(false);}
  };

  const openEdit=e=>{setEditEmp(e);setEF({name:e.name,dept:e.dept,role:e.role,balance:String(e.balance||0),mobile:e.mobile||"",password:""});};
  const saveEdit=async()=>{
    setBusy(true);
    try{
      const patch={name:editForm.name,dept:editForm.dept,role:editForm.role,balance:parseFloat(editForm.balance)||0,mobile:editForm.mobile||undefined};
      if(editForm.password)patch.password=editForm.password;
      if(sbEnabled&&updateUserInSB){await updateUserInSB(editEmp.id,patch);}
      else{setUsers(p=>p.map(u=>u.id===editEmp.id?{...u,...patch,avatar:inits(editForm.name)}:u));}
      toast("✓ "+editForm.name+" updated");setEditEmp(null);
    }catch(e){toast(e.message,"error");}
    finally{setBusy(false);}
  };

  const toggleSuspend=async emp=>{
    const ns=!emp.isSuspended;
    if(!ns&&activeEmps.length>=maxUsers){toast("Cannot activate — active limit reached","error");return;}
    try{
      if(sbEnabled&&updateUserInSB){await updateUserInSB(emp.id,{isSuspended:ns});}
      else{setUsers(p=>p.map(u=>u.id===emp.id?{...u,isSuspended:ns}:u));}
      toast(ns?"⏸ "+emp.name+" suspended":"▶ "+emp.name+" activated");
    }catch(e){toast(e.message,"error");}
  };

  const deleteEmp=async emp=>{
    try{
      if(sbEnabled){const{error}=await supabase.from("users").delete().eq("id",emp.id);if(error)throw new Error(error.message);}
      else{setUsers(p=>p.filter(u=>u.id!==emp.id));}
      toast(emp.name+" removed","warn");
    }catch(e){toast(e.message,"error");}
    setDelEmp(null);
  };

  const resetPassword=async()=>{
    if(!newPwVal||newPwVal.length<4){toast("Password must be at least 4 characters","error");return;}
    setBusy(true);
    try{
      if(sbEnabled){
        const{data,error}=await supabase.rpc("reset_user_password",{p_user_id:resetEmp.id,p_new_password:newPwVal});
        if(error)throw new Error(error.message);
        if(data?.error)throw new Error(data.error);
      } else {
        setUsers(p=>p.map(u=>u.id===resetEmp.id?{...u,password:newPwVal}:u));
      }
      toast("✓ Password reset for "+resetEmp.name);
      setResetEmp(null);setNewPwVal("");
    }catch(e){toast(e.message,"error");}
    finally{setBusy(false);}
  };

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div>
          <h1 style={{fontFamily:FD,fontSize:20,fontWeight:700,color:INK}}>Employees</h1>
          <p style={{color:MUTED,fontSize:11,marginTop:3}}>
            {activeEmps.length} active · {emps.filter(u=>u.isSuspended).length} suspended · max <strong style={{color:INK}}>{maxUsers}</strong> active allowed
            {" · "}<span style={{color:canAdd?GD:"#dc2626",fontWeight:700}}>{canAdd?slotsLeft+" slot"+(slotsLeft!==1?"s":"")+" free":"No slots — suspend to free one"}</span>
          </p>
        </div>
        <Btn onClick={()=>{if(!canAdd){toast("Active limit reached. Suspend an employee to free a slot.","error");return;}setShowAdd(!showAdd);}} v={canAdd?"primary":"outline"}>{showAdd?"✕ Cancel":"＋ Add Employee"}</Btn>
      </div>

      {!canAdd&&<div style={{background:"#fef3c7",border:"1px solid #fcd34d",borderRadius:9,padding:"10px 14px",marginBottom:12,fontSize:12,color:"#92400e"}}>
        ⚠ Active limit of <strong>{maxUsers}</strong> reached. Suspend an existing employee to free a slot, or ask your Admin to increase the limit.
      </div>}

      {showAdd&&canAdd&&<Card style={{padding:18,marginBottom:14,borderColor:G,background:GL}}>
        <div style={{fontFamily:FD,fontSize:13,fontWeight:700,color:INK,marginBottom:12}}>New Employee</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:10}}>
          <div><label style={{fontSize:9,fontWeight:700,color:MUTED,display:"block",marginBottom:3,textTransform:"uppercase"}}>Full Name *</label>
            <input value={form.name} onChange={handleNameChange} placeholder="Riya Mehta" style={inpS}/></div>
          <div><label style={{fontSize:9,fontWeight:700,color:MUTED,display:"block",marginBottom:3,textTransform:"uppercase"}}>Username * (for login)</label>
            <input value={form.username} onChange={e=>setForm({...form,username:e.target.value.toLowerCase().replace(/\s+/g,"")})} placeholder="riya.mehta" style={inpS}/></div>
          <div><label style={{fontSize:9,fontWeight:700,color:MUTED,display:"block",marginBottom:3,textTransform:"uppercase"}}>Password *</label>
            <input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="min 4 chars" style={inpS}/></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10,marginBottom:12}}>
          <div><label style={{fontSize:9,fontWeight:700,color:MUTED,display:"block",marginBottom:3,textTransform:"uppercase"}}>Mobile (optional)</label>
            <input value={form.mobile} onChange={e=>setForm({...form,mobile:e.target.value})} placeholder="9876543210" style={inpS}/></div>
          <div><label style={{fontSize:9,fontWeight:700,color:MUTED,display:"block",marginBottom:3,textTransform:"uppercase"}}>Department</label>
            <select value={form.dept} onChange={e=>setForm({...form,dept:e.target.value})} style={{...inpS,appearance:"none"}}>{depts.map(d=><option key={d}>{d}</option>)}</select></div>
          <div><label style={{fontSize:9,fontWeight:700,color:MUTED,display:"block",marginBottom:3,textTransform:"uppercase"}}>Role</label>
            <select value={form.role} onChange={e=>setForm({...form,role:e.target.value})} style={{...inpS,appearance:"none"}}>{ROLES.filter(r=>r.id!=="manager").map(r=><option key={r.id} value={r.id}>{r.label}</option>)}</select></div>
          <div><label style={{fontSize:9,fontWeight:700,color:MUTED,display:"block",marginBottom:3,textTransform:"uppercase"}}>Wallet ₹</label>
            <input type="number" value={form.balance} onChange={e=>setForm({...form,balance:e.target.value})} placeholder="0" style={inpS}/></div>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
          <div style={{background:"rgba(126,217,87,0.15)",border:"1px solid "+GM,borderRadius:7,padding:"7px 12px",fontSize:11,color:GD,flex:1}}>
            💡 Employee logs in with <strong>username + password</strong>. Mobile is an optional alternative login.
          </div>
          <Btn onClick={add} disabled={busy} style={{padding:"9px 20px",flexShrink:0}}>{busy?"Adding…":"Add Employee →"}</Btn>
        </div>
      </Card>}

      {/* Edit modal */}
      {editEmp&&(
        <div style={{position:"fixed",inset:0,background:"#00000055",display:"flex",alignItems:"center",justifyContent:"center",zIndex:600,backdropFilter:"blur(3px)"}} onClick={()=>setEditEmp(null)}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:16,padding:28,width:480,boxShadow:"0 24px 60px #0003"}}>
            <h3 style={{fontFamily:FD,fontSize:17,fontWeight:700,color:INK,marginBottom:16}}>Edit — {editEmp.name}</h3>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11,marginBottom:14}}>
              {[["Full Name","text",editForm.name,v=>setEF({...editForm,name:v}),""],
                ["Mobile","text",editForm.mobile,v=>setEF({...editForm,mobile:v}),"optional"],
                ["Wallet ₹","number",editForm.balance,v=>setEF({...editForm,balance:v}),""]
              ].map(([l,t,v,fn,ph])=>(
                <div key={l}><label style={{fontSize:9,fontWeight:700,color:MUTED,display:"block",marginBottom:3,textTransform:"uppercase"}}>{l}</label>
                  <input type={t} value={v} onChange={e=>fn(e.target.value)} placeholder={ph} style={inpS}/></div>
              ))}
              <div><label style={{fontSize:9,fontWeight:700,color:MUTED,display:"block",marginBottom:3,textTransform:"uppercase"}}>Department</label>
                <select value={editForm.dept} onChange={e=>setEF({...editForm,dept:e.target.value})} style={{...inpS,appearance:"none"}}>{depts.map(d=><option key={d}>{d}</option>)}</select></div>
              <div><label style={{fontSize:9,fontWeight:700,color:MUTED,display:"block",marginBottom:3,textTransform:"uppercase"}}>Role</label>
                <select value={editForm.role} onChange={e=>setEF({...editForm,role:e.target.value})} style={{...inpS,appearance:"none"}}>{ROLES.filter(r=>r.id!=="manager").map(r=><option key={r.id} value={r.id}>{r.label}</option>)}</select></div>
            </div>
            <div style={{display:"flex",gap:9}}><Btn onClick={saveEdit} disabled={busy} style={{flex:1,padding:11}}>{busy?"Saving…":"Save Changes"}</Btn><Btn v="outline" onClick={()=>setEditEmp(null)}>Cancel</Btn></div>
          </div>
        </div>
      )}

      {/* Password reset modal */}
      {resetEmp&&(
        <div style={{position:"fixed",inset:0,background:"#00000055",display:"flex",alignItems:"center",justifyContent:"center",zIndex:600,backdropFilter:"blur(3px)"}} onClick={()=>{setResetEmp(null);setNewPwVal("");}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:14,padding:26,width:380,boxShadow:"0 24px 60px #0003"}}>
            <h3 style={{fontFamily:FD,fontSize:16,fontWeight:700,color:INK,marginBottom:6}}>Reset Password</h3>
            <p style={{color:MUTED,fontSize:12,marginBottom:16}}>Set a new password for <strong>{resetEmp.name}</strong> ({resetEmp.username||resetEmp.email})</p>
            <input type="text" value={newPwVal} onChange={e=>setNewPwVal(e.target.value)} placeholder="New password (min 4 chars)" style={inpS} autoFocus/>
            <div style={{display:"flex",gap:8,marginTop:14}}>
              <Btn onClick={resetPassword} disabled={busy||!newPwVal} style={{flex:1,padding:10}}>{busy?"Resetting…":"Set Password"}</Btn>
              <Btn v="outline" onClick={()=>{setResetEmp(null);setNewPwVal("");}}>Cancel</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {delEmp&&(
        <div style={{position:"fixed",inset:0,background:"#00000055",display:"flex",alignItems:"center",justifyContent:"center",zIndex:600}} onClick={()=>setDelEmp(null)}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:14,padding:24,width:380,textAlign:"center"}}>
            <div style={{fontSize:32,marginBottom:8}}>⚠️</div>
            <div style={{fontFamily:FD,fontSize:15,fontWeight:700,color:INK,marginBottom:5}}>Delete {delEmp.name}?</div>
            <div style={{color:MUTED,fontSize:12,marginBottom:6}}>Their expense history stays intact but they lose access.</div>
            <div style={{background:"#fef3c7",border:"1px solid #fcd34d",borderRadius:7,padding:"8px 12px",marginBottom:16,fontSize:11,color:"#92400e"}}>
              💡 Suspending is safer — frees a slot, keeps history, can be undone.
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"center"}}>
              <Btn v="warning" onClick={()=>{toggleSuspend(delEmp);setDelEmp(null);}}>⏸ Suspend Instead</Btn>
              <Btn v="danger" onClick={()=>deleteEmp(delEmp)}>Delete Permanently</Btn>
              <Btn v="outline" onClick={()=>setDelEmp(null)}>Cancel</Btn>
            </div>
          </div>
        </div>
      )}

      <Card>
        <table style={{width:"100%"}}>
          <thead><tr><th>Employee</th><th>Username</th><th>Role</th><th>Dept</th><th>Balance</th><th>Claims</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>{emps.length===0?(
            <tr><td colSpan={8} style={{padding:36,textAlign:"center",color:MUTED,fontSize:13}}>No employees yet. Click ＋ Add Employee above to get started.</td></tr>
          ):emps.map(e=>{
            const ec=claims.filter(c=>c.empId===e.id);
            const role=ROLES.find(r=>r.id===e.role)||ROLES[1];
            return(<tr key={e.id} className="rh" style={{opacity:e.isSuspended?.6:1}}>
              <td>
                <div style={{display:"flex",alignItems:"center",gap:7}}>
                  <div style={{width:30,height:30,borderRadius:"50%",background:e.isSuspended?"#f3f4f6":GL,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,color:e.isSuspended?MUTED:GD,fontSize:10}}>{e.avatar}</div>
                  <div><div style={{fontWeight:600,fontSize:12}}>{e.name}</div><div style={{fontSize:10,color:MUTED}}>{e.email||e.mobile||"—"}</div></div>
                </div>
              </td>
              <td style={{fontFamily:"monospace",fontSize:11,color:GD,fontWeight:600}}>{e.username||"—"}</td>
              <td><span style={{background:role.color+"25",color:role.color,padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:700}}>{role.label}</span></td>
              <td><span style={{background:GL,color:GD,padding:"1px 6px",borderRadius:4,fontSize:10,fontWeight:600}}>{e.dept}</span></td>
              <td style={{fontWeight:700,color:policy.reimbursementMode?"#7c3aed":G,fontSize:12}}>{policy.reimbursementMode?fmt(e.reimbursable||0):fmt(e.balance||0)}</td>
              <td style={{fontSize:12,color:MUTED}}>{ec.length}</td>
              <td>{e.isSuspended
                ?<span style={{background:"#fee2e2",color:"#dc2626",padding:"2px 8px",borderRadius:5,fontSize:10,fontWeight:700}}>⊘ Suspended</span>
                :<span style={{background:"#dcfce7",color:"#16a34a",padding:"2px 8px",borderRadius:5,fontSize:10,fontWeight:700}}>● Active</span>}
              </td>
              <td>
                <div style={{display:"flex",gap:4}}>
                  <button onClick={()=>openEdit(e)} title="Edit" style={{background:"none",border:"1px solid "+BDR,color:MUTED,borderRadius:5,padding:"3px 7px",fontSize:11,cursor:"pointer"}}>✏</button>
                  <button onClick={()=>{setResetEmp(e);setNewPwVal("");}} title="Reset Password" style={{background:"none",border:"1px solid #93c5fd",color:"#2563eb",borderRadius:5,padding:"3px 7px",fontSize:11,cursor:"pointer"}}>🔑</button>
                  <button onClick={()=>toggleSuspend(e)} title={e.isSuspended?"Activate":"Suspend"} style={{background:"none",border:"1px solid "+(e.isSuspended?"#16a34a50":"#f59e0b50"),color:e.isSuspended?"#16a34a":"#f59e0b",borderRadius:5,padding:"3px 7px",fontSize:11,cursor:"pointer"}}>{e.isSuspended?"▶":"⏸"}</button>
                  <button onClick={()=>setDelEmp(e)} title="Delete" style={{background:"none",border:"1px solid #fca5a5",color:"#ef4444",borderRadius:5,padding:"3px 7px",fontSize:12,cursor:"pointer"}}>✕</button>
                </div>
              </td>
            </tr>);
          })}</tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── EDIT REQUESTS TAB ────────────────────────────────────────────────────────
function EditRequestsTab({editRequests,claims,getUser,isManager,approveEditRequest,rejectEditRequest,hasEditWindow,userId}){
  const pending=editRequests.filter(r=>r.status==="Pending");
  const resolved=editRequests.filter(r=>r.status!=="Pending");

  const getClaimInfo=req=>{
    const claimId=req.claim_id||req.claimId;
    return claims.find(c=>c.id===claimId);
  };

  return(
    <div>
      <div style={{marginBottom:16}}>
        <h1 style={{fontFamily:FD,fontSize:20,fontWeight:700,color:INK}}>Edit Requests</h1>
        <p style={{color:MUTED,fontSize:12,marginTop:3}}>Employees can request to edit approved expenses. Manager approves a 24-hour edit window. All overrides are audit-trailed.</p>
      </div>

      {pending.length>0&&<>
        <div style={{fontSize:10,fontWeight:700,color:MUTED,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Pending ({pending.length})</div>
        {pending.map(req=>{
          const claim=getClaimInfo(req);
          const emp=getUser(req.requested_by||req.requestedBy);
          return(
            <Card key={req.id} style={{padding:16,marginBottom:8,borderLeft:`3px solid #f59e0b`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
                <div>
                  <div style={{fontWeight:700,color:INK,fontSize:13}}>{req.claim_id||req.claimId}</div>
                  <div style={{color:MUTED,fontSize:11,marginTop:1}}>by {req.requester_name||req.requesterName} · {req.created_at?new Date(req.created_at).toLocaleDateString("en-IN"):""}</div>
                  {claim&&<div style={{fontSize:11,color:"#374151",marginTop:4}}>Claim: {claim.desc} — {fmt(claim.amount)}</div>}
                  <div style={{background:"#fef3c7",borderRadius:6,padding:"6px 10px",marginTop:6,fontSize:12,color:"#92400e"}}><strong>Reason:</strong> {req.reason}</div>
                </div>
                {isManager&&<div style={{display:"flex",gap:7,flexShrink:0}}>
                  <Btn onClick={()=>approveEditRequest(req)} style={{padding:"7px 12px",fontSize:11}}>✓ Approve (24h)</Btn>
                  <Btn v="danger" onClick={()=>rejectEditRequest(req)} style={{padding:"7px 10px",fontSize:11}}>✗ Reject</Btn>
                </div>}
              </div>
            </Card>
          );
        })}
      </>}

      {pending.length===0&&<div style={{background:GL,border:`1px solid ${GM}`,borderRadius:10,padding:24,textAlign:"center",marginBottom:16}}>
        <div style={{fontSize:24,marginBottom:6}}>✅</div>
        <div style={{fontWeight:600,color:INK,fontSize:13}}>No pending edit requests</div>
        <div style={{color:MUTED,fontSize:11,marginTop:3}}>All edit requests have been reviewed.</div>
      </div>}

      {resolved.length>0&&<>
        <div style={{fontSize:10,fontWeight:700,color:MUTED,textTransform:"uppercase",letterSpacing:1,marginBottom:8,marginTop:16}}>History ({resolved.length})</div>
        <Card>
          <table style={{width:"100%"}}>
            <thead><tr><th>Claim</th><th>Requested By</th><th>Reason</th><th>Status</th><th>Reviewed By</th><th>Date</th></tr></thead>
            <tbody>{resolved.map(req=>(
              <tr key={req.id} className="rh">
                <td style={{fontFamily:"monospace",fontSize:11,fontWeight:600,color:GD}}>{req.claim_id||req.claimId}</td>
                <td style={{fontSize:12}}>{req.requester_name||req.requesterName}</td>
                <td style={{fontSize:11,color:MUTED,maxWidth:180}}>{req.reason}</td>
                <td><Badge s={req.status==="Approved"?"Approved":"Rejected"} sm/></td>
                <td style={{fontSize:11,color:MUTED}}>{req.reviewer_name||req.reviewerName||"—"}</td>
                <td style={{fontSize:10,color:MUTED}}>{req.created_at?new Date(req.created_at).toLocaleDateString("en-IN"):""}</td>
              </tr>
            ))}</tbody>
          </table>
        </Card>
      </>}

      <div style={{marginTop:16,padding:"12px 14px",background:"#fef3c7",border:"1px solid #fcd34d",borderRadius:9,fontSize:11,color:"#92400e"}}>
        ⚠ <strong>Audit note:</strong> All approved edit requests are recorded with timestamps and included in the monthly finance digest. Override history cannot be deleted.
      </div>
    </div>
  );
}

// ─── POLICY TAB ───────────────────────────────────────────────────────────────
function Policy({policy,setPolicy,savePolicy,toast,users,sbEnabled}){
  const emps=users.filter(u=>u.role==="employee").length;
  const tier=TIERED.find(t=>emps>=t.min&&emps<=t.max)||TIERED[0];
  const [vendor,setVendor]=useState("");
  const [vMode,setVMode]=useState("blacklist");
  const inpS={padding:"8px 10px",border:`1.5px solid ${BDR}`,borderRadius:7,fontSize:12,background:"#fafff8",width:"100%"};
  return(
    <div>
      <h1 style={{fontFamily:FD,fontSize:20,fontWeight:700,color:INK,marginBottom:14}}>Policy & Settings</h1>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        {/* Core */}
        <Card style={{padding:18}}>
          <div style={{fontFamily:FD,fontSize:13,fontWeight:700,color:INK,marginBottom:12}}>Core Policy</div>
          {[["Auto-Approve Limit (₹)","autoApproveLimit"],["Receipt Mandatory Above (₹)","receiptMandatoryAbove"]].map(([l,k])=>(
            <div key={k} style={{marginBottom:12}}><label style={{fontSize:10,fontWeight:700,color:MUTED,display:"block",marginBottom:4,textTransform:"uppercase"}}>{l}</label><input type="number" value={policy[k]||0} onChange={e=>setPolicy({...policy,[k]:parseFloat(e.target.value)||0})} style={inpS}/></div>
          ))}
          <Toggle on={policy.reimbursementMode}         onClick={()=>setPolicy({...policy,reimbursementMode:!policy.reimbursementMode})}         label="Reimbursement Mode"        sub="No wallet — employees claim back invoices"/>
          <Toggle on={policy.weekendRequiresApproval}   onClick={()=>setPolicy({...policy,weekendRequiresApproval:!policy.weekendRequiresApproval})} label="Weekend → Approval"        sub="Sat/Sun expenses go to manager"/>
          <Toggle on={policy.multiLevelApproval}        onClick={()=>setPolicy({...policy,multiLevelApproval:!policy.multiLevelApproval})}          label="Multi-Level Approval"     sub="Different approvers by amount"/>
          {policy.multiLevelApproval&&<div style={{marginTop:10,background:GL,borderRadius:8,padding:"10px 12px"}}>
            <div style={{fontSize:10,fontWeight:700,color:GD,marginBottom:7,textTransform:"uppercase"}}>Approval Levels</div>
            {(policy.approvalLevels||[]).map((lv,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:7,marginBottom:6,fontSize:12}}>
                <span style={{color:MUTED,minWidth:18}}>L{i+1}</span><span style={{color:MUTED}}>Up to</span>
                <input type="number" value={lv.upTo} onChange={e=>{const a=[...policy.approvalLevels];a[i]={...a[i],upTo:parseFloat(e.target.value)||0};setPolicy({...policy,approvalLevels:a});}} style={{width:80,padding:"4px 7px",border:`1.5px solid ${BDR}`,borderRadius:5,fontSize:11}}/>
                <select value={lv.role} onChange={e=>{const a=[...policy.approvalLevels];a[i]={...a[i],role:e.target.value};setPolicy({...policy,approvalLevels:a});}} style={{padding:"4px 7px",border:`1.5px solid ${BDR}`,borderRadius:5,fontSize:11,appearance:"none"}}>
                  {ROLES.filter(r=>["manager","approver","finance"].includes(r.id)).map(r=><option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              </div>
            ))}
          </div>}
        </Card>
        {/* Vendor */}
        <Card style={{padding:18}}>
          <div style={{fontFamily:FD,fontSize:13,fontWeight:700,color:INK,marginBottom:12}}>Vendor Policy</div>
          <div style={{display:"flex",gap:7,marginBottom:10}}>
            {["whitelist","blacklist"].map(m=><button key={m} onClick={()=>setVMode(m)} style={{flex:1,padding:"6px",borderRadius:7,border:`1.5px solid ${vMode===m?G:BDR}`,background:vMode===m?GL:"#fff",color:vMode===m?GD:MUTED,fontFamily:FB,fontSize:11,fontWeight:600,cursor:"pointer",textTransform:"capitalize"}}>{m==="whitelist"?"✓ Whitelist":"✗ Blacklist"}</button>)}
          </div>
          <div style={{fontSize:11,color:MUTED,marginBottom:9}}>{vMode==="whitelist"?"Only listed vendors allowed":"Claims from these vendors blocked"}</div>
          <div style={{display:"flex",gap:7,marginBottom:9}}>
            <input value={vendor} onChange={e=>setVendor(e.target.value)} placeholder="Vendor name…" style={{...inpS,flex:1}}/>
            <Btn onClick={()=>{if(!vendor.trim())return;const k=vMode==="whitelist"?"vendorWhitelist":"vendorBlacklist";setPolicy({...policy,[k]:[...(policy[k]||[]),vendor.trim()]});setVendor("");}} style={{padding:"8px 12px",fontSize:12}}>Add</Btn>
          </div>
          {(vMode==="whitelist"?policy.vendorWhitelist||[]:policy.vendorBlacklist||[]).map((v,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 9px",background:vMode==="whitelist"?GL:"#fee2e2",borderRadius:6,marginBottom:5,fontSize:12}}>
              <span style={{color:vMode==="whitelist"?GD:"#dc2626"}}>{vMode==="whitelist"?"✓":"✗"} {v}</span>
              <button onClick={()=>{const k=vMode==="whitelist"?"vendorWhitelist":"vendorBlacklist";setPolicy({...policy,[k]:policy[k].filter((_,j)=>j!==i)});}} style={{background:"none",border:"none",color:MUTED,cursor:"pointer",fontSize:13}}>×</button>
            </div>
          ))}
        </Card>
        {/* Category % */}
        <Card style={{padding:18}}>
          <div style={{fontFamily:FD,fontSize:13,fontWeight:700,color:INK,marginBottom:4}}>Category % Limits per Trip</div>
          <div style={{fontSize:11,color:MUTED,marginBottom:10}}>Exceeding → sent to manager for approval</div>
          {CATS.map(cat=>(
            <div key={cat} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <span style={{fontSize:12,flex:1,color:"#374151"}}>{CI[cat]} {cat}</span>
              <div style={{display:"flex",alignItems:"center",gap:4}}><input type="number" value={policy.categoryPct?.[cat]||0} onChange={e=>setPolicy({...policy,categoryPct:{...policy.categoryPct,[cat]:parseFloat(e.target.value)||0}})} style={{...inpS,width:52,textAlign:"center"}}/><span style={{fontSize:11,color:MUTED}}>%</span></div>
            </div>
          ))}
        </Card>
        {/* Dept budgets */}
        <Card style={{padding:18}}>
          <div style={{fontFamily:FD,fontSize:13,fontWeight:700,color:INK,marginBottom:12}}>Department Budgets (₹/month)</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {DEPTS.map(dept=>(<div key={dept}><label style={{fontSize:9,color:MUTED,fontWeight:700,display:"block",marginBottom:2,textTransform:"uppercase"}}>{dept}</label><input type="number" value={policy.departmentBudgets?.[dept]||0} onChange={e=>setPolicy({...policy,departmentBudgets:{...(policy.departmentBudgets||{}),[dept]:parseFloat(e.target.value)||0}})} style={inpS}/></div>))}
          </div>
        </Card>
        {/* Scheduled reports */}
        <Card style={{padding:18}}>
          <div style={{fontFamily:FD,fontSize:13,fontWeight:700,color:INK,marginBottom:12}}>Scheduled Email Reports</div>
          <Toggle on={policy.scheduledReports?.enabled} onClick={()=>setPolicy({...policy,scheduledReports:{...policy.scheduledReports,enabled:!policy.scheduledReports?.enabled}})} label="Enable Scheduled Reports" sub="Auto-email PDF reports"/>
          {policy.scheduledReports?.enabled&&<div style={{marginTop:10}}>
            <div style={{marginBottom:10}}><label style={{fontSize:10,fontWeight:700,color:MUTED,display:"block",marginBottom:4,textTransform:"uppercase"}}>Frequency</label>
              <select value={policy.scheduledReports?.frequency||"weekly"} onChange={e=>setPolicy({...policy,scheduledReports:{...policy.scheduledReports,frequency:e.target.value}})} style={{...inpS,appearance:"none",paddingRight:28}}>
                {["daily","weekly","monthly"].map(f=><option key={f} value={f}>{f.charAt(0).toUpperCase()+f.slice(1)}</option>)}
              </select>
            </div>
            <div><label style={{fontSize:10,fontWeight:700,color:MUTED,display:"block",marginBottom:4,textTransform:"uppercase"}}>Send to Email</label><input type="email" value={policy.scheduledReports?.email||""} onChange={e=>setPolicy({...policy,scheduledReports:{...policy.scheduledReports,email:e.target.value}})} placeholder="reports@company.in" style={inpS}/></div>
            <div style={{marginTop:8,padding:"7px 10px",background:GL,borderRadius:7,fontSize:11,color:GD}}>✓ {policy.scheduledReports?.frequency} reports → {policy.scheduledReports?.email||"(set email above)"}</div>
          </div>}
        </Card>
        {/* Subscription */}
        <Card style={{padding:18}}>
          <div style={{fontFamily:FD,fontSize:13,fontWeight:700,color:INK,marginBottom:10}}>Subscription</div>
          <div style={{background:GL,border:`1px solid ${GM}`,borderRadius:9,padding:"10px 12px",marginBottom:12}}>
            <div style={{fontSize:9,color:GD,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Current Bill</div>
            <div style={{fontFamily:FD,fontSize:22,fontWeight:700,color:INK,marginTop:3}}>{fmt(emps*tier.ppu)}<span style={{fontSize:11,fontWeight:400,color:MUTED}}>/month</span></div>
            <div style={{fontSize:10,color:MUTED,marginTop:1}}>{emps} employees × {fmt(tier.ppu)}/user</div>
          </div>
          <table style={{width:"100%"}}><thead><tr><th>Users</th><th>₹/user/mo</th></tr></thead>
            <tbody>{TIERED.map(t=><tr key={t.min} style={{background:tier.min===t.min?GL:"transparent"}}><td style={{fontWeight:600,fontSize:12}}>{t.min}–{t.max===999?"50+":t.max}</td><td style={{color:GD,fontWeight:700,fontSize:12}}>{fmt(t.ppu)}</td></tr>)}</tbody>
          </table>
        </Card>
      </div>

      {/* ── Departments ── */}
      <Card style={{padding:18,marginTop:12}}>
        <div style={{fontFamily:FD,fontSize:13,fontWeight:700,color:INK,marginBottom:12}}>Departments</div>
        <p style={{color:MUTED,fontSize:11,marginBottom:12}}>Employees are assigned to these departments. Edit or add to match your company structure.</p>
        <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:12}}>
          {(policy.departments||DEFAULT_DEPTS).map((d,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:4,background:GL,border:`1px solid ${GM}`,borderRadius:7,padding:"4px 10px"}}>
              <span style={{fontSize:12,fontWeight:600,color:GD}}>{d}</span>
              <button onClick={()=>{const nd=(policy.departments||DEFAULT_DEPTS).filter((_,j)=>j!==i);setPolicy({...policy,departments:nd});}} style={{background:"none",border:"none",color:"#dc2626",cursor:"pointer",fontSize:12,padding:"0 2px",lineHeight:1}}>✕</button>
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:8}}>
          <input id="newDeptInput" placeholder="Add department (e.g. Legal)" style={{padding:"8px 11px",border:`1.5px solid ${BDR}`,borderRadius:7,fontSize:12,flex:1,background:"#fafff8"}}
            onKeyDown={e=>{if(e.key==="Enter"){const v=e.target.value.trim();if(v&&!(policy.departments||DEFAULT_DEPTS).includes(v)){setPolicy({...policy,departments:[...(policy.departments||DEFAULT_DEPTS),v]});e.target.value="";};}}}/>
          <Btn v="outline" onClick={()=>{const el=document.getElementById("newDeptInput");const v=el.value.trim();if(v&&!(policy.departments||DEFAULT_DEPTS).includes(v)){setPolicy({...policy,departments:[...(policy.departments||DEFAULT_DEPTS),v]});el.value="";}}} style={{padding:"8px 14px",fontSize:12}}>+ Add</Btn>
        </div>
      </Card>

      {/* ── Brand Color ── */}
      <Card style={{padding:18,marginTop:12}}>
        <div style={{fontFamily:FD,fontSize:13,fontWeight:700,color:INK,marginBottom:8}}>Brand Color</div>
        <p style={{color:MUTED,fontSize:11,marginBottom:14}}>Choose your company's accent color. Applied across the sidebar, buttons, and badges.</p>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
          {["#7ED957","#2563eb","#7c3aed","#db2777","#ea580c","#0891b2","#16a34a","#dc2626","#f59e0b","#374151"].map(c=>(
            <button key={c} onClick={()=>setPolicy({...policy,primaryColor:c})} style={{width:32,height:32,borderRadius:"50%",background:c,border:(policy.primaryColor||"#7ED957")===c?"3px solid #1a2e12":"3px solid transparent",cursor:"pointer",boxShadow:(policy.primaryColor||"#7ED957")===c?"0 0 0 2px #fff inset":"none",transition:"all .15s"}}/>
          ))}
          <div style={{display:"flex",alignItems:"center",gap:7,marginLeft:8}}>
            <label style={{fontSize:11,color:MUTED}}>Custom:</label>
            <input type="color" value={policy.primaryColor||"#7ED957"} onChange={e=>setPolicy({...policy,primaryColor:e.target.value})} style={{width:36,height:32,padding:2,borderRadius:6,border:`1.5px solid ${BDR}`,cursor:"pointer"}}/>
            <span style={{fontSize:11,fontFamily:"monospace",color:MUTED}}>{policy.primaryColor||"#7ED957"}</span>
          </div>
        </div>
        <div style={{marginTop:12,padding:"10px 14px",background:GL,borderRadius:8,fontSize:12,color:GD}}>
          💡 Color changes apply immediately after saving. The sidebar, buttons, and status badges will update.
        </div>
      </Card>

      <div style={{marginTop:12}}><Btn onClick={async()=>{if(sbEnabled&&savePolicy){try{await savePolicy(policy);toast("✓ Settings saved to database");}catch(e){toast(e.message,"error");}}else{toast("✓ Settings saved");}}} style={{background:policy.primaryColor||G}}>Save All Settings</Btn></div>
    </div>
  );
}

// ─── HELP MANUAL ─────────────────────────────────────────────────────────────
const HELP_CONTENT={
  manager:{
    title:"Manager Guide",
    sections:[
      {icon:"▦",title:"Dashboard",content:"Your dashboard shows total spend, pending approvals, anomaly alerts, employee balances, and active trip progress. Red button = immediate attention needed. Purple = AI-flagged anomalies."},
      {icon:"✓",title:"Approvals",content:"All pending expense claims appear here. Each card shows the employee, amount, category, trip, and receipt thumbnails. Use ✓ Approve or ✗ Reject. Add remarks for clarity. The system auto-approves claims under your set limit — these won't appear here.\n\n🔍 Anomaly badge = AI detected unusual spend (duplicate, 2.5× avg). ⚠️ = category % exceeded. 📅 = weekend expense."},
      {icon:"📋",title:"All Claims",content:"Full claim history with filters for Pending/Approved/Rejected. Click any row to open the detail modal with full receipts, comments thread, and approval actions."},
      {icon:"🗂️",title:"Trips & Periods",content:"Create a trip or monthly period with a budget. Assign specific employees — only they can submit claims against it. Click the trip name to expand and see per-employee spend. Close a trip to lock it."},
      {icon:"👥",title:"Employees",content:"Add employees with name, email, department, starting balance, and password. Set their role: Employee, Approver, Auditor, or Finance. Adjust wallet balance inline. Set delegation to route approvals to another user when you're on leave."},
      {icon:"⚙️",title:"Policy",content:"Configure:\n• Auto-approve limit — claims under this go through instantly\n• Receipt mandatory above — employees must attach a bill\n• Weekend approval — Sat/Sun claims need manager sign-off\n• Multi-level approval — different approvers by claim size\n• Vendor blacklist — block specific vendors at submit time\n• Category % caps — category overspend routes to you\n• Department budgets — monthly limits per team\n• Scheduled reports — auto-email PDF summaries"},
      {icon:"📊",title:"Analytics",content:"Filter by date range and employee. Charts show: spend by category (bar), month-on-month trend, employee leaderboard vs dept budget, and AI anomaly report. Use 🖨️ Print to generate a formatted expense summary."},
      {icon:"⬇",title:"Exports",content:"Top bar exports:\n• CSV — all claims with full data, works with Excel\n• Tally XML — import directly into Tally Prime (Vouchers → Import)\n• GSTR-2A CSV — GST reconciliation format with IGST/CGST/SGST\n• Zoho Books CSV — import under Expenses in Zoho Books"},
    ]
  },
  employee:{
    title:"Employee Guide",
    sections:[
      {icon:"▦",title:"Dashboard",content:"Shows your wallet balance (or pending reimbursement), total claims, pending count, and active trip progress. Your balance reduces as claims are approved."},
      {icon:"＋",title:"Submit Expense",content:"1. Upload a receipt image/PDF or use 📷 Camera to capture it\n2. AI scans and auto-fills vendor, amount, date, category, GSTIN, invoice number\n3. Fields highlighted in green = AI-filled, verify before submitting\n4. Select trip, adjust currency if foreign expense (auto-converts to INR)\n5. Add notes for any GSTIN or invoice reference\n6. ⚡ = will auto-approve instantly (under limit with receipt)\n\nBatch: click ＋ Add to submit multiple receipts in one go."},
      {icon:"📋",title:"My Claims",content:"Full history of your submissions. Filter by status. Click any row to see full details, receipts, and comments from your manager. You can add comments to ask questions or provide clarifications."},
      {icon:"🗂️",title:"Trips",content:"View trips assigned to you and their budgets. You can also create personal trips. Your submissions are tracked per trip — the progress bar shows your spend vs the trip budget."},
      {icon:"💰",title:"Top-Up",content:"If your wallet balance is running low, submit a top-up request here with the amount needed and reason. Your manager will approve or reject it."},
      {icon:"🔔",title:"Notifications",content:"All approval decisions, rejections, and balance changes appear here. You'll also receive browser push notifications if you allow them. Check the inbox bell icon for unread alerts."},
      {icon:"👤",title:"Profile",content:"Update your name, email, and department. Change your password. Access from the avatar in the sidebar."},
    ]
  },
  auditor:{
    title:"Auditor Guide",
    sections:[
      {icon:"📋",title:"All Claims",content:"Full read-only access to all expense claims across all employees. Use the anomaly filter to surface AI-flagged unusual transactions. All receipts are viewable and downloadable."},
      {icon:"📊",title:"Analytics",content:"Full analytics access: category trends, month-on-month, employee leaderboard, and the complete anomaly report with AI reasoning."},
      {icon:"⬇",title:"Exports",content:"Export CSV, Tally XML, GSTR-2A, and Zoho Books formats for reconciliation and audit purposes."},
      {icon:"🗒️",title:"Audit Log",content:"Complete timestamped log of every approval, rejection, and auto-approval action with actor and remarks."},
    ]
  },
  superadmin:{
    title:"Super Admin Guide",
    sections:[
      {icon:"🏢",title:"Companies",content:"Create, suspend, and delete companies. Set user limits — employees cannot be added beyond the limit. Adjust limits inline in the table. Suspend a company to prevent all logins."},
      {icon:"👥",title:"All Users",content:"Cross-company user directory. View all users, their company, role, and department."},
      {icon:"💳",title:"Billing",content:"View monthly billing per company based on employee count and tiered pricing. Change a company's plan (Starter/Pro/Enterprise). Pricing tiers: 1–5 users ₹299/user, 6–20 ₹249, 21–50 ₹199, 51+ ₹149."},
      {icon:"📋",title:"Audit Log",content:"Cross-company audit log of all approval actions."},
      {icon:"💡",title:"How to Create a Company",content:"1. Click ＋ New Company\n2. Enter company name, industry, plan, and user limit\n3. Enter admin name, email, and password\n4. Click Create →\n5. Sign out of Super Admin\n6. Log in with the admin email and password you just set\n\nThe admin will have Manager role with full access to their workspace."},
    ]
  }
};

function HelpManual({userRole,onClose,inline=false}){
  const role=userRole==="superadmin"?"superadmin":["manager","approver","finance"].includes(userRole)?"manager":userRole==="auditor"?"auditor":"employee";
  const content=HELP_CONTENT[role]||HELP_CONTENT.employee;
  const [activeSection,setActiveSection]=useState(0);
  const section=content.sections[activeSection];

  const inner=(
    <div style={{background:"#fff",borderRadius:inline?14:18,width:inline?"100%":720,maxHeight:inline?"none":"88vh",display:"flex",overflow:inline?"visible":"hidden",boxShadow:inline?"none":"0 24px 60px #0004",flexDirection:inline?"column":"row"}}>
      {/* Sidebar */}
      {!inline&&<div style={{width:220,background:DARK,flexShrink:0,display:"flex",flexDirection:"column",padding:"24px 12px"}}>
        <div style={{marginBottom:20}}><Logo width={140} dark/></div>
        <div style={{fontSize:9,color:G,fontWeight:700,textTransform:"uppercase",letterSpacing:1.5,marginBottom:10,paddingLeft:8}}>📖 {content.title}</div>
        {content.sections.map((s,i)=>(
          <button key={i} onClick={()=>setActiveSection(i)} style={{display:"flex",alignItems:"center",gap:8,padding:"9px 10px",borderRadius:8,cursor:"pointer",border:"none",fontFamily:FB,fontSize:12,fontWeight:activeSection===i?600:400,background:activeSection===i?G:"transparent",color:activeSection===i?"#fff":"rgba(255,255,255,.55)",textAlign:"left",width:"100%",marginBottom:2,transition:"all .15s"}}>
            <span style={{fontSize:13,width:16,textAlign:"center"}}>{s.icon}</span>
            <span>{s.title}</span>
          </button>
        ))}
        <div style={{marginTop:"auto",paddingTop:12,borderTop:"1px solid rgba(255,255,255,.1)"}}>
          <div style={{fontSize:10,color:"rgba(255,255,255,.3)",textAlign:"center",lineHeight:1.5}}>ClaimX<br/>by RB · support@claimx.in</div>
        </div>
      </div>}
      {/* Content */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        {inline&&<div style={{display:"flex",gap:7,marginBottom:16,flexWrap:"wrap"}}>
          {content.sections.map((s,i)=><button key={i} onClick={()=>setActiveSection(i)} style={{padding:"6px 12px",borderRadius:20,border:`1.5px solid ${activeSection===i?G:BDR}`,background:activeSection===i?G:"#fff",color:activeSection===i?"#fff":MUTED,fontFamily:FB,fontSize:11,fontWeight:600,cursor:"pointer"}}>{s.icon} {s.title}</button>)}
        </div>}
        {!inline&&<div style={{padding:"20px 24px 16px",borderBottom:`1px solid ${BDR}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:9,color:MUTED,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Help Manual</div>
            <h2 style={{fontFamily:FD,fontSize:20,fontWeight:700,color:INK}}>{section.title}</h2>
          </div>
          <button onClick={onClose} style={{width:32,height:32,borderRadius:8,background:"#f3f4f6",border:"none",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",color:MUTED}}>✕</button>
        </div>}
        {inline&&<h2 style={{fontFamily:FD,fontSize:18,fontWeight:700,color:INK,marginBottom:12}}>{section.icon} {section.title}</h2>}
        <div style={{flex:1,overflow:"auto",padding:inline?"0":"24px"}}>
          {section.content.split('\n').map((line,i)=>{
            if(line.startsWith('•')||line.match(/^\d+\./)) return<div key={i} style={{display:"flex",gap:8,marginBottom:7,paddingLeft:4}}><span style={{color:G,fontWeight:700,flexShrink:0,marginTop:1,fontSize:13}}>{line.match(/^\d+\./)?line.match(/^\d+\./)[0]:"•"}</span><span style={{fontSize:13,color:"#374151",lineHeight:1.6}}>{line.replace(/^•\s*/,"").replace(/^\d+\.\s*/,"")}</span></div>;
            if(line==="") return<div key={i} style={{height:10}}/>;
            return<p key={i} style={{fontSize:13,color:"#374151",lineHeight:1.7,marginBottom:4}}>{line}</p>;
          })}
          <div style={{marginTop:20,background:GL,border:`1px solid ${GM}`,borderRadius:10,padding:"14px 16px"}}>
            <div style={{fontSize:10,fontWeight:700,color:GD,textTransform:"uppercase",letterSpacing:1,marginBottom:7}}>💡 Quick Tips</div>
            {role==="employee"&&activeSection===1&&["Green border = AI auto-filled — always verify the amount","Drag & drop images onto the upload zone","Camera button works on mobile — point at bill for instant scan","Multi-currency: enter original amount, system converts to ₹"].map((t,i)=><div key={i} style={{fontSize:12,color:GD,marginBottom:5}}>→ {t}</div>)}
            {role==="manager"&&activeSection===1&&["Use Select All + Bulk Approve for quick batch processing","Anomaly-flagged claims need extra scrutiny — check receipts","Add a remark when rejecting so employee knows what to resubmit"].map((t,i)=><div key={i} style={{fontSize:12,color:GD,marginBottom:5}}>→ {t}</div>)}
            {role==="superadmin"&&["Sign out first after creating a company, then login with the new admin credentials","Suspended companies cannot login — all data is preserved","Adjust user limits inline in the table — changes are instant"].map((t,i)=><div key={i} style={{fontSize:12,color:GD,marginBottom:5}}>→ {t}</div>)}
            {!["employee","manager","superadmin"].includes(role)&&["All data exports from the top bar buttons","Anomaly filter shows AI-flagged claims instantly"].map((t,i)=><div key={i} style={{fontSize:12,color:GD,marginBottom:5}}>→ {t}</div>)}
          </div>
        </div>
        <div style={{padding:"14px 24px",borderTop:`1px solid ${BDR}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:11,color:MUTED}}>{activeSection+1} of {content.sections.length}</span>
          <div style={{display:"flex",gap:8}}>
            <Btn v="outline" onClick={()=>setActiveSection(Math.max(0,activeSection-1))} disabled={activeSection===0} style={{padding:"7px 14px",fontSize:12}}>← Prev</Btn>
            <Btn onClick={()=>activeSection<content.sections.length-1?setActiveSection(activeSection+1):onClose()} style={{padding:"7px 14px",fontSize:12}}>{activeSection<content.sections.length-1?"Next →":"Done ✓"}</Btn>
          </div>
        </div>
      </div>
    </div>
  );

  if(inline) return<div style={{maxWidth:700}}><h1 style={{fontFamily:FD,fontSize:20,fontWeight:700,color:INK,marginBottom:16}}>📖 Help & User Manual</h1>{inner}</div>;
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:900,backdropFilter:"blur(4px)"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()}>{inner}</div>
    </div>
  );
}
// ─── EDIT REQUEST MODAL ───────────────────────────────────────────────────────
function ClaimModal({modal,setMdl,handleDecision,getUser,trips,claims,setClaims,userId,userName,addCommentToSB,sbEnabled,cid,editRequests,onEditRequest,onApproveEditRequest,onRejectEditRequest}){
  const [remarks,setRemarks]=useState("");
  const [comment,setComment]=useState("");
  const [receiptsWithUrls,setRWU]=useState(null);

  // ALL hooks must be before any conditional return (React rules)
  // Get claim data safely — will be null for lightbox type
  const isLightbox=modal?.type==="lightbox";
  const c=isLightbox?null:modal?.data;

  // Fetch signed receipt URLs — runs for all modal types but only does work when c exists
  useEffect(()=>{
    if(!c?.receipts?.length){setRWU([]);return;}
    const needsFetch=c.receipts.some(r=>!r.url&&r.storagePath);
    if(!needsFetch){setRWU(c.receipts);return;}
    if(!SB_ENABLED){setRWU(c.receipts);return;}
    Promise.all(c.receipts.map(async r=>{
      if(r.url||!r.storagePath)return r;
      try{
        const{data}=await supabase.storage.from("receipts").createSignedUrl(r.storagePath,3600);
        return{...r,url:data?.signedUrl||null};
      }catch{return r;}
    })).then(setRWU);
  },[c?.id]);

  // Early return for lightbox — safe because all hooks are above
  if(isLightbox)return<Lightbox receipt={modal.data} onClose={()=>setMdl(null)}/>;

  const{type,data}=modal;
  const e=getUser(c.empId);
  const trip=trips.find(t=>t.id===c.tripId);
  const displayReceipts=receiptsWithUrls||c.receipts||[];

  const addComment=async()=>{
    if(!comment.trim())return;
    if(sbEnabled&&addCommentToSB){await addCommentToSB(c.id,comment);}
    else{setClaims(p=>p.map(x=>x.id===c.id?{...x,comments:[...(x.comments||[]),{userId,name:userName,text:comment,time:new Date().toLocaleString()}]}:x));}
    setComment("");
  };

  return(
    <div style={{position:"fixed",inset:0,background:"#00000055",display:"flex",alignItems:"center",justifyContent:"center",zIndex:500,backdropFilter:"blur(3px)"}} onClick={()=>setMdl(null)}>
      <div onClick={ev=>ev.stopPropagation()} style={{background:"#fff",borderRadius:16,padding:24,width:530,maxHeight:"90vh",overflow:"auto",boxShadow:"0 20px 60px #0003"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:13}}>
          <span style={{fontFamily:FD,fontSize:16,fontWeight:700,color:INK}}>{type==="detail"?"Claim Details":type==="approve"?"Approve Claim":"Reject Claim"}</span>
          <button onClick={()=>setMdl(null)} style={{background:"none",border:"none",fontSize:15,cursor:"pointer",color:MUTED}}>✕</button>
        </div>
        <div style={{background:GL,borderRadius:9,padding:13,marginBottom:12}}>
          <div style={{fontFamily:"monospace",fontSize:10,color:GD,fontWeight:600}}>{c.id}</div>
          <div style={{fontSize:14,fontWeight:700,color:INK,marginTop:2}}>{c.desc}</div>
          <div style={{fontFamily:FD,fontSize:22,fontWeight:700,color:INK,marginTop:3}}>{fmt(c.amount)}{c.origCur&&c.origCur!=="INR"&&<span style={{fontSize:11,fontWeight:400,color:MUTED}}> ({c.origCur} {c.origAmount})</span>}</div>
        </div>
        {[["Employee",e?.name],["Date",c.date+(c.weekendFlag?" 📅":"")],["Category",`${CI[c.category]||""} ${c.category}`],["Trip",trip?.name],["Vendor",c.vendor||"—"],["Notes",c.notes||"—"],...(c.remarks?[["Remarks",c.remarks]]:[])].map(([k,v])=>(
          <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid #f3f4f6`,fontSize:12}}><span style={{color:MUTED}}>{k}</span><span style={{fontWeight:600,color:INK,maxWidth:260,textAlign:"right"}}>{v}</span></div>
        ))}
        {c.anomaly&&<div style={{background:"#ede9fe",border:"1px solid #c4b5fd",borderRadius:7,padding:"8px 11px",marginTop:9,fontSize:11,color:"#7c3aed"}}>🔍 Anomaly: {(c.anomalyReasons||[]).join(" · ")}</div>}
        {/* Receipts */}
        {displayReceipts.length>0&&<div style={{marginTop:10}}>
          <div style={{fontSize:10,fontWeight:700,color:MUTED,textTransform:"uppercase",letterSpacing:.5,marginBottom:7}}>Receipts ({displayReceipts.length})</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {displayReceipts.map((r,i)=>(
              <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                {r.url?(
                  r.type?.startsWith("image/")
                    ?<img src={r.url} alt={r.name||"receipt"} style={{width:80,height:80,objectFit:"cover",borderRadius:7,border:`1px solid ${BDR}`,cursor:"zoom-in"}} onClick={()=>setMdl({type:"lightbox",data:r})}/>
                    :<div style={{width:80,height:80,background:"#fee2e2",borderRadius:7,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",border:"1px solid #fca5a5",cursor:"pointer"}} onClick={()=>setMdl({type:"lightbox",data:r})}><span style={{fontSize:28}}>📄</span></div>
                ):(
                  <div style={{width:80,height:80,background:"#f3f4f6",borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",border:`1px solid ${BDR}`}}><span style={{fontSize:24}}>⏳</span></div>
                )}
                {r.url&&<a href={r.url} download={r.name||`receipt_${i+1}`} style={{fontSize:9,color:GD,textDecoration:"none",background:GL,padding:"1px 6px",borderRadius:4,fontWeight:600}}>⬇ Download</a>}
              </div>
            ))}
          </div>
        </div>}
        {/* Comments */}
        <div style={{marginTop:11}}>
          <div style={{fontSize:10,fontWeight:700,color:MUTED,textTransform:"uppercase",letterSpacing:.5,marginBottom:7}}>💬 Comments</div>
          {(c.comments||[]).length===0&&<div style={{fontSize:11,color:MUTED,marginBottom:7}}>No comments yet</div>}
          {(c.comments||[]).map((cm,i)=>(
            <div key={i} style={{padding:"7px 10px",background:"#f9fafb",borderRadius:7,marginBottom:5}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}><span style={{fontSize:11,fontWeight:600,color:INK}}>{cm.name}</span><span style={{fontSize:9,color:MUTED}}>{cm.time}</span></div>
              <div style={{fontSize:12,color:"#374151"}}>{cm.text}</div>
            </div>
          ))}
          <div style={{display:"flex",gap:7,marginTop:5}}>
            <input value={comment} onChange={e=>setComment(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addComment()} placeholder="Add a comment…" style={{flex:1,padding:"8px 11px",border:`1.5px solid ${BDR}`,borderRadius:7,fontFamily:FB,fontSize:12,outline:"none"}}/>
            <Btn onClick={addComment} v="outline" style={{padding:"7px 11px",fontSize:11}}>Send</Btn>
          </div>
        </div>
        {/* Approve/Reject actions */}
        {(type==="approve"||type==="reject")&&<div style={{marginTop:12}}>
          <label style={{fontSize:10,fontWeight:700,color:MUTED,display:"block",marginBottom:4,textTransform:"uppercase"}}>Remarks (optional)</label>
          <textarea value={remarks} onChange={e=>setRemarks(e.target.value)} rows={2} placeholder="Add a note…" style={{width:"100%",padding:"8px 11px",border:`1.5px solid ${BDR}`,borderRadius:7,fontFamily:FB,fontSize:12,resize:"none"}}/>
          <div style={{display:"flex",gap:8,marginTop:10}}>
            {type==="approve"&&<Btn onClick={()=>handleDecision(c.id,"Approved",remarks)} style={{flex:1}}>✓ Confirm Approval</Btn>}
            {type==="reject"&&<Btn v="danger" onClick={()=>handleDecision(c.id,"Rejected",remarks)} style={{flex:1}}>✗ Confirm Rejection</Btn>}
            <Btn v="outline" onClick={()=>setMdl(null)}>Cancel</Btn>
          </div>
        </div>}
        {type==="detail"&&<div style={{marginTop:11,display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <Badge s={c.autoApproved&&c.status==="Approved"?"Auto-Approved":c.status}/>
          <div style={{display:"flex",gap:7}}>
            {(c.status==="Approved"||c.status==="Auto-Approved")&&c.empId===userId&&onEditRequest&&(
              <Btn v="warning" onClick={()=>setMdl({type:"editRequest",data:c})} style={{padding:"6px 12px",fontSize:11}}>✏ Request Edit</Btn>
            )}
            <Btn v="outline" onClick={()=>setMdl(null)} style={{fontSize:11}}>Close</Btn>
          </div>
        </div>}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
//  ROOT — Supabase auth listener + localStorage demo fallback
// ═══════════════════════════════════════════════════════════════════════════
export default function Root(){
  const[DB,setDB]          =useState(()=>loadDB()||DB0);
  const[session,setSession]=useState(()=>{ 
    // On mount, restore custom auth session immediately to avoid flash
    if(SB_ENABLED){ const s=loadSess(); if(s?.customAuth&&s?.sbUser)return s; }
    return null;
  });
  const[loading,setLoading]=useState(true);
  const[isReset,setIsReset]=useState(false);
  const[loadMsg,setLoadMsg]=useState("Connecting…");
  const resolving=useRef(false);
  const customAuthRef=useRef(false); // tracks if current session is custom auth

  useEffect(()=>{ if(!SB_ENABLED)saveDB(DB); },[DB]);

  useEffect(()=>{
    if(!SB_ENABLED){
      const s=loadSess();
      if(s)setSession(s);
      setLoading(false);
      return;
    }

    // Safety: if Supabase never responds in 10s, show login
    const timer=setTimeout(()=>{
      setLoadMsg("Taking too long — showing login…");
      setTimeout(()=>setLoading(false),1500);
    },10000);

    // Listen FIRST — handles INITIAL_SESSION, SIGNED_IN, PASSWORD_RECOVERY
    const{data:{subscription}}=supabase.auth.onAuthStateChange(async(event,sess)=>{
      if(event==="PASSWORD_RECOVERY"){
        setIsReset(true);setSession(null);setLoading(false);
        clearTimeout(timer);return;
      }
      if(event==="SIGNED_OUT"){
        resolving.current=false;
        // Check localStorage directly — ref may not be set yet for custom auth users
        const savedSess=loadSess();
        if(savedSess?.customAuth&&savedSess?.sbUser){
          // This is a custom auth user — Supabase SIGNED_OUT is expected, ignore it
          customAuthRef.current=true;
          setSession(savedSess);
          setLoading(false);clearTimeout(timer);return;
        }
        if(customAuthRef.current){
          setLoading(false);clearTimeout(timer);return;
        }
        setSession(null);setIsReset(false);setLoading(false);
        clearTimeout(timer);return;
      }
      if(event==="INITIAL_SESSION"){
        if(!sess?.user){
          // No Supabase JWT — check for persisted custom auth session
          const savedSess=loadSess();
          if(savedSess?.customAuth&&savedSess?.sbUser){
            customAuthRef.current=true;
            setSession(savedSess);
          }
          setLoading(false);clearTimeout(timer);
        }
        return;
      }
      if((event==="SIGNED_IN"||event==="TOKEN_REFRESHED")&&sess?.user){
        if(resolving.current)return;
        resolving.current=true;
        clearTimeout(timer);
        await resolveSupabaseUser(sess.user.id);
      }
    });

    return()=>{subscription.unsubscribe();clearTimeout(timer);};
  },[]);

  const resolveSupabaseUser=async(authUserId)=>{
    setLoadMsg("Loading your workspace…");
    try{
      // Get the auth user object first — this always works with a valid session
      const{data:{user:authUser}}=await supabase.auth.getUser();
      if(!authUser){setLoading(false);resolving.current=false;return;}

      // ── Check if super admin ──────────────────────────────────────────
      // First try the super_admins table (may be blocked by RLS if policy not set)
      const{data:saRow}=await supabase
        .from("super_admins").select("id").eq("id",authUserId).maybeSingle();

      // If super_admins row found → it's the SA
      if(saRow){
        setSession({userId:authUserId,companyId:null,role:"superadmin",
          sbUser:{id:authUserId,name:"Super Admin",email:authUser.email||"",role:"superadmin",avatar:"SA"}});
        return;
      }

      // ── Check users table (company employees) ────────────────────────
      // Use maybeSingle() — returns null instead of throwing when no row found
      const{data:profile,error:pErr}=await supabase
        .from("users").select("*").eq("id",authUserId).maybeSingle();

      if(pErr){
        console.warn("users table error:",pErr.message,"code:",pErr.code);
        // If RLS blocks even reading users table, show error on login
        return;
      }

      if(profile){
        setSession({userId:authUserId,companyId:profile.company_id,
          role:profile.role,sbUser:mapUser(profile)});
        return;
      }

      // ── Neither found — fallback: check if email matches known SA email ─
      // Handles case where super_admins RLS blocks the table query
      if(authUser.email==="rushabh@rbshah.co.in"||saRow===null&&authUser.email===SA.email){
        // Likely the SA account — treat as superadmin
        console.log("Resolving as superadmin via email match:",authUser.email);
        setSession({userId:authUserId,companyId:null,role:"superadmin",
          sbUser:{id:authUserId,name:"Super Admin",email:authUser.email,role:"superadmin",avatar:"SA"}});
        return;
      }

      // No profile found — user authenticated but not set up in DB yet
      console.warn("Authenticated user has no profile row. Email:",authUser.email,
        "\nRun in Supabase SQL editor:\n",
        `INSERT INTO public.super_admins (id) VALUES ('${authUserId}') ON CONFLICT DO NOTHING;`
      );
    }catch(e){
      console.error("resolveSupabaseUser error:",e);
    }finally{
      setLoading(false);resolving.current=false;
    }
  };

  const handleLogin=(u,m)=>{
    if(u.role==="superadmin"){
      const s={userId:"sa1",companyId:null,role:"superadmin",sbUser:u};
      saveSess(s); // save FIRST so SIGNED_OUT handler can read it
      customAuthRef.current=false;
      setSession(s);
    } else {
      const s={
        userId:u.id,
        companyId:m?.id||u.companyId||null,
        role:u.role,
        sbUser:u,
        customAuth:true,
      };
      saveSess(s); // save FIRST before any Supabase events fire
      customAuthRef.current=true;
      setSession(s);
      setLoading(false);
    }
  };
  const handleLogout=async()=>{
    resolving.current=false;
    const isCustomAuth=session?.customAuth||customAuthRef.current;
    customAuthRef.current=false;
    if(SB_ENABLED&&!isCustomAuth){
      try{await supabase.auth.signOut();}catch(e){console.warn("signOut error:",e);}
    }
    setSession(null);setIsReset(false);saveSess(null);
  };

  // If we have a valid custom auth session already, skip the loading screen entirely
  const hasValidSession=session&&(session.customAuth?session.sbUser:true);

  if(loading&&!hasValidSession)return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:`linear-gradient(145deg,${DARK},#162e0d)`,fontFamily:FB}}>
      <div style={{textAlign:"center",maxWidth:340}}>
        <Logo width={180} dark/>
        <div style={{marginTop:24,display:"flex",alignItems:"center",justifyContent:"center",gap:8,color:"rgba(255,255,255,0.4)",fontSize:13}}>
          <span style={{width:18,height:18,border:"2px solid rgba(255,255,255,0.2)",borderTopColor:G,borderRadius:"50%",animation:"spin .8s linear infinite",display:"inline-block",flexShrink:0}}/>
          {loadMsg}
        </div>
        <button onClick={()=>setLoading(false)}
          style={{marginTop:20,background:"none",border:"1px solid rgba(255,255,255,0.15)",borderRadius:8,color:"rgba(255,255,255,0.35)",padding:"7px 16px",fontFamily:FB,fontSize:11,cursor:"pointer"}}>
          Skip → Go to Login
        </button>
      </div>
    </div>
  );

  if(isReset)return<ErrorBoundary><Login onLogin={handleLogin} DB={DB} isPasswordRecovery={true}/></ErrorBoundary>;

  let currentUser=null,currentMeta=null;
  if(session){
    if(session.role==="superadmin"){
      currentUser=session.sbUser||SA;
    } else if(session.customAuth&&session.sbUser){
      // Custom auth — user object is stored directly in session
      currentUser=session.sbUser;
      currentMeta={id:session.companyId,name:"",industry:"",plan:"",maxUsers:0,status:"Active",createdOn:""};
    } else if(SB_ENABLED&&session.sbUser){
      currentUser=session.sbUser;
      currentMeta={id:session.companyId,name:"",industry:"",plan:"",maxUsers:0,status:"Active",createdOn:""};
    } else {
      for(const cid of Object.keys(DB)){
        const u=DB[cid].users.find(u=>u.id===session.userId);
        if(u){currentUser=u;currentMeta=DB[cid].meta;break;}
      }
    }
  }

  // Only clear session if it's NOT a valid custom auth session
  if(session&&!currentUser&&!session.customAuth){saveSess(null);return<ErrorBoundary><Login onLogin={handleLogin} DB={DB}/></ErrorBoundary>;}
  if(!session||!currentUser)return<ErrorBoundary><Login onLogin={handleLogin} DB={DB}/></ErrorBoundary>;
  if(currentUser.role==="superadmin")return<ErrorBoundary><SuperAdmin DB={DB} setDB={setDB} onLogout={handleLogout}/></ErrorBoundary>;
  if(SB_ENABLED)return<ErrorBoundary><CompanyApp user={currentUser} meta={{id:session.companyId,...currentMeta}} DB={DB} setDB={setDB} onLogout={handleLogout}/></ErrorBoundary>;
  return<ErrorBoundary><CompanyApp user={currentUser} meta={currentMeta} DB={DB} setDB={setDB} onLogout={handleLogout}/></ErrorBoundary>;
}
