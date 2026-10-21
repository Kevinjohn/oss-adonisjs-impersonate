import { Link } from '@inertiajs/react'
import SupportBanner from '~/components/support_banner'
import ContextForm from './context_form'
import { useIdentityFreshness } from './use_identity_freshness'

type Label = { id: number; fullName: string | null; email: string }
type Mode = { isMasquerading: true; contextToken: string; expiresAt: string }

export default function Customer({ actor, customer, mode, emailUpdates, canEdit }: {
  actor: Label; customer: Label; mode: Mode; emailUpdates: boolean; canEdit: boolean
}) {
  const stale = useIdentityFreshness(mode.expiresAt)
  if (stale) return <p role="status" aria-live="assertive">Refreshing support status…</p>
  return <section className="support-page">
    <h1>Customer view</h1>
    <SupportBanner actor={actor} customer={customer} expiresAt={mode.expiresAt} />
    <dl><dt>Customer email</dt><dd>{customer.email}</dd><dt>Email updates</dt><dd>{emailUpdates ? 'On' : 'Off'}</dd></dl>
    {canEdit ? <ContextForm action="/support/customer/preference" context={mode.contextToken}>
      <label htmlFor="emailUpdates">Email updates</label>
      <select id="emailUpdates" name="emailUpdates" defaultValue={emailUpdates ? '1' : '0'}>
        <option value="1">On</option><option value="0">Off</option>
      </select>
      <button type="submit">Save preference</button>
    </ContextForm> : <p>Customer permission does not allow preference changes.</p>}
    <ContextForm action="/support/customer/sensitive" context={mode.contextToken}>
      <button type="submit">Try sensitive account action</button>
    </ContextForm>
    <p><Link href="/support">Return to operator workspace</Link></p>
  </section>
}
