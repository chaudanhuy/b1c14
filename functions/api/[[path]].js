// Prevent unknown API routes / unsupported methods from falling back to the HTML app.
export function onRequest() {
  return Response.json({ error: "API hoặc phương thức không được hỗ trợ." },
    { status: 404, headers: { "Cache-Control": "no-store" } });
}
