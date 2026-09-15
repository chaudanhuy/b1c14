import { readFileSync, writeFileSync } from "node:fs";
const root = new URL("../public/", import.meta.url);
const html = readFileSync(new URL("index.html", root), "utf8");
writeFileSync(
  new URL("admin.html", root),
  html
    .replace('data-entry="dashboard"', 'data-entry="manager"')
    .replace(
      "<title>ĐH31LQA · Cổng nội bộ</title>",
      "<title>Quản lý · ĐH31LQA</title>",
    ),
);
