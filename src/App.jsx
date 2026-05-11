
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Chart, BarController, BarElement, DoughnutController, LineController, LineElement, PointElement, CategoryScale, LinearScale, ArcElement, Tooltip, Legend, Filler } from "chart.js";
import * as XLSX from "xlsx";
import "./style.css";

Chart.register(BarController, BarElement, DoughnutController, LineController, LineElement, PointElement, CategoryScale, LinearScale, ArcElement, Tooltip, Legend, Filler);

const STATUSES = ["Lead mới", "Đã gọi", "Đặt lịch", "T1", "Đã mua gói", "Mất lead"];
const SOURCES = ["MKT", "FB Tổng", "Page cơ sở", "Vãng lai", "Tự kiếm", "Khách cũ", "Khách giới thiệu", "Hotline tổng", "Website"];
const DEFAULT_BRANCHES = ["AKC Ba Đình", "AKC Cầu Giấy", "AKC Long Biên", "AKC Xuân La", "AKC Thanh Xuân", "AKC Đống Đa", "AKC Tương Mai"];

const DEFAULT_USERS = [
  { id: 1, name: "Admin AKC", email: "admin@akc.vn", password: "123456", phone: "", branch: "Tất cả", role: "admin", owner: "", status: "approved", active: true, created: "2026-05-11" },
  { id: 2, name: "Manager Cầu Giấy", email: "manager.caugiay@akc.vn", password: "123456", phone: "", branch: "AKC Cầu Giấy", role: "manager", owner: "Mai Anh", status: "approved", active: true, created: "2026-05-11" },
  { id: 3, name: "Mai Anh", email: "maianh@akc.vn", password: "123456", phone: "", branch: "AKC Cầu Giấy", role: "sale", owner: "Mai Anh", status: "approved", active: true, created: "2026-05-11" },
  { id: 4, name: "Tuấn Sale", email: "tuan@akc.vn", password: "123456", phone: "", branch: "AKC Ba Đình", role: "sale", owner: "Tuấn Sale", status: "approved", active: true, created: "2026-05-11" }
];

const seed = [
  {id:1,name:"Nguyễn Minh Anh",phone:"0988123456",source:"MKT",branch:"AKC Cầu Giấy",owner:"Mai Anh",status:"Lead mới",package_interest:"Membership",value:3500000,follow:"2026-05-12",created:"2026-05-04",note:"Quan tâm giảm mỡ"},
  {id:2,name:"Trần Quốc Huy",phone:"0911222333",source:"FB Tổng",branch:"AKC Ba Đình",owner:"Tuấn Sale",status:"Đặt lịch",package_interest:"PT",value:6000000,follow:"2026-05-11",created:"2026-05-05",note:"Hẹn 18h"},
  {id:3,name:"Lê Phương Thảo",phone:"0977666888",source:"Khách giới thiệu",branch:"AKC Long Biên",owner:"Hương AKC",status:"Đã mua gói",package_interest:"Membership",value:9000000,follow:"",created:"2026-05-06",note:"Chốt gói 6 tháng"},
  {id:4,name:"Phạm Tuấn Kiệt",phone:"0902555666",source:"Hotline tổng",branch:"AKC Xuân La",owner:"Minh Đức",status:"Đã gọi",package_interest:"Membership",value:4500000,follow:"2026-05-13",created:"2026-05-07",note:"Muốn xem cơ sở"},
  {id:5,name:"Hoàng Thanh Mai",phone:"0966777888",source:"Page cơ sở",branch:"AKC Thanh Xuân",owner:"Ngọc Anh",status:"Đã mua gói",package_interest:"PT + Membership",value:12000000,follow:"",created:"2026-05-08",note:"PT + membership"}
];

function money(n){ return Number(n||0).toLocaleString("vi-VN") + "đ"; }
function load(key, fallback){ try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } }
function save(key, value){ localStorage.setItem(key, JSON.stringify(value)); }
function today(){ return new Date().toISOString().slice(0,10); }

function getSalesFromUsers(users){
  return users.filter(u => u.status === "approved" && u.active !== false && (u.role === "sale" || u.role === "manager")).map(u => ({
    id: u.id,
    name: u.owner || u.name,
    email: u.email,
    branch: u.branch,
    role: u.role,
    active: u.active
  }));
}

function getPermissions(user){
  const isAdmin = user.role === "admin";
  const isManager = user.role === "manager";
  const isSale = user.role === "sale";
  return {
    isAdmin, isManager, isSale,
    canViewAll: isAdmin,
    canManageBranches: isAdmin,
    canManageUsers: isAdmin,
    canDeleteLead: isAdmin,
    canImportExport: isAdmin || isManager,
    canViewReports: isAdmin || isManager,
    canViewSettings: isAdmin,
    canEditAnyLead: isAdmin,
    canCreateLead: true
  };
}
function visibleLeadForUser(lead, user){
  if(user.role === "admin") return true;
  if(user.role === "manager") return lead.branch === user.branch;
  if(user.role === "sale") return lead.owner === user.owner && lead.branch === user.branch;
  return false;
}
function canEditLead(lead, user){
  if(user.role === "admin") return true;
  if(user.role === "manager") return lead.branch === user.branch;
  if(user.role === "sale") return lead.owner === user.owner && lead.branch === user.branch;
  return false;
}

