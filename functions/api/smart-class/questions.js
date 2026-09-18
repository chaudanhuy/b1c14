import {requireCadre} from "../../_lib/auth.js";
import {HttpError,readJson} from "../../_lib/security.js";
import {questionRecord,parseQuestionRow,requireId,validId,SMART_MODES} from "../../_lib/smart-class-bank.js";

const select=`SELECT q.*,
 COUNT(DISTINCT CASE WHEN sr.round_id IS NOT NULL THEN sr.session_id || ':' || sr.round_id END) rounds,
 COUNT(r.member_id) responses,
 COALESCE(AVG(r.accuracy),0) avg_accuracy
 FROM smart_class_questions q
 LEFT JOIN smart_class_rounds sr ON sr.question_id=q.id
 LEFT JOIN smart_class_results r ON r.session_id=sr.session_id AND r.round_id=sr.round_id`;

export async function onRequestGet({request,env}){
  const auth=await requireCadre(request,env);if(!auth.ok)return auth.response;
  const url=new URL(request.url),id=url.searchParams.get("id");
  if(id){
    requireId(id,"Mã câu hỏi");
    const row=await env.DB.prepare(select+" WHERE q.id=? GROUP BY q.id LIMIT 1").bind(id).first();
    if(!row)throw new HttpError(404,"Không tìm thấy câu hỏi.");
    return Response.json({question:parseQuestionRow(row)});
  }
  const search=(url.searchParams.get("search")||"").trim().slice(0,100);
  const mode=url.searchParams.get("mode")||"";
  const category=(url.searchParams.get("category")||"").trim().slice(0,80);
  const where=[],bind=[];
  if(search){where.push("(q.title LIKE ? OR q.prompt LIKE ? OR q.category LIKE ?)");const x=`%${search}%`;bind.push(x,x,x);}
  if(mode){if(!SMART_MODES.includes(mode))throw new HttpError(400,"Bộ lọc chế độ không hợp lệ.");where.push("q.mode=?");bind.push(mode);}
  if(category){where.push("q.category=?");bind.push(category);}
  const sql=select+(where.length?" WHERE "+where.join(" AND "):"")+" GROUP BY q.id ORDER BY q.updated_at DESC LIMIT 500";
  const {results=[]}=await env.DB.prepare(sql).bind(...bind).all();
  return Response.json({questions:results.map(parseQuestionRow)});
}

export async function onRequestPost({request,env}){
  const auth=await requireCadre(request,env);if(!auth.ok)return auth.response;
  const body=await readJson(request),now=Date.now();
  if(body.action==="duplicate"){
    const id=requireId(body.id,"Mã câu hỏi");
    const old=await env.DB.prepare("SELECT * FROM smart_class_questions WHERE id=?").bind(id).first();
    if(!old)throw new HttpError(404,"Không tìm thấy câu hỏi.");
    const copy=questionRecord({title:`${old.title.slice(0,149)} (bản sao)`,category:old.category,question:JSON.parse(old.payload_json)},auth.member);
    await env.DB.prepare("INSERT INTO smart_class_questions(id,title,category,mode,prompt,duration,payload_json,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)")
      .bind(copy.id,copy.title,copy.category,copy.question.mode,copy.question.prompt,copy.question.duration,JSON.stringify(copy.question),copy.created_by,now,now).run();
    return Response.json({ok:true,id:copy.id});
  }
  if(body.action==="import"){
    if(!Array.isArray(body.items)||body.items.length<1||body.items.length>100)throw new HttpError(400,"Mỗi lần chỉ nhập 1–100 câu hỏi.");
    const records=body.items.map(item=>questionRecord({...item,id:undefined},auth.member));
    await env.DB.batch(records.map((q,i)=>env.DB.prepare("INSERT INTO smart_class_questions(id,title,category,mode,prompt,duration,payload_json,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)")
      .bind(q.id,q.title,q.category,q.question.mode,q.question.prompt,q.question.duration,JSON.stringify(q.question),q.created_by,now+i,now+i)));
    return Response.json({ok:true,count:records.length});
  }
  const q=questionRecord(body,auth.member);
  await env.DB.prepare("INSERT INTO smart_class_questions(id,title,category,mode,prompt,duration,payload_json,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)")
    .bind(q.id,q.title,q.category,q.question.mode,q.question.prompt,q.question.duration,JSON.stringify(q.question),q.created_by,now,now).run();
  return Response.json({ok:true,id:q.id},{status:201});
}

export async function onRequestPut({request,env}){
  const auth=await requireCadre(request,env);if(!auth.ok)return auth.response;
  const body=await readJson(request),id=requireId(body.id,"Mã câu hỏi"),q=questionRecord({...body,id},auth.member),now=Date.now();
  const result=await env.DB.prepare("UPDATE smart_class_questions SET title=?,category=?,mode=?,prompt=?,duration=?,payload_json=?,updated_at=? WHERE id=?")
    .bind(q.title,q.category,q.question.mode,q.question.prompt,q.question.duration,JSON.stringify(q.question),now,id).run();
  if(!result.meta.changes)throw new HttpError(404,"Không tìm thấy câu hỏi.");
  return Response.json({ok:true,id});
}

export async function onRequestDelete({request,env}){
  const auth=await requireCadre(request,env);if(!auth.ok)return auth.response;
  const id=requireId(new URL(request.url).searchParams.get("id"),"Mã câu hỏi");
  await env.DB.batch([
    env.DB.prepare("DELETE FROM smart_class_question_set_items WHERE question_id=?").bind(id),
    env.DB.prepare("DELETE FROM smart_class_questions WHERE id=?").bind(id),
  ]);
  return Response.json({ok:true});
}
