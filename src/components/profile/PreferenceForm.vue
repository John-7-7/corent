<script setup>
import { computed, nextTick, reactive, ref, useTemplateRef, watch } from 'vue'
import CommuteDestinationPicker from './CommuteDestinationPicker.vue'
import FieldMessage from './FieldMessage.vue'
import NumberStepper from './NumberStepper.vue'
import PillGroup from './PillGroup.vue'
import PrefCard from './PrefCard.vue'
import RangeSlider from './RangeSlider.vue'
import ToggleSwitch from './ToggleSwitch.vue'
import {
  AIRCON_COVERAGE,
  AMENITIES,
  BEDROOM_RANGE,
  BUDGET_RANGE,
  CO_TENANT_RANGE,
  COMMUTE_RANGE,
  COOKING_ACCESS,
  defaultPreferences,
  formatCurrency,
  FURNISHING_LEVELS,
  GUEST_POLICIES,
  LEASE_DURATIONS,
  LOCATIONS,
  normalizePreferences,
  parseIsoDate,
  PROPERTY_TYPES,
  SMOKING_PREFERENCES,
  STUDY_ENVIRONMENTS,
  todayIsoDate,
  UNIVERSITIES,
} from './preferenceOptions'
import './theme.css'

const props = defineProps({
  // User_Preferences fields to start from (missing fields fall back to defaults).
  initialValues: { type: Object, default: () => defaultPreferences() },
  saving: { type: Boolean, default: false },
  submitLabel: { type: String, default: 'Save Preferences' },
})

// save: validated data using the exact User_Preferences field names.
// change: a snapshot on every edit, for live previews and unsaved-change checks.
const emit = defineEmits(['save', 'change'])

const MOVE_IN_MAX_YEARS = 2
const MOVE_IN_FAR_DAYS = 180
const MOVE_IN_SOON_DAYS = 7
const MAX_PEOPLE_PER_BEDROOM = 2
const DEFAULT_BEDROOMS = { min: 1, max: 2 }

const formEl = useTemplateRef('formEl')
const form = reactive(toFormState(props.initialValues))
const lastBedrooms = ref({ ...DEFAULT_BEDROOMS })
const moveInBadInput = ref(false)
const moveInTouched = ref(false)
const submitAttempted = ref(false)
const locatingDestination = ref(false)

function toFormState(values) {
  const state = normalizePreferences(values)
  const defaults = defaultPreferences()
  // Older docs may lack a budget (e.g. private doc missing); keep sliders usable.
  state.BudgetMin ??= defaults.BudgetMin
  state.BudgetMax ??= defaults.BudgetMax
  return state
}

function snapshot() {
  return JSON.parse(JSON.stringify(form))
}

watch(
  () => props.initialValues,
  (values) => {
    Object.assign(form, toFormState(values))
    moveInBadInput.value = false
    moveInTouched.value = false
    submitAttempted.value = false
  },
)

watch(form, () => emit('change', snapshot()), { deep: true, immediate: true })

// ---- Field bindings --------------------------------------------------------

const budgetRange = computed({
  get: () => [form.BudgetMin, form.BudgetMax],
  set: ([min, max]) => {
    form.BudgetMin = min
    form.BudgetMax = max
  },
})

const budgetLabel = computed(
  () => `${formatCurrency(form.BudgetMin)} to ${formatCurrency(form.BudgetMax)}`,
)

// "Any" bedrooms is stored as BedroomsMin = BedroomsMax = null.
const bedroomsAny = computed({
  get: () => form.BedroomsMin === null && form.BedroomsMax === null,
  set: (any) => {
    if (any) {
      lastBedrooms.value = { min: form.BedroomsMin ?? 1, max: form.BedroomsMax ?? 2 }
      form.BedroomsMin = null
      form.BedroomsMax = null
    } else {
      form.BedroomsMin = lastBedrooms.value.min
      form.BedroomsMax = lastBedrooms.value.max
    }
  },
})

function onMoveInInput(event) {
  form.PreferredMoveInDate = event.target.value || null
  moveInBadInput.value = event.target.validity.badInput
  moveInTouched.value = true
}

