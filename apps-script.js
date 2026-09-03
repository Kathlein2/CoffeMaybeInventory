export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  const target = process.env.APPS_SCRIPT_URL;
  if (!target) {
    return res.status(500).json({
      ok: false,
      message: "APPS_SCRIPT_URL is not configured in Vercel."
    });
  }

  try {
    const response = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body)
    });

    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { ok: false, message: "Invalid response from Apps Script." };
    }

    return res.status(response.ok ? 200 : 502).json(data);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Backend connection failed."
    });
  }
}
