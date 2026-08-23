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
  return '₹' + n.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,') + '/-';
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
