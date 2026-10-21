import { Form, Link, usePage } from '@inertiajs/react'
import type { ReactNode } from 'react'

type Shared = {
  user?: { fullName: string | null; email: string }
  flash?: { error?: string; success?: string }
}
export default function Layout({ children }: { children: ReactNode }) {
  const { user, flash } = usePage<Shared>().props
  return (
    <>
      <header>
        <nav aria-label="Main navigation">
          <Link href="/">Home</Link>
          {user ? (
            <>
              <Link href="/support">Support workspace</Link>
              <span>{user.fullName ?? user.email}</span>
              <Form action="/logout" method="post">
                <button type="submit">Log out</button>
              </Form>
            </>
          ) : (
            <>
              <Link href="/login">Log in</Link>
              <Link href="/signup">Sign up</Link>
            </>
          )}
        </nav>
      </header>
      <main>
        {flash?.error && <p role="alert">{flash.error}</p>}
        {flash?.success && <p role="status">{flash.success}</p>}
        {children}
      </main>
    </>
  )
}
