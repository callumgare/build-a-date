type AddCardControlsProps = {
  onAdd: () => void
  onQuickAdd: () => void
}

// The two ways to add an idea (docs/quick-add.md § "Adding an idea"), on the
// deck's edit page and at the end of the shared deck for its editors.
export default function AddCardControls({ onAdd, onQuickAdd }: AddCardControlsProps) {
  return (
    <div className="add-card-controls">
      <button className="add-card" type="button" onClick={onAdd}>
        Add an idea
      </button>
      <span className="empty-slot-divider">or</span>
      <button className="done-button" type="button" onClick={onQuickAdd}>
        Quick Add
      </button>
    </div>
  )
}
