import { Home, CheckSquare, BookOpen, Utensils, CreditCard, Wallet, Calculator, Star, Settings } from 'lucide-react';
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
    ...(user.id === 'Falko' ? [
      { to: '/n26', icon: CreditCard, label: 'N26' }
    ] : []),
    ...(!user.isChild ? [
      { to: '/expenses', icon: Wallet, label: 'Ausgaben' },
      { to: '/budget', icon: Calculator, label: 'Budget' }
    ] : []),
    { to: '/rewards', icon: Star, label: 'Sterne' },
    { to: '/setup', icon: Settings, label: 'Setup' },
  ];
};
