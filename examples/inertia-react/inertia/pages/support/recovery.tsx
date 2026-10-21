import { Link } from '@inertiajs/react'
import { useEffect, useRef } from 'react'

export default function Recovery({ message }: { message: string }) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus() }, [])
  return <section className="support-page" role="alert" aria-live="assertive">
    <h1 ref={heading} tabIndex={-1}>Support action needs review</h1>
    <p>{message}</p>
    <p>The previous form was not replayed and its context remains unchanged.</p>
    <Link href="/support">Check current status</Link>
  </section>
}
