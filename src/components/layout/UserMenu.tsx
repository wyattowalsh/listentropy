import { useState, useRef, useEffect } from 'react'
import { LogOut, Settings, User, ChevronDown } from 'lucide-react'
import { useAuthStore } from '@/store/useAuthStore'

interface UserMenuProps {
  onOpenAccountSettings?: () => void
}

export function UserMenu({ onOpenAccountSettings }: UserMenuProps): JSX.Element | null {
  const { status, user, logout } = useAuthStore()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  if (status !== 'authenticated' || !user) {
    return null
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-theme border border-border/60 bg-surface px-3 py-1.5 text-sm text-text transition-colors hover:border-border hover:bg-surface-hover"
        aria-label="Account menu"
      >
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt=""
            className="h-6 w-6 rounded-full object-cover"
          />
        ) : (
          <User className="h-4 w-4 text-text-muted" />
        )}
        <span className="max-w-[120px] truncate">
          {user.displayName || 'Account'}
        </span>
        <ChevronDown className={`h-3 w-3 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-theme border border-border/80 bg-surface shadow-lg">
          <div className="border-b border-border/60 px-3 py-2">
            <p className="truncate text-sm font-medium text-text">{user.displayName}</p>
            <p className="truncate text-xs text-text-muted">{user.email}</p>
          </div>
          <div className="py-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onOpenAccountSettings?.()
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-text transition-colors hover:bg-surface-hover"
            >
              <Settings className="h-4 w-4" />
              Account Settings
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                void logout()
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-negative transition-colors hover:bg-surface-hover"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
