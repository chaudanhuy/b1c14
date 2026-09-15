import {
  $,
  escapeHTML,
  formatBytes,
  formatDate,
  icon,
  empty,
  skeleton,
} from "./ui.js";
export const MAX_FILE_SIZE = 20 * 1024 * 1024,
  MAX_TOTAL_SIZE = 25 * 1024 * 1024,
  MAX_FILES = 10;
export const EXTENSIONS = [
  "png",
  "jpg",
  "jpeg",
  "webp",
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
];
export const extension = (name) =>
  (/\.([a-z0-9]+)$/i.exec(name || "")?.[1] || "").toLowerCase();
export function fileKind(f) {
  const types = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.ms-powerpoint": "ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      "pptx",
  };
  const e = extension(f.image_name || f.name) || types[f.image_type || f.type];
  if (["png", "jpg", "jpeg", "webp"].includes(e))
    return { key: "image", label: "IMG" };
  if (["doc", "docx"].includes(e)) return { key: "word", label: "W" };
  if (["xls", "xlsx"].includes(e)) return { key: "excel", label: "X" };
  if (["ppt", "pptx"].includes(e)) return { key: "ppt", label: "P" };
  if (e === "pdf") return { key: "pdf", label: "PDF" };
  return { key: "file", label: (e || "FILE").toUpperCase() };
}
export function fileIcon(f) {
  const k = fileKind(f);
  return `<span class="file-icon ${k.key}" aria-hidden="true">${k.label}</span>`;
}
export function fileUrl(f, download = false) {
  return (
    f.url ||
    `/api/image?id=${encodeURIComponent(f.id)}${download ? "&download=1" : ""}`
  );
}
export function fileTile(f, canDelete = false) {
  const name = f.image_name || f.name || `Tài liệu ${f.id}`;
  return `<article class="file-tile"><button class="file-open" data-file-open="${Number(f.id)}" title="${escapeHTML(name)}">${fileIcon(f)}<b>${escapeHTML(name)}</b></button><div class="file-meta"><span>${formatBytes(f.image_size || f.size)}</span><div class="action-row"><a class="icon-button" href="${fileUrl(f, true)}" title="Tải xuống" aria-label="Tải xuống ${escapeHTML(name)}">${icon("download")}</a>${canDelete ? `<button class="icon-button danger-text" data-file-delete="${Number(f.id)}" title="Xóa tệp" aria-label="Xóa ${escapeHTML(name)}">${icon("trash")}</button>` : ""}</div></div></article>`;
}
export function validateSelection(files) {
  if (files.length > MAX_FILES) return "Mỗi lần chọn tối đa 10 tệp.";
  let total = 0;
  for (const f of files) {
    if (!EXTENSIONS.includes(extension(f.name)))
      return `Không hỗ trợ định dạng “${f.name}”.`;
    if (!f.size) return `Tệp “${f.name}” không có nội dung.`;
    if (f.size > MAX_FILE_SIZE) return `Tệp “${f.name}” vượt 20 MB.`;
    total += f.size;
  }
  if (total > MAX_TOTAL_SIZE)
    return "Tổng dung lượng vượt 25 MB. Hãy chia thành nhiều lần gửi.";
  return "";
}
export async function compressImage(file) {
  if (fileKind(file).key !== "image" || file.size < 400 * 1024) return file;
  let bitmap;
  try {
    if (!window.createImageBitmap) return file;
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    if (bitmap.width * bitmap.height > 50_000_000) return file;
    const ratio = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.84),
    );
    canvas.width = canvas.height = 1;
    if (!blob || blob.type !== "image/webp" || blob.size >= file.size * 0.94)
      return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", {
      type: "image/webp",
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
}
let previewVersion = 0,
  previewImage = null,
  zoom = 1,
  rotation = 0,
  baseWidth = 0,
  baseHeight = 0;
