import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';

type NotificationBellButtonProps = {
  isOpen: boolean;
  unreadCount: number;
  onClick: () => void;
};

export function NotificationBellButton({ isOpen, unreadCount, onClick }: NotificationBellButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      className={`relative rounded-full transition-colors ${
        isOpen
          ? 'bg-[#eef5ff] text-[#005eb8] shadow-inner hover:bg-[#e7f0ff]'
          : 'text-[#071d41] hover:bg-[#f1f5f9] hover:text-[#005eb8]'
      }`}
      title="Notificações"
    >
      <Bell className={`h-5 w-5 ${unreadCount > 0 && !isOpen ? 'notification-bell-attention' : ''}`} />
      {unreadCount > 0 && (
        <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Button>
  );
}
