import { ClientPortalProvider } from './context'
import PortalShell from './PortalShell'

export default function ClientPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClientPortalProvider>
      <PortalShell>{children}</PortalShell>
    </ClientPortalProvider>
  )
}
