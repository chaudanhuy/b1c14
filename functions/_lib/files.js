import { getFileExtension, MAX_FILE_BYTES } from "./utils.js";
import { HttpError } from "./security.js";
export const MIME_BY_EXTENSION = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};
export function safeFilename(name, fallback = "tai-lieu.bin") {
  const cleaned = String(name || "")
    .split(/[\\/]/)
    .pop()
    .normalize("NFC")
    .replace(/[\x00-\x1f\x7f<>:"|?*]/g, "_")
    .replace(/[. ]+$/g, "");
  if (!cleaned || cleaned === "." || cleaned === "..") return fallback;
  const ext = getFileExtension(cleaned);
  return cleaned.length > 180
    ? cleaned.slice(0, 165) + (ext ? "." + ext : "")
    : cleaned;
}
export function disposition(name, inline = false) {
  const safe = safeFilename(name);
  const fallback = safe.replace(/[^a-zA-Z0-9. _-]/g, "_");
  const encoded = encodeURIComponent(safe).replace(
    /[!'()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );
  return `${inline ? "inline" : "attachment"}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
function signature(b, values, offset = 0) {
  return values.every((v, i) => b[offset + i] === v);
}
function textAt(b, start, end) {
  return new TextDecoder().decode(b.subarray(start, end));
}
function zipKind(b) {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let e = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--)
    if (
      v.getUint32(i, true) === 0x06054b50 &&
      i + 22 + v.getUint16(i + 20, true) === b.length
    ) {
      e = i;
      break;
    }
  if (e < 0 || v.getUint16(e + 4, true) !== 0 || v.getUint16(e + 6, true) !== 0)
    return "";
  const entries = v.getUint16(e + 10, true),
    size = v.getUint32(e + 12, true);
  let p = v.getUint32(e + 16, true);
  const end = p + size;
  if (!entries || entries > 10000 || size > 2 * 1024 * 1024 || end > e)
    return "";
  const names = new Set();
  for (let i = 0; i < entries; i++) {
    if (
      p + 46 > end ||
      v.getUint32(p, true) !== 0x02014b50 ||
      v.getUint16(p + 8, true) & 1
    )
      return "";
    const n = v.getUint16(p + 28, true),
      extra = v.getUint16(p + 30, true),
      comment = v.getUint16(p + 32, true);
    if (p + 46 + n + extra + comment > end) return "";
    const name = textAt(b, p + 46, p + 46 + n);
    if (name.includes("..") || /vbaProject\.bin$/i.test(name)) return "";
    const local = v.getUint32(p + 42, true);
    if (local + 30 >= b.length || v.getUint32(local, true) !== 0x04034b50)
      return "";
    names.add(name);
    p += 46 + n + extra + comment;
  }
  if (!names.has("[Content_Types].xml") || !names.has("_rels/.rels")) return "";
  const kinds = [
    ["word/document.xml", "docx"],
    ["xl/workbook.xml", "xlsx"],
    ["ppt/presentation.xml", "pptx"],
  ].filter(([name]) => names.has(name));
  return kinds.length === 1 ? kinds[0][1] : "";
}
function compoundKind(b) {
  if (
    b.length < 512 ||
    !signature(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
  )
    return "";
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (v.getUint16(28, true) !== 0xfffe) return "";
  const shift = v.getUint16(30, true);
  if (![9, 12].includes(shift)) return "";
  const size = 2 ** shift,
    max = Math.floor(b.length / size) - 1,
    fats = [];
  const valid = (s) => Number.isInteger(s) && s >= 0 && s < max;
  for (let i = 0; i < 109; i++) {
    const s = v.getUint32(76 + i * 4, true);
    if (valid(s)) fats.push(s);
  }
  let dif = v.getUint32(68, true);
  const seenDif = new Set();
  while (valid(dif) && !seenDif.has(dif) && seenDif.size < 64) {
    seenDif.add(dif);
    const start = (dif + 1) * size;
    for (let i = 0; i < size / 4 - 1; i++) {
      const s = v.getUint32(start + i * 4, true);
      if (valid(s)) fats.push(s);
    }
    dif = v.getUint32(start + size - 4, true);
  }
  let dir = v.getUint32(48, true);
  const seen = new Set(),
    names = new Set();
  while (valid(dir) && !seen.has(dir) && seen.size < 256) {
    seen.add(dir);
    const start = (dir + 1) * size;
    for (let i = 0; i < size; i += 128) {
      const p = start + i,
        n = v.getUint16(p + 64, true);
      if (n >= 2 && n <= 64 && b[p + 66] === 2)
        names.add(new TextDecoder("utf-16le").decode(b.subarray(p, p + n - 2)));
    }
    const fat = fats[Math.floor(dir / (size / 4))];
    if (!valid(fat)) break;
    dir = v.getUint32((fat + 1) * size + (dir % (size / 4)) * 4, true);
  }
  if (names.has("EncryptedPackage")) return "";
  if (names.has("WordDocument")) return "doc";
  if (names.has("Workbook") || names.has("Book")) return "xls";
  if (names.has("PowerPoint Document")) return "ppt";
  return "";
}
export async function validateFile(file) {
  if (!(file instanceof File) || !file.size)
    throw new HttpError(400, "Tệp trống hoặc không hợp lệ.");
  if (file.size > MAX_FILE_BYTES)
    throw new HttpError(413, `Tệp "${file.name}" vượt 20 MB.`);
  const ext = getFileExtension(file.name),
    canonical = MIME_BY_EXTENSION[ext];
  if (!canonical)
    throw new HttpError(415, `Không hỗ trợ định dạng của "${file.name}".`);
  const declared = String(file.type || "").toLowerCase();
  const generic = ["", "application/octet-stream"];
  if (["docx", "xlsx", "pptx"].includes(ext))
    generic.push("application/zip", "application/x-zip-compressed");
  if (declared !== canonical && !generic.includes(declared))
    throw new HttpError(415, `MIME và đuôi tệp "${file.name}" không khớp.`);
  const b = new Uint8Array(await file.arrayBuffer());
  let detected = "";
  if (
    b.length > 24 &&
    signature(b, [137, 80, 78, 71, 13, 10, 26, 10]) &&
    textAt(b, 12, 16) === "IHDR"
  )
    detected = "png";
  else if (b.length > 4 && signature(b, [255, 216, 255])) detected = "jpg";
  else if (
    b.length > 20 &&
    textAt(b, 0, 4) === "RIFF" &&
    textAt(b, 8, 12) === "WEBP"
  )
    detected = "webp";
  else if (/%PDF-[12]\.\d/.test(textAt(b, 0, 1024))) detected = "pdf";
  else if (signature(b, [80, 75, 3, 4])) detected = zipKind(b);
  else detected = compoundKind(b);
  if (!detected || MIME_BY_EXTENSION[detected] !== canonical)
    throw new HttpError(
      415,
      `Nội dung "${file.name}" không khớp định dạng. Hãy dùng tệp gốc không mã hóa.`,
    );
  return {
    name: safeFilename(file.name),
    type: canonical,
    ext: ext,
    size: file.size,
  };
}
