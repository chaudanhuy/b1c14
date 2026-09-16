// Public Worker has no chat endpoint. Only the Pages Durable Object binding can reach LqaChat.
export default { fetch() { return new Response('Not found',{status:404}); } };

const DAY=86400000, LEASE=75000;
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const pair=(a,b)=>[a,b].sort((x,y)=>x-y).join(':');
class ChatError extends Error { constructor(message,code='INVALID'){super(message);this.code=code;} }

export class LqaChat {
  constructor(ctx,env) {
    this.ctx=ctx;this.env=env;this.sql=ctx.storage.sql;
    this.sql.exec("CREATE TABLE IF NOT EXISTS threads (id TEXT PRIMARY KEY,a INTEGER NOT NULL,b INTEGER NOT NULL,expires_at INTEGER NOT NULL)");
    this.sql.exec("CREATE TABLE IF NOT EXISTS messages (seq INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT NOT NULL UNIQUE,thread TEXT NOT NULL,sender INTEGER NOT NULL,recipient INTEGER NOT NULL,body TEXT NOT NULL,sent_at INTEGER NOT NULL)");
    this.sql.exec("CREATE INDEX IF NOT EXISTS messages_thread ON messages(thread,seq)");
    this.sql.exec("CREATE INDEX IF NOT EXISTS threads_expiry ON threads(expires_at)");
    this.sql.exec("CREATE TABLE IF NOT EXISTS limits (key TEXT PRIMARY KEY,window INTEGER NOT NULL,count INTEGER NOT NULL)");
  }
  rows(query,...args) {return [...this.sql.exec(query,...args)];}
  state(ws){return ws.deserializeAttachment();}
  alive(ws,now=Date.now()){const s=this.state(ws);return s&&!s.closed&&ws.readyState===1&&s.last+LEASE>now&&s.exp*1000>now;}
  sockets(id){return this.ctx.getWebSockets().filter(w=>this.alive(w)&&(id===undefined||this.state(w).id===id));}
  emit(ws,data){try{ws.send(JSON.stringify(data));return true;}catch{this.close(ws,1011,'Connection lost');return false;}}
  close(ws,code=1000,reason='Offline'){
    const s=this.state(ws);if(s){s.closed=true;ws.serializeAttachment(s);}
    try{ws.close(code,reason);}catch{}
  }
  roster(){
    const users=new Map();
    for(const ws of this.sockets()){const s=this.state(ws);users.set(s.id,{id:s.id,name:s.name,unit_label:s.unit_label});}
    return [...users.values()].sort((a,b)=>a.name.localeCompare(b.name,'vi'));
  }
  presence(){const data={type:'presence',members:this.roster()};for(const ws of this.sockets())this.emit(ws,data);}
  consume(id,kind,maximum){
    const now=Date.now(),key=kind+':'+id,win=Math.floor(now/60000);
    this.sql.exec('INSERT INTO limits(key,window,count) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET window=excluded.window,count=CASE WHEN limits.window=excluded.window THEN limits.count+1 ELSE 1 END',key,win);
    if(this.rows('SELECT count FROM limits WHERE key=?',key)[0].count>maximum)throw new ChatError('Bạn thao tác hơi nhanh. Hãy thử lại sau một phút.','RATE_LIMIT');
  }
  async member(id){
    return this.env.DB.prepare('SELECT id,name,unit_label,session_version,must_change_password FROM members WHERE id=?').bind(id).first();
  }
  async authenticate(ws){
    const s=this.state(ws);
    if(!s||!this.alive(ws))throw new ChatError('Kết nối đã hết hạn.','AUTH');
    const member=await this.member(s.id);
    if(!member||member.session_version!==s.sv||member.must_change_password)throw new ChatError('Phiên đăng nhập đã thay đổi.','AUTH');
    return member;
  }
  async schedule(){
    const now=Date.now(),expiry=this.rows('SELECT MIN(expires_at) next FROM threads')[0]?.next;
    const times=this.sockets().map(ws=>{const s=this.state(ws);return Math.min(s.last+LEASE,s.exp*1000);});
    if(expiry!=null)times.push(expiry);
    if(times.length)await this.ctx.storage.setAlarm(Math.max(now+10,Math.min(...times)));
    else await this.ctx.storage.deleteAlarm();
  }
  purge(now=Date.now()){
    const expired=this.rows('SELECT id,a,b FROM threads WHERE expires_at<=?',now);
    if(expired.length)this.ctx.storage.transactionSync(()=>{
      this.sql.exec('DELETE FROM messages WHERE thread IN (SELECT id FROM threads WHERE expires_at<=?)',now);
      this.sql.exec('DELETE FROM threads WHERE expires_at<=?',now);
    });
    for(const thread of expired)for(const id of [thread.a,thread.b])
      for(const ws of this.sockets(id))this.emit(ws,{type:'expired',peer:id===thread.a?thread.b:thread.a});
    this.sql.exec('DELETE FROM limits WHERE window<?',Math.floor(now/60000)-2);
  }
  async fetch(request) {
    return this.ctx.blockConcurrencyWhile(async()=>{
      if(new URL(request.url).pathname!=='/connect'||request.headers.get('Upgrade')?.toLowerCase()!=='websocket')
        return new Response('Not found',{status:404});
      let identity;try{identity=JSON.parse(request.headers.get('X-LQA-Identity'));}catch{}
      if(!identity||!Number.isSafeInteger(identity.member_id)||!Number.isSafeInteger(identity.sv)||!Number.isSafeInteger(identity.exp)||identity.exp*1000<=Date.now())
        return new Response('Unauthorized',{status:401});
      const m=await this.member(identity.member_id);
      if(!m||m.must_change_password||m.session_version!==identity.sv)return new Response('Unauthorized',{status:401});
      for(const ws of this.ctx.getWebSockets())if(!this.alive(ws)||(this.state(ws).id===m.id&&this.state(ws).sv!==m.session_version))this.close(ws,4000,'Offline');
      if(this.sockets(m.id).length>=4)return new Response('Mỗi tài khoản mở tối đa 4 tab chat.',{status:429});
      const [client,server]=Object.values(new WebSocketPair());
      this.ctx.acceptWebSocket(server,[String(m.id)]);
      server.serializeAttachment({id:m.id,name:m.name,unit_label:m.unit_label,sv:identity.sv,exp:identity.exp,last:Date.now(),closed:false});
      this.purge();
      this.emit(server,{type:'ready',me:m.id,server_now:Date.now(),heartbeat_ms:25000});
      this.presence();
      await this.schedule();
      return new Response(null,{status:101,webSocket:client});
    });
  }
  async webSocketMessage(ws,message){
    return this.ctx.blockConcurrencyWhile(async()=>{
      let data;
      try{
        if(typeof message!=='string')throw new ChatError('Chỉ cho phép tin nhắn văn bản, không nhận tệp.','BINARY');
        if(new TextEncoder().encode(message).length>10000)throw new ChatError('Tin nhắn quá dài.','TOO_LARGE');
        try{data=JSON.parse(message);}catch{throw new ChatError('Nội dung yêu cầu không hợp lệ.');}
        if(!data||typeof data!=='object'||Array.isArray(data))throw new ChatError('Yêu cầu không hợp lệ.');
        const allowed=data.type==='ping'?['type']:data.type==='send'?['type','id','to','text']:data.type==='history'?['type','peer','before','request_id']:null;
        if(!allowed||Object.keys(data).some(k=>!allowed.includes(k)))throw new ChatError('Không hỗ trợ tệp hoặc loại nội dung này.');
        const s=this.state(ws);if(!s)throw new ChatError('Phiên chat không tồn tại.','AUTH');
        this.consume(s.id,'input',180);
        const me=await this.authenticate(ws);
        s.last=Date.now();s.name=me.name;s.unit_label=me.unit_label;ws.serializeAttachment(s);
        this.purge();
        if(data.type==='ping'){
          this.emit(ws,{type:'pong',server_now:Date.now()});
          // Also reap silent disconnects if a platform alarm was delayed.
          let changed=false;
          for(const socket of this.ctx.getWebSockets())if(!this.alive(socket)&&!this.state(socket)?.closed){this.close(socket,4000,'Offline');changed=true;}
          if(changed)this.presence();
        } else if(data.type==='history'){
          if(!Number.isSafeInteger(data.peer)||data.peer<1||data.peer===me.id||!uuid(data.request_id)||
            (data.before!=null&&(!Number.isSafeInteger(data.before)||data.before<1)))throw new ChatError('Cuộc trò chuyện không hợp lệ.');
          const thread=pair(me.id,data.peer),row=this.rows('SELECT expires_at FROM threads WHERE id=?',thread)[0];
          const list=row?this.rows('SELECT * FROM messages WHERE thread=? AND seq<? ORDER BY seq DESC LIMIT 101',thread,data.before||Number.MAX_SAFE_INTEGER):[];
          this.emit(ws,{type:'history',peer:data.peer,request_id:data.request_id,expires_at:row?.expires_at||null,has_more:list.length>100,messages:list.slice(0,100).reverse()});
        } else {
          if(!uuid(data.id)||!Number.isSafeInteger(data.to)||data.to<1||data.to===me.id||
            typeof data.text!=='string'||!data.text.trim()||data.text.length>2000||data.text.includes('\0'))throw new ChatError('Tin nhắn cần từ 1–2.000 ký tự và một người nhận hợp lệ.');
          const text=data.text.trim(),thread=pair(me.id,data.to);
          const previous=this.rows('SELECT * FROM messages WHERE id=?',data.id)[0];
          if(previous){
            if(previous.sender!==me.id||previous.recipient!==data.to||previous.body!==text)throw new ChatError('Mã tin nhắn đã được sử dụng.','CONFLICT');
            this.emit(ws,{type:'ack',id:data.id,message:previous,expires_at:this.rows('SELECT expires_at FROM threads WHERE id=?',thread)[0]?.expires_at});
          }else{
            this.consume(me.id,'send',30);
            const target=await this.member(data.to);
            if(!target||target.must_change_password)throw new ChatError('Người nhận đang ngoại tuyến.','OFFLINE');
            for(const socket of this.sockets(data.to))if(this.state(socket).sv!==target.session_version)this.close(socket,4001,'Session expired');
            const receivers=this.sockets(data.to);
            if(!receivers.length){this.presence();throw new ChatError('Người nhận đã ngoại tuyến. Tin nhắn chưa được gửi.','OFFLINE');}
            if(!this.alive(ws))throw new ChatError('Kết nối của bạn đã đóng.','AUTH');
            const now=Date.now(),expires=now+DAY;
            let saved;
            this.ctx.storage.transactionSync(()=>{
              this.sql.exec('INSERT INTO threads(id,a,b,expires_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET expires_at=excluded.expires_at',thread,Math.min(me.id,data.to),Math.max(me.id,data.to),expires);
              this.sql.exec('INSERT INTO messages(id,thread,sender,recipient,body,sent_at) VALUES(?,?,?,?,?,?)',data.id,thread,me.id,data.to,text,now);
              saved=this.rows('SELECT * FROM messages WHERE id=?',data.id)[0];
            });
            await this.schedule();
            for(const socket of this.sockets(me.id))if(this.state(socket).sv!==me.session_version)this.close(socket,4001,'Session expired');
            for(const socket of [...receivers,...this.sockets(me.id)])
              this.emit(socket,{type:'message',message:saved,expires_at:expires,sender_name:me.name});
            this.emit(ws,{type:'ack',id:data.id,message:saved,expires_at:expires});
          }
        }
        await this.schedule();
      }catch(error){
        const known=error instanceof ChatError;
        this.emit(ws,{type:'error',code:known?error.code:'SERVER',error:known?error.message:'Chat đang gián đoạn. Hãy thử lại.',id:uuid(data?.id)?data.id:undefined,request_id:uuid(data?.request_id)?data.request_id:undefined});
        if(error.code==='AUTH'||error.code==='BINARY'||error.code==='TOO_LARGE'){
          this.close(ws,error.code==='AUTH'?4001:1008,'Chat policy');this.presence();
        }
      }
    });
  }
  async webSocketClose(ws){this.close(ws);this.presence();await this.schedule();}
  async webSocketError(ws){this.close(ws,1011,'Connection error');this.presence();await this.schedule();}
  async alarm(){
    return this.ctx.blockConcurrencyWhile(async()=>{
      try{
        let changed=false;
        for(const ws of this.ctx.getWebSockets())if(!this.alive(ws)&&!this.state(ws)?.closed){this.close(ws,4000,'Offline');changed=true;}
        this.purge();if(changed)this.presence();await this.schedule();
      }catch(error){await this.ctx.storage.setAlarm(Date.now()+60000);throw error;}
    });
  }
}