function AuthScreen({users,setUsers,onLogin,branches}){
  const [mode,setMode]=useState("login");
  const [error,setError]=useState("");
  const [login,setLogin]=useState({email:"admin@akc.vn", password:"123456"});
  const [reg,setReg]=useState({name:"", phone:"", email:"", password:"", branch:branches[0] || "AKC Cầu Giấy"});

  function doLogin(e){
    e.preventDefault();
    setError("");
    const found = users.find(u => u.email.trim().toLowerCase() === login.email.trim().toLowerCase() && u.password === login.password);
    if(!found){ setError("Sai email hoặc mật khẩu."); return; }
    if(found.status === "pending"){ setError("Tài khoản đang chờ Admin duyệt."); return; }
    if(found.status === "rejected"){ setError("Tài khoản đã bị từ chối."); return; }
    if(found.active === false){ setError("Tài khoản đang bị khóa."); return; }
    onLogin(found);
  }

  function doRegister(e){
    e.preventDefault();
    setError("");
    if(users.some(u => u.email.trim().toLowerCase() === reg.email.trim().toLowerCase())){
      setError("Email này đã tồn tại.");
      return;
    }
    const row = {
      id: Date.now(),
      name: reg.name.trim(),
      phone: reg.phone.trim(),
      email: reg.email.trim().toLowerCase(),
      password: reg.password,
      branch: reg.branch,
      role: "pending",
      owner: reg.name.trim(),
      status: "pending",
      active: false,
      created: today()
    };
    setUsers([row, ...users]);
    setMode("login");
    setLogin({email: reg.email, password: reg.password});
    setError("Đăng ký thành công. Tài khoản đang chờ Admin duyệt.");
  }

  return <div className="login-wrap">
    <div className="login-card">
      <div className="logo big">AKC</div>
      <h1>{mode === "login" ? "Đăng nhập AKC CRM" : "Đăng ký tài khoản"}</h1>
      <p>{mode === "login" ? "Tài khoản phải được Admin duyệt mới đăng nhập được." : "Sau khi đăng ký, Admin sẽ phân quyền và kích hoạt tài khoản."}</p>
      {mode === "login" ? <form onSubmit={doLogin}>
        <label>Email<input value={login.email} onChange={e=>setLogin({...login,email:e.target.value})}/></label>
        <label>Mật khẩu<input type="password" value={login.password} onChange={e=>setLogin({...login,password:e.target.value})}/></label>
        {error && <div className={error.includes("thành công") ? "success" : "error"}>{error}</div>}
        <button className="primary full">Đăng nhập</button>
        <button type="button" className="ghost full" onClick={()=>{setMode("register");setError("");}}>Đăng ký tài khoản mới</button>
        <div className="demo-box">
                </form>
) : (
<form onSubmit={doRegister}>
        <label>Họ tên<input value={reg.name} onChange={e=>setReg({...reg,name:e.target.value})} required/></label>
        <label>Số điện thoại<input value={reg.phone} onChange={e=>setReg({...reg,phone:e.target.value})}/></label>
        <label>Email<input type="email" value={reg.email} onChange={e=>setReg({...reg,email:e.target.value})} required/></label>
        <label>Mật khẩu<input type="password" value={reg.password} onChange={e=>setReg({...reg,password:e.target.value})} required/></label>
        <label>Cơ sở đăng ký<select value={reg.branch} onChange={e=>setReg({...reg,branch:e.target.value})}>{branches.map(b=><option key={b}>{b}</option>)}</select></label>
        {error && <div className="error">{error}</div>}
        <button className="primary full">Gửi đăng ký</button>
        <button type="button" className="ghost full" onClick={()=>{setMode("login");setError("");}}>Quay lại đăng nhập</button>
      </form>
)}
    </div>
  </div>
}

