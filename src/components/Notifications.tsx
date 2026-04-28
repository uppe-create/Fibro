import React, { useState, useEffect, useRef } from 'react';
import { Bell, AlertCircle, Clock, Database } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { Button } from '@/components/ui/button';
import { daysUntil, parseBRDate } from '@/lib/date';

export function Notifications() {
  const { registrations, fetchRegistrations, currentUser, lastBackupDate, exportDatabase } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Fetch registrations if they are empty and user is admin/attendant
  useEffect(() => {
    if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'attendant') && registrations.length === 0) {
      fetchRegistrations();
    }
  }, [currentUser, registrations.length, fetchRegistrations]);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Calculate expiring registrations (within 30 days or already expired)
  const expiringRegistrations = registrations.filter(reg => {
    if (!reg.expiryDate) return false;
    const diffDays = daysUntil(reg.expiryDate);
    return diffDays !== null && diffDays <= 30 && reg.status !== 'pending';
  }).sort((a, b) => {
    const aDate = parseBRDate(a.expiryDate);
    const bDate = parseBRDate(b.expiryDate);
    if (!aDate && !bDate) return 0;
    if (!aDate) return 1;
    if (!bDate) return -1;
    return aDate.getTime() - bDate.getTime();
  });

  const needsBackup = currentUser?.role === 'admin' && (!lastBackupDate || (Date.now() - lastBackupDate > 7 * 24 * 60 * 60 * 1000));
  const unreadCount = expiringRegistrations.length + (needsBackup ? 1 : 0);

  return (
    <div className="relative" ref={popoverRef}>
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={() => setIsOpen(!isOpen)}
        className="relative text-[#86868B] hover:text-[#1D1D1F] hover:bg-gray-100 rounded-full transition-colors"
        title="Notificações"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
          <div className="p-4 bg-gray-50/80 border-b border-gray-100 flex justify-between items-center">
            <h3 className="font-semibold text-[#1D1D1F]">Notificações</h3>
            <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
              {unreadCount} alertas
            </span>
          </div>
          
          <div className="max-h-[400px] overflow-y-auto">
            {unreadCount === 0 ? (
              <div className="p-8 text-center text-gray-500 flex flex-col items-center">
                <Bell className="h-8 w-8 text-gray-300 mb-2" />
                <p className="text-sm">Nenhuma notificação no momento.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {needsBackup && (
                  <div className="p-4 bg-blue-50 hover:bg-blue-100 transition-colors flex gap-3 items-start border-b border-blue-100">
                    <div className="mt-0.5 p-2 rounded-full bg-blue-200 text-blue-700">
                      <Database className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-900">Backup Necessário</p>
                      <p className="text-xs text-blue-700 mt-1">
                        Já faz mais de 7 dias desde o último backup do sistema.
                      </p>
                      <Button 
                        size="sm" 
                        className="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 rounded-lg"
                        onClick={() => {
                          exportDatabase();
                          setIsOpen(false);
                        }}
                      >
                        Fazer Backup Agora
                      </Button>
                    </div>
                  </div>
                )}
                
                {expiringRegistrations.map(reg => {
                  const diffDays = daysUntil(reg.expiryDate) ?? 0;
                  
                  const isExpired = diffDays < 0;
                  
                  return (
                    <div key={reg.id} className="p-4 hover:bg-gray-50 transition-colors flex gap-3 items-start">
                      <div className={`mt-0.5 p-2 rounded-full ${isExpired ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                        {isExpired ? <AlertCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#1D1D1F] line-clamp-1">{reg.fullName}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {isExpired 
                            ? <span className="text-red-600 font-medium">Venceu há {Math.abs(diffDays)} dias</span>
                            : diffDays === 0 
                              ? <span className="text-amber-600 font-medium">Vence hoje!</span>
                              : <span className="text-amber-600 font-medium">Vence em {diffDays} dias</span>
                          }
                        </p>
                        <p className="text-xs text-gray-400 mt-1">CPF: {reg.cpf}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
