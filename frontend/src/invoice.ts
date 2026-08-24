import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { Booking, Payment } from './api';

const sanitizeName = (s: string) => (s || '').replace(/[^a-zA-Z0-9-_\s]/g, '').trim().replace(/\s+/g, '_') || 'file';

async function renameForShare(uri: string, filename: string): Promise<string> {
  try {
    const dir = FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
    if (!dir) return uri;
    const target = `${dir}${filename}`;
    // Overwrite if it already exists.
    try { await FileSystem.deleteAsync(target, { idempotent: true }); } catch {}
    await FileSystem.copyAsync({ from: uri, to: target });
    return target;
  } catch (e) {
    console.warn('renameForShare failed', e);
    return uri;
  }
}

const DEFAULT_TERMS = `RENTAL TERMS & CONDITIONS

1. EXTRA CHARGES (Not Included in Standard Rent)
The following items are billed separately if used: Generator, Cooler, Chair Covers, Speakers, Vegetarian Dining Hall.

2. SECURITY DEPOSIT FOR EQUIPMENT
A refundable deposit of ₹25,000 must be paid in advance if any equipment or appliances are taken or used from the premises. This will be refunded after the event, provided there is no damage, loss, or missing items.

3. RENTAL TIMINGS
Morning Shift: 5:00 AM – 5:00 PM
Night Shift: 5:00 PM – 12:00 Midnight
Note: Please adhere to the above timings. Any extensions must be approved in advance.

4. RULES & DAMAGE LIABILITY
Management will inspect the venue and equipment before and after the event. The client is fully responsible for any damage or loss caused to the venue, furniture, or appliances during the rental period.

5. Personal Belongings & Valuables
Guests must take care of their own belongings at all times. Management is not responsible for any loss, theft, or damage to personal items like cash, gold, mobile phones, laptops, cameras, tablet or other valuable items. Guests are advised to keep their valuables secure, Strictly speaking, management is not responsible.`;

const fmt = (v: number) => {
  const n = Math.round(v || 0);
  return n.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,') + '/-';
};

const formatFull = (iso: string) => {
  const d = new Date(iso);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

const formatShort = (iso: string) => {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
};

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mn = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()} ${hh}:${mn}`;
};

const paymentsSectionHtml = (payments: Payment[] | undefined, advance: number) => {
  const rows: string[] = [];
  if (payments && payments.length > 0) {
    payments.forEach((p, i) => {
      rows.push(`<tr><td>#${i + 1}</td><td>${formatDateTime(p.date)}</td><td class="amount">₹${fmt(p.amount)}</td></tr>`);
    });
  } else if (advance > 0) {
    rows.push(`<tr><td>#1</td><td>Initial advance</td><td class="amount">₹${fmt(advance)}</td></tr>`);
  } else {
    rows.push(`<tr><td colspan="3" style="text-align:center;color:#9e9e9e">No payments recorded yet.</td></tr>`);
  }
  return `<div class="section"><h2>Payment History</h2>
    <table>
      <thead><tr><th>#</th><th>Date</th><th class="amount">Amount</th></tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table></div>`;
};