function App(){
  const [users,setUsers]=useState(()=>load("akc_v7_users", DEFAULT_USERS));
  const [user,setUser]=useState(()=>load("akc_v7_user", null));
  const [page,setPage]=useState("Tổng quan");
  const [leads,setLeads]=useState(()=>load("akc_v7_leads", seed));
  const [branches,setBranches]=useState(()=>load("akc_v7_branches", DEFAULT_BRANCHES));
  const [modal,setModal]=useState(null);
  const [filter,setFilter]=useState({branch:"", source:"", owner:"", date:""});

  useEffect(()=>save("akc_v7_users", users),[users]);
  useEffect(()=>{ if(user) save("akc_v7_user", user); },[user]);
  useEffect(()=>save("akc_v7_leads", leads),[leads]);
  useEffect(()=>save("akc_v7_branches", branches),[branches]);

  if(!user) return <AuthScreen users={users} setUsers={setUsers} branches={branches} onLogin={(u)=>{setUser(u); setPage("Tổng quan");}}/>;

  const perm = getPermissions(user);
  const activeSales = getSalesFromUsers(users);
  const salesNames = activeSales.map(s => s.name);

  const roleVisibleLeads = leads.filter(l => visibleLeadForUser(l,user));
  const filtered = roleVisibleLeads.filter(l =>
    (!filter.branch || l.branch===filter.branch) &&
    (!filter.source || l.source===filter.source) &&
    (!filter.owner || l.owner===filter.owner) &&
    (!filter.date || l.created===filter.date)
  );

  const availableBranches = user.role === "admin" ? branches : branches.filter(b => b === user.branch);
  const availableSales = user.role === "admin" ? activeSales : activeSales.filter(s => s.branch === user.branch && (user.role === "manager" || s.name === user.owner));

  const won = filtered.filter(x=>x.status==="Đã mua gói");
  const booked = filtered.filter(x=>x.status==="Đặt lịch");
  const t1 = filtered.filter(x=>x.status==="T1");
  const revenue = won.reduce((s,x)=>s+Number(x.value||0),0);
  const pendingCount = users.filter(u=>u.status==="pending").length;

  const navAll = [
    "Tổng quan","Lead","Pipeline","Timeline chăm sóc","Lịch hẹn",
    ...(perm.canViewReports ? ["Báo cáo"] : []),
    ...(perm.canManageBranches ? ["Cơ sở"] : []),
    ...(perm.canManageUsers ? [`Tài khoản${pendingCount ? " ("+pendingCount+")" : ""}`] : []),
    "Zalo/Facebook",
    ...(perm.canViewSettings ? ["Cài đặt"] : [])
  ];

  function addDemo(){
    const i = leads.length + 1;
    const defaultBranch = user.role === "admin" ? (branches[i%branches.length] || branches[0]) : user.branch;
    const defaultOwner = user.role === "sale" ? user.owner : (availableSales[i%availableSales.length]?.name || user.owner || salesNames[0]);
    const row = {
      id:Date.now(),
      name:"Lead AKC " + i,
      phone:"09"+Math.floor(10000000+Math.random()*89999999),
      source:SOURCES[i%SOURCES.length],
      branch:defaultBranch,
      owner:defaultOwner,
      status:STATUSES[i%STATUSES.length],
      package_interest:["Membership","PT","PT + Membership","Trial"][i%4],
      value:[3000000,4500000,6000000,9000000,0][i%5],
      follow:"2026-05-15",
      created:today(),
      note:"Dữ liệu demo AKC"
    };
    setLeads([row,...leads]);
  }

  function saveLead(form){
    const row = {...form, value:Number(form.value||0), id:form.id || Date.now()};
    if(user.role === "sale"){ row.branch = user.branch; row.owner = user.owner; }
    if(user.role === "manager"){
      row.branch = user.branch;
      if(!availableSales.some(s=>s.name===row.owner)) row.owner = availableSales[0]?.name || user.owner;
    }
    if(form.id && !canEditLead(form,user)){ alert("Tài khoản này không có quyền sửa lead này."); return; }
    if(row.id && leads.some(l=>l.id===row.id)) setLeads(leads.map(x=>x.id===row.id?row:x));
    else setLeads([row,...leads]);
    setModal(null);
  }

  function deleteLead(id){
    if(!perm.canDeleteLead){ alert("Chỉ Admin mới được xóa lead."); return; }
    if(!confirm("Xóa lead này?")) return;
    setLeads(leads.filter(l=>l.id!==id));
  }

  function updateStatus(id, status){
    const lead = leads.find(l=>l.id===id);
    if(!lead || !canEditLead(lead,user)){ alert("Không có quyền đổi trạng thái lead này."); return; }
    setLeads(leads.map(l=>l.id===id?{...l,status}:l));
  }

  function exportExcel(){
    if(!perm.canImportExport){ alert("Tài khoản này không có quyền export."); return; }
    const ws = XLSX.utils.json_to_sheet(filtered.map(l=>({
      "Tên": l.name, "SĐT": l.phone, "Nguồn": l.source, "Cơ sở": l.branch, "Sale": l.owner,
      "Trạng thái": l.status, "Gói quan tâm": l.package_interest, "Giá trị": l.value,
      "Follow-up": l.follow, "Ngày tạo": l.created, "Ghi chú": l.note
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leads");
    XLSX.writeFile(wb, "akc-crm-leads-v7.xlsx");
  }

  function importExcel(e){
    if(!perm.canImportExport){ alert("Tài khoản này không có quyền import."); return; }
    const file=e.target.files?.[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=(evt)=>{
      const wb=XLSX.read(evt.target.result,{type:"binary"});
      const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      const mapped=rows.map((r,idx)=>{
        let branch = r["Cơ sở"] || r.branch || availableBranches[0] || "";
        let owner = r["Sale"] || r.owner || availableSales[0]?.name || "";
        if(user.role === "manager"){
          branch = user.branch;
          if(!availableSales.some(s=>s.name===owner)) owner = availableSales[0]?.name || user.owner;
        }
        return {
          id:Date.now()+idx,
          name:r["Tên"] || r.name || "",
          phone:String(r["SĐT"] || r.phone || ""),
          source:r["Nguồn"] || r.source || "MKT",
          branch,
          owner,
          status:r["Trạng thái"] || r.status || "Lead mới",
          package_interest:r["Gói quan tâm"] || r.package_interest || "Membership",
          value:Number(r["Giá trị"] || r.value || 0),
          follow:r["Follow-up"] || r.follow || "",
          created:r["Ngày tạo"] || r.created || today(),
          note:r["Ghi chú"] || r.note || ""
        };
      });
      setLeads([...mapped,...leads]);
      e.target.value="";
    };
    reader.readAsBinaryString(file);
  }

  function currentPageBase(){
    return page.startsWith("Tài khoản") ? "Tài khoản" : page;
  }

  return <div className="app">
    <aside className="sidebar">
      <div className="brand"><div className="logo">AKC</div><div><h1>AKC CRM</h1><p>Fullstack v7</p></div></div>
      <nav>{navAll.map(n=><button key={n} className={currentPageBase()===n.split(" (")[0]?"active":""} onClick={()=>setPage(n.split(" (")[0])}>{n}</button>)}</nav>
      <div className="profile">
        <strong>{user.name}</strong>
        <span>{user.role} {user.branch && user.branch !== "Tất cả" ? "· " + user.branch : ""}</span>
        <button onClick={()=>{localStorage.removeItem("akc_v7_user");setUser(null)}}>Đăng xuất</button>
      </div>
    </aside>
    <main className="main">
      <header className="topbar">
        <div><h2>{currentPageBase()}</h2><p>{roleHint(user)}</p></div>
        <div className="top-actions">
          {perm.canImportExport && <label className="import-btn">Import Excel<input type="file" accept=".xlsx,.xls,.csv" onChange={importExcel}/></label>}
          {perm.canImportExport && <button onClick={exportExcel}>Export</button>}
          {perm.canCreateLead && <button onClick={addDemo}>+ Dữ liệu demo</button>}
          {perm.canCreateLead && <button className="primary" onClick={()=>setModal({})}>+ Thêm lead</button>}
        </div>
      </header>

      <Filters filter={filter} setFilter={setFilter} branches={availableBranches} sales={availableSales}/>

      {currentPageBase()==="Tổng quan" && <Dashboard leads={filtered} won={won} booked={booked} t1={t1} revenue={revenue} branches={availableBranches} sales={availableSales}/>}
      {currentPageBase()==="Lead" && <LeadPage leads={filtered} setModal={setModal} deleteLead={deleteLead} user={user} perm={perm}/>}
      {currentPageBase()==="Pipeline" && <Pipeline leads={filtered} updateStatus={updateStatus}/>}
      {currentPageBase()==="Timeline chăm sóc" && <SimplePanel title="Timeline chăm sóc" text="Bản online sẽ lưu nhật ký gọi, nhắn Zalo, đặt lịch, T1, chốt sale theo từng lead."/>}
      {currentPageBase()==="Lịch hẹn" && <Calendar leads={filtered}/>}
      {currentPageBase()==="Báo cáo" && perm.canViewReports && <Reports leads={filtered} branches={availableBranches}/>}
      {currentPageBase()==="Cơ sở" && perm.canManageBranches && <BranchManager branches={branches} setBranches={setBranches} leads={leads} setLeads={setLeads} users={users} setUsers={setUsers}/>}
      {currentPageBase()==="Tài khoản" && perm.canManageUsers && <UserManager users={users} setUsers={setUsers} branches={branches} leads={leads} setLeads={setLeads}/>}
      {currentPageBase()==="Zalo/Facebook" && <SimplePanel title="Zalo/Facebook" text="Module chờ cấu hình Zalo OA API, Facebook Lead Form và Hotline để tự động đổ data về CRM theo nguồn/cơ sở."/>}
      {currentPageBase()==="Cài đặt" && perm.canViewSettings && <Settings branches={branches} setBranches={setBranches} setUsers={setUsers}/>}
    </main>
    {modal && <LeadModal initial={modal} branches={availableBranches} sales={availableSales} user={user} onClose={()=>setModal(null)} onSave={saveLead}/>}
  </div>
}

function roleHint(user){
  if(user.role === "admin") return "Admin: duyệt tài khoản, phân quyền, xem toàn hệ thống, quản lý cơ sở và xóa lead.";
  if(user.role === "manager") return `Manager: chỉ xem và xử lý dữ liệu thuộc ${user.branch}.`;
  return `Sale: chỉ xem và xử lý lead của ${user.owner} tại ${user.branch}.`;
}

function Filters({filter,setFilter,branches,sales}){
  const set=(k,v)=>setFilter({...filter,[k]:v});
  return <section className="filters">
    <select value={filter.branch} onChange={e=>set("branch",e.target.value)}><option value="">Tất cả cơ sở được phép</option>{branches.map(x=><option key={x}>{x}</option>)}</select>
    <select value={filter.source} onChange={e=>set("source",e.target.value)}><option value="">Tất cả nguồn</option>{SOURCES.map(x=><option key={x}>{x}</option>)}</select>
    <select value={filter.owner} onChange={e=>set("owner",e.target.value)}><option value="">Tất cả sale được phép</option>{sales.map(x=><option key={x.id}>{x.name}</option>)}</select>
    <input type="date" value={filter.date} onChange={e=>set("date",e.target.value)}/>
    <button onClick={()=>setFilter({branch:"",source:"",owner:"",date:""})}>Xóa lọc</button>
  </section>
}

function Dashboard({leads, won, booked, t1, revenue, branches, sales}){
  const total = leads.length;
  return <>
    <div className="cards">
      <Card title="Tổng Lead" value={total} sub="Theo quyền tài khoản"/>
      <Card title="Đặt lịch" value={booked.length} sub="Khách đã có lịch đến CLB"/>
      <Card title="T1" value={t1.length} sub="Khách đã đến tập thử"/>
      <Card title="Doanh thu" value={money(revenue)} sub="Deal đã mua gói"/>
    </div>
    <div className="chart-grid">
      <ChartCard title="Lead theo nguồn" sub="Theo data được phép xem"><SourceChart leads={leads}/></ChartCard>
      <ChartCard title="Trạng thái lead" sub="Pipeline hiện tại"><StatusChart leads={leads}/></ChartCard>
      <ChartCard title="Lead theo cơ sở" sub="Admin thấy tất cả, sale chỉ thấy cơ sở mình"><BranchChart leads={leads} branches={branches}/></ChartCard>
      <ChartCard title="KPI theo sale" sub="Theo sale được phép xem"><SaleChart leads={leads} sales={sales}/></ChartCard>
      <ChartCard title="Lead theo thời gian" sub="7 ngày gần nhất"><TrendChart leads={leads}/></ChartCard>
      <ChartCard title="Doanh thu theo cơ sở" sub="Chỉ tính deal đã mua gói"><BranchRevenueChart leads={leads} branches={branches}/></ChartCard>
    </div>
    <section className="panel">
      <div className="panel-head"><h3>Funnel chuyển đổi AKC</h3><span>Lead mới → Đã gọi → Đặt lịch → T1 → Đã mua gói → Mất lead</span></div>
      <div className="funnel">
        {STATUSES.map((s,i)=>{
          const c = leads.filter(x=>x.status===s).length;
          return <div className={"funnel-step f"+i} key={s}><span>{s}</span><strong>{c}</strong><small>{total?Math.round(c/total*100):0}% tổng lead</small></div>
        })}
      </div>
    </section>
  </>
}

function Card({title,value,sub}){return <div className="card"><span>{title}</span><strong>{value}</strong><small>{sub}</small></div>}
function ChartCard({title,sub,children}){return <section className="panel chart-card"><div className="panel-head"><h3>{title}</h3><span>{sub}</span></div>{children}</section>}

function useChart(ref, config, deps){
  useEffect(()=>{
    if(!ref.current) return;
    const chart = new Chart(ref.current, config);
    return ()=>chart.destroy();
  }, deps);
}
function barOptions(axis="y"){
  return {responsive:true,maintainAspectRatio:false,plugins:{legend:{position:"bottom"}},scales:{[axis]:{beginAtZero:true,ticks:{precision:0}}}};
}
const blue = "rgba(54,162,235,.45)";
const blueBorder = "rgba(54,162,235,1)";

function SourceChart({leads}){
  const ref=useRef(null);
  const labels=SOURCES, data=labels.map(s=>leads.filter(x=>x.source===s).length);
  useChart(ref,{type:"bar",data:{labels,datasets:[{label:"Số lead",data,backgroundColor:blue,borderColor:blueBorder,borderWidth:1}]},options:barOptions("y")},[leads]);
  return <div className="canvas-wrap"><canvas ref={ref}/></div>
}
function StatusChart({leads}){
  const ref=useRef(null);
  const labels=STATUSES, data=labels.map(s=>leads.filter(x=>x.status===s).length);
  useChart(ref,{type:"doughnut",data:{labels,datasets:[{data,backgroundColor:["#2563eb","#0ea5e9","#f97316","#8b5cf6","#16a34a","#dc2626"],borderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,cutout:"55%",plugins:{legend:{position:"bottom"}}}},[leads]);
  return <div className="canvas-wrap"><canvas ref={ref}/></div>
}
function BranchChart({leads, branches}){
  const ref=useRef(null);
  const labels=branches, data=labels.map(s=>leads.filter(x=>x.branch===s).length);
  useChart(ref,{type:"bar",data:{labels,datasets:[{label:"Lead theo cơ sở",data,backgroundColor:blue,borderColor:blueBorder,borderWidth:1}]},options:{...barOptions("x"),indexAxis:"y"}},[leads,branches]);
  return <div className="canvas-wrap"><canvas ref={ref}/></div>
}
function SaleChart({leads, sales}){
  const ref=useRef(null);
  const labels=sales.map(s=>s.name), data=labels.map(s=>leads.filter(x=>x.owner===s).length);
  useChart(ref,{type:"bar",data:{labels,datasets:[{label:"Lead phụ trách",data,backgroundColor:blue,borderColor:blueBorder,borderWidth:1}]},options:{...barOptions("x"),indexAxis:"y"}},[leads,sales]);
  return <div className="canvas-wrap"><canvas ref={ref}/></div>
}
function TrendChart({leads}){
  const ref=useRef(null);
  const labels=[...new Set(leads.map(x=>x.created))].sort().slice(-7);
  const data=labels.map(d=>leads.filter(x=>x.created===d).length);
  useChart(ref,{type:"line",data:{labels:labels.map(x=>String(x).slice(5)),datasets:[{label:"Lead mới",data,borderColor:"#36a2eb",backgroundColor:"rgba(54,162,235,.15)",tension:.45,fill:true,pointRadius:4}]},options:barOptions("y")},[leads]);
  return <div className="canvas-wrap"><canvas ref={ref}/></div>
}
function BranchRevenueChart({leads, branches}){
  const ref=useRef(null);
  const labels=branches, data=labels.map(b=>leads.filter(x=>x.branch===b && x.status==="Đã mua gói").reduce((s,x)=>s+Number(x.value||0),0));
  useChart(ref,{type:"bar",data:{labels,datasets:[{label:"Doanh thu",data,backgroundColor:"rgba(22,163,74,.45)",borderColor:"#16a34a",borderWidth:1}]},options:{...barOptions("x"),indexAxis:"y",scales:{x:{beginAtZero:true,ticks:{callback:v=>Number(v).toLocaleString("vi-VN")}}}}},[leads,branches]);
  return <div className="canvas-wrap"><canvas ref={ref}/></div>
}

function LeadPage({leads,setModal,deleteLead,user,perm}){
  return <section className="panel"><h3>Danh sách Lead</h3><div className="table-wrap"><table><thead><tr><th>Khách</th><th>SĐT</th><th>Nguồn</th><th>Cơ sở</th><th>Sale</th><th>Trạng thái</th><th>Gói quan tâm</th><th>Giá trị</th><th>Follow-up</th><th>Thao tác</th></tr></thead><tbody>{leads.map(l=><tr key={l.id}><td><b>{l.name}</b><br/><small>{l.note}</small></td><td>{l.phone}</td><td>{l.source}</td><td>{l.branch}</td><td>{l.owner}</td><td><span className="badge">{l.status}</span></td><td>{l.package_interest}</td><td>{money(l.value)}</td><td>{l.follow||"-"}</td><td className="row-actions">{canEditLead(l,user) && <button onClick={()=>setModal(l)}>Sửa</button>}{perm.canDeleteLead && <button className="danger" onClick={()=>deleteLead(l.id)}>Xóa</button>}</td></tr>)}</tbody></table></div></section>
}
function Pipeline({leads,updateStatus}){
  return <div className="kanban">{STATUSES.map(s=><div className="stage" key={s}><h3>{s}</h3>{leads.filter(x=>x.status===s).map(l=><div className="deal" key={l.id}><b>{l.name}</b><span>{l.phone}</span><span>{l.branch}</span><span>{l.owner} · {money(l.value)}</span><select value={l.status} onChange={e=>updateStatus(l.id,e.target.value)}>{STATUSES.map(x=><option key={x}>{x}</option>)}</select></div>)}</div>)}</div>
}
function Calendar({leads}){
  const rows=leads.filter(x=>x.follow).sort((a,b)=>String(a.follow).localeCompare(String(b.follow)));
  return <section className="panel"><h3>Lịch hẹn / Follow-up</h3><div className="task-list">{rows.map(l=><div className="task" key={l.id}><div><b>{l.name}</b><p>{l.note}</p><small>{l.branch} · {l.source}</small></div><div><b>{l.follow}</b><span>{l.owner} · {l.status}</span></div></div>)}</div></section>
}
function Reports({leads, branches}){
  const total=leads.length, won=leads.filter(x=>x.status==="Đã mua gói").length, rev=leads.filter(x=>x.status==="Đã mua gói").reduce((s,x)=>s+Number(x.value||0),0);
  const bestSource=[...SOURCES].sort((a,b)=>leads.filter(x=>x.source===b).length-leads.filter(x=>x.source===a).length)[0] || "-";
  const bestBranch=[...branches].sort((a,b)=>leads.filter(x=>x.branch===b).length-leads.filter(x=>x.branch===a).length)[0] || "-";
  return <><div className="cards"><Card title="Tỉ lệ chốt" value={(total?Math.round(won/total*100):0)+"%"} sub="Won / tổng lead"/><Card title="Doanh thu" value={money(rev)} sub="Deal đã chốt"/><Card title="Nguồn tốt nhất" value={bestSource} sub="Theo số lead"/><Card title="Cơ sở nhiều lead nhất" value={bestBranch} sub="Theo số lead"/></div></>
}

function BranchManager({branches,setBranches,leads,setLeads,users,setUsers}){
  const [name,setName]=useState("");
  const [edit,setEdit]=useState(null);
  const [editName,setEditName]=useState("");
  function addBranch(){ const n=name.trim(); if(!n) return; if(branches.includes(n)) return alert("Cơ sở đã tồn tại."); setBranches([...branches,n]); setName(""); }
  function startEdit(b){ setEdit(b); setEditName(b); }
  function saveEdit(){
    const n=editName.trim(); if(!n) return;
    if(n!==edit && branches.includes(n)) return alert("Tên cơ sở đã tồn tại.");
    setBranches(branches.map(b=>b===edit?n:b));
    setLeads(leads.map(l=>l.branch===edit?{...l,branch:n}:l));
    setUsers(users.map(u=>u.branch===edit?{...u,branch:n}:u));
    setEdit(null); setEditName("");
  }
  function removeBranch(b){
    const used = leads.filter(l=>l.branch===b).length + users.filter(u=>u.branch===b).length;
    if(used>0 && !confirm(`Cơ sở này đang có ${used} dữ liệu liên quan. Xóa sẽ chuyển các bản ghi về "Chưa gán cơ sở". Tiếp tục?`)) return;
    setBranches(branches.filter(x=>x!==b));
    setLeads(leads.map(l=>l.branch===b?{...l,branch:"Chưa gán cơ sở"}:l));
    setUsers(users.map(u=>u.branch===b?{...u,branch:"Chưa gán cơ sở"}:u));
  }
  return <section className="panel">
    <div className="panel-head"><h3>Quản lý cơ sở</h3><span>Chỉ Admin được truy cập</span></div>
    <div className="add-row"><input placeholder="Tên cơ sở mới" value={name} onChange={e=>setName(e.target.value)}/><button className="primary" onClick={addBranch}>+ Thêm cơ sở</button></div>
    <div className="table-wrap"><table><thead><tr><th>Cơ sở</th><th>Tổng lead</th><th>User đang gán</th><th>Doanh thu</th><th>Thao tác</th></tr></thead><tbody>{branches.map(b=>{
      const arr=leads.filter(l=>l.branch===b);
      const userCount=users.filter(u=>u.branch===b && u.active!==false).length;
      const rev=arr.filter(x=>x.status==="Đã mua gói").reduce((s,x)=>s+Number(x.value||0),0);
      return <tr key={b}><td>{edit===b?<input value={editName} onChange={e=>setEditName(e.target.value)}/>:<b>{b}</b>}</td><td>{arr.length}</td><td>{userCount}</td><td>{money(rev)}</td><td className="row-actions">{edit===b?<><button className="primary" onClick={saveEdit}>Lưu</button><button onClick={()=>setEdit(null)}>Hủy</button></>:<><button onClick={()=>startEdit(b)}>Sửa</button><button className="danger" onClick={()=>removeBranch(b)}>Xóa</button></>}</td></tr>
    })}</tbody></table></div>
  </section>
}

function UserManager({users,setUsers,branches,leads,setLeads}){
  const [editId,setEditId]=useState(null);
  const [form,setForm]=useState(null);
  const pending = users.filter(u=>u.status==="pending");
  const approved = users.filter(u=>u.status!=="pending");

  function startEdit(u){ setEditId(u.id); setForm({...u}); }
  function saveUser(){
    if(!form.name || !form.email) return;
    const old = users.find(u=>u.id===editId);
    const updated = {...form, owner: form.role==="sale" || form.role==="manager" ? (form.owner || form.name) : ""};
    setUsers(users.map(u=>u.id===editId?updated:u));
    if(old?.owner && old.owner !== updated.owner){
      setLeads(leads.map(l=>l.owner===old.owner?{...l,owner:updated.owner}:l));
    }
    setEditId(null); setForm(null);
  }
  function approveUser(u){
    setEditId(u.id);
    setForm({...u, status:"approved", active:true, role:"sale", owner:u.name});
  }
  function rejectUser(u){
    if(!confirm("Từ chối tài khoản này?")) return;
    setUsers(users.map(x=>x.id===u.id?{...x,status:"rejected",active:false}:x));
  }
  function toggleActive(u){ setUsers(users.map(x=>x.id===u.id?{...x,active:!x.active}:x)); }
  function removeUser(u){
    if(u.role==="admin" && users.filter(x=>x.role==="admin" && x.status==="approved").length<=1){
      alert("Không thể xóa admin cuối cùng.");
      return;
    }
    const used=leads.filter(l=>l.owner===u.owner).length;
    if(used>0 && !confirm(`User này đang có ${used} lead. Xóa sẽ chuyển lead về "Chưa gán sale". Tiếp tục?`)) return;
    setUsers(users.filter(x=>x.id!==u.id));
    setLeads(leads.map(l=>l.owner===u.owner?{...l,owner:"Chưa gán sale"}:l));
  }
  function resetPassword(u){
    const pw = prompt("Nhập mật khẩu mới", "123456");
    if(!pw) return;
    setUsers(users.map(x=>x.id===u.id?{...x,password:pw}:x));
    alert("Đã đổi mật khẩu.");
  }

  return <div className="grid2">
    <section className="panel">
      <div className="panel-head"><h3>Yêu cầu tài khoản chờ duyệt</h3><span>{pending.length} yêu cầu</span></div>
      <div className="table-wrap"><table><thead><tr><th>Tên</th><th>Email</th><th>Cơ sở đăng ký</th><th>Ngày</th><th>Thao tác</th></tr></thead><tbody>{pending.map(u=><tr key={u.id}><td><b>{u.name}</b><br/><small>{u.phone}</small></td><td>{u.email}</td><td>{u.branch}</td><td>{u.created}</td><td className="row-actions"><button className="primary" onClick={()=>approveUser(u)}>Duyệt & phân quyền</button><button className="danger" onClick={()=>rejectUser(u)}>Từ chối</button></td></tr>)}{!pending.length && <tr><td colSpan="5">Không có tài khoản chờ duyệt.</td></tr>}</tbody></table></div>
    </section>

    <section className="panel">
      <div className="panel-head"><h3>{editId ? "Phân quyền / sửa tài khoản" : "Chọn tài khoản để sửa"}</h3><span>Admin kiểm soát role, cơ sở, trạng thái</span></div>
      {form ? <div className="user-form">
        <label>Họ tên<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
        <label>Email<input value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>
        <label>SĐT<input value={form.phone||""} onChange={e=>setForm({...form,phone:e.target.value})}/></label>
        <label>Role<select value={form.role} onChange={e=>setForm({...form,role:e.target.value})}><option>sale</option><option>manager</option><option>admin</option></select></label>
        <label>Cơ sở<select value={form.branch} onChange={e=>setForm({...form,branch:e.target.value})}><option>Tất cả</option>{branches.map(b=><option key={b}>{b}</option>)}<option>Chưa gán cơ sở</option></select></label>
        <label>Tên sale/owner<input value={form.owner||form.name} onChange={e=>setForm({...form,owner:e.target.value})}/></label>
        <label>Trạng thái duyệt<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="approved">approved</option><option value="pending">pending</option><option value="rejected">rejected</option></select></label>
        <label>Hoạt động<select value={form.active ? "active":"inactive"} onChange={e=>setForm({...form,active:e.target.value==="active"})}><option value="active">Đang hoạt động</option><option value="inactive">Khóa</option></select></label>
        <div className="row-actions"><button className="primary" onClick={saveUser}>Lưu tài khoản</button><button onClick={()=>{setEditId(null);setForm(null)}}>Hủy</button></div>
      </div> : <p className="muted">Bấm “Duyệt & phân quyền” hoặc “Sửa” ở bảng bên dưới.</p>}
    </section>

    <section className="panel full-grid">
      <div className="panel-head"><h3>Danh sách tài khoản</h3><span>Admin / Manager / Sale</span></div>
      <div className="table-wrap"><table><thead><tr><th>Tên</th><th>Email</th><th>Role</th><th>Cơ sở</th><th>Owner</th><th>Duyệt</th><th>Hoạt động</th><th>Lead</th><th>Thao tác</th></tr></thead><tbody>{approved.map(u=>{
        const leadCount=leads.filter(l=>l.owner===u.owner).length;
        return <tr key={u.id}><td><b>{u.name}</b><br/><small>{u.phone}</small></td><td>{u.email}</td><td>{u.role}</td><td>{u.branch}</td><td>{u.owner||"-"}</td><td><span className={u.status==="approved"?"ok":"off"}>{u.status}</span></td><td><span className={u.active?"ok":"off"}>{u.active?"active":"locked"}</span></td><td>{leadCount}</td><td className="row-actions"><button onClick={()=>startEdit(u)}>Sửa</button><button onClick={()=>toggleActive(u)}>{u.active?"Khóa":"Mở"}</button><button onClick={()=>resetPassword(u)}>Reset MK</button><button className="danger" onClick={()=>removeUser(u)}>Xóa</button></td></tr>
      })}</tbody></table></div>
    </section>
  </div>
}

function Settings({branches,setBranches,setUsers}){
  return <section className="panel">
    <h3>Cài đặt hệ thống</h3>
    <p className="muted">Bản v7 có đăng ký tài khoản, duyệt tài khoản và phân quyền local. Khi deploy thật cần nối Supabase/Auth database.</p>
    <div className="settings-actions">
      <button onClick={()=>{if(confirm("Reset danh sách cơ sở về mặc định?")) setBranches(DEFAULT_BRANCHES)}}>Reset cơ sở mặc định</button>
      <button onClick={()=>{if(confirm("Reset danh sách user về mặc định?")) setUsers(DEFAULT_USERS)}}>Reset user mặc định</button>
      <button className="danger" onClick={()=>{if(confirm("Xóa toàn bộ dữ liệu local?")){localStorage.clear();location.reload();}}}>Xóa toàn bộ dữ liệu local</button>
    </div>
  </section>
}

function SimplePanel({title,text}){return <section className="panel"><h3>{title}</h3><p className="muted">{text}</p></section>}
function LeadModal({initial,branches,sales,user,onClose,onSave}){
  const defaultBranch = user.role === "admin" ? (branches[0]||"") : user.branch;
  const defaultOwner = user.role === "sale" ? user.owner : (sales[0]?.name||user.owner||"");
  const [f,setF]=useState({name:"",phone:"",source:"MKT",branch:defaultBranch,owner:defaultOwner,status:"Lead mới",package_interest:"Membership",value:0,follow:"",created:today(),note:"",...initial});
  const set=(k,v)=>setF({...f,[k]:v});
  const branchLocked = user.role !== "admin";
  const ownerLocked = user.role === "sale";
  return <div className="modal"><form className="modal-card" onSubmit={e=>{e.preventDefault();onSave(f)}}><div className="modal-head"><h3>{f.id?"Sửa lead":"Thêm lead"}</h3><button type="button" onClick={onClose}>×</button></div>
    <label>Tên khách<input value={f.name} onChange={e=>set("name",e.target.value)} required/></label>
    <label>SĐT<input value={f.phone} onChange={e=>set("phone",e.target.value)} required/></label>
    <label>Nguồn<select value={f.source} onChange={e=>set("source",e.target.value)}>{SOURCES.map(x=><option key={x}>{x}</option>)}</select></label>
    <label>Cơ sở<select disabled={branchLocked} value={f.branch} onChange={e=>set("branch",e.target.value)}>{branches.map(x=><option key={x}>{x}</option>)}<option>Chưa gán cơ sở</option></select></label>
    <label>Sale<select disabled={ownerLocked} value={f.owner} onChange={e=>set("owner",e.target.value)}>{sales.map(x=><option key={x.id}>{x.name}</option>)}<option>Chưa gán sale</option></select></label>
    <label>Trạng thái<select value={f.status} onChange={e=>set("status",e.target.value)}>{STATUSES.map(x=><option key={x}>{x}</option>)}</select></label>
    <label>Gói quan tâm<input value={f.package_interest} onChange={e=>set("package_interest",e.target.value)}/></label>
    <label>Giá trị<input type="number" value={f.value} onChange={e=>set("value",e.target.value)}/></label>
    <label>Follow-up<input type="date" value={f.follow} onChange={e=>set("follow",e.target.value)}/></label>
    <label>Ngày tạo<input type="date" value={f.created} onChange={e=>set("created",e.target.value)}/></label>
    <label>Ghi chú<textarea value={f.note} onChange={e=>set("note",e.target.value)}/></label>
    <button className="primary full">Lưu</button>
  </form></div>
}

createRoot(document.getElementById("root")).render(<App/>);
