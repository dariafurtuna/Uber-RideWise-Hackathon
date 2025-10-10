// Simple className utility for combining classes
export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}