const today = todayIsoDate()
const moveInMaxDate = (() => {
  const max = new Date()
  max.setFullYear(max.getFullYear() + MOVE_IN_MAX_YEARS)
  return max.toLocaleDateString('en-CA') // en-CA formats as YYYY-MM-DD
})()

// Single-select sections rendered from data, in mockup order.
const leaseSections = [
  { field: 'PropertyType', title: 'Property Type', options: PROPERTY_TYPES },
  { field: 'LeaseDuration', title: 'Lease Duration', options: LEASE_DURATIONS },
]
const householdSections = [
  { field: 'FurnishingLevel', title: 'Furnishing Level', options: FURNISHING_LEVELS },
  { field: 'CookingAccess', title: 'Cooking Access', options: COOKING_ACCESS },
  { field: 'AirconCoverage', title: 'Aircon Coverage', options: AIRCON_COVERAGE },
  { field: 'SmokingPreference', title: 'Smoking Preference', options: SMOKING_PREFERENCES },
  { field: 'StudyEnvironment', title: 'Study Environment', options: STUDY_ENVIRONMENTS },
  { field: 'GuestPolicy', title: 'Guest Policy', options: GUEST_POLICIES },
]

// ---- Validation ------------------------------------------------------------

const daysUntil = (isoDate) =>
  Math.round((parseIsoDate(isoDate) - parseIsoDate(today)) / (24 * 60 * 60 * 1000))

// Errors block saving.
const errors = computed(() => {
  const result = {}
  if (form.BudgetMin > form.BudgetMax) {
    result.budget = 'Minimum budget cannot be higher than your maximum budget.'
  }
  if (!bedroomsAny.value && form.BedroomsMin > form.BedroomsMax) {
    result.bedrooms = 'Minimum bedrooms cannot be more than maximum bedrooms.'
  }

  const date = form.PreferredMoveInDate
  if (moveInBadInput.value) {
    result.moveIn = "That date doesn't exist. Check the day, month and year."
  } else if (!date) {
    result.moveIn = 'Choose your preferred move-in date.'
  } else if (!parseIsoDate(date)) {
    result.moveIn = 'Enter a valid date.'
  } else if (date < today) {
    result.moveIn = 'Move-in date cannot be in the past.'
  } else if (date > moveInMaxDate) {
    result.moveIn = `Move-in date must be within the next ${MOVE_IN_MAX_YEARS} years.`
  }
  return result
})

// Warnings are advisory and never block saving.
const warnings = computed(() => {
  const result = {}
  const date = form.PreferredMoveInDate
  if (date && !errors.value.moveIn) {
    const days = daysUntil(date)
    if (days <= MOVE_IN_SOON_DAYS) {
      result.moveIn = 'Moving in within a week leaves little time to view units and sign a lease.'
    } else if (days > MOVE_IN_FAR_DAYS) {
      result.moveIn =
        'That is more than 6 months away. Most listings are advertised 1 to 3 months before move-in.'
    }
  }
  if (!form.CommuteDestination) {
    result.commute = 'Pick a destination so commute times can be calculated for listings.'
  }
  if (!bedroomsAny.value && !errors.value.bedrooms) {
    const people = form.CoTenants + 1
    if (people > form.BedroomsMax * MAX_PEOPLE_PER_BEDROOM) {
      result.coTenants = `${people} people (you + ${form.CoTenants}) in up to ${form.BedroomsMax} bedroom${
        form.BedroomsMax === 1 ? '' : 's'
      } means more than ${MAX_PEOPLE_PER_BEDROOM} per room.`
    }
  }
  return result
})

const hasErrors = computed(() => Object.keys(errors.value).length > 0)
// Invalid or past dates show straight away (including a saved date that has
// since passed); the "required" error waits until the user has interacted.
const showMoveInError = computed(
  () =>
    Boolean(errors.value.moveIn) &&
    Boolean(
      form.PreferredMoveInDate ||
      moveInBadInput.value ||
      moveInTouched.value ||
      submitAttempted.value,
    ),
)

async function submit() {
  submitAttempted.value = true
  if (hasErrors.value) {
    await nextTick()
    formEl.value
      ?.querySelector('.is-invalid')
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return
  }
  emit('save', snapshot())
}
</script>

