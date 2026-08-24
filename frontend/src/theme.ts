export const Colors = {
  primary: '#7B1D3C',
  primaryDark: '#541528',
  primaryContainer: '#F9E4EC',
  primaryLight: '#AD4D6A',
  secondary: '#C9963A',
  secondaryContainer: '#FFF3DC',
  success: '#2D7A4F',
  successContainer: '#E6F4ED',
  warning: '#B45309',
  warningContainer: '#FFF3DC',
  error: '#B91C1C',
  errorContainer: '#FDE8E8',
  surface: '#FFFFFF',
  surfaceVariant: '#FDF3F6',
  background: '#F8F4F5',
  outline: '#CCBEC2',
  outlineVariant: '#EEE6E9',
  onSurface: '#1A1A1A',
  onSurfaceVariant: '#5A4A50',
  muted: '#9E9E9E',
};

export const eventTypeColor = (type: string): string => {
  switch ((type || '').toLowerCase()) {
    case 'wedding': return '#7B1D3C';
    case 'reception': return '#C9963A';
    case 'engagement': return '#2D7A4F';
    case 'birthday': return '#1565C0';
    case 'corporate': return '#5A189A';
    default: return '#6B7280';
  }
};

export const eventTypeIcon = (type: string): string => {
  switch ((type || '').toLowerCase()) {
    case 'wedding': return 'heart';
    case 'reception': return 'sparkles';
    case 'engagement': return 'diamond';
    case 'birthday': return 'gift';
    case 'corporate': return 'briefcase';
    default: return 'calendar';
  }
};

export const formatINR = (v: number): string => {
  const n = Math.round(v || 0);
  return n.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,');
};

// Compact INR for KPI cards (₹1.5L, ₹50K)
export const formatINRCompact = (v: number): string => {
  const n = Math.round(v || 0);
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(n % 10000000 === 0 ? 0 : 1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(n % 100000 === 0 ? 0 : 1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return `₹${n}`;
};

// Full form with ₹ prefix and /- suffix, e.g. ₹3,80,000/-
export const formatINRFull = (v: number): string => `₹${formatINR(v)}/-`;

// LOCAL YYYY-MM-DD (never converts to UTC — avoids off-by-one for IST/timezones east of UTC).
export const toLocalISODate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Parse "YYYY-MM-DD" into a local Date at midnight (avoids UTC parsing).
export const parseLocalISODate = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map((v) => parseInt(v, 10));
  return new Date(y, (m || 1) - 1, d || 1);
};

// Whole-day difference (event - today) using local calendar days.
export const daysUntil = (iso: string): number => {
  const t = new Date();
  const today0 = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  const ev = parseLocalISODate(iso);
  return Math.round((ev.getTime() - today0.getTime()) / 86400000);
};

export const formatDate = (iso: string): string => {
  const d = new Date(iso);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

export const formatFullDate = (d: Date): string => {
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
};
