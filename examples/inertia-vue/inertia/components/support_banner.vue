<script setup lang="ts">
defineProps<{
  actor: { fullName: string; email: string }
  customer: { fullName: string; email: string }
  expiresAt: string
}>()
</script>

<template>
  <aside class="support-banner" role="status" aria-live="polite">
    <strong>Support mode is active</strong>
    <span
      >Operator {{ actor.fullName }} ({{ actor.email }}) is viewing {{ customer.fullName }} ({{
        customer.email
      }}).</span
    >
    <span
      >Scope: this account across all devices. Ends
      <time :datetime="expiresAt">{{ new Date(expiresAt).toLocaleString() }}</time
      >.</span
    >
  </aside>
</template>
