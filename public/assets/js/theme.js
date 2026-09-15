try {
  const t = localStorage.getItem("b1-theme") || "system";
  document.documentElement.dataset.theme = t;
} catch {
  document.documentElement.dataset.theme = "system";
}
