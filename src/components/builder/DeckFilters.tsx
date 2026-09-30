import { type DeckSort, deckSorts } from '@/lib/deck-order'
import { Chip, ChipGroup } from '../ui/Chip'
import styles from './DeckFilters.module.css'

type DeckFiltersProps = {
  tags: string[]
  activeTags: Set<string>
  // Whether Not in plan is on, or undefined when there's no saved plan for it
  // to hide anything from, which leaves it out (docs/deck-filters.md § "Not
  // in plan").
  notInPlan: boolean | undefined
  onShowAll: () => void
  onToggleTag: (tag: string) => void
  onToggleNotInPlan: () => void
  sort: DeckSort
  onSort: (sort: DeckSort) => void
}

// The Show filters and the Sort by options over the deck
// (docs/deck-filters.md, docs/deck-sorting.md).
export default function DeckFilters({
  tags,
  activeTags,
  notInPlan,
  onShowAll,
  onToggleTag,
  onToggleNotInPlan,
  sort,
  onSort,
}: DeckFiltersProps) {
  return (
    <>
      <ChipGroup name="Filter ideas" label="Show" className={styles.filters}>
        <Chip pressed={activeTags.size === 0 && !notInPlan} onClick={onShowAll}>
          All
        </Chip>
        {notInPlan !== undefined && (
          <Chip pressed={notInPlan} onClick={onToggleNotInPlan} className={styles.planFilter}>
            Not in plan
          </Chip>
        )}
        {tags.map((tag) => (
          <Chip pressed={activeTags.has(tag)} key={tag} onClick={() => onToggleTag(tag)}>
            {tag}
          </Chip>
        ))}
      </ChipGroup>

      <ChipGroup name="Sort ideas" label="Sort by" className={styles.sort}>
        {deckSorts.map((option) => (
          <Chip pressed={sort === option.value} key={option.value} onClick={() => onSort(option.value)}>
            {option.label}
          </Chip>
        ))}
      </ChipGroup>
    </>
  )
}
