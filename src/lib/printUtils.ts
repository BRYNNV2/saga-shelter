/**
 * Utility untuk mencetak data ke jendela print browser.
 * Membuka popup window dengan HTML yang diformat rapi.
 */

export interface PrintColumn {
    header: string;
    key: string;
    width?: string;
}

export interface PrintOptions {
    title: string;
    subtitle?: string;
    columns: PrintColumn[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: Record<string, any>[];
    footer?: string;
}

export const printData = (options: PrintOptions) => {
    const { title, subtitle, columns, data, footer } = options;
    const now = new Date().toLocaleString("id-ID", {
        day: "numeric", month: "long", year: "numeric",
        hour: "2-digit", minute: "2-digit",
    });

    const rows = data.map((row) =>
        `<tr>${columns.map((col) => `<td>${row[col.key] ?? "—"}</td>`).join("")}</tr>`
    ).join("");

    const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<title>${title}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 11px;
    color: #1a1a2e;
    padding: 20px 28px;
    background: white;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 3px solid #1e3a5f;
    padding-bottom: 10px;
    margin-bottom: 14px;
  }
  .header-left h1 {
    font-size: 18px;
    font-weight: 700;
    color: #1e3a5f;
  }
  .header-left p {
    font-size: 11px;
    color: #666;
    margin-top: 2px;
  }
  .header-right {
    text-align: right;
    font-size: 10px;
    color: #888;
    line-height: 1.6;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 4px;
  }
  thead tr {
    background: #1e3a5f;
    color: white;
  }
  thead th {
    padding: 7px 10px;
    text-align: left;
    font-weight: 600;
    font-size: 10px;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }
  tbody tr:nth-child(even) { background: #f8f9fb; }
  tbody tr:hover { background: #eef2f8; }
  tbody td {
    padding: 6px 10px;
    border-bottom: 1px solid #e8ecf0;
    vertical-align: top;
    max-width: 220px;
    word-wrap: break-word;
  }
  .footer {
    margin-top: 16px;
    padding-top: 10px;
    border-top: 1px solid #ddd;
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: #999;
  }
  .badge {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 20px;
    font-size: 9px;
    font-weight: 600;
    background: #e8f0fe;
    color: #1e3a5f;
  }
  @media print {
    body { padding: 10px 16px; }
    @page { margin: 1cm; size: A4 landscape; }
  }
</style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>ArsipKu &mdash; ${title}</h1>
      ${subtitle ? `<p>${subtitle}</p>` : ""}
    </div>
    <div class="header-right">
      <div>Dicetak: ${now}</div>
      <div>Total data: <strong>${data.length}</strong> baris</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>${columns.map((col) => `<th${col.width ? ` style="width:${col.width}"` : ""}>${col.header}</th>`).join("")}</tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="footer">
    <span>${footer ?? "ArsipKu — Sistem Manajemen Arsip Digital"}</span>
    <span>Halaman 1</span>
  </div>

  <script>
    window.onload = () => { window.print(); window.onafterprint = () => window.close(); };
  </script>
</body>
</html>`;

    const win = window.open("", "_blank", "width=1000,height=700");
    if (!win) {
        alert("Pop-up diblokir! Izinkan pop-up di browser Anda untuk mencetak.");
        return;
    }
    win.document.write(html);
    win.document.close();
};
