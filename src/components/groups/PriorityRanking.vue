<script setup>
import { computed, ref } from 'vue'

// Drag (or use the up/down buttons) to rank priorities; v-model is the ordered keys.
const order = defineModel({ type: Array, required: true })
const props = defineProps({
  factors: { type: Array, required: true }, // [{ key, label }]
})

const items = computed(() =>
  order.value.map((key) => props.factors.find((factor) => factor.key === key)).filter(Boolean),
)

const announcement = ref('')
function move(from, to) {
  if (to < 0 || to >= order.value.length || from === to) return
  const next = [...order.value]
  const [key] = next.splice(from, 1)
  next.splice(to, 0, key)
  order.value = next
  const label = props.factors.find((factor) => factor.key === key)?.label
  announcement.value = `${label} moved to rank ${to + 1}`
}

const listEl = ref(null)
const dragKey = ref(null)
function startDrag(event, key) {
  if (event.button !== 0 || event.target.closest('button')) return
  // On touch screens only the grip drags, so the rest of the row still scrolls.
  if (event.pointerType !== 'mouse' && !event.target.closest('.grip')) return
  event.preventDefault()
  dragKey.value = key
  event.currentTarget.setPointerCapture(event.pointerId)
}
function drag(event) {
  if (!dragKey.value) return
  const rows = [...listEl.value.children]
  const from = order.value.indexOf(dragKey.value)
  const to = rows.findIndex((row) => {
    const box = row.getBoundingClientRect()
    return event.clientY < box.top + box.height / 2
  })
  const target = to === -1 ? rows.length - 1 : to > from ? to - 1 : to
  move(from, target)
}
function endDrag() {
  dragKey.value = null
}
</script>

<template>
  <div class="ranking">
    <ol ref="listEl" class="rank-list" aria-label="Your priorities, most important first">
      <li
        v-for="(item, index) in items"
        :key="item.key"
        class="rank-row"
        :class="{ 'is-dragging': dragKey === item.key }"
        @pointerdown="startDrag($event, item.key)"
        @pointermove="drag"
        @pointerup="endDrag"
        @pointercancel="endDrag"
      >
        <span class="rank">{{ index + 1 }}</span>
        <span class="label">{{ item.label }}</span>
        <span class="moves">
          <button
            type="button"
            :disabled="index === 0"
            :aria-label="`Move ${item.label} up`"
            @click="move(index, index - 1)"
          >
            ↑
          </button>
          <button
            type="button"
            :disabled="index === items.length - 1"
            :aria-label="`Move ${item.label} down`"
            @click="move(index, index + 1)"
          >
            ↓
          </button>
        </span>
        <span class="grip" aria-hidden="true">⠿</span>
      </li>
    </ol>
    <p class="sr-only" aria-live="polite">{{ announcement }}</p>
  </div>
</template>

<style scoped>
.rank-list {
  display: grid;
  gap: 8px;
  margin: 18px 0 0;
  padding: 0;
  list-style: none;
}
.rank-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  border: 1px solid var(--line, #ebe8e6);
  border-radius: 8px;
  background: #fff;
  font-size: 13px;
  cursor: grab;
  user-select: none;
  transition: box-shadow 0.15s;
}
.rank-row.is-dragging {
  border-color: var(--text, #161616);
  box-shadow: 0 4px 12px rgb(0 0 0 / 10%);
  cursor: grabbing;
}
.rank {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--soft, #efeeec);
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.rank-row:first-child .rank {
  background: var(--text, #161616);
  color: #fff;
}
.label {
  flex: 1;
}
.moves {
  display: flex;
  gap: 2px;
}
.moves button {
  width: 26px;
  height: 26px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #6d6863;
  font: inherit;
  cursor: pointer;
}
.moves button:hover:not(:disabled) {
  background: var(--soft, #efeeec);
}
.moves button:disabled {
  opacity: 0.3;
  cursor: default;
}
.moves button:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgb(200 41 47 / 25%);
}
.grip {
  color: #b0aba6;
  font-size: 16px;
  line-height: 1;
  touch-action: none;
}
</style>
