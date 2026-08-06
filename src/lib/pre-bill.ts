export interface PreBillLine {
  name: string;
  quantity: number;
  total: number;
}

export interface PreBillData {
  tenantName: string;
  tabLabel: string;
  lines: PreBillLine[];
  subtotal: number;
  servicePct: number;
  service: number;
  total: number;
  people: number;
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Abre uma janela com a pré-conta (não fiscal) formatada para impressora térmica 80mm. */
export function printPreBill(data: PreBillData) {
  const rows = data.lines
    .map(
      (l) =>
        `<tr><td>${l.quantity}x ${escapeHtml(l.name)}</td><td class="r">${brl(l.total)}</td></tr>`
    )
    .join('');

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
<title>Pré-conta · ${escapeHtml(data.tabLabel)}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  body { font-family: "Courier New", monospace; font-size: 12px; width: 72mm; margin: 0 auto; color: #000; }
  h1 { font-size: 14px; text-align: center; margin: 0 0 2px; }
  .sub { text-align: center; font-size: 11px; margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 1px 0; vertical-align: top; }
  .r { text-align: right; white-space: nowrap; }
  hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
  .tot { font-weight: bold; font-size: 13px; }
  .foot { text-align: center; font-size: 10px; margin-top: 8px; }
</style></head><body>
<h1>${escapeHtml(data.tenantName)}</h1>
<div class="sub">${escapeHtml(data.tabLabel)}<br/>${new Date().toLocaleString('pt-BR')}</div>
<hr/>
<table>${rows}</table>
<hr/>
<table>
  <tr><td>Subtotal</td><td class="r">${brl(data.subtotal)}</td></tr>
  <tr><td>Serviço (${data.servicePct}%)</td><td class="r">${brl(data.service)}</td></tr>
  <tr class="tot"><td>TOTAL</td><td class="r">${brl(data.total)}</td></tr>
  ${data.people > 1 ? `<tr><td>Por pessoa (${data.people})</td><td class="r">${brl(data.total / data.people)}</td></tr>` : ''}
</table>
<div class="foot">DOCUMENTO SEM VALOR FISCAL<br/>Conferência de consumo</div>
<script>window.onload = function(){ window.print(); }<\/script>
</body></html>`;

  const win = window.open('', '_blank', 'width=380,height=640');
  if (!win) return;
  win.document.write(html);
  win.document.close();
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string)
  );
}
