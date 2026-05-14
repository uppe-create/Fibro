import React, { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { NotificationBellButton } from '@/components/notifications/NotificationBellButton';
import { NotificationCard } from '@/components/notifications/NotificationCard';
import { useNotifications } from '@/components/notifications/useNotifications';
import type { NotificationAction } from '@/components/notifications/notificationRules';

export function Notifications() {
  const { registrations, fetchRegistrations, currentUser, lastBackupDate, setActiveTab } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'attendant') && registrations.length === 0) {
      void fetchRegistrations();
    }
  }, [currentUser, registrations.length, fetchRegistrations]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { sections, unreadCount } = useNotifications({ registrations, currentUser, lastBackupDate });

  const handleAction = async (action: NotificationAction) => {
    if (action.kind === 'link') {
      window.open(action.href, '_blank', 'noopener,noreferrer');
      setIsOpen(false);
      return;
    }

    if (action.kind === 'navigate') {
      if (action.registrationId) sessionStorage.setItem('cipf_focus_registration_id', action.registrationId);
      if (action.search) sessionStorage.setItem('cipf_people_search', action.search);
      setActiveTab(action.tab);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={popoverRef}>
      <NotificationBellButton isOpen={isOpen} unreadCount={unreadCount} onClick={() => setIsOpen((open) => !open)} />

      {isOpen ? (
        <div className="fixed inset-x-3 top-20 z-[90] max-h-[calc(100vh-6rem)] overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl animate-in fade-in slide-in-from-top-2 xl:absolute xl:right-0 xl:top-full xl:left-auto xl:mt-2 xl:max-h-none xl:w-96 xl:max-w-none">
          <div className="p-4 bg-gray-50/80 border-b border-gray-100 flex justify-between items-center">
            <h3 className="font-semibold text-[#1D1D1F]">Notificações</h3>
            <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
              {unreadCount} alertas
            </span>
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {sections.length === 0 ? (
              <div className="p-8 text-center text-gray-500 flex flex-col items-center">
                <Bell className="h-8 w-8 text-gray-300 mb-2" />
                <p className="text-sm">Nenhuma notificação no momento.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {sections.map((section) => (
                  <NotificationCard key={section.id} section={section} onAction={handleAction} />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
