import {escapeHTML as h, initials, icon, toast, busy, modal} from "./ui.js";
export function avatarMarkup(member) {
  const fallback = "<span>" + h(initials(member?.name || "")) + "</span>";
  const url = member?.avatar_url;
  if (typeof url !== "string" || !/^\/api\/me\/avatar\?member_id=\d+&v=[0-9a-f-]{36}\.(webp|png|jpg|jpeg)$/.test(url)) return fallback;
  return '<img class="avatar-image" src="'+h(url)+'" alt="" loading="lazy" decoding="async" data-avatar-fallback="'+h(initials(member.name))+'">';
}
export function renderOwnAvatar(member) {
  document.querySelectorAll("[data-member-initials]").forEach(n=>n.innerHTML=avatarMarkup(member));
}
export function setupAvatar({api,getMember,onChange}) {
  document.addEventListener("error",event=>{
    const img=event.target;
    if(img?.tagName!=="IMG"||!img.hasAttribute("data-avatar-fallback"))return;
    const text=document.createElement("span");text.textContent=img.dataset.avatarFallback;img.replaceWith(text);
  },true);
  const choose=document.getElementById("avatarChoose"), remove=document.getElementById("avatarRemove");
  const input=document.getElementById("avatarInput");
  const dialog=document.createElement("dialog");dialog.className="modal avatar-crop";
  dialog.setAttribute("aria-labelledby","avatarCropTitle");
  dialog.innerHTML=`<form class="stack-form"><div class="panel-heading"><h2 id="avatarCropTitle">Chỉnh ảnh đại diện</h2><button type="button" class="icon-button" data-cancel aria-label="Đóng">${icon("x")}</button></div><canvas width="320" height="320" aria-label="Ảnh xem trước"></canvas><label class="field"><span>Phóng to</span><input name="zoom" type="range" min="1" max="3" step=".01" value="1"></label><label class="field"><span>Dịch ngang</span><input name="x" type="range" min="-1" max="1" step=".01" value="0"></label><label class="field"><span>Dịch dọc</span><input name="y" type="range" min="-1" max="1" step=".01" value="0"></label><p class="inline-message" role="status"></p><div class="action-row"><button type="submit" class="button primary">Lưu ảnh</button><button type="button" class="button ghost" data-cancel>Hủy</button></div></form>`;
  document.body.append(dialog);
  const canvas=dialog.querySelector("canvas"),form=dialog.querySelector("form");
  let bitmap=null,owner=null,generation=0,saving=false;
  function draw(){
    if(!bitmap)return;
    const ctx=canvas.getContext("2d"),size=canvas.width;
    const ratio=Math.max(size/bitmap.width,size/bitmap.height)*Number(form.elements.zoom.value);
    const width=bitmap.width*ratio,height=bitmap.height*ratio;
    const x=(size-width)/2+Number(form.elements.x.value)*(width-size)/2;
    const y=(size-height)/2+Number(form.elements.y.value)*(height-size)/2;
    ctx.clearRect(0,0,size,size);ctx.drawImage(bitmap,x,y,width,height);
  }
  choose.onclick=()=>input.click();
  input.onchange=async()=>{
    const file=input.files[0];input.value="";if(!file)return;
    const at=++generation,member=getMember();if(!member||member.must_change_password)return;
    if(!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>10*1024*1024){toast("Chọn PNG, JPEG hoặc WebP tối đa 10 MB.","error");return;}
    try{
      const decoded=await createImageBitmap(file,{imageOrientation:"from-image"});
      if(at!==generation||getMember()?.id!==member.id){decoded.close();return;}
      if(decoded.width*decoded.height>40_000_000){decoded.close();throw new Error("Ảnh quá lớn. Hãy chọn ảnh nhỏ hơn 40 megapixel.");}
      bitmap?.close();bitmap=decoded;owner=member.id;form.reset();form.querySelector(".inline-message").textContent="";
      dialog.showModal();draw();
    }catch(error){toast("Không mở được ảnh: "+error.message,"error");}
  };
  form.addEventListener("input",draw);
  dialog.querySelectorAll("[data-cancel]").forEach(n=>n.onclick=()=>{if(!saving)dialog.close();});
  dialog.addEventListener("cancel",e=>{if(saving)e.preventDefault();});
  dialog.addEventListener("close",()=>{generation++;bitmap?.close();bitmap=null;owner=null;});
  form.onsubmit=async e=>{
    e.preventDefault();if(!bitmap||saving||getMember()?.id!==owner)return;
    const memberId=owner,at=generation;saving=true;
    try{await busy(form.querySelector("[type=submit]"),async()=>{
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/webp",.86));
      if(!blob)throw new Error("Trình duyệt chưa tạo được ảnh.");
      if(at!==generation||getMember()?.id!==memberId)return;
      const data=new FormData();data.append("avatar",new File([blob],blob.type==="image/webp"?"avatar.webp":"avatar.png",{type:blob.type}));
      const result=await api("/api/me/avatar",{method:"POST",body:data});
      if(getMember()?.id!==memberId)return;
      onChange(result.avatar_url);toast(result.message);dialog.close();
    },"Đang lưu…");}catch(error){form.querySelector(".inline-message").textContent=error.message;}finally{saving=false;}
  };
  remove.onclick=async()=>{
    const id=getMember()?.id;if(!id)return;
    const result=await modal({title:"Xóa ảnh đại diện?",description:"Ảnh sẽ trở về chữ viết tắt tên của bạn.",submit:"Xóa ảnh",danger:true,
      onSubmit:()=>api("/api/me/avatar",{method:"DELETE"})});
    if(result&&getMember()?.id===id){onChange(null);toast("Đã dùng ảnh mặc định.");}
  };
}
