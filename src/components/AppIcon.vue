<script setup>
import { computed } from 'vue'

const props = defineProps({
  name: { type: String, required: true },
  size: { type: Number, default: 16 },
  fill: { type: Boolean, default: false },
})

// Each string is one or more sub-paths; they are split on every capital "M".
const ICONS = {
  logo: 'M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16z M17 17l5 5 M7.5 12.5L11 9.5l3.5 3V15h-7z',
  home: 'M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M21 21l-4.3-4.3',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  bookmark: 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z',
  plus: 'M12 5v14 M5 12h14',
  minus: 'M5 12h14',
  x: 'M18 6L6 18 M6 6l12 12',
  check: 'M20 6L9 17l-5-5',
  edit: 'M12 20h9 M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z',
  chevron: 'M9 18l6-6-6-6',
  dots: 'M12 5h.01 M12 12h.01 M12 19h.01',
  pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  wifi: 'M5 12.55a11 11 0 0 1 14.08 0 M1.42 9a16 16 0 0 1 21.16 0 M8.53 16.11a6 6 0 0 1 6.95 0 M12 20h.01',
  aircon: 'M12 2v20 M4.93 6.5l14.14 11 M4.93 17.5l14.14-11 M9 3.5l3 2.5 3-2.5 M9 20.5l3-2.5 3 2.5',
  paw: 'M8 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z M16 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z M4.5 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z M19.5 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z M12 12c-3 0-5 3-5 5.5 0 1.5 1.5 2 3 1.5 1-.3 1.5-.5 2-.5s1 .2 2 .5c1.5.5 3 0 3-1.5 0-2.5-2-5.5-5-5.5z',
  gym: 'M6.5 6.5v11 M17.5 6.5v11 M3.5 9v6 M20.5 9v6 M6.5 12h11',
  pool: 'M2 8c2 0 2-1.5 4-1.5S8 8 10 8s2-1.5 4-1.5S16 8 18 8s2-1.5 4-1.5 M2 13c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5 M2 18c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5',
  car: 'M5 17h14 M3 13l2-6a2 2 0 0 1 2-1.5h10a2 2 0 0 1 2 1.5l2 6v4H3z M7.5 17v2 M16.5 17v2',
  laundry: 'M4 3h16v18H4z M4 8h16 M12 18a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z M12 1v2 M12 21v2 M4.22 4.22l1.42 1.42 M18.36 18.36l1.42 1.42 M1 12h2 M21 12h2 M4.22 19.78l1.42-1.42 M18.36 5.64l1.42-1.42',
}

const paths = computed(() =>
  (ICONS[props.name] || '').split(/(?=M)/).map((s) => s.trim()).filter(Boolean),
)
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    :fill="fill ? 'currentColor' : 'none'"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path v-for="(d, i) in paths" :key="i" :d="d" />
  </svg>
</template>