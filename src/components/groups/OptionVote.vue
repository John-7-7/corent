<script setup>
import { computed } from 'vue'
import OptionInfo from './OptionInfo.vue'
import { TONE_ICONS } from './sweetSpot.js'
import './sweetSpot.css'

// Panel for preferences picked from options (region, bedrooms, property type).
const props = defineProps({
  item: { type: Object, required: true },
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['vote'])

const voting = computed(() => props.item.voting ?? null)
const voteMode = computed(() => voting.value?.mode === 'vote')
const finalised = computed(() =>
  voting.value?.settledShared ? null : (voting.value?.finalised ?? null),
)
const flexible = computed(() => voting.value?.flexible ?? [])
const total = computed(() => props.item.details.length)

const options = computed(() =>
  voteMode.value && !finalised.value
    ? [...voting.value.options].sort((a, b) => b.count - a.count)
    : [],
)
const leader = computed(() => voting.value?.leader ?? null)
const optionFor = (value) => voting.value?.options.find((option) => option.value === value)

const focus = computed(() => {
  if (finalised.value) return optionFor(finalised.value.value) ?? finalised.value
  if (leader.value) return optionFor(leader.value.value) ?? leader.value
  if (!voteMode.value) return null
  return (
    [...voting.value.options].sort((a, b) => b.supporters.length - a.supporters.length)[0] ?? null
  )
})
const works = (detail) =>
  focus.value?.supporters
    ? Boolean(focus.value.supporters.includes(detail.uid) || flexible.value.includes(detail.uid))
    : detail.fit !== false
const fitsOption = (option, detail) =>
  option.supporters.includes(detail.uid) || flexible.value.includes(detail.uid)
const infoRows = (option) =>
  props.item.details.map((detail) => ({
    uid: detail.uid,
    name: detail.name,
    ok: fitsOption(option, detail),
    note: flexible.value.includes(detail.uid) ? 'No preference' : detail.value,
  }))
const infoSummary = (option) =>
  `Works for ${props.item.details.filter((detail) => fitsOption(option, detail)).length} of ${total.value}`
const fitCount = computed(() => props.item.details.filter(works).length)

const state = computed(() =>
  finalised.value
    ? 'agreed'
    : voteMode.value
      ? 'conflict'
      : props.item.status === 'shared'
        ? 'match'
        : 'empty',
)
const noun = computed(() => props.item.label.toLowerCase())
// An open issue outranks the result until it's resolved or reopened as a vote.
const tone = computed(() => (props.item.issue?.open ? 'issue' : state.value))
const shown = computed(() =>
  tone.value === 'issue'
    ? {
        title: 'Issue raised',
        text: 'A member raised an issue with this result. Talk it through, then resolve it or start a new vote.',
      }
    : heading.value,
)

const heading = computed(
  () =>
    ({
      agreed: {
        title: `${props.item.label} agreed`,
        text: 'Everyone confirmed this choice.',
      },
      match: {
        title: 'You have a match!',
        text: 'Based on everyone’s preferences, this works for the whole house.',
      },
      conflict:
        props.item.status === 'shared'
          ? {
              title: `Vote on the ${noun.value}`,
              text: 'An issue reopened this. Vote for the option that works best.',
            }
          : {
              title: `No shared ${noun.value} yet`,
              text: 'Preferences don’t overlap. Vote for the option that works best.',
            },
      empty: {
        title: 'Not enough info yet',
        text: props.item.note || 'Some members haven’t filled this in yet.',
      },
    })[state.value],
)
const boxLabel = computed(
  () =>
    ({
      agreed: 'Agreed',
      match: 'Shared choice',
      conflict: leader.value ? 'Leading' : 'Most preferred',
    })[state.value],
)
const boxValue = computed(() => {
  const value =
    state.value === 'match' ? props.item.value : (focus.value?.label ?? props.item.value)
  // A shared bedroom count is just a number ("4", "2 – 3"), so name the unit.
  return props.item.key === 'bedrooms' && /^[\d\s–-]+$/.test(String(value))
    ? `${value} ${value === '1' ? 'bedroom' : 'bedrooms'}`
    : value
})
const boxUnit = computed(() =>
  fitCount.value === total.value
    ? 'Works for everyone'
    : `Works for ${fitCount.value} of ${total.value}`,
)
</script>

<template>
  <div class="sweet-spot" :class="`is-${tone}`">
    <header class="spot-head">
      <span class="spot-icon" aria-hidden="true">{{ TONE_ICONS[tone] }}</span>
      <span>
        <span class="eyebrow">Group decision</span>
        <strong class="spot-title">{{ shown.title }}</strong>
      </span>
    </header>
    <p class="spot-text">{{ shown.text }}</p>

    <div v-if="boxLabel && boxValue" class="range-box">
      <span class="eyebrow">{{ boxLabel }}</span>
      <strong class="range-value">{{ boxValue }}</strong>
      <span class="range-unit">{{ boxUnit }}</span>
    </div>

    <div v-if="item.details.length" class="bars">
      <div class="bar-rows">
        <div v-for="detail in item.details" :key="detail.uid" class="bar-row">
          <span class="bar-name">{{ detail.name }}</span>
          <span class="member-value" :title="detail.value">{{ detail.value }}</span>
          <span class="tick" :aria-label="works(detail) ? 'Works for them' : undefined">{{
            works(detail) ? '✓' : ''
          }}</span>
        </div>
      </div>
    </div>
    <p v-if="flexible.length && state === 'conflict'" class="private-note">
      {{ flexible.length }} {{ flexible.length === 1 ? 'member has' : 'members have' }} no
      preference, so any option works for {{ flexible.length === 1 ? 'them' : 'them all' }}.
    </p>

    <fieldset v-if="options.length" class="options">
      <legend class="eyebrow">Vote for an option</legend>
      <TransitionGroup tag="div" name="option" class="option-list">
        <div
          v-for="option in options"
          :key="option.value"
          class="option"
          :class="{
            'is-mine': voting.mine === option.value,
            'is-leading': leader?.value === option.value,
          }"
        >
          <label class="option-main">
            <input
              type="radio"
              :name="`vote-${item.key}`"
              :checked="voting.mine === option.value"
              :disabled="disabled"
              @change="emit('vote', option.value)"
            />
            <span class="option-text">
              <strong>{{ option.label }}</strong>
              <span class="delta">{{ option.supporters.length }} of {{ total }} prefer this</span>
            </span>
            <span
              class="count"
              :class="{ 'is-empty': !option.count }"
              :aria-label="`${option.count} ${option.count === 1 ? 'vote' : 'votes'}`"
            >
              <strong class="count-number">{{ option.count }}</strong>
              <span class="count-unit">{{ option.count === 1 ? 'vote' : 'votes' }}</span>
            </span>
          </label>
          <OptionInfo
            :title="option.label"
            :summary="infoSummary(option)"
            :rows="infoRows(option)"
          />
        </div>
      </TransitionGroup>
    </fieldset>
  </div>
</template>
