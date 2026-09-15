import { requireCadre } from "../../_lib/auth.js";
import { taskRoster } from "../../_lib/submissions.js";
import { createZipStream } from "../../_lib/zip.js";
import { disposition } from "../../_lib/files.js";
import { HttpError, rateLimit } from "../../_lib/security.js";
const xml = (s) =>
  String(s ?? "")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const labels = {
  not_submitted: "Chưa nộp",
  pending: "Chờ duyệt",
  approved: "Đạt",
  rejected: "Cần nộp lại",
};
export async function onRequestGet({ request, env }) {
  const auth = await requireCadre(request, env);
  if (!auth.ok) return auth.response;
  const limited = await rateLimit(env, `export:${auth.member.id}`, 6, 300);
  if (limited) return limited;
  const id = Number(new URL(request.url).searchParams.get("task_id"));
  if (!Number.isSafeInteger(id) || id < 1)
    throw new HttpError(400, "Hãy chọn nhiệm vụ.");
  const task = await env.DB.prepare("SELECT * FROM tasks WHERE id = ?")
    .bind(id)
    .first();
  if (!task) throw new HttpError(404, "Không tìm thấy nhiệm vụ.");
  const members = await taskRoster(env, id);
  const data = [
    [
      "Nhiệm vụ",
      "Tiểu đội",
      "Họ và tên",
      "Trạng thái",
      "Số tệp",
      "Nộp gần nhất (UTC)",
      "Người duyệt",
      "Phản hồi",
      "Hạn chót (UTC)",
    ],
    ...members.map((m) => [
      task.title,
      m.unit_label,
      m.name,
      labels[m.status],
      m.image_count,
      m.updated_at || "",
      m.reviewer_name || "",
      m.review_note || "",
      task.due_at || "",
    ]),
  ];
  // Inline strings prevent formulas supplied through names/titles/feedback from executing in Excel.
  const rows = data
    .map(
      (row, i) =>
        `<row r="${i + 1}">${row.map((cell, j) => `<c r="${String.fromCharCode(65 + j)}${i + 1}" t="inlineStr"><is><t xml:space="preserve">${xml(cell)}</t></is></c>`).join("")}</row>`,
    )
    .join("");
  const parts = {
    "[Content_Types].xml":
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    "_rels/.rels":
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    "xl/workbook.xml":
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Tiến độ minh chứng" sheetId="1" r:id="rId1"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels":
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    "xl/worksheets/sheet1.xml": `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="3" width="28" customWidth="1"/><col min="4" max="9" width="25" customWidth="1"/></cols><sheetData>${rows}</sheetData><autoFilter ref="A1:I${data.length}"/></worksheet>`,
  };
  const files = Object.entries(parts).map(([path, content]) => ({
    path,
    getObject: async () => ({
      body: new Blob([
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + content,
      ]).stream(),
    }),
  }));
  return new Response(createZipStream({ files }), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": disposition(`Tien-do-${task.title}.xlsx`),
      "Cache-Control": "no-store",
    },
  });
}
