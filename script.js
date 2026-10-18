const $=id=>document.getElementById(id);
const money=n=>(Number(n)||0).toFixed(2);
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const todayStr=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
let sales=[], store=null;

// Storage: shared db if available, otherwise this browser only
function lsGet(){try{return JSON.parse(localStorage.getItem("mrrans-sales")||"[]")}catch(e){return[]}}
function lsSet(){try{localStorage.setItem("mrrans-sales",JSON.stringify(sales))}catch(e){}}
async function initStore(){
  try{
    const db=await (window.claude&&claude.use?claude.use("db"):null);
    if(db){
      const col=db.collection("sales");
      store={
        save:s=>col.doc(s.id).set(s),
        remove:id=>col.doc(id).delete()
      };
      col.onSnapshot(snap=>{sales=snap.docs.map(d=>d.data());render()},()=>fallback());
      return;
    }
  }catch(e){}
  fallback();
}
function fallback(){
  sales=lsGet();
  store={save:async s=>{sales=sales.filter(x=>x.id!==s.id).concat(s);lsSet();render()},
         remove:async id=>{sales=sales.filter(x=>x.id!==id);lsSet();render()}};
  render();
}

function syncItem(){const[,p]=$("item").value.split("|");$("rate").value=p;calc()}
function calc(){
  const a=(Number($("rate").value)||0)*Math.max(1,Number($("qty").value)||1);
  $("amt").textContent=money(a);
  if(document.activeElement!==$("paid")&&!$("paid").dataset.touched)$("paid").value=a?a:"";
  $("bal").textContent=money(Math.max(0,a-(Number($("paid").value)||0)));
}
["rate","qty"].forEach(i=>$(i).addEventListener("input",()=>{$("paid").dataset.touched="";calc()}));
$("paid").addEventListener("input",()=>{$("paid").dataset.touched="1";calc()});
$("item").addEventListener("change",()=>{$("paid").dataset.touched="";syncItem()});

function daySales(){return sales.filter(s=>s.date===$("day").value).sort((a,b)=>a.seq-b.seq)}

$("save").addEventListener("click",async()=>{
  const qty=Math.max(1,Number($("qty").value)||1),rate=Number($("rate").value)||0;
  if(!rate){$("msg").textContent="Enter a rate first.";return}
  const date=$("day").value, ds=sales.filter(s=>s.date===date);
  const seq=ds.reduce((m,s)=>Math.max(m,s.seq),0)+1;
  const now=new Date();
  const amount=rate*qty, paid=Number($("paid").value)||0;
  const s={id:"MR-"+date.replace(/-/g,"")+"-"+String(seq).padStart(3,"0"),seq,date,
    time:now.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),
    customer:$("cname").value.trim(),contact:$("ccontact").value.trim(),
    item:$("item").value.split("|")[0],qty,rate,amount,paid,balance:Math.max(0,amount-paid),
    pay:$("pay").value,cashier:$("cashier").value.trim(),note:$("note").value.trim()};
  try{
    await store.save(s);
    ["cname","ccontact","note"].forEach(i=>$(i).value="");
    $("qty").value=1;$("paid").dataset.touched="";syncItem();
    $("msg").textContent="Saved "+s.id;
    showReceipt(s);
  }catch(e){$("msg").textContent="Could not save: "+((e&&e.message)||"unknown error")}
});

