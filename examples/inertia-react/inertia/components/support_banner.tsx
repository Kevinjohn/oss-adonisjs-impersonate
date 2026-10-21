type Label = { fullName: string | null; email: string }

export default function SupportBanner({
  actor,
  customer,
  expiresAt,
}: {
  actor: Label
  customer: Label
  expiresAt: string
}) {
  return (
    <aside className="support-banner" role="status" aria-live="polite">
      <strong>Support mode</strong>
      <span>
        Signed in as {actor.fullName ?? actor.email}; viewing {customer.fullName ?? customer.email}.
      </span>
      <span>
        Account-wide scope. Fixed deadline:{' '}
        <time dateTime={expiresAt}>{new Date(expiresAt).toLocaleString()}</time>.
      </span>
    </aside>
  )
}
