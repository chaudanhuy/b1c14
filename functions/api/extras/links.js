import { requireAuth, hasPasswordResetAccess } from '../../_lib/auth.js';
import { HttpError, readJson, rateLimit } from '../../_lib/security.js';
import { textField, recordId } from '../../_lib/extras.js';

export async function onRequestGet({request, env}) {
  const auth = await requireAuth(request, env); if (!auth.ok) return auth.response;
  const result = await env.DB.prepare('SELECT id,title,url,created_at FROM quick_links ORDER BY created_at DESC,id DESC LIMIT 100').all();
  return Response.json({items:result.results || [], can_manage:hasPasswordResetAccess(auth.member)});
}
async function owner(request,env) {
  const auth=await requireAuth(request,env);
  if(auth.ok && !hasPasswordResetAccess(auth.member)) throw new HttpError(403,'Chỉ Châu Đan Huy được thêm hoặc xóa liên kết.');
  return auth;
}
export async function onRequestPost({request,env}) {
  const auth=await owner(request,env);if(!auth.ok)return auth.response;
  const limit=await rateLimit(env,'quick-links:'+auth.member.id,20,3600);if(limit)return limit;
  const body=await readJson(request),title=textField(body.title,'Tên liên kết',120),raw=textField(body.url,'Địa chỉ web',2048);
  let url;
  try { url=new URL(raw); } catch {throw new HttpError(400,'Nhập địa chỉ đầy đủ bắt đầu bằng https:// hoặc http://.');}
  if(!['https:','http:'].includes(url.protocol)||!url.hostname||url.username||url.password)
    throw new HttpError(400,'Chỉ chấp nhận đường dẫn HTTP/HTTPS không chứa thông tin đăng nhập.');
  const id=crypto.randomUUID();
  const result=await env.DB.prepare('INSERT OR IGNORE INTO quick_links(id,title,url,created_by,created_at) SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM quick_links)<100')
    .bind(id,title,url.href,auth.member.id,new Date().toISOString()).run();
  if(!result.meta.changes)throw new HttpError(409,'Liên kết đã có hoặc danh sách đã đủ 100 mục.');
  return Response.json({ok:true,id});
}
export async function onRequestDelete({request,env}) {
  const auth=await owner(request,env);if(!auth.ok)return auth.response;
  const body=await readJson(request),id=recordId(body.id);
  const result=await env.DB.prepare('DELETE FROM quick_links WHERE id=?').bind(id).run();
  if(!result.meta.changes)throw new HttpError(404,'Liên kết không còn tồn tại.');
  return Response.json({ok:true});
}
