import { HttpError } from "./security.js";

export const SMART_MODES = ["quiz","buzzer","short","reorder","estimate","match"];
const UUID_RE=/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i;

export function cleanText(value,label,max,{allowEmpty=false}={}){
  if(typeof value!=="string")throw new HttpError(400,`${label} không hợp lệ.`);
  const text=value.trim();
  if((!allowEmpty&&!text)||text.length>max)throw new HttpError(400,`${label} trống hoặc quá dài.`);
  return text;
}
function num(value,label,min,max){
  const n=Number(value);
  if(!Number.isFinite(n)||n<min||n>max)throw new HttpError(400,`${label} ngoài giới hạn.`);
  return n;
}
export function validId(value){return typeof value==="string"&&UUID_RE.test(value);}
export function requireId(value,label="Mã dữ liệu"){
  if(!validId(value))throw new HttpError(400,`${label} không hợp lệ.`);
  return value;
}

export function normalizeBankQuestion(input){
  if(!input||typeof input!=="object"||Array.isArray(input)||!SMART_MODES.includes(input.mode))
    throw new HttpError(400,"Chế độ câu hỏi không hợp lệ.");
  const q={mode:input.mode,prompt:cleanText(input.prompt,"Câu hỏi",500),duration:Math.round(num(input.duration,"Thời gian",5,300))};
  if(q.mode==="quiz"){
    if(!Array.isArray(input.options)||input.options.length!==4)throw new HttpError(400,"Trắc nghiệm cần đúng 4 đáp án.");
    q.options=input.options.map((x,i)=>cleanText(x,`Đáp án ${"ABCD"[i]}`,200));
    if(!["A","B","C","D"].includes(input.correct))throw new HttpError(400,"Chọn đáp án đúng A–D.");
    q.correct=input.correct;
  }else if(q.mode==="short"){
    if(!Array.isArray(input.accepted)||input.accepted.length<1||input.accepted.length>20)
      throw new HttpError(400,"Cần 1–20 đáp án được chấp nhận.");
    q.accepted=input.accepted.map((x,i)=>cleanText(x,`Đáp án ${i+1}`,50));
    q.ignoreAccents=input.ignoreAccents===true;
  }else if(q.mode==="reorder"){
    if(!Array.isArray(input.items)||input.items.length<2||input.items.length>8)
      throw new HttpError(400,"Cần 2–8 mục sắp xếp.");
    q.items=input.items.map((x,i)=>cleanText(x,`Mục ${i+1}`,150));
  }else if(q.mode==="estimate"){
    q.min=num(input.min,"Giá trị nhỏ nhất",-1e9,1e9);q.max=num(input.max,"Giá trị lớn nhất",-1e9,1e9);
    if(q.max<=q.min)throw new HttpError(400,"Giá trị lớn nhất phải lớn hơn giá trị nhỏ nhất.");
    q.step=num(input.step,"Bước nhảy",0.000001,q.max-q.min);
    q.correct=num(input.correct,"Giá trị đúng",q.min,q.max);
  }else if(q.mode==="match"){
    if(!Array.isArray(input.pairs)||input.pairs.length<2||input.pairs.length>8)
      throw new HttpError(400,"Cần 2–8 cặp ghép.");
    q.pairs=input.pairs.map((pair,i)=>{
      if(!Array.isArray(pair)||pair.length!==2)throw new HttpError(400,`Cặp ${i+1} không hợp lệ.`);
      return [cleanText(pair[0],`Vế trái ${i+1}`,150),cleanText(pair[1],`Vế phải ${i+1}`,150)];
    });
  }
  return q;
}

export function questionRecord(body,member){
  const question=normalizeBankQuestion(body.question||body);
  return {
    id:validId(body.id)?body.id:crypto.randomUUID(),
    title:cleanText(body.title||question.prompt,"Tên câu hỏi",160),
    category:cleanText(body.category||"Chung","Chủ đề",80),
    question,
    created_by:Number(member.id),
  };
}

export function parseQuestionRow(row){
  let question;
  try{question=JSON.parse(row.payload_json);}catch{question={mode:row.mode,prompt:row.prompt,duration:row.duration};}
  return {
    id:row.id,title:row.title,category:row.category,mode:row.mode,prompt:row.prompt,duration:Number(row.duration),question,
    created_by:Number(row.created_by),created_at:Number(row.created_at),updated_at:Number(row.updated_at),
    rounds:Number(row.rounds||0),responses:Number(row.responses||0),avg_accuracy:Number(row.avg_accuracy||0),
  };
}
