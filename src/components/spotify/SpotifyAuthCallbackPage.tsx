import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'

import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { useSpotifyAuthStore } from '@/store/useSpotifyAuthStore'

let spotifyAuthCallbackPromise: Promise<boolean> | null = null

export function SpotifyAuthCallbackPage(): JSX.Element {
  const navigate = useNavigate()
  const { handleAuthCallback, status, error } = useSpotifyAuthStore(useShallow((state) => ({
    handleAuthCallback: state.handleAuthCallback,
    status: state.status,
    error: state.error,
  })))

  useEffect(() => {
    if (!spotifyAuthCallbackPromise) {
      spotifyAuthCallbackPromise = handleAuthCallback().finally(() => {
        spotifyAuthCallbackPromise = null
      })
    }

    let active = true
    let redirectTimeout: number | null = null

    void spotifyAuthCallbackPromise.then((handled) => {
      if (!active) {
        return
      }
      const next = useSpotifyAuthStore.getState()
      const shouldRedirect = handled && next.status === 'connected' && !next.error
      if (!shouldRedirect) {
        return
      }
      redirectTimeout = window.setTimeout(() => {
        if (active) {
          navigate('/', { replace: true })
        }
      }, 400)
    })

    return () => {
      active = false
      if (redirectTimeout !== null) {
        window.clearTimeout(redirectTimeout)
      }
    }
  }, [handleAuthCallback, navigate])

  return (
    <div className="mx-auto max-w-lg p-6">
      <Card>
        <CardTitle>Spotify Authentication</CardTitle>
        <CardDescription className="mt-2">
          {status === 'authorizing' || status === 'refreshing'
            ? 'Finalizing Spotify OAuth in this browser session…'
            : error
              ? error
              : 'Spotify connection updated. Redirecting back to Listentropy…'}
        </CardDescription>
        {error ? (
          <div className="mt-4 rounded-theme border border-negative/30 bg-surface-hover p-3">
            <p className="text-xs text-text-muted">
              OAuth callback did not complete. Confirm your Spotify app client ID and allowed redirect URI, then try again from the app.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => navigate('/', { replace: true })}>
                Return to app
              </Button>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  )
}
