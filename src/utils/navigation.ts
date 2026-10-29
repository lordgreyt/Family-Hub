import { Home, CheckSquare, CreditCard, Wallet, Calculator, Star, Settings, SlidersHorizontal, GraduationCap, Luggage, Euro, Banknote, Languages } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { User } from '../services/mockDb';

export interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
}

export const getNavItems = (user: User | null, showPacklist = true, showHolidayBudget = true, showTasks = true): NavItem[] => {
  if (!user) return [];

  return [
    { to: '/', icon: Home, label: 'Home' },
    ...(showTasks ? [
      { to: '/tasks', icon: CheckSquare, label: 'Aufgaben' },
    ] : []),
    { to: '/grades', icon: GraduationCap, label: 'Noten' },
    { to: '/vokabeln', icon: Languages, label: 'Vokabeln' },
    ...(user.id === 'Falko' ? [
      { to: '/n26', icon: CreditCard, label: 'N26' },
    ] : []),
    ...(!user.isChild ? [
      ...(showPacklist ? [
        { to: '/packliste', icon: Luggage, label: 'Packliste' },
      ] : []),
      ...(showHolidayBudget ? [
        { to: '/urlaubsbudget', icon: Euro, label: 'Urlaubsbudget' },
      ] : []),
      { to: '/expenses', icon: Wallet, label: 'Ausgaben' },
      { to: '/op-finanzen', icon: Banknote, label: 'OP-Finanzen' },
      { to: '/budget', icon: Calculator, label: 'Budget' },
      { to: '/smart-home', icon: SlidersHorizontal, label: 'Smart Home' },
    ] : []),
    { to: '/rewards', icon: Star, label: 'Sterne' },
    { to: '/setup', icon: Settings, label: 'Setup' },
  ];
};
