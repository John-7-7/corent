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
  emit('busy', false)
  emit('update:modelValue', result)
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
    <p v-if="modelValue && !pendingValue" class="destination__address">
      <BaseIcon name="map-pin" :size="13" />
      <span>
        <strong>{{ selectedDestination?.name ?? 'Selected destination' }}</strong>
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
