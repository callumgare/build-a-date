import { getDb } from '@/db'
import { previewResponse } from '@/lib/og/serve'
import { getPreviewImage } from '@/lib/previews'

// The plan's link preview, as a browser last drew it (docs/share-previews.md
// § "Storing and serving").
export async function GET(request: Request, { params }: { params: Promise<{ planId: string }> }) {
  return previewResponse(await getPreviewImage(getDb(), 'plan', (await params).planId), request)
}
