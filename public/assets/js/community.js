
import {escapeHTML as h, icon, toast, modal} from './ui.js';

const time=value=>new Date(value).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Ho_Chi_Minh'});
const chatIcon='<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M20 11a8 8 0 0 1-8 8H5l-4 3 1.5-6A9 9 0 1 1 20 11Z"/><path d="M7 10h9M7 14h6"/></svg>';
const linkIcon='<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m10 13 4-4m-6 7-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m0 12a4 4 0 0 0 6 0l5-5a4 4 0 0 0-6-6l-1 1" transform="translate(2 0) scale(.85 1)"/></svg>';
export const communityTiles=`<button class="extras-tile" data-extra="lqa"><span class="extras-symbol lqa-purple">${chatIcon}</span><strong>LQA-Message</strong><p>Gặp nhau khi đang online. Trò chuyện riêng, chỉ bằng văn bản.</p><span class="extras-count">Mở danh sách online →</span></button><button class="extras-tile" data-extra="links"><span class="extras-symbol lqa-blue">${linkIcon}</span><strong>Liên kết nhanh</strong><p>Những địa chỉ cần dùng, được Châu Đan Huy chia sẻ.</p><span class="extras-count">Mở các liên kết →</span></button>`;

export function createCommunity({api,getMember}) {
  let socket=null,epoch=0,connecting=false,retry=null,heartbeat=null,lastPong=0,attempt=0,serverOffset=0;
  let activeTab='', windowFocused=document.hasFocus();
  window.addEventListener('focus',()=>{windowFocused=true;});
  window.addEventListener('blur',()=>{windowFocused=false;});
  let status='Chưa kết nối',ready=false,people=[],host=null,mode='',back=null,viewEpoch=0;
  let peer=null,messages=[],historyId=null,hasMore=false,expiry=null,loadingHistory=false;
  const drafts=new Map(),pending=new Map(),seen=new Map(),expiries=new Map();
  const notices=document.createElement('div');notices.className='lqa-notifications';notices.setAttribute('aria-live','polite');document.body.append(notices);
  const dialog=document.createElement('dialog');dialog.className='lqa-window';dialog.setAttribute('aria-labelledby','lqaPeerName');dialog.setAttribute('aria-modal','false');
  dialog.innerHTML=`<header class="lqa-window-head"><span class="lqa-avatar">${chatIcon}</span><div><strong id="lqaPeerName">LQA-Message</strong><small id="lqaPeerStatus"></small></div><button type="button" class="icon-button" data-chat-close aria-label="Đóng trò chuyện">${icon('x')}</button></header><p class="lqa-retention">Tự xóa sau 24 giờ kể từ tin nhắn cuối cùng.</p><button class="button ghost small" id="lqaOlder" type="button" hidden>Xem tin trước</button><div id="lqaMessages" class="lqa-messages" role="log" aria-live="polite" aria-relevant="additions"></div><p id="lqaChatError" class="lqa-error" role="status"></p><form id="lqaCompose"><label class="sr-only" for="lqaText">Tin nhắn văn bản</label><textarea id="lqaText" maxlength="2000" rows="2" placeholder="Nhập tin nhắn… Enter để gửi" required></textarea><button type="submit" class="button primary" id="lqaSend">Gửi</button><small>Chỉ văn bản · Shift + Enter để xuống dòng</small></form>`;
  document.body.append(dialog);
  const q=s=>dialog.querySelector(s),allowed=()=>!!getMember()&&!getMember().must_change_password;
  const now=()=>Date.now()+serverOffset;
  const currentDraft=()=>{if(!peer)return null;if(!drafts.has(peer.id))drafts.set(peer.id,{text:'',id:crypto.randomUUID()});return drafts.get(peer.id);};
  const isOnline=id=>ready&&people.some(p=>p.id===id);
  const post=data=>{if(!ready||socket?.readyState!==1)throw new Error('Chat chưa kết nối. Hãy thử lại khi trạng thái Online xuất hiện.');socket.send(JSON.stringify(data));};
  const heading=(title,description)=>`<div class="extras-head"><div><button class="button ghost small" data-community="back">← Tiện ích</button><h1>${title}</h1><p class="muted">${description}</p></div></div>`;
  function updateStatus(value) {status=value;renderOnline();composer();}
  function composer(){
    const online=peer&&isOnline(peer.id),busy=peer&&[...pending.values()].some(p=>p.peer===peer.id);
    q('#lqaPeerStatus').textContent=!ready?status:online?'● Đang online':'○ Đã ngoại tuyến';
    q('#lqaSend').disabled=!online||busy||loadingHistory;
    q('#lqaText').disabled=!online;
    q('#lqaSend').textContent=busy?'Đang gửi…':'Gửi';
  }
  function renderOnline(){
    if(!host||mode!=='chat')return;
    const other=people.filter(p=>p.id!==getMember()?.id);
    host.innerHTML=heading('LQA-Message','Chọn người đang online để mở hộp thoại chat riêng.')+
      `<div class="lqa-presence-bar"><span class="lqa-status ${ready?'connected':''}">${h(status)}</span><span class="muted">${ready?other.length+' thành viên khác đang online':'Đang chờ kết nối'}</span><button class="button ghost small" data-community="reconnect">Kết nối lại</button></div><div class="lqa-people">${other.map(p=>`<button type="button" class="lqa-person" data-community="peer" data-id="${p.id}"><span class="lqa-person-dot"></span><span><b>${h(p.name)}</b><small>${h(p.unit_label)}</small></span><span>Chat →</span></button>`).join('')||'<div class="extras-empty">'+(ready?'Chưa có thành viên khác đang online.':'Danh sách sẽ hiện khi kết nối chat sẵn sàng.')+'</div>'}</div><p class="extras-help">Bạn được tính online khi đang đăng nhập và còn kết nối với web. Người nhận phải online mới gửi được tin. Đóng web hoặc mất kết nối sẽ chuyển sang ngoại tuyến; phát hiện mất mạng có thể mất khoảng 75 giây.</p>`;
  }
  function renderMessages(scroll=true){
    const node=q('#lqaMessages'),top=node.scrollTop,height=node.scrollHeight;
    node.innerHTML=messages.length?messages.map(m=>`<article class="lqa-bubble ${m.sender===getMember()?.id?'mine':''}"><p>${h(m.body)}</p><time>${time(m.sent_at)}</time></article>`).join(''):
      '<p class="lqa-empty">'+(loadingHistory?'Đang tải cuộc trò chuyện…':'Chưa có tin nhắn. Bắt đầu bằng một lời chào nhé.')+'</p>';
    q('#lqaOlder').hidden=!hasMore;q('#lqaOlder').disabled=loadingHistory;
    if(scroll)node.scrollTop=node.scrollHeight;else node.scrollTop=top+node.scrollHeight-height;
  }
  function history(older=false){
    if(!peer||!ready)return;
    historyId=crypto.randomUUID();loadingHistory=true;composer();
    try{post({type:'history',peer:peer.id,request_id:historyId,...(older&&messages.length?{before:messages[0].seq}:{})});}
    catch(error){loadingHistory=false;q('#lqaChatError').textContent=error.message;}
  }
  function openPeer(person){
    if(!allowed())return;
    const changed=peer?.id!==person.id;
    peer=person;q('#lqaPeerName').textContent=person.name;
    if(changed){messages=[];hasMore=false;expiry=expiries.get(peer.id)||null;historyId=null;}
    q('#lqaChatError').textContent='';
    q('#lqaText').value=currentDraft().text;
    if(!dialog.open)dialog.show();
    history();renderMessages();composer();
    if(isOnline(peer.id))q('#lqaText').focus();
  }
  function notify(message,name,deadline){
    const item=document.createElement('div');item.className='lqa-notice';item.dataset.peer=String(message.sender);item.dataset.expires=String(deadline);
    const open=document.createElement('button');open.type='button';open.className='lqa-notice-open';
    const title=document.createElement('b');title.textContent='LQA-Message · '+name;
    const text=document.createElement('span');text.textContent=message.body.slice(0,110);
    open.append(title,text);open.onclick=()=>{openPeer({id:message.sender,name});item.remove();};
    const close=document.createElement('button');close.className='icon-button';close.type='button';close.setAttribute('aria-label','Đóng thông báo');close.textContent='×';close.onclick=()=>item.remove();
    item.append(open,close);notices.append(item);while(notices.children.length>3)notices.firstElementChild.remove();
    window.setTimeout(()=>item.remove(),9000);
  }
  function addMessage(message,deadline,name,notification=true){
    const me=getMember()?.id;if(!me||![message.sender,message.recipient].includes(me))return;
    const other=message.sender===me?message.recipient:message.sender;
    expiries.set(other,deadline);
    const duplicate=seen.has(message.id);seen.set(message.id,{peer:other,expires:deadline});
    if(peer?.id===other){
      expiry=deadline;
      if(!messages.some(m=>m.id===message.id)){messages.push(message);messages.sort((a,b)=>a.seq-b.seq);renderMessages();}
    }
    if(!duplicate&&notification&&message.recipient===me&&!(activeTab==='lqa-message'&&!document.hidden&&windowFocused))notify(message,name||people.find(p=>p.id===other)?.name||'Thành viên',deadline);
  }
  function expirePeer(id){
    expiries.delete(id);drafts.delete(id);
    for(const [key,val]of seen)if(val.peer===id)seen.delete(key);
    for(const el of notices.querySelectorAll('[data-peer]'))if(Number(el.dataset.peer)===id)el.remove();
    if(peer?.id===id){messages=[];expiry=null;hasMore=false;historyId=null;loadingHistory=false;q('#lqaText').value='';renderMessages();q('#lqaChatError').textContent='Cuộc trò chuyện đã tự xóa sau 24 giờ không có tin nhắn mới.';composer();}
  }
  function receive(data){
    if(!allowed())return;
    if(data.server_now)serverOffset=data.server_now-Date.now();
    if(data.type==='ready'){
      ready=true;attempt=0;lastPong=Date.now();updateStatus('● Đang online');
      if(dialog.open&&peer)history();
    }else if(data.type==='pong'){lastPong=Date.now();}
    else if(data.type==='presence'){people=data.members;renderOnline();composer();}
    else if(data.type==='history'&&peer?.id===data.peer&&historyId===data.request_id){
      const older=messages.length>0;
      loadingHistory=false;hasMore=data.has_more;expiry=data.expires_at;
      if(expiry)expiries.set(peer.id,expiry);
      const merged=new Map([...data.messages,...messages].map(m=>[m.id,m]));
      messages=[...merged.values()].sort((a,b)=>a.seq-b.seq);
      for(const m of messages)seen.set(m.id,{peer:peer.id,expires:expiry});
      renderMessages(!older);composer();
    }else if(data.type==='message'||data.type==='NEW_MESSAGE'){addMessage(data.message,data.expires_at,data.sender_name);}
    else if(data.type==='ack'){
      addMessage(data.message,data.expires_at,null,false);
      const p=pending.get(data.id);if(p){clearTimeout(p.timer);pending.delete(data.id);}
      const target=data.message.recipient,d=drafts.get(target);
      if(d?.id===data.id){drafts.delete(target);if(peer?.id===target)q('#lqaText').value='';}
      if(peer?.id===target)q('#lqaChatError').textContent='';
      composer();
    }else if(data.type==='expired'){expirePeer(data.peer);}
    else if(data.type==='error'){
      if(data.id){const p=pending.get(data.id);if(p){clearTimeout(p.timer);pending.delete(data.id);}}
      if(data.request_id===historyId)loadingHistory=false;
      q('#lqaChatError').textContent=data.error;
      if(data.code==='AUTH'){ready=false;socket?.close();updateStatus('Phiên chat đã hết hạn');}
      composer();
    }
  }
  function dropConnection(){
    clearTimeout(retry);retry=null;clearInterval(heartbeat);heartbeat=null;
    const old=socket;socket=null;ready=false;people=[];connecting=false;
    if(old){old.onclose=null;old.onmessage=null;old.onerror=null;try{old.close();}catch{}}
    for(const p of pending.values())clearTimeout(p.timer);pending.clear();
    loadingHistory=false;historyId=null;
  }
  function reconnectLater(at){
    if(at!==epoch||!allowed())return;
    clearTimeout(retry);
    retry=window.setTimeout(()=>connect(),Math.min(30000,1000*2**Math.min(attempt++,5))+Math.random()*300);
  }
  async function connect(){
    if(!allowed()||connecting||(socket&&(socket.readyState===0||socket.readyState===1)))return;
    const at=epoch;connecting=true;updateStatus('Đang kết nối…');
    try{
      const data=await api('/api/chat/connect');
      if(at!==epoch||!allowed())return;
      if(!data.configured){updateStatus('Chưa cấu hình Worker LQA-Message');return;}
      const url=new URL('/api/chat/connect',location.href);url.protocol=url.protocol==='https:'?'wss:':'ws:';
      const ws=new WebSocket(url);socket=ws;lastPong=Date.now();
      ws.onmessage=event=>{if(at!==epoch||socket!==ws)return;try{receive(JSON.parse(event.data));}catch{q('#lqaChatError').textContent='Không đọc được dữ liệu chat.';}};
      ws.onerror=()=>{if(at===epoch)updateStatus('Kết nối chat đang gián đoạn');};
      ws.onclose=()=>{
        if(at!==epoch||socket!==ws)return;
        dropConnection();updateStatus('Đã mất kết nối · đang nối lại…');reconnectLater(at);
      };
      heartbeat=window.setInterval(()=>{
        if(at!==epoch||socket!==ws)return;
        if(Date.now()-lastPong>(ready?60000:30000)){ws.close();return;}
        if(ready)try{post({type:'ping'});}catch{}
      },25000);
    }catch(error){
      if(at===epoch&&allowed()){updateStatus(error.message);reconnectLater(at);}
    }finally{if(at===epoch)connecting=false;}
  }
  async function send(){
    if(!peer||!isOnline(peer.id)||[...pending.values()].some(p=>p.peer===peer.id))return;
    const draft=currentDraft(),text=q('#lqaText').value.trim();
    if(!text)return;
    if(draft.text!==q('#lqaText').value){draft.text=q('#lqaText').value;draft.id=crypto.randomUUID();}
    const id=draft.id,to=peer.id;
    q('#lqaChatError').textContent='';
    const timer=window.setTimeout(()=>{
      pending.delete(id);if(peer?.id===to)q('#lqaChatError').textContent='Chưa nhận xác nhận. Bạn có thể gửi lại nguyên nội dung để tránh trùng tin.';composer();
    },12000);
    pending.set(id,{peer:to,timer});
    try{post({type:'send',id,to,text});}catch(error){clearTimeout(timer);pending.delete(id);q('#lqaChatError').textContent=error.message;}
    composer();
  }
  dialog.querySelector('[data-chat-close]').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{q('#lqaText').blur();});
  q('#lqaCompose').onsubmit=event=>{event.preventDefault();void send();};
  q('#lqaText').addEventListener('input',()=>{const d=currentDraft();if(d){d.text=q('#lqaText').value;d.id=crypto.randomUUID();}});
  q('#lqaText').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();void send();}});
  for(const type of ['drop','paste'])q('#lqaText').addEventListener(type,event=>{
    const files=type==='drop'?event.dataTransfer?.files:event.clipboardData?.files;
    if(files?.length){event.preventDefault();q('#lqaChatError').textContent='LQA-Message chỉ nhận văn bản, không nhận tệp.';}
  });
  q('#lqaOlder').onclick=()=>history(true);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&dialog.open&&dialog.contains(document.activeElement))dialog.close();});
  window.addEventListener('pagehide',()=>{epoch++;dropConnection();clearChats();updateStatus('Đã ngắt kết nối');});
  window.addEventListener('offline',()=>{epoch++;dropConnection();updateStatus('Mất kết nối mạng');});
  window.addEventListener('pageshow',()=>{if(allowed())void connect();});
  window.addEventListener('online',()=>{if(allowed())void connect();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&allowed()){if(ready)try{post({type:'ping'});}catch{}else void connect();}});
  window.setInterval(()=>{
    for(const [id,end] of expiries)if(end<=now())expirePeer(id);
    for(const [id,s] of seen)if(s.expires<=now())seen.delete(id);
  },5000);

  async function renderLinks(){
    if(!host||mode!=='links')return;
    const at=++viewEpoch,target=host;
    host.innerHTML=heading('Liên kết nhanh','Các trang cần dùng, gọn trong một nơi.')+'<div class="panel" aria-busy="true"><div class="skeleton line"></div><div class="skeleton line"></div></div>';
    try{
      const data=await api('/api/extras/links');
      if(at!==viewEpoch||target!==host||!allowed())return;
      host.innerHTML=heading('Liên kết nhanh','Mọi thành viên đều xem được. Châu Đan Huy quản lý danh sách.')+
        '<div class="extras-toolbar">'+(data.can_manage?'<button class="button primary" data-community="add-link">'+icon('plus')+' Thêm liên kết</button>':'')+'<button class="button ghost" data-community="refresh-links">Làm mới</button></div>'+
        '<div class="lqa-links">'+(data.items.map(link=>{
          let safe;try{safe=new URL(link.url);}catch{return '';}
          if(!['http:','https:'].includes(safe.protocol))return '';
          return `<article class="lqa-link"><span class="extras-symbol lqa-blue">${linkIcon}</span><div><a href="${h(safe.href)}" target="_blank" rel="noopener noreferrer">${h(link.title)} ↗</a><small>${h(safe.hostname)}</small></div>${data.can_manage?'<button class="icon-button danger-text" data-community="delete-link" data-id="'+h(link.id)+'" aria-label="Xóa liên kết">'+icon('trash')+'</button>':''}</article>`;
        }).join('')||'<div class="extras-empty">Chưa có liên kết được chia sẻ.</div>')+'</div>';
    }catch(error){
      if(at===viewEpoch&&target===host)host.innerHTML=heading('Liên kết nhanh','')+'<p class="lqa-error">'+h(error.message)+'</p><button class="button ghost" data-community="refresh-links">Thử lại</button>';
    }
  }
  async function action(event){
    const button=event.target.closest('[data-community]');if(!button||!allowed())return;
    const action=button.dataset.community;
    if(action==='back'){back?.();return;}
    if(action==='peer'){const p=people.find(p=>p.id===Number(button.dataset.id));if(p)openPeer(p);return;}
    if(action==='reconnect'){epoch++;dropConnection();void connect();return;}
    if(action==='refresh-links'){void renderLinks();return;}
    const at=epoch;
    if(action==='add-link'){
      const result=await modal({title:'Thêm liên kết nhanh',submit:'Thêm liên kết',fields:'<label class="field"><span>Tên hiển thị</span><input name="title" maxlength="120" required></label><label class="field"><span>Địa chỉ trang web</span><input name="url" type="url" maxlength="2048" placeholder="https://" required></label>',onSubmit:data=>api('/api/extras/links',{method:'POST',body:data})});
      if(result&&at===epoch&&allowed()){toast('Đã thêm liên kết.');void renderLinks();}
    }
    if(action==='delete-link'){
      const result=await modal({title:'Xóa liên kết này?',description:'Liên kết sẽ được gỡ khỏi danh sách của tất cả thành viên.',submit:'Xóa',danger:true,onSubmit:()=>api('/api/extras/links',{method:'DELETE',body:{id:button.dataset.id}})});
      if(result&&at===epoch&&allowed()){toast('Đã xóa liên kết.');void renderLinks();}
    }
  }
  function mount(root,next,onBack){
    if(host)host.removeEventListener('click',action);
    viewEpoch++;host=root;mode=next;activeTab=next==='chat'?'lqa-message':next;back=onBack;host.addEventListener('click',action);
    if(next==='chat'){renderOnline();void connect();}else void renderLinks();
  }
  function clearChats(){
    drafts.clear();seen.clear();expiries.clear();notices.replaceChildren();
    peer=null;messages=[];expiry=null;hasMore=false;q('#lqaText').value='';q('#lqaChatError').textContent='';q('#lqaMessages').replaceChildren();
    q('#lqaPeerName').textContent='LQA-Message';q('#lqaPeerStatus').textContent='';
    if(dialog.open)dialog.close();
  }
  function reset(){
    epoch++;dropConnection();status='Chưa kết nối';unmount();clearChats();
  }
  function unmount(){viewEpoch++;if(host)host.removeEventListener('click',action);host=null;mode='';activeTab='';back=null;}
  return {sync(){if(allowed())void connect();else reset();},reset,unmount,mountChat:(r,b)=>mount(r,'chat',b),mountLinks:(r,b)=>mount(r,'links',b)};
}