export function buildInvoiceHtml(booking: Booking, opts?: { hallName?: string; hallAddress?: string; ownerName?: string; ownerPhone?: string }) {
  const total = booking.totalAmount || 0;
  const advance = booking.advancePaid || 0;
  const balance = total - advance;
  const now = new Date();
  const invoiceDate = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
  const termsHtml = DEFAULT_TERMS.split('\n').filter((l) => l.trim()).map((l) => `<li>${l.trim()}</li>`).join('\n');
  const hallName = opts?.hallName || 'MAKEMYEVENTS CONVENTION HALL';
  const hallAddress = opts?.hallAddress || '';
  const ownerName = opts?.ownerName || '';
  const ownerPhone = opts?.ownerPhone || '';
  const notes = booking.notes || '';

  const ownerLine = [ownerName, ownerPhone ? `📞 ${ownerPhone}` : ''].filter(Boolean).join(' • ');
  const headerSubHtml = [
    hallAddress ? `<span>📍 ${hallAddress}</span>` : '',
    ownerLine ? `<span>${ownerLine}</span>` : '',
  ].filter(Boolean).join('<br/>');

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Invoice ${booking.id}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f5f5f5;color:#1a1a1a;padding:20px}
  .page{max-width:700px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)}
  .header{background:linear-gradient(135deg,#7B1D3C,#541528);color:#fff;padding:32px 36px}
  .header h1{font-size:24px;font-weight:700;letter-spacing:1px}
  .header p{font-size:12px;opacity:0.8;margin-top:4px}
  .header .hall-sub{font-size:11px;opacity:0.9;margin-top:8px}
  .meta{display:flex;justify-content:space-between;padding:22px 36px;background:#fafafa;border-bottom:1px solid #eee}
  .meta label{font-size:10px;color:#9e9e9e;text-transform:uppercase;letter-spacing:.5px}
  .meta p{font-size:13px;font-weight:600;margin-top:2px}
  .badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;text-transform:capitalize}
  .confirmed{background:#e6f4ed;color:#2d7a4f}.pending{background:#fff3dc;color:#b45309}
  .completed{background:#f0f0f0;color:#6b7280}.cancelled{background:#fde8e8;color:#b91c1c}
  .section{padding:22px 36px;border-bottom:1px solid #eee}
  .section h2{font-size:12px;font-weight:700;color:#7B1D3C;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  .item label{font-size:10px;color:#9e9e9e}
  .item p{font-size:13px;font-weight:600;margin-top:2px}
  table{width:100%;border-collapse:collapse}
  th{background:#f5f5f5;padding:10px 12px;text-align:left;font-size:11px;color:#9e9e9e;text-transform:uppercase;letter-spacing:.5px}
  td{padding:11px 12px;font-size:13px;border-bottom:1px solid #f0f0f0}
  .amount{text-align:right;font-weight:600}
  .total td{font-weight:700;font-size:14px;border-top:2px solid #eee;border-bottom:none}
  .balance td{color:${balance > 0 ? '#b45309' : '#2d7a4f'}}
  .notes{background:#fafafa;border-radius:8px;padding:12px;font-size:12px;color:#5a4a50;line-height:1.6}
  .terms{list-style:none;padding:0;margin:0}
  .terms li{font-size:11px;color:#5a4a50;line-height:1.7;padding:3px 0;border-bottom:1px dashed #f0f0f0}
  .footer{padding:18px 36px;text-align:center;font-size:11px;color:#9e9e9e;background:#fafafa}
</style></head>
<body>
<div class="page">
  <div class="header"><h1>${hallName}</h1>${headerSubHtml ? `<p class="hall-sub">${headerSubHtml}</p>` : ''}<p>Tax Invoice / Receipt</p></div>
  <div class="meta">
    <div><label>Invoice No.</label><p>${booking.id}</p></div>
    <div><label>Invoice Date</label><p>${invoiceDate}</p></div>
    <div><label>Status</label><p><span class="badge ${booking.status}">${booking.status}</span></p></div>
  </div>
  <div class="section"><h2>Client Details</h2>
    <div class="grid">
      <div class="item"><label>Client Name</label><p>${booking.clientName}</p></div>
      <div class="item"><label>Phone</label><p>+91 ${booking.phone || 'N/A'}</p></div>
    </div></div>
  <div class="section"><h2>Event Details</h2>
    <div class="grid">
      <div class="item"><label>Event Type</label><p>${booking.eventType}</p></div>
      <div class="item"><label>Event Date</label><p>${formatFull(booking.eventDate)}</p></div>
      <div class="item"><label>Function Time</label><p>${booking.functionTime}</p></div>
      <div class="item"><label>Guest Count</label><p>${booking.guestCount} guests</p></div>
    </div></div>
  <div class="section"><h2>Payment Summary</h2>
    <table>
      <thead><tr><th>Description</th><th class="amount">Amount (₹)</th></tr></thead>
      <tbody>
        ${(booking.charges && booking.charges.length > 0)
          ? booking.charges.map((c) => `<tr><td>${c.label}</td><td class="amount">₹${fmt(c.amount)}</td></tr>`).join('')
          : `<tr><td>Hall Booking — ${booking.eventType} (${booking.guestCount} guests)</td><td class="amount">₹${fmt(total)}</td></tr>`
        }
        <tr class="total"><td>Total Amount</td><td class="amount">₹${fmt(total)}</td></tr>
        <tr><td>Advance Paid</td><td class="amount" style="color:#2d7a4f">- ₹${fmt(advance)}</td></tr>
        <tr class="balance"><td>${balance > 0 ? 'Balance Due' : 'Fully Paid ✓'}</td><td class="amount">₹${fmt(balance)}</td></tr>
      </tbody>
    </table></div>
  ${paymentsSectionHtml(booking.payments, advance)}
  ${notes ? `<div class="section"><h2>Notes</h2><div class="notes">${notes}</div></div>` : ''}
  <div class="section"><h2>Terms &amp; Conditions</h2><ul class="terms">${termsHtml}</ul></div>
  <div class="footer"><p>Thank you for choosing ${hallName}</p><p style="margin-top:4px">Computer-generated invoice.</p></div>
</div></body></html>`;
}

export async function shareInvoice(booking: Booking, opts?: { hallName?: string; hallAddress?: string; ownerName?: string; ownerPhone?: string }) {
  const html = buildInvoiceHtml(booking, opts);
  const filename = `${sanitizeName(booking.clientName)}_${sanitizeName(booking.id)}.pdf`;
  if (Platform.OS === 'web') {
    const win = window.open('', '_blank');
    if (win) {
      win.document.title = filename.replace('.pdf', '');
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 500);
    }
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  const finalUri = await renameForShare(uri, filename);
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(finalUri, {
      mimeType: 'application/pdf',
      dialogTitle: filename,
      UTI: 'com.adobe.pdf',
    });
  }
}

// ---------------- Custom date-range report ----------------

export function buildReportHtml(bookings: Booking[], startISO: string, endISO: string, opts?: { hallName?: string; hallAddress?: string; ownerName?: string; ownerPhone?: string }) {
  const hallName = opts?.hallName || 'MAKEMYEVENTS CONVENTION HALL';
  const hallAddress = opts?.hallAddress || '';
  const ownerName = opts?.ownerName || '';
  const ownerPhone = opts?.ownerPhone || '';
  const ownerBits = [ownerName, ownerPhone ? `📞 ${ownerPhone}` : ''].filter(Boolean).join(' • ');
  const headerSubBits = [
    hallAddress ? `📍 ${hallAddress}` : '',
    ownerBits,
  ].filter(Boolean).join(' | ');
  const now = new Date();
  const generatedOn = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;

  // filter + sort by event date
  const filtered = bookings
    .filter((b) => b.eventDate >= startISO && b.eventDate <= endISO)
    .slice()
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate));

  const totalRevenue = filtered.reduce((s, b) => s + (b.totalAmount || 0), 0);
  const totalAdvance = filtered.reduce((s, b) => s + (b.advancePaid || 0), 0);
  const totalBalance = totalRevenue - totalAdvance;

  const bookingRows = filtered.map((b, i) => {
    const balance = (b.totalAmount || 0) - (b.advancePaid || 0);
    const payments = (b.payments || []);
    const paymentList = payments.length > 0
      ? payments.map((p) => `${formatDateTime(p.date)} — ₹${fmt(p.amount)}`).join('<br/>')
      : (b.advancePaid > 0 ? `Initial advance — ₹${fmt(b.advancePaid)}` : '<span style="color:#9e9e9e">—</span>');
    return `<tr>
      <td>${i + 1}</td>
      <td><b>${b.id}</b><br/><span style="color:#9e9e9e;font-size:10px">${b.eventType} • ${b.functionTime}</span></td>
      <td>${b.clientName}<br/><span style="color:#9e9e9e;font-size:10px">+91 ${b.phone}</span></td>
      <td>${formatShort(b.eventDate)}</td>
      <td>${b.guestCount}</td>
      <td class="amount">₹${fmt(b.totalAmount)}</td>
      <td class="amount" style="color:#2d7a4f">₹${fmt(b.advancePaid)}</td>
      <td class="amount" style="color:${balance > 0 ? '#b45309' : '#2d7a4f'}">₹${fmt(balance)}</td>
      <td><span class="badge ${b.status}">${b.status}</span></td>
      <td style="font-size:10px">${paymentList}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Booking Report ${startISO} — ${endISO}</title>
<style>
  @page { size: A4 landscape; margin: 14mm; }
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#1a1a1a;padding:16px}
  .page{background:#fff}
  .header{background:linear-gradient(135deg,#7B1D3C,#541528);color:#fff;padding:22px 24px;border-radius:12px 12px 0 0}
  .header h1{font-size:22px;font-weight:800;letter-spacing:0.5px}
  .header p{font-size:12px;opacity:0.8;margin-top:6px}
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:16px 24px;background:#fafafa}
  .kpi{background:#fff;border:1px solid #eee;border-radius:10px;padding:12px}
  .kpi label{font-size:10px;color:#9e9e9e;text-transform:uppercase;letter-spacing:.4px}
  .kpi p{font-size:16px;font-weight:800;margin-top:4px}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  th{background:#7B1D3C;color:#fff;padding:9px 8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.4px}
  td{padding:10px 8px;font-size:11px;border-bottom:1px solid #f0f0f0;vertical-align:top}
  .amount{text-align:right;font-weight:700}
  .badge{display:inline-block;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;text-transform:capitalize}
  .confirmed{background:#e6f4ed;color:#2d7a4f}.pending{background:#fff3dc;color:#b45309}
  .completed{background:#f0f0f0;color:#6b7280}.cancelled{background:#fde8e8;color:#b91c1c}
  .footer{padding:12px 24px;font-size:10px;color:#9e9e9e;text-align:center}
  tfoot td{font-weight:800;background:#fafafa;border-top:2px solid #7B1D3C}
</style></head>
<body>
<div class="page">
  <div class="header">
    <h1>${hallName}</h1>
    ${headerSubBits ? `<p style="font-size:11px;opacity:0.85;margin-top:6px">${headerSubBits}</p>` : ''}
    <p>Booking Report • ${formatShort(startISO)} — ${formatShort(endISO)} • Generated on ${generatedOn}</p>
  </div>
  <div class="kpis">
    <div class="kpi"><label>Total Bookings</label><p>${filtered.length}</p></div>
    <div class="kpi"><label>Total Revenue</label><p>₹${fmt(totalRevenue)}</p></div>
    <div class="kpi"><label>Advance Received</label><p style="color:#2d7a4f">₹${fmt(totalAdvance)}</p></div>
    <div class="kpi"><label>Pending Balance</label><p style="color:${totalBalance > 0 ? '#b45309' : '#2d7a4f'}">₹${fmt(totalBalance)}</p></div>
  </div>
  ${filtered.length === 0 ? '<div style="padding:36px;text-align:center;color:#9e9e9e">No bookings in this date range.</div>' : `<table>
    <thead><tr>
      <th>#</th><th>Booking</th><th>Client</th><th>Event Date</th><th>Guests</th>
      <th class="amount">Total</th><th class="amount">Advance</th><th class="amount">Balance</th>
      <th>Status</th><th>Payments</th>
    </tr></thead>
    <tbody>${bookingRows}</tbody>
    <tfoot><tr>
      <td colspan="5" style="text-align:right">Grand Total</td>
      <td class="amount">₹${fmt(totalRevenue)}</td>
      <td class="amount" style="color:#2d7a4f">₹${fmt(totalAdvance)}</td>
      <td class="amount" style="color:${totalBalance > 0 ? '#b45309' : '#2d7a4f'}">₹${fmt(totalBalance)}</td>
      <td colspan="2"></td>
    </tr></tfoot>
  </table>`}
  <div class="footer">Report from ${hallName} — MakeMyEvents App</div>
</div>
</body></html>`;
}

export async function shareReport(bookings: Booking[], startISO: string, endISO: string, opts?: { hallName?: string; hallAddress?: string; ownerName?: string; ownerPhone?: string }) {
  const html = buildReportHtml(bookings, startISO, endISO, opts);
  const filename = `Report_${startISO}_to_${endISO}.pdf`;
  if (Platform.OS === 'web') {
    const win = window.open('', '_blank');
    if (win) { win.document.title = filename.replace('.pdf', ''); win.document.write(html); win.document.close(); setTimeout(() => win.print(), 500); }
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  const finalUri = await renameForShare(uri, filename);
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(finalUri, {
      mimeType: 'application/pdf',
      dialogTitle: filename,
      UTI: 'com.adobe.pdf',
    });
  }
}

// ---------------- Financial P&L report ----------------

export type FinancialSummary = {
  income: number;
  expenditureByCategory: { label: string; amount: number }[];
  totalExpenditure: number;
  netProfit: number;
  bookingCount: number;
};

const HALL_RENT_LABEL = 'Hall Rent';

export function computeFinancialSummary(bookings: Booking[], startISO: string, endISO: string): FinancialSummary {
  const filtered = bookings.filter((b) => b.eventDate >= startISO && b.eventDate <= endISO && b.status !== 'cancelled');
  let income = 0;
  const catMap: Record<string, number> = {};
  for (const b of filtered) {
    const charges = b.charges || [];
    if (charges.length === 0) {
      // Legacy bookings without breakdown: treat full total as Hall Rent income
      income += b.totalAmount || 0;
      continue;
    }
    for (const c of charges) {
      if ((c.label || '').trim().toLowerCase() === HALL_RENT_LABEL.toLowerCase()) {
        income += c.amount || 0;
      } else {
        const key = (c.label || 'Other').trim() || 'Other';
        catMap[key] = (catMap[key] || 0) + (c.amount || 0);
      }
    }
  }
  const expenditureByCategory = Object.entries(catMap)
    .map(([label, amount]) => ({ label, amount }))
    .sort((a, b) => b.amount - a.amount);
  const totalExpenditure = expenditureByCategory.reduce((s, e) => s + e.amount, 0);
  return {
    income,
    expenditureByCategory,
    totalExpenditure,
    netProfit: income - totalExpenditure,
    bookingCount: filtered.length,
  };
}

export function buildFinancialReportHtml(bookings: Booking[], startISO: string, endISO: string, opts?: { hallName?: string; hallAddress?: string; ownerName?: string; ownerPhone?: string }) {
  const hallName = opts?.hallName || 'MAKEMYEVENTS CONVENTION HALL';
  const hallAddress = opts?.hallAddress || '';
  const ownerName = opts?.ownerName || '';
  const ownerPhone = opts?.ownerPhone || '';
  const ownerBits = [ownerName, ownerPhone ? `📞 ${ownerPhone}` : ''].filter(Boolean).join(' • ');
  const headerSubBits = [hallAddress ? `📍 ${hallAddress}` : '', ownerBits].filter(Boolean).join(' | ');
  const now = new Date();
  const generatedOn = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;

  const s = computeFinancialSummary(bookings, startISO, endISO);
  const isProfit = s.netProfit >= 0;

  const expRows = s.expenditureByCategory.length > 0
    ? s.expenditureByCategory.map((e, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${e.label}</td>
        <td class="amount">₹${fmt(e.amount)}</td>
      </tr>`).join('')
    : `<tr><td colspan="3" style="text-align:center;color:#9e9e9e">No expenditure recorded in this period.</td></tr>`;

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Financial Report ${startISO} — ${endISO}</title>
<style>
  @page { size: A4; margin: 14mm; }
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#1a1a1a;padding:16px;background:#fff}
  .page{max-width:760px;margin:0 auto}
  .header{background:linear-gradient(135deg,#7B1D3C,#541528);color:#fff;padding:22px 24px;border-radius:12px 12px 0 0}
  .header h1{font-size:22px;font-weight:800;letter-spacing:0.5px}
  .header p{font-size:12px;opacity:0.85;margin-top:6px}
  .kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:16px 24px;background:#fafafa;border:1px solid #eee;border-top:none}
  .kpi{background:#fff;border:1px solid #eee;border-radius:10px;padding:12px}
  .kpi label{font-size:10px;color:#9e9e9e;text-transform:uppercase;letter-spacing:.4px}
  .kpi p{font-size:16px;font-weight:800;margin-top:4px}
  .section{padding:18px 24px;border:1px solid #eee;border-top:none;background:#fff}
  .section h2{font-size:12px;font-weight:800;color:#7B1D3C;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px}
  table{width:100%;border-collapse:collapse}
  th{background:#f5f5f5;padding:10px 12px;text-align:left;font-size:11px;color:#5a4a50;text-transform:uppercase;letter-spacing:.5px}
  td{padding:10px 12px;font-size:12px;border-bottom:1px solid #f0f0f0}
  .amount{text-align:right;font-weight:700}
  tfoot td{font-weight:800;background:#fafafa;border-top:2px solid #7B1D3C}
  .netcard{margin-top:14px;border-radius:12px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;
    background:${isProfit ? 'linear-gradient(135deg,#e6f4ed,#c9e8d5)' : 'linear-gradient(135deg,#fde8e8,#f9d1d1)'};
    border:1px solid ${isProfit ? '#2d7a4f' : '#b91c1c'}}
  .netcard label{font-size:11px;color:#5a4a50;text-transform:uppercase;letter-spacing:.5px}
  .netcard .val{font-size:22px;font-weight:900;color:${isProfit ? '#2d7a4f' : '#b91c1c'}}
  .footer{padding:14px 24px;font-size:10px;color:#9e9e9e;text-align:center;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px;background:#fafafa}
</style></head>
<body>
<div class="page">
  <div class="header">
    <h1>${hallName}</h1>
    ${headerSubBits ? `<p>${headerSubBits}</p>` : ''}
    <p>Financial Report • ${formatShort(startISO)} — ${formatShort(endISO)} • Generated on ${generatedOn}</p>
  </div>
  <div class="kpis">
    <div class="kpi"><label>Bookings</label><p>${s.bookingCount}</p></div>
    <div class="kpi"><label>Total Income (Hall Rent)</label><p style="color:#2d7a4f">₹${fmt(s.income)}</p></div>
    <div class="kpi"><label>Total Expenditure</label><p style="color:#b45309">₹${fmt(s.totalExpenditure)}</p></div>
  </div>

  <div class="section">
    <h2>Income</h2>
    <table>
      <thead><tr><th>Description</th><th class="amount">Amount (₹)</th></tr></thead>
      <tbody>
        <tr><td>Total Hall Rent Collected (${s.bookingCount} bookings)</td><td class="amount" style="color:#2d7a4f">₹${fmt(s.income)}</td></tr>
      </tbody>
      <tfoot><tr><td>Total Income</td><td class="amount" style="color:#2d7a4f">₹${fmt(s.income)}</td></tr></tfoot>
    </table>
  </div>

  <div class="section">
    <h2>Expenditure (by Category)</h2>
    <table>
      <thead><tr><th style="width:40px">#</th><th>Category</th><th class="amount">Amount (₹)</th></tr></thead>
      <tbody>${expRows}</tbody>
      <tfoot><tr><td colspan="2">Total Expenditure</td><td class="amount" style="color:#b45309">₹${fmt(s.totalExpenditure)}</td></tr></tfoot>
    </table>
  </div>

  <div class="section" style="border-radius:0 0 12px 12px;padding-top:8px">
    <div class="netcard">
      <div>
        <label>${isProfit ? 'Net Profit' : 'Net Loss'}</label>
        <p style="font-size:11px;color:#5a4a50;margin-top:4px">Income − Expenditure</p>
      </div>
      <div class="val">${isProfit ? '' : '- '}₹${fmt(Math.abs(s.netProfit))}</div>
    </div>
  </div>

  <div class="footer">Financial report from ${hallName} — MakeMyEvents App</div>
</div>
</body></html>`;
}

export async function shareFinancialReport(bookings: Booking[], startISO: string, endISO: string, opts?: { hallName?: string; hallAddress?: string; ownerName?: string; ownerPhone?: string }) {
  const html = buildFinancialReportHtml(bookings, startISO, endISO, opts);
  const filename = `Financial_Report_${startISO}_to_${endISO}.pdf`;
  if (Platform.OS === 'web') {
    const win = window.open('', '_blank');
    if (win) { win.document.title = filename.replace('.pdf', ''); win.document.write(html); win.document.close(); setTimeout(() => win.print(), 500); }
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  const finalUri = await renameForShare(uri, filename);
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(finalUri, {
      mimeType: 'application/pdf',
      dialogTitle: filename,
      UTI: 'com.adobe.pdf',
    });
  }
}
