import { requireAuth, getSessionPayload } from "../../_lib/auth.js";
import { HttpError, rateLimit } from "../../_lib/security.js";
export async function onRequestGet({request,env}){
  const auth=await requireAuth(request,env);if(!auth.ok)return auth.response;
  if(request.headers.get("Upgrade")?.toLowerCase()!=="websocket")
    return Response.json({configured:!!env.SMART_CLASS});
  if(request.headers.get("Origin")!==new URL(request.url).origin)throw new HttpError(403,"Kết nối phải xuất phát từ chính website.");
  if(!env.SMART_CLASS)throw new HttpError(503,"Smart Class chưa được kết nối với Worker.");
  const limited=await rateLimit(env,"smart-connect:"+auth.member.id,30,60);if(limited)return limited;
  const session=await getSessionPayload(request,env);
  if(!session||session.sv!==auth.member.session_version)throw new HttpError(401,"Phiên đăng nhập đã thay đổi.");
  const room=env.SMART_CLASS.get(env.SMART_CLASS.idFromName("b1c14-smart-class-v1"));
  return room.fetch(new Request("https://smart.internal/connect",{
    headers:{Upgrade:"websocket","X-Smart-Identity":JSON.stringify(session)}
  }));
}
