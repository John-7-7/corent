<script setup>
import { computed, ref } from 'vue'
import { searchAddress } from '../../services/geocodingService'
import { formatAddress } from './preferenceOptions'
import BaseIcon from './BaseIcon.vue'
import FieldMessage from './FieldMessage.vue'
import PillGroup from './PillGroup.vue'
import './theme.css'

const props = defineProps({
  // CommuteDestination: { Address, Lat, Lng } or null.
  modelValue: { type: Object, default: null },
  // [{ value, label, name, postal, fallback: { Address, Lat, Lng } }]
  destinations: { type: Array, required: true },
  label: { type: String, default: 'Commute destination' },
})

const emit = defineEmits(['update:modelValue', 'busy'])

const pendingValue = ref(null)
const usedFallback = ref(false)
let latestRequestId = 0

// The campus buttons cover students, but the report's second user group
// commutes to a workplace, so any Singapore address, postal code or building
// name can be searched too. OneMap's search endpoint needs no token.
const query = ref('')
const searching = ref(false)
const searchError = ref('')

const options = computed(() =>
  props.destinations.map((d) => ({ value: d.value, label: d.label, icon: 'graduation-cap' })),
)

// Destinations are stored as addresses, so match them back by postal code.
const selectedDestination = computed(() => {
  const address = props.modelValue?.Address
  return address ? (props.destinations.find((d) => address.includes(d.postal)) ?? null) : null
})

const selectedValue = computed(() => pendingValue.value ?? selectedDestination.value?.value ?? null)

async function choose(value) {
  const requestId = ++latestRequestId
  if (value === null) {
    pendingValue.value = null
    usedFallback.value = false
    emit('busy', false)
    emit('update:modelValue', null)
    return
  }

  const destination = props.destinations.find((d) => d.value === value)
  pendingValue.value = value
  emit('busy', true)

  let result
  let fallback = false
  try {
    result = await searchAddress(destination.postal)
  } catch {
    result = { ...destination.fallback }
    fallback = true
  }

  // A newer selection was made while this one was in flight.
  if (requestId !== latestRequestId) return

  pendingValue.value = null
  usedFallback.value = fallback
  searchError.value = ''
  emit('busy', false)
  emit('update:modelValue', result)
}

/** Resolves a typed address through OneMap and stores it as the destination. */
async function searchCustom() {
  const term = query.value.trim()
  if (!term) return

  const requestId = ++latestRequestId
  searching.value = true
  searchError.value = ''
  emit('busy', true)

  try {
    const result = await searchAddress(term)
    if (requestId !== latestRequestId) return
    pendingValue.value = null
    usedFallback.value = false
    query.value = ''
    emit('update:modelValue', result)
  } catch (error) {
    if (requestId !== latestRequestId) return
    searchError.value =
      error instanceof Error && /No OneMap result/.test(error.message)
        ? `No match for "${term}". Try a postal code or a building name.`
        : "Couldn't reach OneMap. Check your connection and try again."
  } finally {
    if (requestId === latestRequestId) {
      searching.value = false
      emit('busy', false)
    }
  }
}
</script>

<template>
  <div class="destination">
    <span class="destination__label">{{ label }}</span>
    <PillGroup
      :model-value="selectedValue"
      :options="options"
      :loading-value="pendingValue"
      :label="label"
      deselectable
      @update:model-value="choose"
    />
    <div class="destination__search">
      <label class="destination__hint" for="commute-search">
        Somewhere else? Enter an address, postal code or building name
      </label>
      <div class="destination__row">
        <input
          id="commute-search"
          v-model="query"
          class="destination__input"
          type="search"
          placeholder="e.g. 018956, or Mapletree Business City"
          :disabled="searching"
          @keyup.enter="searchCustom"
        />
        <button
          type="button"
          class="destination__go"
          :disabled="searching || !query.trim()"
          @click="searchCustom"
        >
          {{ searching ? 'Searching…' : 'Find' }}
        </button>
      </div>
    </div>

    <FieldMessage v-if="searchError" type="warning">{{ searchError }}</FieldMessage>

    <p v-if="modelValue && !pendingValue" class="destination__address">
      <BaseIcon name="map-pin" :size="13" />
      <span>
        <strong>{{ selectedDestination?.name ?? 'Custom destination' }}</strong>
        <span class="destination__line">{{ formatAddress(modelValue.Address) }}</span>
      </span>
    </p>
    <FieldMessage v-if="usedFallback && modelValue && !pendingValue" type="warning">
      Couldn't reach OneMap, so we used the saved campus address. You can still save.
    </FieldMessage>
  </div>
</template>

<style scoped>
.destination {
  font-family: var(--cr-font);
}
.destination__label {
  display: block;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 500;
  color: var(--cr-muted);
}
.destination__search {
  margin-top: 12px;
}
.destination__hint {
  display: block;
  margin-bottom: 6px;
  font-size: 11.5px;
  color: var(--cr-muted);
}
.destination__row {
  display: flex;
  gap: 8px;
}
.destination__input {
  flex: 1;
  min-width: 0;
  padding: 7px 10px;
  border: 1px solid var(--cr-line, #d9d9e3);
  border-radius: var(--cr-radius-control);
  font: inherit;
  font-size: 12.5px;
  color: var(--cr-text);
  background: #fff;
}
.destination__input:disabled {
  opacity: 0.6;
}
.destination__go {
  flex: none;
  padding: 7px 14px;
  border: 1px solid var(--cr-accent);
  border-radius: var(--cr-radius-control);
  background: var(--cr-accent);
  color: #fff;
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
}
.destination__go:disabled {
  opacity: 0.5;
  cursor: default;
}

.destination__address {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 10px 0 0;
  padding: 8px 10px;
  border-radius: var(--cr-radius-control);
  background: #f7f7f7;
  font-size: 12px;
  color: var(--cr-text);
}
.destination__address .base-icon {
  margin-top: 1px;
  color: var(--cr-accent);
}
.destination__line {
  display: block;
  margin-top: 2px;
  color: var(--cr-muted);
}
</style>