function transformImage() {
  if (!previewImage) return;
  const stage = $("#previewStage"),
    canvas = stage.querySelector(".preview-canvas");
  if (!canvas) return;
  const rotated = rotation % 180 !== 0;
  const width = baseWidth * zoom,
    height = baseHeight * zoom;
  canvas.style.width =
    Math.max(stage.clientWidth, rotated ? height : width) + "px";
  canvas.style.height =
    Math.max(stage.clientHeight, rotated ? width : height) + "px";
  previewImage.style.width = width + "px";
  previewImage.style.height = height + "px";
  previewImage.style.left = "50%";
  previewImage.style.top = "50%";
  previewImage.style.transform = `translate(-50%,-50%) rotate(${rotation}deg)`;
  $("#resetZoom").textContent = Math.round(zoom * 100) + "%";
  $("#zoomIn").disabled = zoom >= 4;
  $("#zoomOut").disabled = zoom <= 0.5;
}
export function openPreview(file) {
  const dialog = $("#previewDialog"),
    stage = $("#previewStage"),
    version = ++previewVersion;
  previewImage = null;
  zoom = 1;
  rotation = 0;
  $("#previewTitle").textContent = file.image_name || file.name || "Tài liệu";
  $("#previewMeta").textContent = [
    formatBytes(file.image_size || file.size),
    file.created_at ? formatDate(file.created_at) : "Chưa gửi",
  ].join(" · ");
  const link = $("#downloadFile");
  link.href = fileUrl(file, true);
  link.download = file.image_name || file.name || "";
  const kind = fileKind(file);
  $("#imageControls").hidden = kind.key !== "image";
  stage.replaceChildren();
  if (!dialog.open) dialog.showModal();
  if (kind.key === "image") {
    skeleton(stage, 1, "tile");
    const img = new Image();
    img.alt = file.image_name || file.name;
    img.className = "preview-image";
    img.decoding = "async";
    img.onload = () => {
      if (version !== previewVersion || !dialog.open) return;
      const ratio = Math.min(
        1,
        (stage.clientWidth - 32) / img.naturalWidth,
        (stage.clientHeight - 32) / img.naturalHeight,
      );
      baseWidth = img.naturalWidth * ratio;
      baseHeight = img.naturalHeight * ratio;
      stage.removeAttribute("aria-busy");
      stage.innerHTML = '<div class="preview-canvas"></div>';
      stage.firstElementChild.append(img);
      previewImage = img;
      transformImage();
    };
    img.onerror = () => {
      if (version === previewVersion) {
        stage.removeAttribute("aria-busy");
        stage.innerHTML = empty(
          "Chưa tải được ảnh",
          "Hãy thử mở lại hoặc tải tệp xuống.",
        );
      }
    };
    img.src = fileUrl(file);
  } else if (kind.key === "pdf") {
    stage.innerHTML = `<iframe title="Xem trước PDF" src="${escapeHTML(fileUrl(file))}"></iframe>`;
  } else {
    stage.innerHTML = `<div class="document-preview">${fileIcon(file)}<h3>${escapeHTML(file.image_name || file.name)}</h3><p>Tải tài liệu để mở bằng ${kind.key === "word" ? "Word" : kind.key === "excel" ? "Excel" : kind.key === "ppt" ? "PowerPoint" : "ứng dụng tương ứng"}. Tệp được giữ nguyên định dạng và nội dung.</p></div>`;
  }
}
export function setupPreview() {
  $("#zoomIn").onclick = () => {
    zoom = Math.min(4, zoom + 0.25);
    transformImage();
  };
  $("#zoomOut").onclick = () => {
    zoom = Math.max(0.5, zoom - 0.25);
    transformImage();
  };
  $("#rotateImage").onclick = () => {
    rotation = (rotation + 90) % 360;
    transformImage();
  };
  $("#resetZoom").onclick = () => {
    zoom = 1;
    rotation = 0;
    transformImage();
  };
  $("#previewDialog").addEventListener("close", () => {
    ++previewVersion;
    previewImage = null;
    $("#previewStage").replaceChildren();
    $("#previewStage").removeAttribute("aria-busy");
    $("#downloadFile").removeAttribute("href");
  });
  window.addEventListener("resize", transformImage);
}
