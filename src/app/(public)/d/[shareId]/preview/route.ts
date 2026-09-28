import { eq } from 'drizzle-orm'
import { getDb } from '@/db'
import { deck } from '@/db/schema'
import { previewResponse } from '@/lib/og/serve'
import { getPreviewImage } from '@/lib/previews'

// The shared deck's link preview, as a browser last drew it
// (docs/share-previews.md § "Storing and serving").
export async function GET(request: Request, { params }: { params: Promise<{ shareId: string }> }) {
  const db = getDb()
  const [found] = await db
    .select({ id: deck.id })
    .from(deck)
    .where(eq(deck.shareId, (await params).shareId))
  return previewResponse(found ? await getPreviewImage(db, 'deck', found.id) : null, request)
}
