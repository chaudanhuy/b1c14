export const STATES = ["LOBBY","QUESTION_ACTIVE","QUESTION_LOCKED","SHOW_RESULT","LEADERBOARD","FINISHED"];
export const MODES = ["quiz","buzzer","short","reorder","estimate","match"];
export class RoomError extends Error {
  constructor(message,code="INVALID"){super(message);this.code=code;}
}
const fail = message => {throw new RoomError(message);};
const clean = (value,max=500) => typeof value==="string" && value.trim() && value.trim().length<=max
  ? value.trim() : fail("Nội dung trống hoặc quá dài.");
const number = (n,min,max) => typeof n==="number" && Number.isFinite(n) && n>=min && n<=max
  ? n : fail("Giá trị số ngoài giới hạn.");
const norm = (text,accents) => {
  const n=text.trim().toLocaleLowerCase("vi").replace(/\s+/g," ");
  return accents?n.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d"):n;
};
const uid = () => crypto.randomUUID();
const shuffle = array => {
  const a=[...array];
  for(let i=a.length-1;i>0;i--){const r=new Uint32Array(1);crypto.getRandomValues(r);const j=r[0]%(i+1);[a[i],a[j]]=[a[j],a[i]];}
  return a;
};
export function initialState(){return {phase:"LOBBY",session:null,host:null,round:null,scores:{},roundCount:0,usedQuestionIds:[],version:0};}
export function question(input) {
  if(!input || !MODES.includes(input.mode))fail("Chế độ không hợp lệ.");
  const q={mode:input.mode,prompt:clean(input.prompt),duration:Math.round(number(input.duration,5,300))};
  if(typeof input.bankId==="string"&&/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(input.bankId))q.bankId=input.bankId;
  if(q.mode==="quiz"){
    if(!Array.isArray(input.options)||input.options.length!==4)fail("Cần đúng 4 đáp án.");
    q.options=input.options.map(x=>clean(x,200));
    if(!["A","B","C","D"].includes(input.correct))fail("Chọn đáp án đúng.");
    q.correct=input.correct;
  } else if(q.mode==="short"){
    if(!Array.isArray(input.accepted)||!input.accepted.length||input.accepted.length>20)fail("Cần 1–20 đáp án chấp nhận.");
    q.ignoreAccents=input.ignoreAccents===true;q.accepted=input.accepted.map(x=>clean(x,50));
  } else if(q.mode==="reorder"){
    if(!Array.isArray(input.items)||input.items.length<2||input.items.length>8)fail("Cần 2–8 bước theo thứ tự đúng.");
    const items=input.items.map(text=>({id:uid(),text:clean(text,150)}));
    q.correct=items.map(x=>x.id);q.items=shuffle(items);
  } else if(q.mode==="estimate"){
    q.min=number(input.min,-1e9,1e9);q.max=number(input.max,-1e9,1e9);
    if(q.max<=q.min)fail("Giá trị Max phải lớn hơn Min.");
    q.step=number(input.step,0.000001,q.max-q.min);
    q.correct=number(input.correct,q.min,q.max);
  } else if(q.mode==="match"){
    if(!Array.isArray(input.pairs)||input.pairs.length<2||input.pairs.length>8)fail("Cần 2–8 cặp.");
    if(input.pairs.some(p=>!Array.isArray(p)||p.length!==2))fail("Mỗi dòng cần đúng một cặp trái | phải.");
    const pairs=input.pairs.map(p=>({left:{id:uid(),text:clean(p?.[0],150)},right:{id:uid(),text:clean(p?.[1],150)}}));
    q.left=shuffle(pairs.map(p=>p.left));q.right=shuffle(pairs.map(p=>p.right));
    q.correct=Object.fromEntries(pairs.map(p=>[p.left.id,p.right.id]));
  }
  return q;
}
const scoreAt=(accuracy,elapsed,duration)=>Math.round(accuracy*(1000-Math.min(800,Math.max(0,elapsed)*800/(duration*1000))));
function accuracy(q,a){
  if(!a)return 0;
  switch(q.mode){
    case "quiz": return a.value===q.correct?1:0;
    case "buzzer": return a.winner?1:0;
    case "short": return q.accepted.some(x=>norm(x,q.ignoreAccents)===norm(a.value,q.ignoreAccents))?1:0;
    case "reorder": return a.value.filter((x,i)=>x===q.correct[i]).length/q.correct.length;
    case "estimate": return Math.max(0,1-Math.abs(a.value-q.correct)/(q.max-q.min));
    case "match": return Object.keys(a.pairs).length/q.left.length;
  }
}
export function lockRound(s,now) {
  const r=s.round;
  if(s.phase!=="QUESTION_ACTIVE"||!r)return [];
  s.phase="QUESTION_LOCKED";r.lockedAt=now;
  const order=Object.entries(r.answers).filter(([,a])=>a.submitted).sort((a,b)=>
    Math.abs(a[1].value-r.q.correct)-Math.abs(b[1].value-r.q.correct)||a[1].elapsed-b[1].elapsed||Number(a[0])-Number(b[0]));
  const results=[];
  for(const p of r.participants){
    const a=r.answers[p.id],acc=accuracy(r.q,a);
    const elapsed=a?.elapsed??null;
    let points=a?scoreAt(acc,elapsed??r.q.duration*1000,r.q.duration):0;
    if(r.q.mode==="buzzer")points=a?.winner?1000:0;
    if(r.q.mode==="estimate"){
      const rank=order.findIndex(([id])=>Number(id)===p.id);
      points=rank<0?0:Math.max(100,1000-rank*50);
    }
    const total=s.scores[p.id]??={id:p.id,name:p.name,score:0,correct:0,rounds:0,elapsed:0};
    total.name=p.name;total.score+=points;total.correct+=acc;total.rounds++;total.elapsed+=elapsed??r.q.duration*1000;
    results.push({member_id:p.id,name:p.name,score:points,accuracy:acc,elapsed_ms:elapsed,responded:a?1:0});
  }
  r.results=results;
  return results.map(row=>({...row,session_id:s.session.id,round_id:r.id,mode:r.q.mode,created_at:now}));
}
export function leaderboard(s){
  return Object.values(s.scores).sort((a,b)=>b.score-a.score||b.correct-a.correct||a.elapsed-b.elapsed||a.id-b.id);
}
function estimateValue(q,value){
  const n=number(value,q.min,q.max),nearest=q.min+Math.round((n-q.min)/q.step)*q.step;
  if(Math.abs(n-nearest)>Math.max(1e-9,Math.abs(n)*Number.EPSILON*8,q.step*1e-6))fail("Giá trị không khớp bước nhảy của câu hỏi.");
  return n;
}
export function apply(s,me,data,now,peers) {
  const events=[],ledger=[];
  const host = () => {
    if(me.role!=="host" || s.host?.id!==me.id)throw new RoomError("Chỉ người điều hành phiên mới được thao tác.","FORBIDDEN");
  };
  if(data.type==="CLAIM_HOST"){
    if(me.role!=="host")throw new RoomError("Tài khoản không có quyền cán sự.","FORBIDDEN");
    if(s.host && s.host.id!==me.id && peers.some(p=>p.id===s.host.id))fail("Người điều hành hiện tại vẫn đang trực tuyến.");
    s.host={id:me.id,name:me.name};
  } else if(data.type==="NEW_SESSION"){
    host();
    if(!["LOBBY","FINISHED"].includes(s.phase)||s.session&&s.phase!=="FINISHED")fail("Hãy kết thúc phiên hiện tại trước.");
    const title=clean(data.title||"Smart Class",120);
    s.session={id:uid(),host_id:me.id,title,started_at:now,ended_at:null};
    s.round=null;s.scores={};s.roundCount=0;s.usedQuestionIds=[];s.phase="LOBBY";
  } else if(data.type==="START_QUESTION"){
    host();
    if(!s.session||!["LOBBY","SHOW_RESULT","LEADERBOARD"].includes(s.phase))fail("Tạo phiên hoặc công bố kết quả vòng trước trước khi bắt đầu.");
    if(data.sessionId!==s.session.id)fail("Phiên đã thay đổi.");
    if(s.roundCount>=100)fail("Đã đủ 100 vòng. Hãy kết thúc và tạo phiên mới.");
    const q=question(data.question);
    s.usedQuestionIds ||= [];
    if(q.bankId&&!s.usedQuestionIds.includes(q.bankId))s.usedQuestionIds.push(q.bankId);
    const participants=peers.filter(p=>p.role==="student").map(({id,name})=>({id,name}));
    if(!participants.length)fail("Chưa có học viên trực tuyến.");
    s.round={id:uid(),q,startedAt:now,deadline:now+q.duration*1000,participants,answers:{},previews:{},buzzerLocked:false,winner:null,results:null};
    s.phase="QUESTION_ACTIVE";s.roundCount++;
  } else if(["LOCK_QUESTION","SHOW_RESULT","SHOW_LEADERBOARD","FINISH"].includes(data.type)){
    host();
    if(!s.session||data.sessionId!==s.session.id)fail("Phiên đã thay đổi.");
    if(data.type!=="FINISH"&&data.roundId!==s.round?.id)fail("Vòng đã thay đổi.");
    if(data.type==="LOCK_QUESTION"){
      if(s.phase!=="QUESTION_ACTIVE")fail("Không có câu hỏi đang mở.");
      ledger.push(...lockRound(s,now));
    } else if(data.type==="SHOW_RESULT"){
      if(!["QUESTION_ACTIVE","QUESTION_LOCKED"].includes(s.phase))fail("Chưa có kết quả để công bố.");
      ledger.push(...lockRound(s,now));s.phase="SHOW_RESULT";
    } else if(data.type==="SHOW_LEADERBOARD"){
      if(s.phase==="FINISHED")fail("Phiên đã kết thúc.");
      ledger.push(...lockRound(s,now));s.phase="LEADERBOARD";
    } else {
      if(s.phase==="FINISHED")return {events,ledger};
      ledger.push(...lockRound(s,now));s.phase="FINISHED";s.session.ended_at=now;
    }
  } else {
    const r=s.round;
    if(me.role!=="student")throw new RoomError("Người điều hành không tham gia chấm điểm.","FORBIDDEN");
    if(!r||data.roundId!==r.id||data.sessionId!==s.session?.id)fail("Câu hỏi đã thay đổi.");
    if(s.phase!=="QUESTION_ACTIVE"||now>=r.deadline)fail("Câu hỏi đã khóa.");
    if(!r.participants.some(p=>p.id===me.id))fail("Bạn sẽ tham gia từ vòng tiếp theo.");
    const q=r.q,old=r.answers[me.id],elapsed=Math.max(0,now-r.startedAt);
    if(old?.submitted){events.push({type:"ANSWER_ACCEPTED",to:me.id,duplicate:true});return {events,ledger};}
    if(data.type==="ESTIMATE_PREVIEW" && q.mode==="estimate"){
      r.previews[me.id]=estimateValue(q,data.value);
    } else if(data.type==="MATCH_PAIR"&&q.mode==="match"){
      const left=data.left,right=data.right;
      if(!q.left.some(x=>x.id===left)||!q.right.some(x=>x.id===right))fail("Cặp không hợp lệ.");
      const a=old||{pairs:{},attempts:0,submitted:false,elapsed};a.attempts++;
      r.answers[me.id]=a;
      const correct=q.correct[left]===right;
      if(correct&&!a.pairs[left]&&!Object.values(a.pairs).includes(right)){
        a.pairs[left]=right;a.elapsed=elapsed;a.submitted=Object.keys(a.pairs).length===q.left.length;
      }
      events.push({type:"PAIR_RESULT",to:me.id,left,right,correct});
    } else {
      const a={elapsed,submitted:true,value:null};
      if(data.type==="SUBMIT_QUIZ"&&q.mode==="quiz"){
        if(!["A","B","C","D"].includes(data.answer))fail("Đáp án không hợp lệ.");a.value=data.answer;
      } else if(data.type==="BUZZER_HIT"&&q.mode==="buzzer"){
        // No await between reading the flag, locking it and assigning the winner.
        a.winner=!r.buzzerLocked;
        if(!r.buzzerLocked){r.buzzerLocked=true;r.winner={id:me.id,name:me.name,timestamp:now};events.push({type:"BUZZER_WINNER",winner:r.winner});}
        a.behind=Math.max(0,now-r.winner.timestamp);
      } else if(data.type==="SUBMIT_SHORT"&&q.mode==="short"){
        a.value=clean(data.answer,50);
      } else if(data.type==="SUBMIT_REORDER"&&q.mode==="reorder"){
        if(!Array.isArray(data.answer)||data.answer.length!==q.items.length||new Set(data.answer).size!==q.items.length||
          data.answer.some(id=>!q.items.some(x=>x.id===id)))fail("Chuỗi sắp xếp không hợp lệ.");
        a.value=[...data.answer];
      } else if(data.type==="SUBMIT_ESTIMATE"&&q.mode==="estimate"){
        a.value=estimateValue(q,data.value);r.previews[me.id]=a.value;
      } else fail("Thông điệp không phù hợp chế độ.");
      r.answers[me.id]=a;events.push({type:"ANSWER_ACCEPTED",to:me.id,elapsed_ms:elapsed});
    }
  }
  return {events,ledger};
}
export function snapshot(s,me,peers,now) {
  const host=me.role==="host" && s.host?.id===me.id;
  const revealed=["SHOW_RESULT","LEADERBOARD","FINISHED"].includes(s.phase);
  let round=null;
  if(s.round){
    const r=s.round,{correct,accepted,...visible}=r.q;
    round={id:r.id,q:host||revealed?r.q:visible,startedAt:r.startedAt,deadline:r.deadline,
      count:r.participants.length,answered:Object.values(r.answers).filter(a=>a.submitted).length,
      eligible:r.participants.some(p=>p.id===me.id),mine:r.answers[me.id]||null,winner:r.winner,
      results:host||revealed?r.results:null};
    if(host){
      const entries=Object.entries(r.answers);
      round.stats={
        quiz:["A","B","C","D"].map(letter=>({label:letter,count:entries.filter(([,a])=>a.value===letter).length})),
        words:r.q.mode==="short"?Object.entries(entries.reduce((all,[,a])=>{
          const key=norm(a.value,r.q.ignoreAccents);all[key]=(all[key]||0)+1;return all;},{})).map(([text,count])=>({text,count})):[],
        top:r.q.mode==="short"?entries.filter(([,a])=>accuracy(r.q,a)===1).sort((a,b)=>a[1].elapsed-b[1].elapsed).slice(0,3)
          .map(([id,a])=>({name:r.participants.find(p=>p.id===Number(id))?.name,elapsed:a.elapsed})):[],
        histogram:r.q.mode==="estimate"?Array.from({length:10},(_,i)=>({
          label:(r.q.min+i*(r.q.max-r.q.min)/10).toLocaleString("vi"),count:Object.values(r.previews)
            .filter(value=>Math.min(9,Math.floor((value-r.q.min)/(r.q.max-r.q.min)*10))===i).length})):[],
        progress:r.participants.map(p=>({id:p.id,name:p.name,percent:r.q.mode==="match"?
          Math.round(Object.keys(r.answers[p.id]?.pairs||{}).length/r.q.left.length*100):r.answers[p.id]?.submitted?100:0}))
      };
    }
  }
  return {type:"STATE",server_now:now,version:s.version,phase:s.phase,session:s.session,host:s.host,
    usedQuestionIds:Array.isArray(s.usedQuestionIds)?s.usedQuestionIds:[],
    me:{id:me.id,name:me.name,role:me.role,controlling:host},members:peers,round,
    leaderboard:host||revealed?leaderboard(s):[]};
}
