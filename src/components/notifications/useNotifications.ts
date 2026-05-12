import type { AppUser, CIPFRegistration } from '@/store/useAppStore';
import { buildNotificationSections } from './notificationRules';

type UseNotificationsParams = {
  registrations: CIPFRegistration[];
  currentUser: AppUser | null;
  lastBackupDate?: number | null;
};

export function useNotifications({ registrations, currentUser, lastBackupDate }: UseNotificationsParams) {
  return buildNotificationSections({ registrations, currentUser, lastBackupDate });
}
