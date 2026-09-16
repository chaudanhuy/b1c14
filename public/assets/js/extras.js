import { escapeHTML as h, icon, toast, modal, busy } from './ui.js';
import { communityTiles } from './community.js';

const endpoint = '/api/extras/';
const stamp = value => new Date(value).toLocaleString('vi-VN', { timeZone:'Asia/Ho_Chi_Minh', day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
const mailIcon = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m3 7 9 6 9-6"/></svg>';
const bellIcon = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>';
const button = (action, label, style='soft', attributes='') => `<button type="button" class="button ${style}" data-extra="${action}" ${attributes}>${label}</button>`;
const pager = (page, more) => `<div class="extras-pagination">${button('previous','Trước','ghost', page ? '' : 'disabled')}<span class="muted">Trang ${page+1}</span>${button('next','Tiếp','ghost', more ? '' : 'disabled')}</div>`;
const blank = text => `<div class="extras-empty">${h(text)}</div>`;
const textInput = (name,label,value='',max=160) => `<label class="field"><span>${label}</span><input name="${name}" maxlength="${max}" required value="${h(value)}"></label>`;
const area = (name,label,value='',max=8000,required=true) => `<label class="field"><span>${label}</span><textarea name="${name}" maxlength="${max}" ${required?'required':''}>${h(value)}</textarea></label>`;

export function createExtras({ community, api, getMember, isActive }) {
  const root = document.getElementById('extrasRoot');
  let screen='hub', box='inbox', page=0, period='upcoming', version=0, session=0;
  let controller=new AbortController(), summarySequence=0, rows=[], currentMail=null, recipients=[];
  let draft=null, edit=null, active=false, writing=false;
  const manager = () => getMember()?.role === 'cadre';
  const allowed = () => !!getMember() && !getMember().must_change_password;
  function cancelled() { return new DOMException('Cancelled','AbortError'); }
  async function request(path, options={}) {
    const at=session;
    const data=await api(endpoint+path, { ...options, ...(options.method ? {} : { signal:controller.signal }) });
    if (at!==session || !allowed()) throw cancelled();
    return data;
  }
  async function run(fn) {
    const at=session;
    try { await fn(); } catch(error) {
      if (at!==session || error.name==='AbortError') return;
      toast(error.message,'error');
      const loader=root.querySelector('.extras-loading');
      if(loader) loader.outerHTML=blank('Không tải được dữ liệu. '+error.message)+button('reload','Thử lại');
    }
  }
  function header(title,description,back=true,actions='') {
    return `<div class="extras-head"><div>${back?button('hub','← Tiện ích','ghost small'):'<span class="extras-eyebrow">KHÔNG GIAN TIỆN ÍCH</span>'}<h1>${h(title)}</h1><p class="muted">${h(description)}</p></div><div class="action-row">${actions}</div></div>`;
  }
  function begin(next, title, description, actions='') {
    community.unmount();
    controller.abort(); controller=new AbortController(); screen=next; version++;
    root.innerHTML=header(title,description,next!=='hub',actions)+'<div class="extras-loading panel" aria-busy="true"><div class="skeleton line"></div><div class="skeleton line"></div><div class="skeleton line"></div></div>';
    return version;
  }
  function draw(at, html) { if(at===version && active) root.innerHTML=html; }
  async function summary() {
    if(!active || !allowed()) return;
    const at=session, ticket=++summarySequence;
    try {
      const data=await api(endpoint+'summary');
      if(at!==session || ticket!==summarySequence || !active) return;
      for(const [key,value] of Object.entries(data))
        root.querySelectorAll('[data-extra-count="'+key+'"]').forEach(n=>n.textContent=value);
    } catch(error) {
      if(at===session && active) root.querySelectorAll('[data-extra-count]').forEach(n=>n.textContent='—');
    }
  }
  function hub() {
    begin('hub','Thêm','Một nơi cho những việc nhỏ, kết nối cả tập thể.');
    root.innerHTML=header('Thêm','Một nơi cho những việc nhỏ, kết nối cả tập thể.',false,button('reload',icon('refresh')+' Làm mới','ghost'))+
      `<div class="extras-tiles">
      <button class="extras-tile" data-extra="mail"><span class="extras-symbol">${mailIcon}</span><strong>Hộp thư</strong><p>Gửi lời nhắn cho một người hoặc toàn bộ thành viên.</p><span class="extras-count"><span data-extra-count="unread_mail">…</span> thư chưa đọc →</span></button>
      <button class="extras-tile" data-extra="events"><span class="extras-symbol">${icon('clock')}</span><strong>Đếm ngược sự kiện</strong><p>Những mốc đáng nhớ, lịch thi và kế hoạch của riêng bạn.</p><span class="extras-count"><span data-extra-count="upcoming_events">…</span> sự kiện sắp tới →</span></button>
      <button class="extras-tile" data-extra="notices"><span class="extras-symbol">${bellIcon}</span><strong>Bảng thông báo</strong><p>Cập nhật thông tin chung và xác nhận khi bạn đã đọc.</p><span class="extras-count"><span data-extra-count="unread_notices">…</span> thông báo chưa đọc →</span></button>
      ${communityTiles}</div><p class="extras-help">Thư được gửi trong website. Số lượng chưa đọc tự cập nhật mỗi phút khi bạn mở mục Thêm.</p>`;
    void summary();
  }
  async function mailList(reset=false) {
    if(reset) page=0;
    const actions=button('compose',icon('plus')+' Soạn thư','primary');
    const at=begin('mail','Hộp thư','Trao đổi trong đơn vị, gửi đúng người bạn muốn.',actions);
    const data=await request('mail?box='+box+'&page='+page);
    if(at!==version) return; rows=data.items;
    const tabs=`<div class="extras-toolbar"><div class="extras-tabs">${button('inbox','Thư đến','soft','aria-pressed="'+(box==='inbox')+'"')}${button('sent','Đã gửi','soft','aria-pressed="'+(box==='sent')+'"')}</div>${button('reload',icon('refresh')+' Làm mới','ghost')}<span class="muted">Chưa đọc: <b data-extra-count="unread_mail">…</b></span></div>`;
    draw(at,header('Hộp thư','Trao đổi trong đơn vị, gửi đúng người bạn muốn.',true,actions)+tabs+
      '<div class="extras-list">'+(rows.length?rows.map(m=>`<button class="extras-mail-row ${box==='inbox'&&!m.read_at?'unread':''}" data-extra="mail-detail" data-id="${m.id}"><span class="extras-mail-dot"></span><span><b>${h(m.subject)}</b><small>${box==='inbox'?h(m.sender_name)+' · '+h(m.sender_unit):'Đến: '+h(m.audience==='all'?'Toàn bộ thành viên':m.recipient_name)+' · '+m.read_count+'/'+m.recipient_count+' đã đọc'}</small></span><time class="extras-meta">${stamp(m.created_at)}</time></button>`).join(''):blank(box==='inbox'?'Chưa có thư đến.':'Bạn chưa gửi thư nào.'))+'</div>'+pager(page,data.has_more));
    void summary();
  }
  async function detail(id) {
    const at=begin('detail','Đọc thư','');
    const data=await request('mail?id='+encodeURIComponent(id));
    if(at!==version) return;
    currentMail=data.mail;
    if(!currentMail.is_sender && !currentMail.read_at) {
      await request('mail',{method:'PATCH',body:{id,action:'read'}});
      if(at!==version) return;
    }
    const m=currentMail;
    const destination=m.audience==='all'?'Toàn bộ thành viên':data.recipients.map(x=>x.name).join(', ');
    draw(at,header('Hộp thư','',true,button('mail-back','← Danh sách','ghost'))+
      `<article class="panel extras-detail"><span class="extras-chip">${m.is_sender?'Đã gửi':'Thư đến'}${m.audience==='all'?' · Gửi toàn bộ':''}</span><h2>${h(m.subject)}</h2><p class="extras-meta">Từ: ${h(m.sender_name)} · ${h(m.sender_unit)}<br>Đến: ${h(destination)}<br>${stamp(m.created_at)} (giờ Việt Nam)</p><div class="extras-body">${h(m.body)}</div>
      ${m.is_sender?'<details><summary>Trạng thái người nhận ('+data.recipients.length+')</summary><ul class="extras-recipient-list">'+data.recipients.map(r=>'<li>'+h(r.name)+' · '+(r.read_at?'Đã đọc '+stamp(r.read_at):'Chưa đọc')+'</li>').join('')+'</ul></details>':''}
      <div class="extras-actions">${!m.is_sender?button('reply','Trả lời','primary'):''}${button('delete-mail',icon('trash')+' Xóa khỏi hộp thư','ghost danger-text')}</div></article>`);
  }
  async function compose(reply=null) {
    if(reply) draft={id:crypto.randomUUID(),recipient:String(reply.sender_id),subject:('Re: '+reply.subject).slice(0,160),body:''};
    draft ||= {id:crypto.randomUUID(),recipient:'',subject:'',body:''};
    const at=begin('compose','Soạn thư','Mọi thành viên đều có thể gửi thư riêng hoặc gửi toàn bộ.');
    const data=await request('mail?recipients=1'); if(at!==version) return; recipients=data.members;
    draw(at,header('Soạn thư','Thư nội bộ dạng văn bản; không gửi ra email bên ngoài.',true,button('mail-back','← Hộp thư','ghost'))+
      `<form id="extrasMailForm" class="panel stack-form extras-form">
      <label class="field"><span>Gửi đến</span><select name="recipient" required><option value="">Chọn người nhận…</option><option value="all" ${draft.recipient==='all'?'selected':''}>Toàn bộ thành viên (trừ bạn)</option>${recipients.map(m=>'<option value="'+m.id+'" '+(draft.recipient===String(m.id)?'selected':'')+'>'+h(m.name)+' · '+h(m.unit_label)+'</option>').join('')}</select></label>
      ${textInput('subject','Tiêu đề',draft.subject)}${area('body','Nội dung',draft.body)}
      <p class="extras-error" data-form-error role="status"></p><div class="extras-actions"><button type="submit" class="button primary">${mailIcon} Gửi thư</button>${button('discard-draft','Bỏ bản nháp','ghost')}</div>
      <p class="extras-help">Bản nháp chỉ giữ trong phiên trang này. Thư đã gửi không thể thu hồi khỏi hộp thư người nhận.</p></form>`);
  }
  async function sendMail(form) {
    if(writing) return;
    const values=Object.fromEntries(new FormData(form));
    Object.assign(draft,values);
    if(values.recipient==='all') {
      const confirmed=await modal({title:'Gửi thư cho toàn bộ thành viên?',description:'Tất cả thành viên hiện tại, trừ bạn, sẽ nhận được thư này.',submit:'Gửi toàn bộ'});
      if(!confirmed || screen!=='compose') return;
    }
    const at=version; writing=true;
    try {
      await busy(form.querySelector('[type=submit]'),async()=>{
        const result=await request('mail',{method:'POST',body:{id:draft.id,audience:values.recipient==='all'?'all':'person',recipient_id:Number(values.recipient),subject:values.subject,body:values.body}});
        draft=null; toast(result.message);
        if(at===version && active) { box='sent'; await mailList(true); }
      },'Đang gửi…');
    } catch(error) {
      if(error.name!=='AbortError' && at===version) form.querySelector('[data-form-error]').textContent=error.message+' Bạn có thể gửi lại nguyên nội dung để tránh tạo thư trùng.';
      throw error;
    } finally {writing=false;}
  }
  function tick() {
    if(!active || !isActive() || document.hidden) return;
    root.querySelectorAll('[data-countdown]').forEach(node=>{
      let seconds=Math.max(0,Math.ceil((Date.parse(node.dataset.countdown)-Date.now())/1000));
      const days=Math.floor(seconds/86400);seconds%=86400;
      const hours=Math.floor(seconds/3600);seconds%=3600;
      const minutes=Math.floor(seconds/60);seconds%=60;
      const values=[days,hours,minutes,seconds];
      node.querySelectorAll('b').forEach((n,i)=>n.textContent=String(values[i]).padStart(i?2:1,'0'));
      const end=node.parentElement.querySelector('[data-event-ended]');
      if(end) end.hidden=Date.parse(node.dataset.countdown)>Date.now();
    });
  }
  async function events(reset=false) {
    if(reset) page=0;
    const actions=button('new-event',icon('plus')+' Tạo sự kiện','primary');
    const at=begin('events','Đếm ngược sự kiện','Lưu một mốc thời gian, chờ đón những điều sắp tới.',actions);
    const data=await request('events?period='+period+'&page='+page);if(at!==version) return;rows=data.items;
    draw(at,header('Đếm ngược sự kiện','Thời gian hiển thị và nhập theo giờ Việt Nam (UTC+7).',true,actions)+
      `<div class="extras-toolbar extras-tabs">${button('upcoming','Sắp tới','soft','aria-pressed="'+(period==='upcoming')+'"')}${button('past','Đã đến mốc','soft','aria-pressed="'+(period==='past')+'"')}${button('reload',icon('refresh')+' Làm mới','ghost')}</div><div class="extras-grid">`+
      (rows.length?rows.map(e=>`<article class="extras-event ${e.scope==='all'?'shared':''}"><span class="extras-chip">${e.scope==='all'?'Toàn đơn vị':'Chỉ mình tôi'}</span><h2>${h(e.title)}</h2><p class="extras-meta">${stamp(e.target_at)} · ${h(e.owner_name)}</p>
      <div class="extras-timer" data-countdown="${h(e.target_at)}" aria-label="Thời gian còn lại">${['Ngày','Giờ','Phút','Giây'].map(x=>'<span><b>0</b><small>'+x+'</small></span>').join('')}</div><p class="extras-chip" data-event-ended hidden>Đã đến mốc sự kiện</p>
      ${e.description?'<p class="extras-event-note">'+h(e.description)+'</p>':''}${e.can_edit?'<div class="extras-actions">'+button('edit-event',icon('edit')+' Sửa','ghost small','data-id="'+e.id+'"')+button('delete-event',icon('trash')+' Xóa','ghost small danger-text','data-id="'+e.id+'"')+'</div>':''}</article>`).join(''):blank('Chưa có sự kiện trong danh sách này.'))+'</div>'+pager(page,data.has_more));
    tick();
  }
  function eventForm(event=null) {
    edit=event;begin('event-form',event?'Sửa sự kiện':'Tạo sự kiện','');
    const date=event?new Date(Date.parse(event.target_at)+7*3600000).toISOString().slice(0,16):'';
    root.innerHTML=header(event?'Sửa sự kiện':'Tạo sự kiện','Thời gian nhập theo giờ Việt Nam (UTC+7).',true,button('events-back','← Sự kiện','ghost'))+
      `<form id="extrasEventForm" class="panel stack-form extras-form">${textInput('title','Tên sự kiện',event?.title||'')}
      <label class="field"><span>Ngày và giờ (Việt Nam)</span><input type="datetime-local" name="target" min="2024-01-01T00:00" max="2100-12-31T23:59" required value="${date}"></label>
      <label class="field"><span>Phạm vi</span><select name="scope" ${event&&event.owner_id!==getMember().id?'disabled':''}><option value="private">Chỉ mình tôi</option>${manager()?'<option value="all" '+(event?.scope==='all'?'selected':'')+'>Toàn đơn vị</option>':''}</select></label>
      ${area('description','Ghi chú',event?.description||'',2000,false)}<p class="extras-error" data-form-error role="status"></p><button class="button primary" type="submit">Lưu sự kiện</button></form>`;
  }
  async function saveEvent(form) {
    if(writing) return;
    const data=Object.fromEntries(new FormData(form)), at=version;writing=true;
    try {
      await busy(form.querySelector('[type=submit]'),async()=>{
        await request('events',{method:edit?'PATCH':'POST',body:{...data,scope:data.scope||edit.scope,target_at:data.target+':00+07:00',...(edit?{id:edit.id,revision:edit.revision}:{})}});
        toast('Đã lưu sự kiện.');
        if(at===version&&active) { period=Date.parse(data.target+':00+07:00')<=Date.now()?'past':'upcoming';await events(true); }
      });
    } catch(error) {if(at===version) form.querySelector('[data-form-error]').textContent=error.message;throw error;} finally {writing=false;}
  }
  async function notices(reset=false) {
    if(reset) page=0;
    const actions=manager()?button('new-notice',icon('plus')+' Đăng thông báo','primary'):'';
    const at=begin('notices','Bảng thông báo','Thông tin chung của đơn vị, ngay tại đây.',actions);
    const data=await request('notices?page='+page);if(at!==version) return;rows=data.items;
    draw(at,header('Bảng thông báo','Bấm vào tiêu đề để đọc nội dung, sau đó xác nhận Đã đọc.',true,actions)+
      '<div class="extras-toolbar">'+button('reload',icon('refresh')+' Làm mới','ghost')+'</div><div class="extras-list">'+
      (rows.length?rows.map(n=>`<details class="extras-notice ${n.pinned?'pinned':''}"><summary><span class="extras-chip">${n.pinned?'Đã ghim · ':''}${n.is_read?'Đã đọc':'Chưa đọc'}</span><h2>${h(n.title)}</h2><p class="extras-meta">${h(n.author_name)} · ${stamp(n.updated_at)}</p></summary><div class="extras-body">${h(n.body)}</div><div class="extras-actions">
      ${button('read-notice',n.is_read?'Đã xác nhận đọc':icon('check')+' Đã đọc','soft small','data-id="'+n.id+'" '+(n.is_read?'disabled':''))}
      ${manager()?button('edit-notice',icon('edit')+' Sửa','ghost small','data-id="'+n.id+'"')+button('delete-notice',icon('trash')+' Xóa','ghost small danger-text','data-id="'+n.id+'"'):''}</div></details>`).join(''):blank('Chưa có thông báo.'))+'</div>'+pager(page,data.has_more));
  }
  function noticeForm(notice=null) {
    if(!manager()) return;
    edit=notice;begin('notice-form',notice?'Sửa thông báo':'Đăng thông báo','');
    root.innerHTML=header(notice?'Sửa thông báo':'Đăng thông báo','Mọi thành viên đều xem được thông báo này.',true,button('notices-back','← Thông báo','ghost'))+
      `<form id="extrasNoticeForm" class="panel stack-form extras-form">${textInput('title','Tiêu đề',notice?.title||'')}${area('body','Nội dung',notice?.body||'')}
      <label class="check-label"><input name="pinned" type="checkbox" ${notice?.pinned?'checked':''}> Ghim lên đầu bảng</label>
      <p class="extras-error" data-form-error role="status"></p><button type="submit" class="button primary">${notice?'Lưu thay đổi':'Đăng thông báo'}</button></form>`;
  }
  async function saveNotice(form) {
    if(writing) return;
    const data=Object.fromEntries(new FormData(form)),at=version;writing=true;
    try {
      await busy(form.querySelector('[type=submit]'),async()=>{
        await request('notices',{method:edit?'PATCH':'POST',body:{...data,pinned:!!data.pinned,...(edit?{id:edit.id,revision:edit.revision,action:'edit'}:{})}});
        toast('Đã lưu thông báo.');if(at===version&&active) await notices(true);
      });
    } catch(error) {if(at===version) form.querySelector('[data-form-error]').textContent=error.message;throw error;} finally {writing=false;}
  }
  async function remove(type,item) {
    const at=version;
    const result=await modal({title:type==='mail'?'Xóa khỏi hộp thư của bạn?':'Xóa nội dung này?',description:type==='mail'?'Bản của những người nhận khác vẫn còn.':item.title,submit:'Xóa',danger:true,onSubmit:()=>request(type,{method:'DELETE',body:{id:item.id,...(type==='mail'?{box:item.is_sender?'sent':'inbox'}:{revision:item.revision})}})});
    if(result&&at===version&&active) {toast('Đã xóa.');if(type==='mail')await mailList(true);else if(type==='events')await events(true);else await notices(true);}
  }
  async function reload() {
    if(screen==='mail')return mailList();
    if(screen==='events')return events();
    if(screen==='notices')return notices();
    return hub();
  }
  root.addEventListener('input',event=>{
    if(event.target.closest('#extrasMailForm')&&draft) {
      const name=event.target.name;
      if(['recipient','subject','body'].includes(name)&&draft[name]!==event.target.value) {
        draft[name]=event.target.value;draft.id=crypto.randomUUID();
      }
    }
  });
  root.addEventListener('submit',event=>{
    event.preventDefault();
    if(!allowed())return;
    const form=event.target;
    void run(()=>form.id==='extrasMailForm'?sendMail(form):form.id==='extrasEventForm'?saveEvent(form):saveNotice(form));
  });
  root.addEventListener('click',event=>{
    const target=event.target.closest('[data-extra]');if(!target||target.disabled||!allowed()||writing)return;
    const action=target.dataset.extra, item=rows.find(r=>r.id===target.dataset.id);
    void run(async()=>{
      if(action==='hub')return hub();
      if(action==='lqa'){begin('lqa','LQA-Message','');community.mountChat(root,hub);return;}
      if(action==='links'){begin('links','Liên kết nhanh','');community.mountLinks(root,hub);return;}
      if(action==='mail') {box='inbox';return mailList(true);}
      if(action==='mail-back')return mailList(true);
      if(action==='inbox'||action==='sent'){box=action;return mailList(true);}
      if(action==='compose')return compose();
      if(action==='reply')return compose(currentMail);
      if(action==='discard-draft'){const ok=await modal({title:'Bỏ bản nháp?',submit:'Bỏ bản nháp',danger:true});if(ok){draft=null;return mailList(true);}return;}
      if(action==='mail-detail')return detail(target.dataset.id);
      if(action==='delete-mail')return remove('mail',currentMail);
      if(action==='events'||action==='events-back')return events(true);
      if(action==='upcoming'||action==='past'){period=action;return events(true);}
      if(action==='new-event')return eventForm();
      if(action==='edit-event'&&item)return eventForm(item);
      if(action==='delete-event'&&item)return remove('events',item);
      if(action==='notices'||action==='notices-back')return notices(true);
      if(action==='new-notice')return noticeForm();
      if(action==='edit-notice'&&item)return noticeForm(item);
      if(action==='delete-notice'&&item)return remove('notices',item);
      if(action==='read-notice'&&item){const at=version;await request('notices',{method:'PATCH',body:{id:item.id,revision:item.revision,action:'read'}});if(at===version)await notices();return;}
      if(action==='previous'){page=Math.max(0,page-1);return reload();}
      if(action==='next'){page++;return reload();}
      if(action==='reload')return reload();
    });
  });
  window.setInterval(tick,1000);
  window.setInterval(()=>{if(isActive()&&!document.hidden)void summary();},60000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){tick();if(isActive())void summary();}});
  return {
    open(){if(!allowed())return;active=true;hub();},
    close(){community.unmount();active=false;version++;controller.abort();},
    reset(){community.unmount();session++;version++;active=false;controller.abort();rows=[];recipients=[];currentMail=null;draft=null;edit=null;writing=false;root.replaceChildren();},
  };
}
