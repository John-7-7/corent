<script setup>
import { computed, ref, watch } from 'vue'
import RangeSlider from '../profile/RangeSlider.vue'
import { BUDGET_RANGE, formatCurrency } from '../profile/preferenceOptions.js'
import { formatRange } from '../../services/groupAggregation.js'
import OptionInfo from './OptionInfo.vue'
import './sweetSpot.css'

// The group's budget sweet spot. Every shared budget is a bar on one scale
// (private budgets stay out) and a dashed band marks the range the group lands
// on: the shared range, or when budgets don't overlap, the ideal range (up to
// the lowest maximum) or a range a member suggested. Hovering a bar or the band
// shows its range, and each option's info button shows who it works for.
const props = defineProps({
  // { members: [{ uid, name, color, min, max }], hidden, shared: { min, max } | null }
  bars: { type: Object, required: true },
  // votingFor's budget voting, only while budgets don't overlap.
  voting: { type: Object, default: null },
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['vote'])

const label = (range) => formatRange(range.min, range.max, formatCurrency)
const same = (a, b) => a && b && a.min === b.min && a.max === b.max
const keyOf = (range) => `${range.min}-${range.max}`
// A voted (stored) result. A shared match is settled too, but shows as the match.
const voteMode = computed(() => props.voting?.mode === 'vote')
const finalised = computed(() =>
  props.voting?.settledShared ? null : (props.voting?.finalised?.value ?? null),
)
const summary = computed(() => props.voting?.summary ?? { ranges: [], overlap: null })

// Options when budgets don't overlap: the ideal and every range members suggested
// this round, most votes first. Ties keep the ideal first, then amount order.
const options = computed(() => {
  if (!voteMode.value || finalised.value) return []
  const ideal = props.voting.suggestion
  const countOf = (range) => summary.value.ranges.find((pick) => same(pick, range))?.count ?? 0
  return [
    ...(ideal ? [{ min: ideal.min, max: ideal.max, ideal: true, count: countOf(ideal) }] : []),
    ...summary.value.ranges
      .filter((pick) => !same(pick, ideal))
      .map((pick) => ({ min: pick.min, max: pick.max, count: pick.count })),
  ].sort((a, b) => b.count - a.count)
})
// The leading option (most votes, no tie) shows green.
const leaderKey = computed(() => {
  const most = Math.max(0, ...options.value.map((option) => option.count))
  const leaders = options.value.filter((option) => most > 0 && option.count === most)
  return leaders.length === 1 ? keyOf(leaders[0]) : null
})

// My own range on the slider, previewed on the bars while open.
const ownOpen = ref(false)
const step = BUDGET_RANGE.step
const own = ref([0, 0])

// The band: my own range while I pick it, else the agreed or shared range, else
// the leading option, else the ideal.
const band = computed(() => {
  if (ownOpen.value) return { min: own.value[0], max: own.value[1] }
  if (finalised.value) return finalised.value
  if (voteMode.value) {
    const leader = options.value.find((option) => keyOf(option) === leaderKey.value)
    return leader ?? options.value[0] ?? null
  }
  return props.bars.shared
})

// One scale for every bar, option and the band, padded to the slider's step.
const scale = computed(() => {
  const amounts = [
    ...props.bars.members.flatMap((bar) => [bar.min, bar.max]),
    ...options.value.flatMap((option) => [option.min, option.max]),
    ...(finalised.value ? [finalised.value.min, finalised.value.max] : []),
  ].filter(Number.isFinite)
  const low = amounts.length ? Math.min(...amounts) : BUDGET_RANGE.min
  const high = amounts.length ? Math.max(...amounts) : BUDGET_RANGE.max
  return {
    min: Math.max(BUDGET_RANGE.min, Math.floor((low - 100) / step) * step),
    max: Math.min(BUDGET_RANGE.max, Math.ceil((high + 100) / step) * step),
  }
})
const percent = (value) =>
  ((value - scale.value.min) / (scale.value.max - scale.value.min || 1)) * 100
const span = ({ min, max }) => ({
  left: `${percent(min)}%`,
  width: min === max ? '4px' : `${percent(max) - percent(min)}%`,
})

const snap = (value) =>
  Math.min(scale.value.max, Math.max(scale.value.min, Math.round(value / step) * step))
function openOwn() {
  const from = props.voting?.mine ?? band.value ?? props.voting?.suggestion
  own.value = from ? [snap(from.min), snap(from.max)] : [scale.value.min, scale.value.max]
  ownOpen.value = true
}
watch(finalised, () => (ownOpen.value = false))
function voteOwn() {
  emit('vote', { min: own.value[0], max: own.value[1] })
  ownOpen.value = false
}

// A member's budget works when the band's top is affordable for them and reaches
// their minimum (a maximum is a hard limit, a minimum is flexible).
const worksFor = (range, bar) => range.max <= bar.max && range.max >= bar.min
const works = (bar) => Boolean(band.value && worksFor(band.value, bar))
// Who an option works for, for its info card (shared budgets only).
const infoRows = (range) =>
  props.bars.members.map((bar) => ({
    uid: bar.uid,
    name: bar.name,
    ok: worksFor(range, bar),
    note:
      range.max > bar.max
        ? `${formatCurrency(range.max - bar.max)} over their max`
        : range.max < bar.min
          ? `${formatCurrency(bar.min - range.max)} under their minimum`
          : 'Within their budget',
  }))
const infoSummary = (range) => {
  const fits = props.bars.members.filter((bar) => worksFor(range, bar)).length
  const hidden = props.bars.hidden ? ` · ${props.bars.hidden} private, not counted` : ''
  return `Works for ${fits} of ${props.bars.members.length} shared budgets${hidden}`
}
// How an option compares with my own budget, shown only to me.
const delta = (range) => {
  const my = props.voting?.myRange
  if (!my || !range) return ''
  if (range.max > my.max) return `${formatCurrency(range.max - my.max)} over your max`
  if (range.max < my.min) return `${formatCurrency(my.min - range.max)} under your minimum`
  return 'Within your budget'
}

const state = computed(() =>
  finalised.value ? 'agreed' : voteMode.value ? 'conflict' : props.bars.shared ? 'match' : 'empty',
)
const heading = computed(
  () =>
    ({
      agreed: { title: 'Budget agreed', text: 'Everyone confirmed this monthly budget.' },
      match: {
        title: 'You have a match!',
        text: 'Based on everyone’s ranges, this monthly budget works for the whole house.',
      },
      // An issue can reopen a shared range as a vote.
      conflict: props.bars.shared
        ? {
            title: 'Vote on the budget',
            text: 'An issue reopened the budget. Keep the shared range, or suggest your own.',
          }
        : {
            title: 'No shared range yet',
            text: 'Budgets don’t overlap. Go with the ideal range, or suggest your own.',
          },
      empty: { title: 'No shared budgets yet', text: 'Nobody has shared a budget range yet.' },
    })[state.value],
)
const boxLabel = computed(() =>
  ownOpen.value
    ? 'Preview'
    : { agreed: 'Agreed range', match: 'Shared range' }[state.value] ||
      (leaderKey.value && !same(band.value, props.voting?.suggestion)
        ? 'Leading range'
        : 'Ideal range'),
)
</script>

<template>
  <div class="sweet-spot" :class="`is-${state}`">
    <header class="spot-head">
      <span class="spot-icon" aria-hidden="true">✦</span>
      <span>
        <span class="eyebrow">Group sweet spot</span>
        <strong class="spot-title">{{ heading.title }}</strong>
      </span>
    </header>
    <p class="spot-text">{{ heading.text }}</p>

    <div v-if="band" class="range-box">
      <span class="eyebrow">{{ boxLabel }}</span>
      <strong class="range-value">{{ label(band) }}</strong>
      <span class="range-unit">per person / month</span>
    </div>

    <div v-if="bars.members.length" class="bars">
      <div class="bar-row scale-row" aria-hidden="true">
        <span></span>
        <span class="scale-ends">
          <span>{{ formatCurrency(scale.min) }}</span>
          <span>{{ formatCurrency(scale.max) }}</span>
        </span>
        <span></span>
      </div>
      <div class="bar-rows">
        <div v-for="bar in bars.members" :key="bar.uid" class="bar-row">
          <span class="bar-name">{{ bar.name }}</span>
          <span class="track">
            <span
              class="bar"
              tabindex="0"
              :style="{ ...span(bar), '--bar': bar.color }"
              :data-tip="`${bar.name}: ${label(bar)}`"
              :aria-label="`${bar.name}: ${label(bar)}`"
            ></span>
          </span>
          <span class="tick" :aria-label="works(bar) ? 'Works for them' : undefined">{{
            works(bar) ? '✓' : ''
          }}</span>
        </div>
        <!-- The band crosses every row, like a window on the scale. -->
        <div v-if="band" class="band-layer">
          <span class="band" :style="span(band)" :data-tip="label(band)"></span>
        </div>
      </div>
    </div>
    <p v-if="bars.hidden" class="private-note">
      {{ bars.hidden }} {{ bars.hidden === 1 ? 'member keeps their' : 'members keep their' }} budget
      private, so {{ bars.hidden === 1 ? "it isn't" : "they aren't" }} shown or used here.
    </p>

    <fieldset v-if="options.length" class="options">
      <legend class="eyebrow">Vote for a range</legend>
      <!-- Options slide into their new place when the vote order changes. -->
      <TransitionGroup tag="div" name="option" class="option-list">
        <div
          v-for="option in options"
          :key="keyOf(option)"
          class="option"
          :class="{
            'is-mine': same(voting.mine, option),
            'is-leading': keyOf(option) === leaderKey,
          }"
        >
          <label class="option-main">
            <input
              type="radio"
              name="budget-vote"
              :checked="same(voting.mine, option)"
              :disabled="disabled"
              @change="emit('vote', { min: option.min, max: option.max })"
            />
            <span class="option-text">
              <span class="option-title">
                <strong>{{ label(option) }}</strong>
                <span v-if="option.ideal" class="tag">Ideal</span>
              </span>
              <span class="delta">{{
                option.ideal
                  ? `${bars.shared ? 'The shared range' : 'Up to the lowest maximum'} · ${delta(option)}`
                  : delta(option)
              }}</span>
              <span class="mini-track" aria-hidden="true">
                <span class="mini-band" :style="span(option)"></span>
              </span>
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
            :title="label(option)"
            :summary="infoSummary(option)"
            :rows="infoRows(option)"
          />
        </div>
      </TransitionGroup>

      <div class="option own">
        <button
          v-if="!ownOpen"
          type="button"
          class="own-toggle"
          :disabled="disabled"
          @click="openOwn"
        >
          Suggest my own range
        </button>
        <template v-else>
          <RangeSlider
            v-model="own"
            :min="scale.min"
            :max="scale.max"
            :step="step"
            :format-value="formatCurrency"
            label="Your suggested budget range per person"
          />
          <span class="delta">{{ delta({ min: own[0], max: own[1] }) }}</span>
          <span class="own-actions">
            <button type="button" class="btn btn-secondary" @click="ownOpen = false">Cancel</button>
            <button type="button" class="btn btn-primary" @click="voteOwn">
              Suggest {{ formatRange(own[0], own[1], formatCurrency) }}
            </button>
          </span>
        </template>
      </div>
    </fieldset>
  </div>
</template>
