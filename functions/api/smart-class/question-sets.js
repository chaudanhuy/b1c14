import {requireCadre} from "../../_lib/auth.js";
import {HttpError,readJson} from "../../_lib/security.js";
import {cleanText,parseQuestionRow,requireId,validId} from "../../_lib/smart-class-bank.js";

async function setItems(env,id){
  const {results=[]}=await env.DB.prepare(`SELECT q.*,i.position,
    COUNT(DISTINCT CASE WHEN sr.round_id IS NOT NULL THEN sr.session_id || ':' || sr.round_id END) rounds,
    COUNT(r.member_id) responses,COALESCE(AVG(r.accuracy),0) avg_accuracy
    FROM smart_class_question_set_items i JOIN smart_class_questions q ON q.id=i.question_id
    LEFT JOIN smart_class_rounds sr ON sr.question_id=q.id
    LEFT JOIN smart_class_results r ON r.session_id=sr.session_id AND r.round_id=sr.round_id
    WHERE i.set_id=? GROUP BY q.id,i.position ORDER BY i.position`).bind(id).all();
  return results.map(row=>({...parseQuestionRow(row),position:Number(row.position)}));
}
async function replaceItems(env,setId,ids){
  if(!Array.isArray(ids)||ids.length>200||new Set(ids).size!==ids.length||ids.some(id=>!validId(id)))
    throw new HttpError(400,"Danh sách câu hỏi của bộ đề không hợp lệ.");
  if(ids.length){
    const placeholders=ids.map(()=>"?").join(",");
    const count=await env.DB.prepare(`SELECT COUNT(*) count FROM smart_class_questions WHERE id IN (${placeholders})`).bind(...ids).first();
    if(Number(count?.count)!==ids.length)throw new HttpError(400,"Bộ đề chứa câu hỏi không còn tồn tại.");
  }
  const statements=[env.DB.prepare("DELETE FROM smart_class_question_set_items WHERE set_id=?").bind(setId)];
  ids.forEach((id,index)=>statements.push(env.DB.prepare("INSERT INTO smart_class_question_set_items(set_id,question_id,position) VALUES(?,?,?)").bind(setId,id,index+1)));
  await env.DB.batch(statements);
}

export async function onRequestGet({request,env}){
  const auth=await requireCadre(request,env);if(!auth.ok)return auth.response;
  const id=new URL(request.url).searchParams.get("id");
  if(id){
    requireId(id,"Mã bộ đề");
    const set=await env.DB.prepare("SELECT * FROM smart_class_question_sets WHERE id=?").bind(id).first();
    if(!set)throw new HttpError(404,"Không tìm thấy bộ đề.");
    return Response.json({set:{...set,created_at:Number(set.created_at),updated_at:Number(set.updated_at),questions:await setItems(env,id)}});
  }
  const {results=[]}=await env.DB.prepare(`SELECT s.*,COUNT(i.question_id) item_count
    FROM smart_class_question_sets s LEFT JOIN smart_class_question_set_items i ON i.set_id=s.id
    GROUP BY s.id ORDER BY s.updated_at DESC LIMIT 100`).all();
  return Response.json({sets:results.map(s=>({...s,item_count:Number(s.item_count||0),created_at:Number(s.created_at),updated_at:Number(s.updated_at)}))});
}

export async function onRequestPost({request,env}){
  const auth=await requireCadre(request,env);if(!auth.ok)return auth.response;
  const body=await readJson(request),id=crypto.randomUUID(),now=Date.now();
  const title=cleanText(body.title,"Tên bộ đề",160),description=cleanText(body.description||"","Mô tả",600,{allowEmpty:true});
  await env.DB.prepare("INSERT INTO smart_class_question_sets(id,title,description,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?)")
    .bind(id,title,description,Number(auth.member.id),now,now).run();
  if(body.question_ids)await replaceItems(env,id,body.question_ids);
  return Response.json({ok:true,id},{status:201});
}

export async function onRequestPut({request,env}){
  const auth=await requireCadre(request,env);if(!auth.ok)return auth.response;
  const body=await readJson(request),id=requireId(body.id,"Mã bộ đề"),now=Date.now();
  const current=await env.DB.prepare("SELECT * FROM smart_class_question_sets WHERE id=?").bind(id).first();
  if(!current)throw new HttpError(404,"Không tìm thấy bộ đề.");
  const title=body.title===undefined?current.title:cleanText(body.title,"Tên bộ đề",160);
  const description=body.description===undefined?current.description:cleanText(body.description||"","Mô tả",600,{allowEmpty:true});
  await env.DB.prepare("UPDATE smart_class_question_sets SET title=?,description=?,updated_at=? WHERE id=?").bind(title,description,now,id).run();
  if(body.question_ids!==undefined)await replaceItems(env,id,body.question_ids);
  return Response.json({ok:true,id});
}

export async function onRequestDelete({request,env}){
  const auth=await requireCadre(request,env);if(!auth.ok)return auth.response;
  const id=requireId(new URL(request.url).searchParams.get("id"),"Mã bộ đề");
  await env.DB.batch([
    env.DB.prepare("DELETE FROM smart_class_question_set_items WHERE set_id=?").bind(id),
    env.DB.prepare("DELETE FROM smart_class_question_sets WHERE id=?").bind(id),
  ]);
  return Response.json({ok:true});
}
