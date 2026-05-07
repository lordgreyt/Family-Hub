import { AlertTriangle, Calendar, Clock, Star, Heart, ShoppingCart, Home, BookOpen, Wrench, Dumbbell } from 'lucide-react';

export interface TaskIconDef {
  name: string;
  label: string;
  color: string;
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
}

export const TASK_ICONS: TaskIconDef[] = [
  { name: '', label: 'Auto', color: '', Icon: AlertTriangle },
  { name: 'AlertTriangle', label: 'Dringend', color: 'var(--color-red)', Icon: AlertTriangle },
  { name: 'Calendar', label: 'Termin', color: 'var(--color-blue)', Icon: Calendar },
  { name: 'Clock', label: 'Zeit', color: 'var(--color-orange)', Icon: Clock },
  { name: 'Star', label: 'Wichtig', color: 'var(--color-yellow)', Icon: Star },
  { name: 'Heart', label: 'Familie', color: 'var(--color-pink)', Icon: Heart },
  { name: 'ShoppingCart', label: 'Einkauf', color: 'var(--color-teal)', Icon: ShoppingCart },
  { name: 'Home', label: 'Haushalt', color: 'var(--color-primary)', Icon: Home },
  { name: 'BookOpen', label: 'Lernen', color: '#7C3AED', Icon: BookOpen },
  { name: 'Wrench', label: 'Reparatur', color: '#6B7280', Icon: Wrench },
  { name: 'Dumbbell', label: 'Sport', color: 'var(--color-green)', Icon: Dumbbell },
];

/** Find icon definition by name, or return undefined */
export function getTaskIcon(name?: string): TaskIconDef | undefined {
  if (!name) return undefined;
  return TASK_ICONS.find(i => i.name === name);
}
