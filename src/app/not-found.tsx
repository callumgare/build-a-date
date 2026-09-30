import PageShell from '@/components/PageShell'
import Button from '@/components/ui/Button'
import Heading from '@/components/ui/Heading'
import Panel from '@/components/ui/Panel'

export default function NotFound() {
  return (
    <PageShell>
      <Panel narrow>
        <Heading>Nothing here</Heading>
        <p>This link doesn&apos;t go anywhere. It may have been deleted, or mistyped.</p>
        <Button variant="text" href="/">
          Go to Build-a-Date
        </Button>
      </Panel>
    </PageShell>
  )
}
