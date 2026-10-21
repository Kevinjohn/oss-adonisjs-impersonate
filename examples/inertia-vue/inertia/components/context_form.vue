<script setup lang="ts">
import { Form } from '@adonisjs/inertia/vue'

const props = defineProps<{
  action: string
  context: string
  submitLabel: string
  method?: 'post'
}>()

// Capture the token at form creation. A later props refresh cannot rebind this intent.
const originalContext = props.context
</script>

<template>
  <Form v-slot="{ processing }" :action="action" :method="method ?? 'post'">
    <input type="hidden" name="_masqueradeContext" :value="originalContext" />
    <slot :processing="processing" />
  </Form>
</template>
