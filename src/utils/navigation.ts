import { Home, CheckSquare, BookOpen, Utensils, ShoppingCart, CreditCard, Wallet, Calculator, Star, Settings, Zap, Activity, Bell, FileText } from 'lucide-react';
import type { User } from '../services/mockDb';

export interface NavItem {
  to: string;
  icon: any;
  label: string;
}

export const getNavItems = (user: User | null): NavItem[] => {
  if (!user) return [];

  return [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/tasks', icon: CheckSquare, label: 'Aufgaben' },
    { to: '/notes', icon: BookOpen, label: 'Notizen' },
    { to: '/meals', icon: Utensils, label: 'Mahlzeit' },
    { to: '/pantry', icon: ShoppingCart, label: 'Vorrat' },
    ...(user.id === 'Falko' ? [
      { to: '/n26', icon: CreditCard, label: 'N26' },
      { to: '/paperless', icon: FileText, label: 'Paperless' },
    ] : []),
    ...(!user.isChild ? [
      { to: '/denk-dran', icon: Bell, label: 'Denk dran' },
      { to: '/expenses', icon: Wallet, label: 'Ausgaben' },
      { to: '/budget', icon: Calculator, label: 'Budget' },
      { to: '/wallbox', icon: Zap, label: 'Wallbox' }
    ] : []),
    { to: '/rewards', icon: Star, label: 'Sterne' },
    { to: '/e-diary', icon: Activity, label: 'Stimmungskalender' },
    { to: '/setup', icon: Settings, label: 'Setup' },
  ];
};
