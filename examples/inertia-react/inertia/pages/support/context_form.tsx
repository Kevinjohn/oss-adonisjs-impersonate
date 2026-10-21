import { Form } from '@inertiajs/react'
import { useRef, type ReactNode } from 'react'

/** A rendered intent owns its original token, even if a props refresh arrives. */
export default function ContextForm({ action, context, children, disabled = false }: {
  action: string
  context: string
  children: ReactNode
  disabled?: boolean
}) {
  const original = useRef(context)
  return <Form action={action} method="post" options={{ preserveState: false }}>
    {() => <>
      <input type="hidden" name="_masqueradeContext" value={original.current} readOnly />
      <fieldset disabled={disabled}>{children}</fieldset>
    </>}
  </Form>
}
