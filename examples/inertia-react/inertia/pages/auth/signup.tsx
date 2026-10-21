import { Form, usePage } from '@inertiajs/react'

export default function Signup() {
  const { errors } = usePage<{ errors: Record<string, string> }>().props
  return (
    <section className="support-page">
      <h1>Create account</h1>
      <Form action="/signup" method="post">
        <label htmlFor="fullName">Name</label>
        <input
          id="fullName"
          name="fullName"
          aria-invalid={Boolean(errors.fullName)}
          aria-describedby={errors.fullName ? 'name-error' : undefined}
          required
        />
        {errors.fullName && (
          <p id="name-error" role="alert">
            {errors.fullName}
          </p>
        )}
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'email-error' : undefined}
          required
        />
        {errors.email && (
          <p id="email-error" role="alert">
            {errors.email}
          </p>
        )}
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? 'password-error' : undefined}
          required
        />
        {errors.password && (
          <p id="password-error" role="alert">
            {errors.password}
          </p>
        )}
        <label htmlFor="passwordConfirmation">Confirm password</label>
        <input
          id="passwordConfirmation"
          name="passwordConfirmation"
          type="password"
          aria-invalid={Boolean(errors.passwordConfirmation)}
          aria-describedby={errors.passwordConfirmation ? 'confirmation-error' : undefined}
          required
        />
        {errors.passwordConfirmation && (
          <p id="confirmation-error" role="alert">
            {errors.passwordConfirmation}
          </p>
        )}
        <button type="submit">Create account</button>
      </Form>
    </section>
  )
}
