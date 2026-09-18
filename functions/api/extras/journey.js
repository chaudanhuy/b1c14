import { requireAuth } from "../../_lib/auth.js";
export const LEVELS = [
  {name:"Tân binh",xp:0},{name:"Tiên phong",xp:100},{name:"Bứt phá",xp:300},
  {name:"Tinh hoa",xp:700},{name:"Dẫn đầu",xp:1500},{name:"Truyền cảm hứng",xp:3000}
];
export async function onRequestGet({request,env}) {
  const auth=await requireAuth(request,env);if(!auth.ok)return auth.response;
  const {results=[]}=await env.DB.prepare(`
    WITH files AS (
      SELECT submission_id,MIN(created_at) first_file FROM submission_images GROUP BY submission_id
    ), tasks_done AS (
      SELECT s.member_id,COUNT(*) submitted,
        SUM(CASE WHEN t.due_at IS NOT NULL AND julianday(f.first_file)<=julianday(t.due_at) THEN 1 ELSE 0 END) on_time
      FROM task_submissions s JOIN tasks t ON t.id=s.task_id JOIN files f ON f.submission_id=s.id
      GROUP BY s.member_id
    ), activity AS (
      SELECT member_id,COUNT(DISTINCT session_id) attendance,
        SUM(responded) interactions,SUM(score) game_score
      FROM smart_class_results GROUP BY member_id
    )
    SELECT m.id,m.name,m.unit_label,m.avatar_url,COALESCE(t.submitted,0) submitted,
      COALESCE(t.on_time,0) on_time,COALESCE(a.attendance,0) attendance,
      COALESCE(a.interactions,0) interactions,COALESCE(a.game_score,0) game_score
    FROM members m LEFT JOIN tasks_done t ON t.member_id=m.id LEFT JOIN activity a ON a.member_id=m.id
  `).all();
  const leaderboard=results.map(m=>{
    const xp=m.on_time*50+m.attendance*20+m.interactions*5;
    const level=LEVELS.findLast(l=>xp>=l.xp),next=LEVELS.find(l=>l.xp>xp)||null;
    return {...m,xp,level:level.name,level_start:level.xp,next,progress:next?Math.min(100,100*(xp-level.xp)/(next.xp-level.xp)):100};
  }).sort((a,b)=>b.xp-a.xp||b.game_score-a.game_score||a.name.localeCompare(b.name,"vi"));
  return Response.json({me:leaderboard.find(m=>m.id===auth.member.id),leaderboard,levels:LEVELS,
    rules:{on_time:50,attendance:20,interaction:5},
    note:"Đúng hạn: nhiệm vụ có hạn và còn minh chứng nộp trước hạn. Chuyên cần: số phiên Smart Class có mặt khi bắt đầu ít nhất một vòng. Tương tác: số vòng đã trả lời. Không quy đổi thành điểm học tập chính thức."
  });
}
