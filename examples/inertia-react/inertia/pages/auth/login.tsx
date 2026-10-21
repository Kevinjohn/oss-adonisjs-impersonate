import { Form } from '@inertiajs/react'

export default function Login() {
  return <section className="support-page"><h1>Log in</h1><Form action="/login" method="post">
    <label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="username" required />
    <label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required />
    <button type="submit">Log in</button>
  </Form></section>
}
