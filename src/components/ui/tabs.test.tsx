import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { Tabs, TabsList, TabsTrigger } from './tabs'

describe('Tabs keyboard navigation', () => {
  it('moves focus and selection with arrow keys', () => {
    const onValueChange = vi.fn()

    render(
      <Tabs value="a" onValueChange={onValueChange}>
        <TabsList aria-label="Demo tabs">
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
      </Tabs>,
    )

    const first = screen.getByRole('tab', { name: 'A' })
    first.focus()
    fireEvent.keyDown(first, { key: 'ArrowRight' })

    expect(onValueChange).toHaveBeenCalledWith('b')
  })
})
