import Button from '../ui/Button'
import Divider from '../ui/Divider'
import styles from './AddCardControls.module.css'

type AddCardControlsProps = {
  onAdd: () => void
  onQuickAdd: () => void
}

// The two ways to add an idea (docs/quick-add.md § "Adding an idea"), on the
// deck's edit page and at the end of the shared deck for its editors.
export default function AddCardControls({ onAdd, onQuickAdd }: AddCardControlsProps) {
  return (
    <div className={styles.controls} data-add-card-controls>
      <Button variant="text" className={styles.add} onClick={onAdd}>
        Add an idea
      </Button>
      <Divider short>or</Divider>
      <Button className={styles.quickAdd} onClick={onQuickAdd}>
        Quick Add
      </Button>
    </div>
  )
}
