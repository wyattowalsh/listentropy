import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import type { ProcessedDataModel } from '@/lib/types'

import { ShareCardOverlay } from './ShareCardOverlay'
import { ArchetypeCard } from './cards/ArchetypeCard'
import { ByNumbersCard } from './cards/ByNumbersCard'
import { ClockPersonaCard } from './cards/ClockPersonaCard'
import { DeviceJourneyCard } from './cards/DeviceJourneyCard'
import { ForgottenGemCard } from './cards/ForgottenGemCard'
import { GuiltyPleasuresCard } from './cards/GuiltyPleasuresCard'
import { IntentSignatureCard } from './cards/IntentSignatureCard'
import { OfflinePrivateMomentsCard } from './cards/OfflinePrivateMomentsCard'
import { StreakCard } from './cards/StreakCard'
import { TasteFingerprintCard } from './cards/TasteFingerprintCard'
import { TitleCard } from './cards/TitleCard'
import { TopArtistsCard } from './cards/TopArtistsCard'
import { TopTracksCard } from './cards/TopTracksCard'
import { TravelFootprintCard } from './cards/TravelFootprintCard'
import { STORY_CARD_REGISTRY, type StoryCardKey } from './story-card-order'

export type StoryAspect = 'story' | 'square'

interface StoryCardDeckProps {
  data: ProcessedDataModel
  displayName: string
  aspect: StoryAspect
  showBranding: boolean
  showQr: boolean
  selectedCardKeys?: StoryCardKey[]
  onCardsReady?: (cards: Array<{ key: string; element: HTMLElement | null }>) => void
  onActiveCardKeyChange?: (cardKey: StoryCardKey) => void
}

interface CardConfig {
  key: StoryCardKey
  title: string
  render: () => JSX.Element
}

function aspectClasses(aspect: StoryAspect): string {
  return aspect === 'story' ? 'aspect-[9/16]' : 'aspect-square'
}

function exportDimensions(aspect: StoryAspect): { width: number; height: number } {
  return aspect === 'story' ? { width: 1080, height: 1920 } : { width: 1080, height: 1080 }
}

export function StoryCardDeck({
  data,
  displayName,
  aspect,
  showBranding,
  showQr,
  selectedCardKeys,
  onCardsReady,
  onActiveCardKeyChange,
}: StoryCardDeckProps): JSX.Element {
  const [index, setIndex] = useState(0)
  const cardElementsRef = useRef<Record<string, HTMLElement | null>>({})
  const stagingRootRef = useRef<HTMLDivElement | null>(null)

  const cards = useMemo<CardConfig[]>(
    () => {
      const renderByKey: Record<StoryCardKey, () => JSX.Element> = {
        title: () => <TitleCard data={data} name={displayName} />,
        'top-artists': () => <TopArtistsCard data={data} />,
        'top-tracks': () => <TopTracksCard data={data} />,
        clock: () => <ClockPersonaCard data={data} />,
        streak: () => <StreakCard data={data} />,
        'guilty-pleasures': () => <GuiltyPleasuresCard data={data} />,
        'forgotten-gem': () => <ForgottenGemCard data={data} />,
        archetype: () => <ArchetypeCard data={data} />,
        numbers: () => <ByNumbersCard data={data} />,
        fingerprint: () => <TasteFingerprintCard data={data} />,
        'travel-footprint': () => <TravelFootprintCard data={data} />,
        'intent-signature': () => <IntentSignatureCard data={data} />,
        'device-journey': () => <DeviceJourneyCard data={data} />,
        'offline-private': () => <OfflinePrivateMomentsCard data={data} />,
      }

      const baseCards: CardConfig[] = STORY_CARD_REGISTRY.map((card) => ({
        key: card.key,
        title: card.title,
        render: renderByKey[card.key],
      }))

      if (!selectedCardKeys || selectedCardKeys.length === 0) {
        return baseCards
      }
      const allowed = new Set(selectedCardKeys)
      return baseCards.filter((card) => allowed.has(card.key))
    },
    [data, displayName, selectedCardKeys],
  )

  useEffect(() => {
    if (!onCardsReady) {
      return
    }
    onCardsReady(
      cards.map((card) => ({
        key: card.key,
        element: cardElementsRef.current[card.key] ?? null,
      })),
    )
  }, [cards, onCardsReady, aspect, showBranding, showQr])

  const clampedIndex = Math.min(index, Math.max(0, cards.length - 1))

  useEffect(() => {
    const key = cards[clampedIndex]?.key
    if (key && onActiveCardKeyChange) {
      onActiveCardKeyChange(key)
    }
  }, [cards, clampedIndex, onActiveCardKeyChange])

  useEffect(() => {
    const node = stagingRootRef.current
    if (!node) {
      return
    }
    node.setAttribute('inert', '')
  }, [])

  const current = cards[clampedIndex] ?? cards[0]
  const dimensions = exportDimensions(aspect)
  const atStart = clampedIndex === 0
  const atEnd = clampedIndex === cards.length - 1 && cards.length > 0

  const hiddenCards = cards.map((card) => (
    <div
      key={`hidden-${card.key}`}
      ref={(node) => {
        cardElementsRef.current[card.key] = node
      }}
      id={`story-card-${card.key}`}
      className="absolute left-0 top-0"
      style={{
        width: `${dimensions.width}px`,
        height: `${dimensions.height}px`,
      }}
    >
      <div className="relative h-full w-full">
        {card.render()}
        <ShareCardOverlay
          showBranding={showBranding}
          showQr={showQr}
          qrUrl={window.location.origin}
        />
      </div>
    </div>
  ))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-muted">Card {Math.min(clampedIndex + 1, cards.length)} / {cards.length}: {current?.title ?? 'N/A'}</p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            aria-label="Go to previous story card"
            onClick={() => setIndex(Math.max(0, clampedIndex - 1))}
            disabled={atStart}
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </Button>
          {atEnd ? (
            <Button aria-label="Restart story card deck" onClick={() => setIndex(0)}>
              <RotateCcw className="h-4 w-4" />
              Restart
            </Button>
          ) : (
            <Button
              variant="outline"
              aria-label="Go to next story card"
              onClick={() => setIndex(Math.min(cards.length - 1, clampedIndex + 1))}
              disabled={cards.length === 0}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className={`relative mx-auto w-full max-w-[420px] overflow-hidden rounded-theme border border-border bg-surface shadow-2xl ${aspectClasses(aspect)}`}>
        <div className="relative h-full w-full">
          {current ? current.render() : null}
          <ShareCardOverlay
            showBranding={showBranding}
            showQr={showQr}
            qrUrl={window.location.origin}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {cards.map((card, cardIndex) => (
          <button
            key={`tab-${card.key}`}
            type="button"
            aria-label={`Go to card ${cardIndex + 1}: ${card.title}`}
            onClick={() => setIndex(cardIndex)}
            className={`h-2.5 w-6 rounded-full transition ${
              cardIndex === clampedIndex ? 'bg-accent' : 'bg-surface-hover hover:bg-text-muted/50'
            }`}
          />
        ))}
      </div>
      {atEnd ? (
        <p className="rounded-theme border border-accent/30 bg-accent/10 px-3 py-2 text-xs text-text-muted">
          End of deck reached — restart to review, or export this card set.
        </p>
      ) : null}
      <div
        ref={stagingRootRef}
        className="pointer-events-none fixed left-0 top-0 h-0 w-0 overflow-hidden"
        aria-hidden="true"
      >
        {hiddenCards}
      </div>
    </div>
  )
}
