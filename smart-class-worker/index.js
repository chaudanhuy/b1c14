import { initialState, apply, lockRound, snapshot, RoomError } from "./engine.js";
// No public route can forge the internal identity header: access is through the Pages DO binding.
export default { fetch(){return new Response("Not found",{status:404});} };
const LEASE=50000, MAX_BYTES=16000;
const uuid=x=>typeof x==="string"&&/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(x);
export class SmartClassRoom {
  constructor(ctx,env){
    this.ctx=ctx;this.env=env;this.sql=ctx.storage.sql;
    this.sql.exec("CREATE TABLE IF NOT EXISTS room (id INTEGER PRIMARY KEY CHECK(id=1),state TEXT NOT NULL)");
    this.sql.exec("CREATE TABLE IF NOT EXISTS outbox (id TEXT PRIMARY KEY,payload TEXT NOT NULL)");
    this.sql.exec("CREATE TABLE IF NOT EXISTS commands (id TEXT PRIMARY KEY,member INTEGER NOT NULL,created INTEGER NOT NULL)");
    this.sql.exec("CREATE TABLE IF NOT EXISTS limits (member INTEGER PRIMARY KEY,window INTEGER NOT NULL,count INTEGER NOT NULL)");
    const saved=[...this.sql.exec("SELECT state FROM room WHERE id=1")][0];
    this.room=saved?JSON.parse(saved.state):initialState();
  }
  attachment(ws){return ws.deserializeAttachment();}
  alive(ws,now=Date.now()){const a=this.attachment(ws);return a&&!a.closed&&ws.readyState===1&&a.last+LEASE>now&&a.exp*1000>now;}
  sockets(){return this.ctx.getWebSockets().filter(ws=>this.alive(ws));}
  peers(){
    const peers=new Map();
    for(const ws of this.sockets()){const {id,name,role}=this.attachment(ws);peers.set(id,{id,name,role});}
    return [...peers.values()];
  }
  emit(ws,payload){try{ws.send(JSON.stringify(payload));}catch{this.close(ws,1011);}}
  close(ws,code=1000){
    const a=this.attachment(ws);if(a){a.closed=true;ws.serializeAttachment(a);}
    try{ws.close(code,"Connection closed");}catch{}
  }
  publish(onlyHost=false){
    const peers=this.peers(),now=Date.now();
    for(const ws of this.sockets()){
      const me=this.attachment(ws);
      if(!onlyHost||me.id===this.room.host?.id)this.emit(ws,snapshot(this.room,me,peers,now));
    }
  }
  async member(id){
    return this.env.DB.prepare("SELECT id,name,unit_code,can_manage,session_version,must_change_password FROM members WHERE id=?").bind(id).first();
  }
  role(m){return m.can_manage===1?"host":"student";}
  save(ledger=[],command=null,member=null){
    this.ctx.storage.transactionSync(()=>{
      this.room.version++;
      this.sql.exec("INSERT INTO room(id,state) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET state=excluded.state",JSON.stringify(this.room));
      if(this.room.session){
        const s=this.room.session;
        this.sql.exec("INSERT INTO outbox(id,payload) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload",
          "session:"+s.id,JSON.stringify({session:s}));
      }
      if(ledger.length)this.sql.exec("INSERT OR IGNORE INTO outbox(id,payload) VALUES(?,?)",
        "round:"+ledger[0].round_id,JSON.stringify({results:ledger}));
      if(command){
        this.sql.exec("INSERT INTO commands(id,member,created) VALUES(?,?,?)",command,member,Date.now());
        this.sql.exec("DELETE FROM commands WHERE id IN (SELECT id FROM commands ORDER BY created DESC LIMIT -1 OFFSET 1024)");
      }
    });
  }
  expireRound(now=Date.now()){
    if(this.room.phase==="QUESTION_ACTIVE"&&this.room.round.deadline<=now){
      const before=structuredClone(this.room);
      try{const rows=lockRound(this.room,now);this.save(rows);this.publish();}
      catch(e){this.room=before;throw e;}
    }
  }
  async schedule(){
    const now=Date.now(),times=this.sockets().map(ws=>{const a=this.attachment(ws);return Math.min(a.last+LEASE,a.exp*1000);});
    if(this.room.phase==="QUESTION_ACTIVE")times.push(this.room.round.deadline);
    if([...this.sql.exec("SELECT id FROM outbox LIMIT 1")].length)times.push(now+1000);
    if(times.length)await this.ctx.storage.setAlarm(Math.max(now+10,Math.min(...times)));
    else await this.ctx.storage.deleteAlarm();
  }
  async fetch(request){
    return this.ctx.blockConcurrencyWhile(async()=>{
      if(new URL(request.url).pathname!=="/connect"||request.headers.get("Upgrade")?.toLowerCase()!=="websocket")
        return new Response("Not found",{status:404});
      let identity;try{identity=JSON.parse(request.headers.get("X-Smart-Identity"));}catch{}
      if(!identity||!Number.isSafeInteger(identity.member_id)||!Number.isSafeInteger(identity.sv)||
        !Number.isSafeInteger(identity.exp)||identity.exp*1000<=Date.now())return new Response("Unauthorized",{status:401});
      const m=await this.member(identity.member_id);
      if(!m||m.must_change_password||m.session_version!==identity.sv)return new Response("Unauthorized",{status:401});
      for(const ws of this.ctx.getWebSockets())if(!this.alive(ws))this.close(ws,4000);
      if(this.sockets().filter(ws=>this.attachment(ws).id===m.id).length>=3)return new Response("Tối đa 3 tab Smart Class mỗi tài khoản.",{status:429});
      if(this.sockets().length>=120)return new Response("Phòng đã đầy.",{status:429});
      this.expireRound();
      const [client,server]=Object.values(new WebSocketPair());
      this.ctx.acceptWebSocket(server,[String(m.id)]);
      server.serializeAttachment({id:m.id,name:m.name,role:this.role(m),sv:identity.sv,exp:identity.exp,last:Date.now(),closed:false});
      this.emit(server,{type:"READY",heartbeat_ms:15000,server_now:Date.now()});this.publish();
      await this.schedule();
      return new Response(null,{status:101,webSocket:client});
    });
  }
  async webSocketMessage(ws,message){
    const receivedAt=Date.now();
    return this.ctx.blockConcurrencyWhile(async()=>{
      let data;
      try{
        if(typeof message!=="string"||new TextEncoder().encode(message).length>MAX_BYTES)
          throw new RoomError("Chỉ nhận thông điệp văn bản ngắn.","POLICY");
        try{data=JSON.parse(message);}catch{throw new RoomError("JSON không hợp lệ.");}
        if(!data||typeof data!=="object"||Array.isArray(data))throw new RoomError("Thông điệp không hợp lệ.");
        const me=this.attachment(ws);
        if(!this.alive(ws))throw new RoomError("Phiên kết nối đã hết hạn.","AUTH");
        const win=Math.floor(receivedAt/1000);
        this.sql.exec("INSERT INTO limits(member,window,count) VALUES(?,?,1) ON CONFLICT(member) DO UPDATE SET window=excluded.window,count=CASE WHEN limits.window=excluded.window THEN limits.count+1 ELSE 1 END",me.id,win);
        if([...this.sql.exec("SELECT count FROM limits WHERE member=?",me.id)][0].count>12)
          throw new RoomError("Thao tác quá nhanh. Thử lại sau một giây.","RATE_LIMIT");
        if(data.type==="PING"){
          const m=await this.member(me.id);
          if(!m||m.must_change_password||m.session_version!==me.sv||this.role(m)!==me.role)
            throw new RoomError("Phiên đăng nhập hoặc quyền hạn đã thay đổi.","AUTH");
          me.last=Date.now();me.name=m.name;ws.serializeAttachment(me);
          this.expireRound();
          let changed=false;
          for(const socket of this.ctx.getWebSockets())if(!this.alive(socket)&&!this.attachment(socket)?.closed){this.close(socket,4000);changed=true;}
          if(changed)this.publish();
          this.emit(ws,{type:"PONG",server_now:Date.now()});
        } else if(data.type==="SYNC"){
          this.expireRound();this.emit(ws,snapshot(this.room,me,this.peers(),Date.now()));
        } else {
          if(!uuid(data.id))throw new RoomError("Thiếu mã thao tác hợp lệ.");
          // Revalidate manager rights before every host control operation.
          if(me.role==="host"){
            const m=await this.member(me.id);
            if(!m||m.must_change_password||m.session_version!==me.sv||this.role(m)!=="host")
              throw new RoomError("Quyền điều hành đã thay đổi.","AUTH");
          }
          this.expireRound(receivedAt);
          const previous=[...this.sql.exec("SELECT member FROM commands WHERE id=?",data.id)][0];
          if(previous){
            if(previous.member!==me.id)throw new RoomError("Mã thao tác đã tồn tại.");
            this.emit(ws,{type:"ACK",id:data.id,duplicate:true});
            this.emit(ws,snapshot(this.room,me,this.peers(),Date.now()));
          } else {
            const before=structuredClone(this.room);
            let result;
            try{
              // Entire check → first-answer/buzzer lock → persistence is synchronous.
              result=apply(this.room,me,data,me.role==="host"?Date.now():receivedAt,this.peers());
              this.save(result.ledger,data.id,me.id);
            }catch(error){this.room=before;throw error;}
            for(const event of result.events)for(const socket of this.sockets())
              if(!event.to||this.attachment(socket).id===event.to)this.emit(socket,event);
            this.emit(ws,{type:"ACK",id:data.id});
            this.publish(data.type==="ESTIMATE_PREVIEW");
          }
        }
        await this.schedule();
      }catch(error){
        this.emit(ws,{type:"ERROR",id:uuid(data?.id)?data.id:undefined,code:error.code||"SERVER",
          error:error instanceof RoomError?error.message:"Smart Class đang gián đoạn. Hãy kết nối lại."});
        if(error.code==="AUTH"||error.code==="POLICY")this.close(ws,error.code==="AUTH"?4001:1008);
        if(!(error instanceof RoomError))console.error("SmartClass operation failed",error);
      }
    });
  }
  async flush(){
    const pending=[...this.sql.exec("SELECT id,payload FROM outbox LIMIT 8")];
    for(const row of pending){
      const payload=JSON.parse(row.payload);
      if(payload.session){
        const s=payload.session;
        await this.env.DB.prepare("INSERT INTO smart_class_sessions(id,host_id,started_at,ended_at,title) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET ended_at=excluded.ended_at,title=excluded.title")
          .bind(s.id,s.host_id,s.started_at,s.ended_at,s.title).run();
      }else{
        const statements=payload.results.map(r=>this.env.DB.prepare("INSERT OR IGNORE INTO smart_class_results(session_id,round_id,member_id,mode,score,accuracy,elapsed_ms,responded,created_at) VALUES(?,?,?,?,?,?,?,?,?)")
          .bind(r.session_id,r.round_id,r.member_id,r.mode,r.score,r.accuracy,r.elapsed_ms,r.responded,r.created_at));
        for(let i=0;i<statements.length;i+=40)await this.env.DB.batch(statements.slice(i,i+40));
      }
      this.sql.exec("DELETE FROM outbox WHERE id=?",row.id);
    }
  }
  async alarm(){
    return this.ctx.blockConcurrencyWhile(async()=>{
      for(const ws of this.ctx.getWebSockets())if(!this.alive(ws))this.close(ws,4000);
      this.expireRound();this.publish();
      try{await this.flush();await this.schedule();}
      catch(error){console.error("SmartClass D1 sync failed",error);const now=Date.now(), times=[now+30000];
        if(this.room.phase==="QUESTION_ACTIVE")times.push(this.room.round.deadline);
        for(const ws of this.sockets()){const a=this.attachment(ws);times.push(a.last+LEASE,a.exp*1000);}
        await this.ctx.storage.setAlarm(Math.max(now+10,Math.min(...times)));}
    });
  }
  async webSocketClose(ws){this.close(ws);this.publish();await this.schedule();}
  async webSocketError(ws){this.close(ws,1011);this.publish();await this.schedule();}
}
