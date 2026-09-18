import {requireAuth} from "../../_lib/auth.js";
export async function onRequestGet({request,env}){
  const auth=await requireAuth(request,env);if(!auth.ok)return auth.response;
  const {results=[]}=await env.DB.prepare(
    "SELECT s.*,COUNT(DISTINCT r.member_id) participants,COUNT(DISTINCT r.round_id) rounds FROM smart_class_sessions s LEFT JOIN smart_class_results r ON r.session_id=s.id GROUP BY s.id ORDER BY s.started_at DESC LIMIT 30"
  ).all();
  return Response.json({sessions:results});
}
