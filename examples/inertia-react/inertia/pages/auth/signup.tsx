import { Form } from '@inertiajs/react'

export default function Signup() {
  return <section className="support-page"><h1>Create account</h1><Form action="/signup" method="post">
    <label htmlFor="fullName">Name</label><input id="fullName" name="fullName" required />
    <label htmlFor="email">Email</label><input id="email" name="email" type="email" required />
    <label htmlFor="password">Password</label><input id="password" name="password" type="password" required />
    <label htmlFor="passwordConfirmation">Confirm password</label><input id="passwordConfirmation" name="passwordConfirmation" type="password" required />
    <button type="submit">Create account</button>
  </Form></section>
}