function render(){
  const d=daySales(), tot=d.reduce((a,s)=>a+s.amount,0), paid=d.reduce((a,s)=>a+s.paid,0);
  $("dlabel").textContent=new Date($("day").value+"T00:00").toLocaleDateString([],{weekday:"long",year:"numeric",month:"long",day:"numeric"});
  $("s-n").textContent=d.length;$("s-q").textContent=d.reduce((a,s)=>a+s.qty,0);
  $("s-t").textContent=money(tot);$("s-p").textContent=money(paid);$("s-b").textContent=money(d.reduce((a,s)=>a+s.balance,0));
  const by={};d.forEach(s=>by[s.pay]=(by[s.pay]||0)+s.paid);
  $("s-pay").textContent=Object.keys(by).length?"Collected by: "+Object.entries(by).map(([k,v])=>k+" GH₵ "+money(v)).join(" · "):"";
  $("empty").style.display=d.length?"none":"block";
  $("rows").innerHTML=d.map(s=>`<tr><td><span class="badge">${String(s.seq).padStart(3,"0")}</span></td><td>${esc(s.time)}</td>
    <td>${esc(s.customer||"Walk-in")}${s.contact?"<br><small>"+esc(s.contact)+"</small>":""}</td><td>${esc(s.item)}</td>
    <td class="n">${s.qty}</td><td class="n">${money(s.amount)}</td><td class="n">${money(s.paid)}</td><td>${esc(s.pay)}</td>
    <td class="n ${s.balance>0?"warn":""}">${money(s.balance)}</td>
    <td class="act"><button class="ghost" data-v="${esc(s.id)}">View</button><button class="ghost" data-d="${esc(s.id)}">✕</button></td></tr>`).join("");
}
$("rows").addEventListener("click",async e=>{
  const v=e.target.dataset.v,d=e.target.dataset.d;
  if(v)showReceipt(sales.find(s=>s.id===v));
  if(d&&confirm("Delete this sale?")){try{await store.remove(d)}catch(err){alert("Could not delete.")}}
});

function showReceipt(s){
  if(!s)return;
  $("rcpt").innerHTML=`<h3>MR RANS</h3><div class="c">TASTY SHITO<br>IPT-Container<br>0595933599 / 0553623954</div><hr>
  <div>Receipt No.: ${esc(s.id)}</div><div>Payment Typ: ${esc(s.pay)}</div>
  <div>Date: ${esc(s.date)} ${esc(s.time)}</div><div>Cashier: ${esc(s.cashier||"N/A")}</div><hr>
  <div class="r"><b>ITEM</b><b>QTY &nbsp; RATE &nbsp; AMT</b></div>
  <div>${esc(s.item)}</div><div class="r"><span></span><span>${s.qty} &nbsp; ${money(s.rate)} &nbsp; ${money(s.amount)}</span></div><hr>
  <div class="r"><span>Total Amount:</span><b>₵${money(s.amount)}</b></div>
  <div class="r"><span>Amount Paid:</span><span>₵${money(s.paid)}</span></div>
  <div class="r"><span>Balance:</span><span>₵${money(s.balance)}</span></div>
  <div>Customer: ${esc(s.customer)}</div><div>Contact: ${esc(s.contact)}</div><div>Note: ${esc(s.note)}</div>
  <div class="no">MR-${String(s.seq).padStart(3,"0")}</div><div class="c">Thank you for buying from us</div>`;
  $("modal").classList.add("on");
}
$("rclose").onclick=()=>$("modal").classList.remove("on");
$("rprint").onclick=()=>window.print();
$("print").onclick=()=>window.print();

$("csv").onclick=async()=>{
  const d=daySales();if(!d.length){$("msg").textContent="Nothing to export for this day.";return}
  const head=["Receipt","Date","Time","Customer","Contact","Item","Qty","Rate","Amount","Paid","Payment","Balance","Cashier","Note"];
  const q=v=>'"'+String(v==null?"":v).replace(/"/g,'""')+'"';
  const csv=[head.map(q).join(",")].concat(d.map(s=>[s.id,s.date,s.time,s.customer,s.contact,s.item,s.qty,s.rate,s.amount,s.paid,s.pay,s.balance,s.cashier,s.note].map(q).join(","))).join("\n");
  try{const dl=await claude.use("downloads");if(dl){await dl.save({filename:"shito-sales-"+$("day").value+".csv",data:csv});return}}catch(e){}
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
  a.download="shito-sales-"+$("day").value+".csv";
  document.body.appendChild(a);a.click();a.remove();
};

$("day").value=todayStr();$("day").addEventListener("change",render);
$("theme").addEventListener("click",()=>{
  const r=document.documentElement,dark=r.getAttribute("data-theme")==="dark"||(!r.getAttribute("data-theme")&&matchMedia("(prefers-color-scheme: dark)").matches);
  r.setAttribute("data-theme",dark?"light":"dark");$("theme").textContent=dark?"🌙":"☀️";
});
syncItem();render();initStore();