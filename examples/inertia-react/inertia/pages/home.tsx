import { Link } from '@inertiajs/react'

export default function Home() {
  return <section className="support-page">
    <h1>Support mode example</h1>
    <p>Sign in as the fictional operator to review customer accounts with a fixed, account-wide support deadline.</p>
    <p><Link href="/login">Sign in</Link> · <Link href="/support">Open support workspace</Link></p>
  </section>
}
