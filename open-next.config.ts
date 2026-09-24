import { defineCloudflareConfig } from '@opennextjs/cloudflare'

// Every page reads per-user or per-deck data from D1, so there's nothing for
// an incremental cache to hold.
export default defineCloudflareConfig()
