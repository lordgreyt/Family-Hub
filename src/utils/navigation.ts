import { Home, CheckSquare, BookOpen, CreditCard, Wallet, Calculator, Star, Settings, Zap, Activity, Bell, SlidersHorizontal, GraduationCap, Luggage, Euro } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { User } from '../services/mockDb';

export interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
}

export const getNavItems = (user: User | null, showPacklist = true, showHolidayBudget = true): NavItem[] => {
  if (!user) return [];

  return [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/tasks', icon: CheckSquare, label: 'Aufgaben' },
    { to: '/notes', icon: BookOpen, label: 'Notizen' },
    { to: '/grades', icon: GraduationCap, label: 'Noten' },
    ...(user.id === 'Falko' ? [
      { to: '/n26', icon: CreditCard, label: 'N26' },
    ] : []),
    ...(!user.isChild ? [
      { to: '/denk-dran', icon: Bell, label: 'Denk dran' },
      ...(showPacklist ? [
        { to: '/packliste', icon: Luggage, label: 'Packliste' },
      ] : []),
      ...(showHolidayBudget ? [
        { to: '/urlaubsbudget', icon: Euro, label: 'Urlaubsbudget' },
      ] : []),
      { to: '/expenses', icon: Wallet, label: 'Ausgaben' },
      { to: '/budget', icon: Calculator, label: 'Budget' },
      { to: '/smart-home', icon: SlidersHorizontal, label: 'Smart Home' },
      { to: '/wallbox', icon: Zap, label: 'Wallbox' }
    ] : []),
    { to: '/rewards', icon: Star, label: 'Sterne' },
    { to: '/e-diary', icon: Activity, label: 'Stimmung' },
    { to: '/setup', icon: Settings, label: 'Setup' },
  ];
};
