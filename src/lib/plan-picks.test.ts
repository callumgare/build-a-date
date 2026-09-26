import type { PlanGroup, PlanPicks } from '@/types'
import {
  addCard,
  addGroup,
  changeGroup,
  firstRow,
  isBlankGroup,
  keepCards,
  moveCardBy,
  noPicks,
  parsePicks,
  pickedIds,
  picksKey,
  placeCard,
  removeCard,
  removeGroup,
} from './plan-picks'

function group(id: string, cardIds: string[], rest: Partial<PlanGroup> = {}): PlanGroup {
  return { id, title: '', notes: '', cardIds, ...rest }
}

const picks: PlanPicks = { cardIds: ['a', 'b'], groups: [group('g1', ['c']), group('g2', [])] }

describe('plan picks', () => {
  it('lists every picked card, row by row', () => {
    expect(pickedIds(picks)).toEqual(['a', 'b', 'c'])
  })

  it('adds a card to the end of the first row, once', () => {
    expect(addCard(picks, 'd').cardIds).toEqual(['a', 'b', 'd'])
    expect(addCard(picks, 'c')).toBe(picks)
  })

  it('removes a card from whichever row it is in', () => {
    expect(removeCard(picks, 'c').groups[0].cardIds).toEqual([])
    expect(removeCard(picks, 'nope')).toBe(picks)
  })

  /** @see docs/card-layout.md § "Reordering the plan" - by dragging it */
  describe('placing a card', () => {
    it('moves it along its own row', () => {
      expect(placeCard(picks, 'a', firstRow, 1).cardIds).toEqual(['b', 'a'])
    })

    it('moves it into a group, and out again', () => {
      const grouped = placeCard(picks, 'a', 'g2', 0)
      expect(grouped.cardIds).toEqual(['b'])
      expect(grouped.groups[1].cardIds).toEqual(['a'])
      expect(placeCard(grouped, 'c', firstRow, 0).cardIds).toEqual(['c', 'b'])
    })

    it('keeps the place in bounds, and changes nothing when it is already there', () => {
      expect(placeCard(picks, 'a', 'g1', 9).groups[0].cardIds).toEqual(['c', 'a'])
      expect(placeCard(picks, 'a', firstRow, 0)).toBe(picks)
      expect(placeCard(picks, 'a', 'no-such-group', 0)).toBe(picks)
    })
  })

  /** @see docs/card-layout.md § "Reordering the plan" - from the keyboard */
  describe('moving a card from the keyboard', () => {
    it('goes one place along its row, and no further than the ends', () => {
      expect(moveCardBy(picks, 'a', { along: 1 }).cardIds).toEqual(['b', 'a'])
      expect(moveCardBy(picks, 'a', { along: -1 })).toBe(picks)
    })

    it('goes onto the row below or above, at the same place or the end', () => {
      const down = moveCardBy(picks, 'b', { across: 1 })
      expect(down.cardIds).toEqual(['a'])
      expect(down.groups[0].cardIds).toEqual(['c', 'b'])
      expect(moveCardBy(picks, 'c', { across: -1 }).cardIds).toEqual(['c', 'a', 'b'])
      expect(moveCardBy(picks, 'a', { across: -1 })).toBe(picks)
    })
  })

  it('keeps only cards that pass, each once, where it is first found', () => {
    const repeated = { cardIds: ['a', 'x', 'a'], groups: [group('g1', ['a', 'c'])] }
    expect(keepCards(repeated, (id) => id !== 'x')).toEqual({ cardIds: ['a'], groups: [group('g1', ['c'])] })
    expect(keepCards(picks, () => true)).toBe(picks)
  })

  /** @see docs/plans.md § "Groups" */
  describe('groups', () => {
    it('adds an empty group at the bottom', () => {
      expect(addGroup(noPicks, 'g').groups).toEqual([group('g', [])])
    })

    it('puts the cards of a removed group back on the end of the first row', () => {
      expect(removeGroup(picks, 'g1')).toEqual({ cardIds: ['a', 'b', 'c'], groups: [group('g2', [])] })
    })

    it('changes the title and notes', () => {
      expect(changeGroup(picks, 'g2', { title: 'Later', notes: 'Bring cash' }).groups[1]).toEqual(
        group('g2', [], { title: 'Later', notes: 'Bring cash' }),
      )
    })

    it('counts a group with no title, notes or cards as blank', () => {
      expect(isBlankGroup(group('g', [], { title: '  ' }))).toBe(true)
      expect(isBlankGroup(group('g', [], { notes: 'x' }))).toBe(false)
      expect(isBlankGroup(group('g', ['a']))).toBe(false)
    })

    it('tells picks apart by their groups too', () => {
      expect(picksKey(picks)).toBe(picksKey(structuredClone(picks)))
      expect(picksKey(changeGroup(picks, 'g1', { title: 'x' }))).not.toBe(picksKey(picks))
    })
  })

  /** @see docs/plans.md § "Picks are kept in the browser" */
  describe('reading kept picks', () => {
    it('reads picks with groups', () => {
      expect(parsePicks(structuredClone(picks))).toEqual(picks)
    })

    it('reads a plain list of ids, as kept before there were groups', () => {
      expect(parsePicks(['a', 3, 'b'])).toEqual({ cardIds: ['a', 'b'], groups: [] })
    })

    it('drops groups it cannot read, and repeated ones', () => {
      expect(
        parsePicks({
          cardIds: ['a'],
          groups: [
            group('g', ['b']),
            group('g', ['c']),
            { id: '', cardIds: [] },
            null,
            { id: 'h', cardIds: [], title: 4 },
          ],
        }),
      ).toEqual({ cardIds: ['a'], groups: [group('g', ['b']), group('h', [])] })
    })

    it('reads nothing from anything else', () => {
      expect(parsePicks(null)).toBeNull()
      expect(parsePicks('a')).toBeNull()
      expect(parsePicks({ cardIds: ['a'] })).toBeNull()
    })
  })
})
