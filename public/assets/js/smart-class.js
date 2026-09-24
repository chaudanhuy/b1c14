import {escapeHTML as h,icon,toast,modal} from "./ui.js";
const MODES={quiz:"Trắc nghiệm tốc độ",buzzer:"Rung chuông cướp quyền",short:"Trả lời ngắn",reorder:"Sắp xếp thứ tự",estimate:"Thanh trượt ước lượng",match:"Ghép cặp tương ứng"};
const PHASES={LOBBY:"Phòng chờ",QUESTION_ACTIVE:"Đang trả lời",QUESTION_LOCKED:"Đã khóa",SHOW_RESULT:"Kết quả",LEADERBOARD:"Bảng vinh danh",FINISHED:"Đã kết thúc"};
const btn=(action,text,style="soft",disabled=false)=>`<button type="button" class="button ${style}" data-smart="${action}" ${disabled?"disabled":""}>${text}</button>`;
const field=(name,label,type="text",value="",attrs="")=>`<label class="field"><span>${label}</span><input name="${name}" type="${type}" value="${h(value)}" ${attrs} required></label>`;
const area=(name,label,placeholder)=>`<label class="field"><span>${label}</span><textarea name="${name}" required maxlength="2400" rows="5" placeholder="${h(placeholder)}"></textarea></label>`;
export function createSmartClass({api,getMember}){
  const root=document.getElementById("smartClassRoot");
  let ws=null,active=false,generation=0,heartbeat,reconnect,ticker,attempt=0,s=null,offset=0,lastPong=0;
  let liveKey="",order=[],left=null,wrongPair=null,previewAt=0,audioContext=null,sound=true,confettiFrame=0,celebrated="",lastRound="";
  const bank={questions:[],sets:[],detail:null,loaded:false,loading:false,tab:"bank",search:"",mode:"",category:"",editing:null,autoRun:false,autoNextTimeout:null,autoResultTimeout:null};
  const pending=new Map();
  const allowed=()=>getMember()&&!getMember().must_change_password;
  const me=()=>s?.me;
  const current=()=>({sessionId:s?.session?.id,roundId:s?.round?.id});
  function soundReady(){
    if(!sound||!audioContext||audioContext.state!=="running")return;
    const oscillator=audioContext.createOscillator(),gain=audioContext.createGain();
    oscillator.connect(gain);gain.connect(audioContext.destination);oscillator.frequency.value=660;
    gain.gain.setValueAtTime(.055,audioContext.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+.18);
    oscillator.start();oscillator.stop(audioContext.currentTime+.2);
  }
  document.addEventListener("pointerdown",()=>{
    if(!active||!sound)return;
    try{audioContext ||= new (window.AudioContext||window.webkitAudioContext)();void audioContext.resume().catch(()=>{});}catch{}
  });
  function shell(){
    root.innerHTML=`<div class="page-heading"><div><span class="eyebrow">TƯƠNG TÁC LỚP HỌC</span><h1>Smart Class</h1><p class="muted">Cùng tham gia. Cùng bứt phá.</p></div>
      <div class="action-row">${btn("sound","Âm thanh: bật","ghost")}${btn("connect","Kết nối lại","ghost")}</div></div>
      <div class="notice"><span id="smartStatus" role="status">Đang kết nối…</span></div>
      <div id="smartToolbar" class="action-row smart-toolbar"></div><section id="smartMaster" class="panel smart-master" hidden></section>
      <section id="smartLive" class="panel smart-live" aria-live="polite"></section><section id="smartBoard" class="smart-board"></section>
      <p class="muted smart-footnote">Thời gian và điểm được tính tại máy chủ khi nhận thao tác. Thành viên vào sau khi mở câu hỏi tham gia từ vòng tiếp theo.</p>`;
  }
  function status(text){const node=root.querySelector("#smartStatus");if(node)node.textContent=text;}
  async function connect(){
    if(!active||!allowed()||ws?.readyState===0||ws?.readyState===1)return;
    const at=generation;status("Đang kết nối Smart Class…");
    try{
      const config=await api("/api/smart-class/connect");
      if(at!==generation||!active)return;
      if(!config.configured){status("Smart Class chưa được cấu hình. Cần thêm binding SMART_CLASS trong Cloudflare Pages.");return;}
      const url=new URL("/api/smart-class/connect",location.href);url.protocol=location.protocol==="https:"?"wss:":"ws:";
      const socket=new WebSocket(url);ws=socket;
      socket.onopen=()=>{
        if(at!==generation){socket.close();return;}
        attempt=0;lastPong=Date.now();status("Đã kết nối · Đồng bộ phiên…");
        clearInterval(heartbeat);
        heartbeat=setInterval(()=>{
          if(Date.now()-lastPong>45000){socket.close();return;}
          if(socket.readyState===1)socket.send(JSON.stringify({type:"PING"}));
        },15000);
      };
      socket.onmessage=event=>{
        if(at!==generation||!active||ws!==socket)return;
        let data;try{data=JSON.parse(event.data);}catch{return;}
        lastPong=Date.now();
        if(data.server_now)offset=data.server_now-Date.now();
        if(data.type==="READY"){
          for(const packet of pending.values())socket.send(JSON.stringify(packet));
        } else if(data.type==="STATE"){
          if(s && s.session?.id===data.session?.id&&data.version<s.version)return;
          s=data;render();
        } else if(data.type==="ACK")pending.delete(data.id);
        else if(data.type==="ERROR"){
          pending.delete(data.id);toast(data.error,"error");
          if(data.code==="AUTH"){status("Phiên đăng nhập đã thay đổi. Hãy đăng nhập lại.");socket.close(4001);return;}
          if(data.id&&data.code!=="RATE_LIMIT"&&data.code!=="SERVER"&&socket.readyState===1)socket.send(JSON.stringify({type:"SYNC"}));
        } else if(data.type==="PAIR_RESULT"&&!data.correct){
          wrongPair={id:data.right,until:Date.now()+400};
          const b=root.querySelector('[data-right="'+data.right+'"]');
          if(b){b.classList.remove("smart-shake");void b.offsetWidth;b.classList.add("smart-shake");}
          toast("Chưa khớp. Hãy thử cặp khác.","info");
        } else if(data.type==="BUZZER_WINNER")soundReady();
      };
      socket.onclose=event=>{
        if(at!==generation||ws!==socket)return;
        ws=null;clearInterval(heartbeat);status(event.code===4001?"Phiên đăng nhập đã thay đổi. Hãy đăng nhập lại.":"Mất kết nối · Đang thử nối lại…");
        liveKey="";root.querySelectorAll("#smartLive button,#smartLive input").forEach(n=>n.disabled=true);
        if(active&&event.code!==4001&&event.code!==1008)scheduleReconnect();
      };
      socket.onerror=()=>status("Kết nối đang gián đoạn…");
    }catch(error){
      if(at!==generation||error.name==="AbortError")return;
      status(error.message);scheduleReconnect();
    }
  }
  function scheduleReconnect(){
    clearTimeout(reconnect);
    reconnect=setTimeout(()=>void connect(),Math.min(15000,1000*2**Math.min(4,attempt++))+Math.random()*300);
  }
  function send(type,body={},queue=true){
    if(!ws||ws.readyState!==1){toast("Đang mất kết nối. Chờ kết nối lại rồi thử.","error");return false;}
    const packet={type,id:crypto.randomUUID(),...current(),...body};
    if(queue){if(pending.size>=8){toast("Đang chờ máy chủ xác nhận.","info");return false;}pending.set(packet.id,packet);}
    ws.send(JSON.stringify(packet));return true;
  }
  const canStart=()=>!!s?.session&&["LOBBY","SHOW_RESULT","LEADERBOARD"].includes(s.phase)&&ws?.readyState===1;
  function formQuestion(){
    const form=root.querySelector("#smartQuestionForm");if(!form)return null;
    const values=Object.fromEntries(new FormData(form));
    const q={mode:values.mode,prompt:values.prompt,duration:Number(values.duration)};
    if(q.mode==="quiz"){q.options=["A","B","C","D"].map(l=>values["option"+l]);q.correct=values.correct;}
    if(q.mode==="short"){q.accepted=values.accepted.split("\n").filter(x=>x.trim());q.ignoreAccents=values.ignoreAccents==="on";}
    if(q.mode==="reorder")q.items=values.items.split("\n").filter(x=>x.trim());
    if(q.mode==="estimate")for(const key of ["min","max","step","correct"])q[key]=Number(values[key]);
    if(q.mode==="match")q.pairs=values.pairs.split("\n").filter(x=>x.trim()).map(x=>x.split("|").map(y=>y.trim()));
    return q;
  }
  function fillQuestionForm(record=null){
    const form=root.querySelector("#smartQuestionForm");if(!form)return;
    const q=record?.question||{mode:"quiz",prompt:"",duration:20,options:["","","",""],correct:"A"};
    form.reset();form.elements.mode.value=q.mode;form.elements.prompt.value=q.prompt||"";form.elements.duration.value=q.duration||20;modeFields(q.mode);
    if(q.mode==="quiz"){["A","B","C","D"].forEach((l,i)=>form.elements["option"+l].value=q.options?.[i]||"");form.elements.correct.value=q.correct||"A";}
    if(q.mode==="short"){form.elements.accepted.value=(q.accepted||[]).join("\n");form.elements.ignoreAccents.checked=q.ignoreAccents!==false;}
    if(q.mode==="reorder")form.elements.items.value=(q.items||[]).join("\n");
    if(q.mode==="estimate")for(const key of ["min","max","step","correct"])form.elements[key].value=q[key]??({min:0,max:100,step:1,correct:50}[key]);
    if(q.mode==="match")form.elements.pairs.value=(q.pairs||[]).map(x=>x.join(" | ")).join("\n");
    bank.editing=record;bank.tab="quick";renderMasterPanes();
  }
  async function loadBank(force=false){
    if(bank.loading||bank.loaded&&!force)return;bank.loading=true;renderMasterPanes();
    try{
      const [questions,sets]=await Promise.all([api("/api/smart-class/questions"),api("/api/smart-class/question-sets")]);
      bank.questions=questions.questions||[];bank.sets=sets.sets||[];bank.loaded=true;
      if(bank.detail?.id){const detail=await api("/api/smart-class/question-sets?id="+encodeURIComponent(bank.detail.id));bank.detail=detail.set||null;}
    }catch(error){toast(error.message,"error");}
    finally{bank.loading=false;renderMasterPanes();}
  }
  function filteredQuestions(){
    const text=bank.search.trim().toLocaleLowerCase("vi");
    return bank.questions.filter(q=>(!bank.mode||q.mode===bank.mode)&&(!bank.category||q.category===bank.category)&&(!text||[q.title,q.prompt,q.category,MODES[q.mode]].some(v=>String(v||"").toLocaleLowerCase("vi").includes(text))));
  }
  function questionCard(q,compact=false){
    const used=(s?.usedQuestionIds||[]).includes(q.id),rate=q.responses?Math.round(q.avg_accuracy*100):null;
    return `<article class="smart-question-card ${used?"used":""}" data-question-id="${q.id}"><div class="smart-question-main"><div class="action-row"><span class="badge pending">${h(MODES[q.mode])}</span><span class="smart-category">${h(q.category||"Chung")}</span>${used?'<span class="badge approved">Đã hỏi</span>':""}</div><h3>${h(q.title||q.prompt)}</h3>${q.title!==q.prompt?`<p>${h(q.prompt)}</p>`:""}<small>${q.duration} giây · ${q.rounds||0} lượt dùng${rate===null?"":" · "+rate+"% chính xác"}</small></div><div class="action-row">${btn("bank-start","Bắt đầu","primary",!canStart())}${compact?"":btn("bank-edit","Sửa","soft")}${compact?"":btn("bank-duplicate","Nhân bản","ghost")}${compact?"":btn("bank-delete","Xóa","ghost")}</div></article>`;
  }
  function renderBankPane(){
    const pane=root.querySelector("#smartBankPane");if(!pane)return;
    const categories=[...new Set(bank.questions.map(q=>q.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"vi"));
    pane.innerHTML=`<div class="smart-bank-head"><div><h3>Ngân hàng câu hỏi</h3><p class="muted">Chuẩn bị trước câu hỏi, đến giờ học chỉ việc chọn và bắt đầu.</p></div><div class="action-row">${btn("new-question","Soạn câu mới","primary")}${btn("import-json","Nhập JSON","soft")}${btn("export-json","Xuất JSON","ghost")}${btn("bank-refresh","Làm mới","ghost")}</div></div>
      <div class="smart-bank-filters"><input name="bankSearch" value="${h(bank.search)}" placeholder="Tìm câu hỏi, chủ đề…"><select name="bankMode"><option value="">Tất cả chế độ</option>${Object.entries(MODES).map(([k,v])=>`<option value="${k}" ${bank.mode===k?"selected":""}>${v}</option>`).join("")}</select><select name="bankCategory"><option value="">Tất cả chủ đề</option>${categories.map(v=>`<option ${bank.category===v?"selected":""}>${h(v)}</option>`).join("")}</select></div>
      <div id="smartBankList" class="smart-question-list">${bank.loading?'<p class="muted">Đang tải ngân hàng…</p>':filteredQuestions().length?filteredQuestions().map(q=>questionCard(q)).join(""):'<div class="empty-state"><h3>Chưa có câu hỏi phù hợp</h3><p>Soạn câu mới hoặc nhập danh sách JSON để bắt đầu.</p></div>'}</div>`;
  }
  function renderSetsPane(){
    const pane=root.querySelector("#smartSetsPane");if(!pane)return;
    if(bank.detail){
      const ids=bank.detail.questions.map(q=>q.id),available=bank.questions.filter(q=>!ids.includes(q.id));
      const next=bank.detail.questions.find(q=>!(s?.usedQuestionIds||[]).includes(q.id));
      pane.innerHTML=`<div class="smart-bank-head"><div><button type="button" class="button ghost" data-smart="set-back">← Danh sách bộ đề</button><h3>${h(bank.detail.title)}</h3><p class="muted">${h(bank.detail.description||"Không có mô tả")}</p></div><div class="action-row">${btn("set-auto","Chạy tự động","primary",!next||!canStart())}${btn("set-next","Câu tiếp theo","soft",!next||!canStart())}${btn("set-rename","Đổi tên","soft")}${btn("set-delete","Xóa bộ đề","ghost")}</div></div>
        <div class="smart-set-add"><select id="smartSetAdd"><option value="">Chọn câu hỏi để thêm…</option>${available.map(q=>`<option value="${q.id}">${h(q.title)} · ${h(MODES[q.mode])}</option>`).join("")}</select>${btn("set-add","Thêm vào bộ đề","soft",!available.length)}</div>
        <div class="smart-set-list">${bank.detail.questions.length?bank.detail.questions.map((q,i)=>`<div class="smart-set-row"><b>${i+1}</b><div>${questionCard(q,true)}</div><div class="smart-set-order">${btn("set-up","↑","ghost",i===0)}${btn("set-down","↓","ghost",i===bank.detail.questions.length-1)}${btn("set-remove","Bỏ","ghost")}</div></div>`).join(""):'<p class="muted">Bộ đề chưa có câu hỏi. Chọn một câu ở phía trên để thêm.</p>'}</div>`;
      return;
    }
    pane.innerHTML=`<div class="smart-bank-head"><div><h3>Bộ câu hỏi / Đề thi</h3><p class="muted">Gom các câu đã chuẩn bị thành một trình tự dùng trong buổi học.</p></div>${btn("set-new","Tạo bộ đề","primary")}</div><div class="smart-set-grid">${bank.loading?'<p class="muted">Đang tải…</p>':bank.sets.length?bank.sets.map(set=>`<article class="smart-set-card"><h3>${h(set.title)}</h3><p class="muted">${h(set.description||"Không có mô tả")}</p><b>${set.item_count||0} câu hỏi</b><div class="action-row">${btn("set-open","Mở bộ đề","soft")}</div><span data-set-id="${set.id}" hidden></span></article>`).join(""):'<div class="empty-state"><h3>Chưa có bộ đề</h3><p>Tạo bộ đề rồi thêm câu hỏi từ ngân hàng.</p></div>'}</div>`;
  }
  function renderMasterPanes(){
    const node=root.querySelector("#smartMaster");if(!node||node.hidden)return;
    node.querySelectorAll("[data-smart-tab]").forEach(b=>b.classList.toggle("active",b.dataset.smartTab===bank.tab));
    for(const [tab,id] of [["bank","smartBankPane"],["quick","smartQuickPane"],["sets","smartSetsPane"]]){const pane=root.querySelector("#"+id);if(pane)pane.hidden=bank.tab!==tab;}
    const banner=root.querySelector("#smartEditBanner");if(banner)banner.innerHTML=bank.editing?`<div class="notice">Đang sửa: <b>${h(bank.editing.title)}</b> ${btn("edit-cancel","Hủy sửa","ghost")}</div>`:"";
    const start=root.querySelector('#smartQuestionForm [type="submit"]');if(start)start.disabled=!canStart();
    if(bank.tab==="bank")renderBankPane();if(bank.tab==="sets")renderSetsPane();
  }
  function master(){
    const node=root.querySelector("#smartMaster"),controlling=me()?.controlling;
    node.hidden=!controlling;if(!controlling)return;
    if(!node.querySelector("#smartQuestionForm")){
      node.innerHTML=`<div class="panel-heading"><div><h2>Điều hành lớp học</h2><p>Chuẩn bị ngân hàng câu hỏi hoặc soạn nhanh ngay trong phiên.</p></div></div>
      <div class="smart-tabs"><button type="button" class="button soft" data-smart-tab="bank">Ngân hàng câu hỏi</button><button type="button" class="button soft" data-smart-tab="sets">Bộ đề</button><button type="button" class="button soft" data-smart-tab="quick">Soạn nhanh</button></div>
      <div id="smartBankPane"></div><div id="smartSetsPane" hidden></div><div id="smartQuickPane" hidden><div id="smartEditBanner"></div><form id="smartQuestionForm" class="stack-form">
      <label class="field"><span>Chế độ</span><select name="mode">${Object.entries(MODES).map(([key,label])=>`<option value="${key}">${label}</option>`).join("")}</select></label>
      ${field("prompt","Câu hỏi / yêu cầu","text","","maxlength=500")}${field("duration","Thời gian (giây)","number",20,"min=5 max=300")}
      <div id="smartModeFields"></div><div class="action-row"><button type="submit" class="button primary">${icon("plus")} Bắt đầu câu hỏi</button>${btn("save-question","Lưu vào ngân hàng","soft")}${btn("clear-question","Làm mới mẫu","ghost")}</div></form></div>`;
      modeFields("quiz");void loadBank();
    }
    renderMasterPanes();
  }
  function modeFields(mode){
    let html="";
    if(mode==="quiz")html=["A","B","C","D"].map(l=>field("option"+l,"Đáp án "+l,"text","","maxlength=200")).join("")+
      '<label class="field"><span>Đáp án đúng</span><select name="correct">'+["A","B","C","D"].map(l=>'<option>'+l+'</option>').join("")+'</select></label>';
    if(mode==="short")html=area("accepted","Đáp án được chấp nhận (mỗi dòng một cách viết, tối đa 50 ký tự)","Hà Nội\nHa Noi")+
      '<label class="check-label"><input type="checkbox" name="ignoreAccents" checked> Bỏ qua dấu tiếng Việt khi so khớp</label>';
    if(mode==="reorder")html=area("items","Nhập các bước theo thứ tự ĐÚNG (2–8 dòng); hệ thống tự xáo trộn","Bước một\nBước hai\nBước ba");
    if(mode==="estimate")html=field("min","Giá trị nhỏ nhất","number",0,"step=any")+field("max","Giá trị lớn nhất","number",100,"step=any")+
      field("step","Bước nhảy","number",1,"min=0.000001 step=any")+field("correct","Giá trị đúng","number",50,"step=any");
    if(mode==="match")html=area("pairs","Các cặp ĐÚNG, mỗi dòng: nội dung trái | nội dung phải (2–8 cặp)","Hà Nội | Việt Nam\nParis | Pháp");
    if(mode==="buzzer")html='<p class="muted">Người bấm đầu tiên được máy chủ ghi nhận thắng và nhận 1.000 điểm. Âm thanh chỉ bật sau khi trình duyệt cho phép.</p>';
    root.querySelector("#smartModeFields").innerHTML=html;
  }
  function bars(items){
    const max=Math.max(1,...items.map(x=>x.count));
    return '<div class="smart-bars" style="--columns:'+items.length+'">'+items.map(x=>`<div><span>${h(x.label)}</span><div><i style="height:${x.count/max*100}%"></i></div><b>${x.count}</b></div>`).join("")+'</div>';
  }
  function hostStats(r){
    if(!r.stats)return "";
    const st=r.stats;
    if(r.q.mode==="quiz")return bars(st.quiz);
    if(r.q.mode==="estimate")return bars(st.histogram)+'<p class="muted">Phân phối các giá trị đang chọn; chưa xác nhận vẫn được tính trong biểu đồ.</p>';
    if(r.q.mode==="short")return '<div class="smart-cloud">'+st.words.map(x=>`<span style="font-size:${Math.min(2.4,1+x.count*.12)}rem">${h(x.text)} <small>×${x.count}</small></span>`).join("")+
      '</div><ol>'+st.top.map(x=>`<li>${h(x.name)} · ${x.elapsed} ms</li>`).join("")+'</ol>';
    return '<div class="smart-progress-list">'+st.progress.map(x=>`<label>${h(x.name)} <b>${x.percent}%</b><progress max="100" value="${x.percent}"></progress></label>`).join("")+'</div>';
  }
  function answerLabel(q){
    if(q.mode==="quiz")return q.correct+" · "+q.options["ABCD".indexOf(q.correct)];
    if(q.mode==="short")return q.accepted.join(" / ");
    if(q.mode==="reorder")return q.correct.map(id=>q.items.find(x=>x.id===id).text).join(" → ");
    if(q.mode==="estimate")return String(q.correct);
    if(q.mode==="match")return q.left.map(x=>x.text+" ↔ "+q.right.find(y=>y.id===q.correct[x.id]).text).join(" · ");
    return "Người bấm chuông đầu tiên";
  }
  function student(r){
    const q=r.q,open=s.phase==="QUESTION_ACTIVE"&&r.eligible&&!r.mine?.submitted;
    const estimateDefault=q.mode==="estimate"?q.min+Math.round((q.max-q.min)/q.step/2)*q.step:0;
    let html="";
    if(!r.eligible)return '<p class="notice">Bạn vào sau khi mở câu hỏi. Hãy chờ vòng tiếp theo.</p>';
    if(q.mode==="buzzer"){
      if(r.winner){
        const own=r.winner.id===me().id;
        return `<div class="smart-buzzer-result ${own?"correct":""}"><h2>${own?"Bạn đã giành quyền trả lời!":"Người giành quyền: "+h(r.winner.name)}</h2><p>${r.mine&&!own?"Bạn chậm hơn "+h(r.winner.name)+" "+r.mine.behind+" ms.":!own?"Chuông đã khóa.":""}</p></div>`;
      }
      return btn("buzz","♬ BẤM CHUÔNG","primary smart-buzzer",!open);
    }
    if(r.mine?.submitted){
      html='<p class="badge approved">Đã ghi nhận đáp án · '+r.mine.elapsed+' ms</p>';
      if(q.mode==="quiz")html+='<p>Bạn chọn: <b>'+h(r.mine.value)+'</b></p>';
      else if(["short","estimate"].includes(q.mode))html+='<p>Bạn trả lời: <b>'+h(r.mine.value)+'</b></p>';
      return html;
    }
    if(!open)return '<p class="muted">Câu hỏi đã khóa. Chờ người điều hành công bố kết quả.</p>';
    if(q.mode==="quiz")html='<div class="smart-options">'+q.options.map((text,i)=>`<button type="button" class="button soft smart-option" data-answer="${"ABCD"[i]}"><b>${"ABCD"[i]}</b><span>${h(text)}</span></button>`).join("")+'</div>';
    else if(q.mode==="short")html='<form id="smartShortForm" class="stack-form">'+field("answer","Câu trả lời của bạn","text","","maxlength=50 autocomplete=off")+'<button class="button primary">Gửi câu trả lời</button></form>';
    else if(q.mode==="reorder"){
      if(!order.length||order.some(id=>!q.items.some(x=>x.id===id)))order=q.items.map(x=>x.id);
      html='<ol class="smart-order">'+order.map((id,i)=>`<li draggable="true" data-order-id="${id}"><span>${h(q.items.find(x=>x.id===id).text)}</span><div class="action-row"><button type="button" class="icon-button" data-move="${i}" data-direction="-1" aria-label="Di chuyển lên" ${!i?"disabled":""}>↑</button><button type="button" class="icon-button" data-move="${i}" data-direction="1" aria-label="Di chuyển xuống" ${i===order.length-1?"disabled":""}>↓</button></div></li>`).join("")+'</ol>'+btn("reorder","Xác nhận thứ tự","primary");
    } else if(q.mode==="estimate")html=`<label class="field"><span>Giá trị bạn chọn: <output id="smartEstimateValue">${estimateDefault}</output></span><input id="smartEstimate" type="range" min="${q.min}" max="${q.max}" step="${q.step}" value="${estimateDefault}"></label><p class="muted">${q.min} — ${q.max}</p>${btn("estimate","Xác nhận","primary")}`;
    else if(q.mode==="match"){
      const pairs=r.mine?.pairs||{};
      html='<p class="muted">Chọn một ô bên trái, rồi chọn ô tương ứng bên phải.</p><div class="smart-match"><div>'+q.left.map(x=>`<button type="button" class="button ${pairs[x.id]?"soft correct":"soft"}" data-left="${x.id}" ${pairs[x.id]?"disabled":""}>${h(x.text)}</button>`).join("")+'</div><div>'+
      q.right.map(x=>`<button type="button" class="button soft ${Object.values(pairs).includes(x.id)?"correct":""}" data-right="${x.id}" ${Object.values(pairs).includes(x.id)?"disabled":""}>${h(x.text)}</button>`).join("")+'</div></div>';
    }
    return html;
  }
  function render(){
    if(!active||!s)return;
    status(PHASES[s.phase]+" · "+s.members.filter(x=>x.role==="student").length+" học viên trực tuyến"+
      (s.host?" · Điều hành: "+s.host.name:" · Chờ người điều hành"));
    root.querySelector("#smartToolbar").innerHTML=me().role==="host"?[
      !me().controlling?btn("claim","Điều hành phiên","primary"):"",
      me().controlling?btn("session","Tạo phiên mới","primary",!!s.session&&s.phase!=="FINISHED"):"",
      me().controlling?btn("lock","Khóa câu hỏi","soft",s.phase!=="QUESTION_ACTIVE"):"",
      me().controlling?btn("result","Hiện đáp án đúng","soft",!["QUESTION_ACTIVE","QUESTION_LOCKED"].includes(s.phase)):"",
      me().controlling?btn("board","Bảng vinh danh","soft",!s.session||s.phase==="FINISHED"):"",
      me().controlling?btn("finish","Kết thúc phiên","ghost",!s.session||s.phase==="FINISHED"):""
    ].join(""):"";
    master();
    const r=s.round,node=root.querySelector("#smartLive");
    if(!r){node.innerHTML='<h2>'+h(s.session?.title||"Chào mừng đến Smart Class")+'</h2><p class="muted">Chờ người điều hành bắt đầu câu hỏi. Hãy giữ trang này mở để tham gia.</p>';liveKey="";}
    else{
      const key=r.id+":"+s.phase+":"+JSON.stringify(r.mine)+":"+(r.winner?.id||"")+":"+r.eligible+":"+me().controlling;
      const reveal=["SHOW_RESULT","LEADERBOARD","FINISHED"].includes(s.phase);
      if(key!==liveKey){
        if(lastRound!==r.id){order=[];left=null;wrongPair=null;lastRound=r.id;if(r.q.mode==="buzzer"&&s.phase==="QUESTION_ACTIVE")soundReady();}
        node.innerHTML=`<div class="panel-heading"><span class="badge pending">${h(MODES[r.q.mode])}</span><b id="smartTimer"></b></div><h2>${h(r.q.prompt)}</h2>
          <p class="muted"><span id="smartAnswered">${r.answered}</span>/${r.count} đã xác nhận</p>
          ${me().controlling?'<div id="smartHostStats"></div><details><summary>Xem đáp án (chỉ người điều hành)</summary><p>'+h(answerLabel(r.q))+'</p></details>':student(r)}
          ${reveal?'<div class="notice"><p>Đáp án: <b>'+h(answerLabel(r.q))+'</b></p></div>':""}
          ${reveal&&r.results?'<p>Điểm vòng này của bạn: <b>'+(r.results.find(x=>x.member_id===me().id)?.score||0)+'</b></p>':""}`;
        liveKey=key;
        if(r.q.mode==="short"&&s.phase==="QUESTION_ACTIVE"&&!me().controlling)
          node.querySelector('[name="answer"]')?.focus({preventScroll:true});
      }
      if(wrongPair&&wrongPair.until>Date.now())node.querySelector('[data-right="'+wrongPair.id+'"]')?.classList.add("smart-shake");
      const count=node.querySelector("#smartAnswered");if(count)count.textContent=r.answered;
      const stats=node.querySelector("#smartHostStats");if(stats)stats.innerHTML=hostStats(r);
    }
    const board=root.querySelector("#smartBoard");
    if(["LEADERBOARD","FINISHED"].includes(s.phase)||me().controlling&&s.leaderboard.length){
      const leaders=s.leaderboard;
      board.innerHTML='<div class="section-heading"><h2>Bảng vinh danh</h2></div><div class="smart-podium">'+
        leaders.slice(0,3).map((p,i)=>`<article class="panel smart-place place-${i+1}"><span>${["🥇","🥈","🥉"][i]}</span><h3>${h(p.name)}</h3><b>${p.score.toLocaleString("vi")} điểm</b></article>`).join("")+
        '</div><div class="panel smart-ranking">'+leaders.map((p,i)=>`<div><b>${i+1}</b><span>${h(p.name)}</span><strong>${p.score}</strong><small>${p.rounds?Math.round(p.correct/p.rounds*100):0}% chính xác</small></div>`).join("")+'</div>';
      const celebration=s.session?.id+":"+r?.id+":"+s.phase;
      if(["LEADERBOARD","FINISHED"].includes(s.phase)&&celebrated!==celebration){celebrated=celebration;confetti(board);}
    }else board.replaceChildren();
    tick();
  }
  function tick(){
    if(wrongPair&&wrongPair.until<=Date.now()){root.querySelectorAll(".smart-shake").forEach(n=>n.classList.remove("smart-shake"));wrongPair=null;}
    const node=root.querySelector("#smartTimer");
    if(node&&s?.round){
      const seconds=Math.max(0,(s.round.deadline-(Date.now()+offset))/1000);
      node.textContent=s.phase==="QUESTION_ACTIVE"?seconds.toFixed(1)+" s":PHASES[s.phase];
      if(!seconds&&s.phase==="QUESTION_ACTIVE"){
         root.querySelectorAll("#smartLive button,#smartLive input").forEach(n=>n.disabled=true);
         if(me()?.controlling&&bank.autoRun){
           if(!bank.autoNextTimeout){
             bank.autoNextTimeout=setTimeout(()=>{send("LOCK_QUESTION");setTimeout(()=>send("SHOW_RESULT"),1500);},1000);
           }
         }
      }
    }
    if(s?.phase==="SHOW_RESULT"&&me()?.controlling&&bank.autoRun){
      if(!bank.autoResultTimeout){
        bank.autoResultTimeout=setTimeout(()=>{
          const q=bank.detail?.questions.find(x=>!(s?.usedQuestionIds||[]).includes(x.id));
          if(q)send("START_QUESTION",{question:{...q.question,bankId:q.id}});
          else{send("SHOW_LEADERBOARD");bank.autoRun=false;}
        },6000);
      }
    }else bank.autoResultTimeout=null;
    if(s?.phase!=="QUESTION_ACTIVE")bank.autoNextTimeout=null;
  }
  function confetti(container){
    if(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)return;
    window.cancelAnimationFrame(confettiFrame);
    const canvas=document.createElement("canvas");canvas.className="smart-confetti";canvas.setAttribute("aria-hidden","true");container.append(canvas);
    const width=container.clientWidth||600,height=320,dpr=Math.min(2,window.devicePixelRatio||1);canvas.width=width*dpr;canvas.height=height*dpr;
    const ctx=canvas.getContext("2d");if(!ctx){canvas.remove();return;}ctx.scale(dpr,dpr);
    const style=window.getComputedStyle(document.documentElement),colors=["--primary","--green","--amber","--blue"].map(x=>style.getPropertyValue(x).trim());
    const particles=Array.from({length:70},()=>({x:Math.random()*width,y:-Math.random()*height,v:1.5+Math.random()*3,color:colors[Math.floor(Math.random()*4)],r:Math.random()*6}));
    const start=performance.now();
    function frame(now){ctx.clearRect(0,0,width,height);for(const p of particles){p.y+=p.v;p.x+=Math.sin(p.y/30);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.r+3,5);}
      if(now-start<4000&&active&&canvas.isConnected)confettiFrame=window.requestAnimationFrame(frame);else canvas.remove();}
    confettiFrame=window.requestAnimationFrame(frame);
  }
  root.addEventListener("change",event=>{
    if(event.target.name==="mode")modeFields(event.target.value);
    if(event.target.name==="bankMode"){bank.mode=event.target.value;renderBankPane();}
    if(event.target.name==="bankCategory"){bank.category=event.target.value;renderBankPane();}
  });
  root.addEventListener("input",event=>{
    if(event.target.name==="bankSearch"){bank.search=event.target.value;renderBankPane();return;}
    if(event.target.id!=="smartEstimate")return;
    const value=Number(event.target.value);root.querySelector("#smartEstimateValue").textContent=value;
    if(Date.now()-previewAt>200){previewAt=Date.now();send("ESTIMATE_PREVIEW",{value},false);}
  });
  root.addEventListener("submit",event=>{
    event.preventDefault();
    const form=event.target,values=Object.fromEntries(new FormData(form));
    if(form.id==="smartShortForm"){send("SUBMIT_SHORT",{answer:values.answer});return;}
    if(form.id!=="smartQuestionForm")return;
    const q=formQuestion();
    send("START_QUESTION",{question:q});
  });
  root.addEventListener("click",async event=>{
    try{
    const target=event.target.closest("button");if(!target||target.disabled)return;
    if(target.dataset.smartTab){bank.tab=target.dataset.smartTab;renderMasterPanes();return;}
    if(target.dataset.answer){send("SUBMIT_QUIZ",{answer:target.dataset.answer});return;}
    if(target.dataset.move){
      const i=Number(target.dataset.move),j=i+Number(target.dataset.direction);
      [order[i],order[j]]=[order[j],order[i]];liveKey="";render();return;
    }
    if(target.dataset.left){
      left=target.dataset.left;
      root.querySelectorAll("[data-left]").forEach(n=>n.classList.toggle("selected",n.dataset.left===left));return;
    }
    if(target.dataset.right){if(!left){toast("Chọn một ô bên trái trước.","info");return;}send("MATCH_PAIR",{left,right:target.dataset.right});left=null;return;}
    const action=target.dataset.smart,at=generation,session=s?.session?.id;
    const card=target.closest("[data-question-id]"),questionId=card?.dataset.questionId;
    const setCard=target.closest(".smart-set-card"),setId=setCard?.querySelector("[data-set-id]")?.dataset.setId;
    if(action==="new-question"){bank.editing=null;fillQuestionForm(null);}
    else if(action==="clear-question"){bank.editing=null;fillQuestionForm(null);}
    else if(action==="edit-cancel"){bank.editing=null;fillQuestionForm(null);}
    else if(action==="bank-refresh")await loadBank(true);
    else if(action==="bank-start"){const q=bank.questions.find(x=>x.id===questionId)||bank.detail?.questions.find(x=>x.id===questionId);if(q&&canStart())send("START_QUESTION",{question:{...q.question,bankId:q.id}});}
    else if(action==="bank-edit"){const q=bank.questions.find(x=>x.id===questionId);if(q)fillQuestionForm(q);}
    else if(action==="bank-duplicate"){if(questionId){await api("/api/smart-class/questions",{method:"POST",body:{action:"duplicate",id:questionId}});toast("Đã nhân bản câu hỏi.","success");await loadBank(true);}}
    else if(action==="bank-delete"){if(questionId&&await modal({title:"Xóa câu hỏi?",description:"Câu hỏi sẽ bị gỡ khỏi mọi bộ đề. Kết quả các phiên cũ vẫn được giữ.",submit:"Xóa",danger:true})){await api("/api/smart-class/questions?id="+encodeURIComponent(questionId),{method:"DELETE"});toast("Đã xóa câu hỏi.","success");await loadBank(true);}}
    else if(action==="save-question"){
      const q=formQuestion();if(!q)return;const editing=bank.editing;
      const result=await modal({title:editing?"Lưu thay đổi":"Lưu vào ngân hàng",fields:field("title","Tên gợi nhớ","text",editing?.title||q.prompt.slice(0,120),"maxlength=160")+field("category","Chủ đề","text",editing?.category||"Chung","maxlength=80"),submit:"Lưu",onSubmit:async values=>{const body={id:editing?.id,title:values.title,category:values.category,question:q};await api("/api/smart-class/questions",{method:editing?"PUT":"POST",body});return true;}});
      if(result){toast(editing?"Đã cập nhật câu hỏi.":"Đã lưu câu hỏi.","success");bank.editing=null;bank.tab="bank";await loadBank(true);}
    }else if(action==="import-json"){
      const result=await modal({title:"Nhập câu hỏi từ JSON",description:"Dán một mảng câu hỏi hoặc { questions: [...] }. Tối đa 100 câu mỗi lần.",fields:`<label class="field"><span>JSON</span><textarea name="json" rows="12" required placeholder="Dán JSON câu hỏi tại đây"></textarea></label>`,submit:"Nhập",onSubmit:async values=>{let data;try{data=JSON.parse(values.json);}catch{throw new Error("JSON không hợp lệ.");}const items=Array.isArray(data)?data:data.questions;if(!Array.isArray(items))throw new Error("JSON phải là một mảng hoặc có trường questions.");await api("/api/smart-class/questions",{method:"POST",body:{action:"import",items}});return items.length;}});
      if(result){toast(`Đã nhập ${result} câu hỏi.`,"success");await loadBank(true);}
    }else if(action==="export-json"){
      const data=JSON.stringify(bank.questions.map(q=>({title:q.title,category:q.category,question:q.question})),null,2),blob=new Blob([data],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="smart-class-question-bank.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),0);
    }else if(action==="set-new"){
      const result=await modal({title:"Tạo bộ đề",fields:field("title","Tên bộ đề","text","","maxlength=160")+'<label class="field"><span>Mô tả</span><textarea name="description" rows="4" maxlength="600"></textarea></label>',submit:"Tạo",onSubmit:async values=>{const data=await api("/api/smart-class/question-sets",{method:"POST",body:values});return data.id;}});
      if(result){await loadBank(true);bank.detail=(await api("/api/smart-class/question-sets?id="+encodeURIComponent(result))).set;bank.tab="sets";renderMasterPanes();}
    }else if(action==="set-open"){if(setId){bank.detail=(await api("/api/smart-class/question-sets?id="+encodeURIComponent(setId))).set;renderSetsPane();}}
    else if(action==="set-back"){bank.detail=null;renderSetsPane();}
    else if(action==="set-rename"){
      const set=bank.detail;if(set){const result=await modal({title:"Sửa bộ đề",fields:field("title","Tên bộ đề","text",set.title,"maxlength=160")+`<label class="field"><span>Mô tả</span><textarea name="description" rows="4" maxlength="600">${h(set.description||"")}</textarea></label>`,submit:"Lưu",onSubmit:async values=>{await api("/api/smart-class/question-sets",{method:"PUT",body:{id:set.id,...values}});return true;}});if(result){bank.detail=(await api("/api/smart-class/question-sets?id="+encodeURIComponent(set.id))).set;await loadBank(true);}}
    }else if(action==="set-delete"){const set=bank.detail;if(set&&await modal({title:"Xóa bộ đề?",description:"Câu hỏi trong ngân hàng không bị xóa.",submit:"Xóa",danger:true})){await api("/api/smart-class/question-sets?id="+encodeURIComponent(set.id),{method:"DELETE"});bank.detail=null;await loadBank(true);}}
    else if(action==="set-add"){const id=root.querySelector("#smartSetAdd")?.value;if(id&&bank.detail){const ids=[...bank.detail.questions.map(q=>q.id),id];await api("/api/smart-class/question-sets",{method:"PUT",body:{id:bank.detail.id,question_ids:ids}});bank.detail=(await api("/api/smart-class/question-sets?id="+encodeURIComponent(bank.detail.id))).set;renderSetsPane();}}
    else if(["set-up","set-down","set-remove"].includes(action)&&questionId&&bank.detail){let ids=bank.detail.questions.map(q=>q.id),i=ids.indexOf(questionId);if(action==="set-remove")ids.splice(i,1);else{const j=i+(action==="set-up"?-1:1);[ids[i],ids[j]]=[ids[j],ids[i]];}await api("/api/smart-class/question-sets",{method:"PUT",body:{id:bank.detail.id,question_ids:ids}});bank.detail=(await api("/api/smart-class/question-sets?id="+encodeURIComponent(bank.detail.id))).set;renderSetsPane();}
    else if(action==="set-next"||action==="set-auto"){bank.autoRun=(action==="set-auto");const q=bank.detail?.questions.find(x=>!(s?.usedQuestionIds||[]).includes(x.id));if(q&&canStart())send("START_QUESTION",{question:{...q.question,bankId:q.id}});}
    else if(action==="claim")send("CLAIM_HOST");
    else if(action==="session"){
      const result=await modal({title:"Tạo phiên Smart Class",fields:field("title","Tên phiên","text","Smart Class","maxlength=120"),submit:"Tạo phiên",onSubmit:values=>values.title});
      if(result&&active&&generation===at&&s?.session?.id===session)send("NEW_SESSION",{title:result});
    }else if(action==="finish"){
      if(await modal({title:"Kết thúc phiên?",description:"Câu hỏi đang mở sẽ được khóa và điểm được lưu.",submit:"Kết thúc"}) && active && generation===at && s?.session?.id===session)send("FINISH");
    }else if(action==="lock")send("LOCK_QUESTION");
    else if(action==="result")send("SHOW_RESULT");
    else if(action==="board")send("SHOW_LEADERBOARD");
    else if(action==="buzz")send("BUZZER_HIT");
    else if(action==="reorder")send("SUBMIT_REORDER",{answer:order});
    else if(action==="estimate")send("SUBMIT_ESTIMATE",{value:Number(root.querySelector("#smartEstimate").value)});
    else if(action==="connect"){attempt=0;clearTimeout(reconnect);if(ws?.readyState===1)ws.send(JSON.stringify({type:"SYNC"}));else void connect();}
    else if(action==="sound"){sound=!sound;target.textContent="Âm thanh: "+(sound?"bật":"tắt");}
    }catch(error){toast(error.message||"Không thể hoàn thành thao tác.","error");}
  });
  let dragging=null;
  root.addEventListener("dragstart",e=>{dragging=e.target.closest("[data-order-id]")?.dataset.orderId;if(dragging)e.dataTransfer.setData("text/plain",dragging);});
  root.addEventListener("dragover",e=>{if(dragging&&e.target.closest("[data-order-id]"))e.preventDefault();});
  root.addEventListener("drop",e=>{
    const id=e.target.closest("[data-order-id]")?.dataset.orderId;
    if(!dragging||!id)return;e.preventDefault();const from=order.indexOf(dragging),to=order.indexOf(id);
    if(from>=0&&to>=0){order.splice(from,1);order.splice(to,0,dragging);liveKey="";render();}dragging=null;
  });
  return {
    open(){if(active)return;active=true;generation++;shell();void connect();ticker=setInterval(tick,100);},
    close(){active=false;generation++;clearTimeout(reconnect);clearInterval(heartbeat);clearInterval(ticker);window.cancelAnimationFrame(confettiFrame);
      if(ws){const socket=ws;ws=null;socket.close();}pending.clear();s=null;liveKey="";order=[];left=null;wrongPair=null;lastRound="";bank.detail=null;bank.editing=null;root.replaceChildren();},
    reset(){this.close();celebrated="";}
  };
}
