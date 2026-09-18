import { requireAuth } from "../../_lib/auth.js";
import { boundedBody, HttpError, rateLimit } from "../../_lib/security.js";
import { validateFile } from "../../_lib/files.js";
const prefix = id => "/api/me/avatar?member_id=" + id + "&v=";
const keyFrom = (id, value) => {
  const base = prefix(id);
  if (!value?.startsWith(base)) return null;
  const file = value.slice(base.length);
  return /^[0-9a-f-]{36}\.(webp|png|jpg|jpeg)$/.test(file) ? "avatars/" + id + "/" + file : null;
};
export async function onRequestGet({request, env}) {
  const auth = await requireAuth(request, env); if (!auth.ok) return auth.response;
  const url = new URL(request.url), id = Number(url.searchParams.get("member_id"));
  if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(400, "Thành viên không hợp lệ.");
  const member = await env.DB.prepare("SELECT avatar_url FROM members WHERE id=?").bind(id).first();
  const key = keyFrom(id, member?.avatar_url);
  if (!key || member.avatar_url !== prefix(id) + url.searchParams.get("v")) return new Response("Not found", {status:404});
  if (!env.UPLOADS) throw new HttpError(503, "Chưa cấu hình R2.");
  const object = await env.UPLOADS.get(key); if (!object) return new Response("Not found", {status:404});
  return new Response(object.body, {headers:{
    "Content-Type":object.httpMetadata?.contentType || "image/webp",
    "Cache-Control":"private, no-cache", "Vary":"Cookie",
    "Content-Security-Policy":"default-src 'none'", "X-Content-Type-Options":"nosniff"
  }});
}
function retireOld(env, id) {
  // Read and queue the old key in the SAME atomic D1 batch as replacement.
  return env.DB.prepare(`INSERT OR IGNORE INTO r2_cleanup(image_key,not_before)
    SELECT 'avatars/' || id || '/' || substr(avatar_url, length(?) + 1), unixepoch()
    FROM members WHERE id=? AND avatar_url LIKE ?`).bind(prefix(id), id, prefix(id) + "%");
}
export async function onRequestPost({request, env}) {
  const auth = await requireAuth(request, env); if (!auth.ok) return auth.response;
  if (!env.UPLOADS) throw new HttpError(503, "Chưa cấu hình R2.");
  const limited = await rateLimit(env, "avatar:" + auth.member.id, 10, 600); if (limited) return limited;
  const type = request.headers.get("Content-Type") || "";
  if (!type.startsWith("multipart/form-data;")) throw new HttpError(415,"Hãy chọn một ảnh.");
  const body = await boundedBody(request, 2*1024*1024+65536);
  let form; try { form = await new Response(body,{headers:{"Content-Type":type}}).formData(); }
  catch { throw new HttpError(400,"Không đọc được ảnh tải lên."); }
  const file=form.get("avatar");
  if (!(file instanceof File) || file.size > 2*1024*1024) throw new HttpError(413,"Ảnh đại diện tối đa 2 MB.");
  const valid=await validateFile(file);
  if (!["png","jpg","jpeg","webp"].includes(valid.ext)) throw new HttpError(415,"Chỉ nhận PNG, JPEG hoặc WebP.");
  const id=auth.member.id, filename=crypto.randomUUID()+"."+valid.ext;
  const key="avatars/"+id+"/"+filename, url=prefix(id)+filename;
  await env.DB.prepare("INSERT INTO r2_cleanup(image_key,not_before) VALUES(?,unixepoch()+86400)").bind(key).run();
  await env.UPLOADS.put(key, file.stream(), {httpMetadata:{contentType:valid.type}});
  await env.DB.batch([
    retireOld(env,id),
    env.DB.prepare("UPDATE members SET avatar_url=? WHERE id=?").bind(url,id),
    env.DB.prepare("DELETE FROM r2_cleanup WHERE image_key=?").bind(key)
  ]);
  return Response.json({avatar_url:url,message:"Đã cập nhật ảnh đại diện."});
}
export async function onRequestDelete({request,env}) {
  const auth=await requireAuth(request,env); if(!auth.ok)return auth.response;
  await env.DB.batch([retireOld(env,auth.member.id),
    env.DB.prepare("UPDATE members SET avatar_url=NULL WHERE id=?").bind(auth.member.id)]);
  return Response.json({avatar_url:null,message:"Đã dùng ảnh đại diện mặc định."});
}