<template>
  <form ref="formEl" class="pref-form" novalidate @submit.prevent="submit">
    <PrefCard title="Budget Range" :invalid="Boolean(errors.budget)">
      <template #aside>
        <span class="value-label">{{ budgetLabel }}<small>/mo</small></span>
      </template>
      <RangeSlider
        v-model="budgetRange"
        :min="BUDGET_RANGE.min"
        :max="BUDGET_RANGE.max"
        :step="BUDGET_RANGE.step"
        :min-gap="BUDGET_RANGE.minGap"
        :format-value="formatCurrency"
        label="Monthly budget"
      />
      <div class="card-footer">
        <ToggleSwitch
          v-model="form.IsBudgetPrivate"
          icon="lock"
          label="Keep my budget private"
          description="Group members won't see your budget, and it won't be used in the group's budget summary."
        />
      </div>
      <FieldMessage v-if="errors.budget">{{ errors.budget }}</FieldMessage>
    </PrefCard>

    <PrefCard title="Max Commute">
      <template #aside>
        <span class="value-label">{{ form.MaxCommuteTime }} min</span>
      </template>
      <RangeSlider
        v-model="form.MaxCommuteTime"
        :min="COMMUTE_RANGE.min"
        :max="COMMUTE_RANGE.max"
        :step="COMMUTE_RANGE.step"
        :format-value="(v) => `${v} min`"
        label="Maximum commute time"
      />
      <div class="card-footer">
        <CommuteDestinationPicker
          v-model="form.CommuteDestination"
          :destinations="UNIVERSITIES"
          label="Commuting to"
          @busy="locatingDestination = $event"
        />
      </div>
      <FieldMessage v-if="warnings.commute" type="warning">{{ warnings.commute }}</FieldMessage>
    </PrefCard>

    <PrefCard
      title="Bedrooms"
      subtitle="Min to max bedrooms required"
      :invalid="Boolean(errors.bedrooms)"
    >
      <template #aside>
        <button
          type="button"
          class="chip-toggle"
          :class="{ 'is-selected': bedroomsAny }"
          :aria-pressed="bedroomsAny"
          aria-label="Any number of bedrooms"
          @click="bedroomsAny = !bedroomsAny"
        >
          Any
        </button>
      </template>
      <div class="split">
        <NumberStepper
          v-model="form.BedroomsMin"
          label="Min"
          aria-label="minimum bedrooms"
          :min="BEDROOM_RANGE.min"
          :max="BEDROOM_RANGE.max"
          :disabled="bedroomsAny"
        />
        <div class="split__divider" aria-hidden="true" />
        <NumberStepper
          v-model="form.BedroomsMax"
          label="Max"
          aria-label="maximum bedrooms"
          :min="BEDROOM_RANGE.min"
          :max="BEDROOM_RANGE.max"
          :disabled="bedroomsAny"
        />
      </div>
      <FieldMessage v-if="errors.bedrooms">{{ errors.bedrooms }}</FieldMessage>
    </PrefCard>

    <PrefCard title="Move-in Date" :invalid="showMoveInError">
      <input
        id="move-in-date"
        type="date"
        class="text-input"
        :class="{ 'has-error': showMoveInError }"
        :value="form.PreferredMoveInDate ?? ''"
        :min="today"
        :max="moveInMaxDate"
        aria-label="Preferred move-in date"
        :aria-invalid="showMoveInError"
        @input="onMoveInInput"
        @blur="moveInTouched = true"
      />
      <FieldMessage v-if="showMoveInError">{{ errors.moveIn }}</FieldMessage>
      <FieldMessage v-else-if="warnings.moveIn" type="warning">{{ warnings.moveIn }}</FieldMessage>
    </PrefCard>

    <PrefCard v-for="section in leaseSections" :key="section.field" :title="section.title">
      <PillGroup v-model="form[section.field]" :options="section.options" :label="section.title" />
    </PrefCard>

    <PrefCard title="Co-tenants" subtitle="Number of people you expect to share with">
      <template #aside>
        <NumberStepper
          v-model="form.CoTenants"
          aria-label="co-tenants"
          :min="CO_TENANT_RANGE.min"
          :max="CO_TENANT_RANGE.max"
        />
      </template>
      <FieldMessage v-if="warnings.coTenants" type="warning">{{ warnings.coTenants }}</FieldMessage>
    </PrefCard>

    <PrefCard v-for="section in householdSections" :key="section.field" :title="section.title">
      <PillGroup v-model="form[section.field]" :options="section.options" :label="section.title" />
    </PrefCard>

    <PrefCard title="Amenities">
      <PillGroup v-model="form.Amenities" :options="AMENITIES" multiple label="Amenities" />
    </PrefCard>

    <PrefCard title="Preferred Locations" subtitle="Select all neighbourhoods you'd consider">
      <PillGroup
        v-model="form.PreferredLocations"
        :options="LOCATIONS"
        multiple
        variant="dark"
        any-label="Any location"
        label="Preferred locations"
      />
    </PrefCard>

    <div class="submit-bar">
      <p v-if="submitAttempted && hasErrors" class="submit-bar__hint" role="alert">
        Fix the highlighted fields to save.
      </p>
      <button type="submit" class="btn-primary" :disabled="saving || locatingDestination">
        <span v-if="saving" class="btn-spinner" aria-hidden="true" />
        {{ saving ? 'Saving…' : locatingDestination ? 'Locating destination…' : submitLabel }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.pref-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-family: var(--cr-font);
}
.value-label {
  font-size: 15px;
  font-weight: 700;
  color: var(--cr-accent);
  white-space: nowrap;
}
.value-label small {
  font-size: 11px;
  font-weight: 500;
  color: var(--cr-muted);
}
.card-footer {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--cr-border);
}
.chip-toggle {
  height: 26px;
  padding: 0 12px;
  border: 1px solid var(--cr-border-strong);
  border-radius: 999px;
  background: var(--cr-surface);
  font: 600 11px/1 var(--cr-font);
  color: var(--cr-text);
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;
}
.chip-toggle:hover:not(.is-selected) {
  border-color: var(--cr-subtle);
}
.chip-toggle.is-selected {
  background: var(--cr-accent);
  border-color: var(--cr-accent);
  color: #fff;
}
.chip-toggle:focus-visible {
  outline: none;
  box-shadow: var(--cr-focus-ring);
}
.split {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: end;
  gap: 20px;
}
.split__divider {
  width: 1px;
  height: 32px;
  background: var(--cr-border);
}
.text-input {
  box-sizing: border-box;
  width: 100%;
  height: 38px;
  padding: 0 12px;
  border: 1px solid var(--cr-border-strong);
  border-radius: var(--cr-radius-control);
  background: var(--cr-surface);
  font: 400 13px var(--cr-font);
  color: var(--cr-text);
  transition: border-color 0.15s ease;
}
.text-input:hover {
  border-color: var(--cr-subtle);
}
.text-input:focus {
  outline: none;
  border-color: var(--cr-accent);
  box-shadow: var(--cr-focus-ring);
}
.text-input.has-error {
  border-color: var(--cr-error);
}
.submit-bar {
  position: sticky;
  bottom: 0;
  z-index: 5;
  margin: 4px -4px 0;
  padding: 10px 4px 16px;
  background: linear-gradient(to top, var(--cr-bg) 75%, transparent);
}
.submit-bar__hint {
  margin: 0 0 8px;
  text-align: center;
  font-size: 12px;
  font-weight: 500;
  color: var(--cr-error);
}
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 44px;
  border: none;
  border-radius: 10px;
  background: var(--cr-accent);
  color: #fff;
  font: 600 14px var(--cr-font);
  cursor: pointer;
  box-shadow: 0 2px 6px rgb(228 0 43 / 25%);
  transition:
    background-color 0.15s ease,
    opacity 0.15s ease;
}
.btn-primary:hover:not(:disabled) {
  background: var(--cr-accent-hover);
}
.btn-primary:focus-visible {
  outline: none;
  box-shadow: var(--cr-focus-ring);
}
.btn-primary:disabled {
  opacity: 0.7;
  cursor: progress;
}
.btn-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgb(255 255 255 / 45%);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
