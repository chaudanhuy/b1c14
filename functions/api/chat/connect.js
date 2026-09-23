import { requireAuth, getSessionPayload } from '../../_lib/auth.js';
import { HttpError, rateLimit } from '../../_lib/security.js';

export async function onRequestGet({request,env}) {
  const auth=await requireAuth(request,env);if(!auth.ok)return auth.response;
  if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')
    return Response.json({configured:!!env.LQA_CHAT});
  // Browser WebSocket handshakes cannot carry the ordinary CSRF header.
  if(request.headers.get('Origin')!==new URL(request.url).origin)
    throw new HttpError(403,'Kết nối chat phải xuất phát từ chính website.');
  if(!env.LQA_CHAT)throw new HttpError(503,'LQA-Message chưa được nối với Worker chat.');
  const limited=await rateLimit(env,'chat-connect:'+auth.member.id,30,60);if(limited)return limited;
  const session=await getSessionPayload(request,env);
  if(!session || session.sv!==auth.member.session_version)
    throw new HttpError(401,'Phiên đăng nhập vừa thay đổi.');
  const headers=new Headers({Upgrade:'websocket','X-LQA-Identity':JSON.stringify(session)});
  const hub=env.LQA_CHAT.get(env.LQA_CHAT.idFromName('b1c14-chat-v1'));
  return hub.fetch(new Request('https://lqa.internal/connect',{headers}));
}
