import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { Booking } from './api';

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

export function buildInvoiceHtml(booking: Booking, opts?: { ownerName?: string; hallName?: string }) {
  const total = booking.totalAmount || 0;
  const advance = booking.advancePaid || 0;
  const balance = total - advance;
  const now = new Date();
  const invoiceDate = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
  const termsHtml = DEFAULT_TERMS.split('\n').filter((l) => l.trim()).map((l) => `<li>${l.trim()}</li>`).join('\n');
  const hallName = opts?.hallName || 'MAKEMYEVENTS CONVENTION HALL';
  const notes = booking.notes || '';

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
  <div class="header"><h1>${hallName}</h1><p>Tax Invoice / Receipt</p></div>
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
        <tr><td>Hall Booking — ${booking.eventType} (${booking.guestCount} guests)</td><td class="amount">₹${fmt(total)}</td></tr>
        <tr><td>Advance Paid</td><td class="amount" style="color:#2d7a4f">- ₹${fmt(advance)}</td></tr>
        <tr class="total"><td>Total Amount</td><td class="amount">₹${fmt(total)}</td></tr>
        <tr class="balance"><td>${balance > 0 ? 'Balance Due' : 'Fully Paid ✓'}</td><td class="amount">₹${fmt(balance)}</td></tr>
      </tbody>
    </table></div>
  ${notes ? `<div class="section"><h2>Notes</h2><div class="notes">${notes}</div></div>` : ''}
  <div class="section"><h2>Terms &amp; Conditions</h2><ul class="terms">${termsHtml}</ul></div>
  <div class="footer"><p>Thank you for choosing MakeMyEvents</p><p style="margin-top:4px">Computer-generated invoice. For queries, contact hall management.</p></div>
</div></body></html>`;
}

export async function shareInvoice(booking: Booking, opts?: { hallName?: string }) {
  const html = buildInvoiceHtml(booking, opts);
  if (Platform.OS === 'web') {
    // Web: open printable HTML in a new tab
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 500);
    }
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Invoice ${booking.id}`,
      UTI: 'com.adobe.pdf',
    });
  }
}
