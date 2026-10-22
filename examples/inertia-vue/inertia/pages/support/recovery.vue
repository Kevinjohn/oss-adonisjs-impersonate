<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { onMounted, ref } from 'vue'
defineProps<{ title: string; message: string }>()
const heading = ref<HTMLHeadingElement>()
onMounted(() => heading.value?.focus())
</script>

<template>
  <Head :title="title" />
  <main class="support-page">
    <h1 ref="heading" tabindex="-1">{{ title }}</h1>
    <section class="panel" role="alert">
      <p>{{ message }}</p>
      <p>The previous form was not replayed. Check current status before creating a new action.</p>
      <Link href="/support">Check current status</Link>
    </section>
  </main>
</template>
