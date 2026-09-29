# Save as an app

On an iPhone or iPad, the builder (a shared deck at `/d/…`, the sample deck, and editing a plan) shows a small note, **Save this as an app: tap Share, then Add to Home Screen.**, with the Share glyph drawn inline and a **Dismiss** button. iOS Safari has no install prompt of its own, so the note points at the manual route. It's `InstallHint` in `src/components/InstallHint.tsx`, rendered by `PlanBuilder`, as an `aside` labelled *Save as an app*.

## Who sees it

- **iPhones and iPads.** An iPhone or iPod says so in its user agent. An iPad says it's a Mac, so a "Mac" with a touch screen (`navigator.maxTouchPoints > 1`) counts as one. A real Mac, and every other device, doesn't see it.
- **Not once it's saved.** Opened from the home screen (`navigator.standalone`, or the `(display-mode: standalone)` media query), it doesn't show.
- **Not once dismissed.** **Dismiss** hides it and remembers that in local storage (`install-hint-dismissed`), so it stays away on later visits. Where storage can't be used, it can still be dismissed, and just comes back next visit.

The server can't see the device, so the note is decided after the page first renders, and the server's HTML never has it.
