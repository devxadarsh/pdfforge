export function hexToRgba(color: string, alpha: number): string {
  if (!color) return `rgba(37, 99, 235, ${alpha})`;
  if (color.startsWith('rgba')) {
    return color.replace(/[\d\.]+\)$/g, `${alpha})`);
  }
  if (color.startsWith('rgb')) {
    return color.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
  }
  let c = color.replace('#', '');
  if (c.length === 3) {
    c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  }
  const r = parseInt(c.substring(0, 2), 16) || 0;
  const g = parseInt(c.substring(2, 4), 16) || 0;
  const b = parseInt(c.substring(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function adjustColor(color: string, amount: number): string {
  if (!color || !color.startsWith('#')) return color || '#2563eb';
  let c = color.replace('#', '');
  if (c.length === 3) {
    c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  }
  let r = parseInt(c.substring(0, 2), 16) || 0;
  let g = parseInt(c.substring(2, 4), 16) || 0;
  let b = parseInt(c.substring(4, 6), 16) || 0;

  r = Math.min(255, Math.max(0, Math.round(r + (amount * 255) / 100)));
  g = Math.min(255, Math.max(0, Math.round(g + (amount * 255) / 100)));
  b = Math.min(255, Math.max(0, Math.round(b + (amount * 255) / 100)));

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
