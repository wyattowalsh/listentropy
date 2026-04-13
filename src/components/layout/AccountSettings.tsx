import { useState } from 'react'
import { Music2, Trash2, Unlink, Link, X, Shield } from 'lucide-react'
import { useAuthStore } from '@/store/useAuthStore'
import { Button } from '@/components/ui/button'

interface AccountSettingsProps {
  onClose: () => void
}

export function AccountSettings({ onClose }: AccountSettingsProps): JSX.Element {
  const { user, disconnectSpotify, deleteAccount, login } = useAuthStore()
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (!user) {
    return <div />
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-theme border border-border/80 bg-bg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
          <h2 className="font-heading text-lg font-semibold text-text">Account Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-theme p-1 text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
            aria-label="Close settings"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 px-6 py-5">
          <div className="flex items-center gap-4">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface text-text-muted">
                <Music2 className="h-8 w-8" />
              </div>
            )}
            <div>
              <p className="text-lg font-medium text-text">{user.displayName || 'Spotify User'}</p>
              <p className="text-sm text-text-muted">{user.email}</p>
              <p className="mt-1 text-xs text-text-muted">
                Member since {new Date(user.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="rounded-theme border border-border/60 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-text">
              <Shield className="h-4 w-4 text-accent" />
              Spotify Connection
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div>
                <p className="text-sm text-text">
                  {user.spotifyConnected ? (
                    <span className="text-[#1DB954]">Connected</span>
                  ) : (
                    <span className="text-text-muted">Disconnected</span>
                  )}
                </p>
                {user.scopes.length > 0 && (
                  <p className="mt-0.5 text-xs text-text-muted">
                    Scopes: {user.scopes.join(', ')}
                  </p>
                )}
              </div>
              {user.spotifyConnected ? (
                <Button
                  variant="outline"
                  onClick={() => void disconnectSpotify()}
                  className="gap-1 text-xs"
                >
                  <Unlink className="h-3 w-3" />
                  Disconnect
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={login}
                  className="gap-1 text-xs text-[#1DB954] border-[#1DB954]/40 hover:bg-[#1DB954]/10"
                >
                  <Link className="h-3 w-3" />
                  Reconnect
                </Button>
              )}
            </div>
          </div>

          <div className="rounded-theme border border-negative/30 p-4">
            <p className="text-sm font-medium text-negative">Danger Zone</p>
            <p className="mt-1 text-xs text-text-muted">
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
            <div className="mt-3">
              {!confirmDelete ? (
                <Button
                  variant="ghost"
                  onClick={() => setConfirmDelete(true)}
                  className="gap-1 border-negative/40 text-xs text-negative hover:bg-negative/10"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete Account
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      void deleteAccount()
                      onClose()
                    }}
                    className="gap-1 border-negative bg-negative/10 text-xs text-negative hover:bg-negative/20"
                  >
                    Confirm Delete
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setConfirmDelete(false)}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
