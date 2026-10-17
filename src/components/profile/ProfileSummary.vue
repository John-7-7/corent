<script setup>
import { computed } from 'vue'
import BaseIcon from './BaseIcon.vue'
import {
  AMENITIES,
  formatCurrency,
  formatMoveInDate,
  LEASE_DURATIONS,
  LOCATIONS,
  optionLabel,
  PROPERTY_TYPES,
  universityForDestination,
} from './preferenceOptions'
import './theme.css'

const props = defineProps({
  // User_Preferences-shaped object (e.g. the live form snapshot).
  preferences: { type: Object, required: true },
  title: { type: String, default: 'Profile Summary' },
})

const rows = computed(() => {
  const p = props.preferences
  const destination = universityForDestination(p.CommuteDestination)
  const bedrooms =
    p.BedroomsMin === null && p.BedroomsMax === null
      ? 'Any'
      : p.BedroomsMin === p.BedroomsMax
        ? String(p.BedroomsMin)
        : `${p.BedroomsMin} to ${p.BedroomsMax}`

  return [
    {
      key: 'budget',
      label: 'Budget',
      value: `${formatCurrency(p.BudgetMin)} to ${formatCurrency(p.BudgetMax)}/mo`,
      icon: p.IsBudgetPrivate ? 'lock' : '',
      hint: p.IsBudgetPrivate ? 'Private' : '',
    },
    {
      key: 'commute',
      label: 'Commute',
      value: `up to ${p.MaxCommuteTime} min`,
      hint: destination ? `to ${destination.label}` : '',
    },
    { key: 'bedrooms', label: 'Bedrooms', value: bedrooms },
    { key: 'moveIn', label: 'Move-in', value: formatMoveInDate(p.PreferredMoveInDate) },
    { key: 'property', label: 'Property', value: optionLabel(PROPERTY_TYPES, p.PropertyType) },
    { key: 'lease', label: 'Lease', value: optionLabel(LEASE_DURATIONS, p.LeaseDuration) },
    {
      key: 'coTenants',
      label: 'Co-tenants',
      value: `${p.CoTenants} ${p.CoTenants === 1 ? 'person' : 'people'}`,
    },
  ]
})

const amenityLabels = computed(() =>
  (props.preferences.Amenities ?? []).map((slug) => optionLabel(AMENITIES, slug)),
)
const locationLabels = computed(() =>
  (props.preferences.PreferredLocations ?? []).map((slug) => optionLabel(LOCATIONS, slug)),
)
</script>

<template>
  <aside class="summary" :aria-label="title">
    <h2 class="summary__title">{{ title }}</h2>
    <dl class="summary__rows">
      <div v-for="row in rows" :key="row.key" class="summary__row">
        <dt>{{ row.label }}</dt>
        <dd>
          <span v-if="row.hint" class="summary__hint">
            <BaseIcon v-if="row.icon" :name="row.icon" :size="11" />{{ row.hint }}
          </span>
          {{ row.value }}
        </dd>
      </div>
    </dl>

    <div class="summary__group">
      <h3>Amenities</h3>
      <ul v-if="amenityLabels.length" class="summary__chips">
        <li v-for="label in amenityLabels" :key="label" class="chip chip--accent">{{ label }}</li>
      </ul>
      <p v-else class="summary__empty">None selected</p>
    </div>

    <div class="summary__group">
      <h3>Locations</h3>
      <ul v-if="locationLabels.length" class="summary__chips">
        <li v-for="label in locationLabels" :key="label" class="chip">{{ label }}</li>
      </ul>
      <p v-else class="summary__empty">Any location</p>
    </div>

    <slot />
  </aside>
</template>

<style scoped>
.summary {
  background: var(--cr-surface);
  border: 1px solid var(--cr-border);
  border-radius: var(--cr-radius-card);
  box-shadow: var(--cr-shadow-card);
  padding: 16px 18px 18px;
  font-family: var(--cr-font);
  color: var(--cr-text);
}
.summary__title {
  margin: 0 0 12px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--cr-muted);
}
.summary__rows {
  margin: 0;
}
.summary__row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  padding: 6px 0;
  font-size: 12.5px;
}
.summary__row dt {
  color: var(--cr-muted);
}
.summary__row dd {
  margin: 0;
  font-weight: 600;
  text-align: right;
}
.summary__hint {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-right: 6px;
  font-size: 11px;
  font-weight: 500;
  color: var(--cr-subtle);
}
.summary__group {
  margin-top: 10px;
}
.summary__group h3 {
  margin: 0 0 6px;
  font-size: 12.5px;
  font-weight: 400;
  color: var(--cr-muted);
}
.summary__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.chip {
  padding: 3px 9px;
  border-radius: 999px;
  background: #ececec;
  font-size: 11px;
  font-weight: 600;
  color: var(--cr-text);
}
.chip--accent {
  background: var(--cr-accent-soft);
  color: var(--cr-accent);
}
.summary__empty {
  margin: 0;
  font-size: 12px;
  color: var(--cr-subtle);
}
</style>
