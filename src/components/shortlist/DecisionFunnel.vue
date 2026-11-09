<script setup>
import { computed } from 'vue'
import { agreedPerPersonBudget, householdSize, matchesAgreedFilters, shareOf } from './groupFilters'

/**
 * Where the group is in its decision: from every listing on the market down to
 * an enquiry, one stage per step. Every number is live, votes and enquiries
 * come from the same Firestore listeners the Shortlist tab uses.
 */
const props = defineProps({
  listings: { type: Array, default: () => [] },
  groupPreference: { type: Object, default: null },
  memberCount: { type: Number, default: 1 },
  shortlistedIds: { type: Array, default: () => [] },
  // Current members' listing votes: [{ listingId, userId }]
  votes: { type: Array, default: () => [] },
  // [{ listingId }]
  enquiries: { type: Array, default: () => [] },
  isGroupMode: { type: Boolean, default: false },
})

const emit = defineEmits(['go'])

const available = computed(() =>
  props.listings.filter((listing) => listing.IsAvailable !== false && Number(listing.MonthlyRent) > 0),
)

const budget = computed(() => agreedPerPersonBudget(props.groupPreference, props.memberCount))
const people = computed(() => householdSize(props.groupPreference, props.memberCount))
const hasPreferences = computed(() => !!props.groupPreference)

const fitting = computed(() =>
  available.value.filter(
    (listing) =>
      matchesAgreedFilters(listing, props.groupPreference) &&
      (budget.value === null || shareOf(listing, people.value) <= budget.value),
  ),
)

const votesByListing = computed(() => {
  const tally = new Map()
  for (const vote of props.votes) {
    if (!props.shortlistedIds.includes(vote.listingId)) continue
    tally.set(vote.listingId, (tally.get(vote.listingId) ?? 0) + 1)
  }
  return tally
})

const majority = computed(() => Math.floor(Math.max(props.memberCount, 1) / 2) + 1)
const voted = computed(() => props.shortlistedIds.filter((id) => votesByListing.value.has(id)))
const backed = computed(() =>
  props.shortlistedIds.filter((id) => (votesByListing.value.get(id) ?? 0) >= majority.value),
)
const enquired = computed(() =>
  props.shortlistedIds.filter((id) => props.enquiries.some((enquiry) => enquiry.listingId === id)),
)

const stages = computed(() => {
  const rows = [
    { key: 'market', label: 'On the market', hint: 'Available listings in CoRent', count: available.value.length },
    {
      key: 'fit',
      label: 'Fit your agreed preferences',
      hint: hasPreferences.value
        ? 'Agreed type, regions, bedrooms and budget'
        : 'No preferences agreed yet, so every listing passes',
      count: fitting.value.length,
    },
    { key: 'shortlist', label: 'Shortlisted', hint: 'Saved by your group', count: props.shortlistedIds.length },
  ]
  if (props.isGroupMode) {
    rows.push(
      { key: 'voted', label: 'Have at least one vote', hint: 'Someone backs it', count: voted.value.length },
      {
        key: 'majority',
        label: 'Majority support',
        hint: `${majority.value} of ${props.memberCount} members voted for it`,
        count: backed.value.length,
      },
      { key: 'enquiry', label: 'Enquiry sent', hint: 'An agent has been contacted', count: enquired.value.length },
    )
  }
  const top = Math.max(rows[0].count, 1)
  return rows.map((row, index) => {
    const previous = index ? rows[index - 1].count : null
    return {
      ...row,
      // Square-root scale: 424 listings and 2 enquiries cannot share a linear
      // axis and both stay readable. The real counts are printed on every bar.
      width: row.count ? Math.max(Math.sqrt(row.count / top) * 100, 9) : 3,
      conversion: previous ? Math.round((row.count / previous) * 100) : null,
    }
  })
})

const nextStep = computed(() => {
  const shortlisted = props.shortlistedIds.length
  if (!shortlisted) return { text: 'Save listings from Browse to start your shortlist.', to: '/listings', label: 'Browse listings' }
  if (!props.isGroupMode) return { text: 'Join a group on Home to vote and decide together.', to: '/home', label: 'Go to Home' }
  const unvoted = shortlisted - voted.value.length
  if (unvoted > 0)
    return {
      text: `${unvoted} shortlisted ${unvoted === 1 ? 'listing has' : 'listings have'} no votes yet.`,
      tab: 'shortlist',
      label: 'Vote on the shortlist',
    }
  if (!backed.value.length)
    return { text: 'No listing has majority support yet. Put the front-runners side by side.', tab: 'compare', label: 'Compare listings' }
  if (!enquired.value.length)
    return {
      text: `${backed.value.length} ${backed.value.length === 1 ? 'listing has' : 'listings have'} majority support. Work out the rent split, then enquire.`,
      tab: 'rent',
      label: 'Split the rent',
    }
  return { text: 'Enquiry sent. The agent will be in touch with your group.', tab: null }
})
</script>

<template>
  <section class="df" aria-labelledby="df-title">
    <div class="df-head">
      <h3 id="df-title">Decision funnel</h3>
      <p>How far your group has narrowed things down, updated live as members vote.</p>
    </div>

    <ol class="df-stages">
      <li v-for="(stage, index) in stages" :key="stage.key" class="df-stage">
        <div class="df-label">
          <strong>{{ stage.label }}</strong>
          <span>{{ stage.hint }}</span>
        </div>
        <div class="df-track">
          <div
            class="df-bar"
            :style="{ width: `${stage.width}%`, '--shade': index / Math.max(stages.length - 1, 1) }"
            role="img"
            :aria-label="`${stage.label}: ${stage.count}`"
          >
            <span>{{ stage.count }}</span>
          </div>
        </div>
        <span class="df-conversion">
          <template v-if="stage.conversion !== null">{{ stage.conversion }}%</template>
        </span>
      </li>
    </ol>
    <p class="df-note">
      Bars use a square-root scale so the later stages stay visible; % is the share kept from the stage above.
    </p>

    <div class="df-next">
      <p><strong>Next step:</strong> {{ nextStep.text }}</p>
      <RouterLink v-if="nextStep.to" class="df-action" :to="nextStep.to">{{ nextStep.label }}</RouterLink>
      <button v-else-if="nextStep.tab" type="button" class="df-action" @click="emit('go', nextStep.tab)">
        {{ nextStep.label }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.df {
  display: grid;
  gap: 12px;
  padding: 18px;
  border: 1px solid var(--chip-line);
  border-radius: 12px;
  background: #fff;
}
.df-head h3 {
  font-size: 14px;
}
.df-head p,
.df-note {
  margin-top: 4px;
  color: var(--muted);
  font-size: 12px;
}
.df-note {
  margin: 0;
  font-size: 11px;
}
/* The funnel sits in its own dotted, light-blue panel so it reads as one shape. */
.df-stages {
  display: grid;
  gap: 0;
  margin: 0;
  padding: 6px 14px;
  border: 1.5px dashed #aab5f6;
  border-radius: 12px;
  background: linear-gradient(180deg, #f6f7ff 0%, #e9edff 100%);
  list-style: none;
}
.df-stage {
  display: grid;
  grid-template-columns: 190px 1fr 44px;
  gap: 12px;
  align-items: center;
  padding: 7px 0;
}
.df-stage + .df-stage {
  border-top: 1px dotted #c3cbf7;
}
.df-stage:nth-child(even) {
  margin: 0 -14px;
  padding: 7px 14px;
  background: rgb(123 140 240 / 6%);
}
.df-label {
  display: grid;
  line-height: 1.3;
}
.df-label strong {
  font-size: 12.5px;
}
.df-label span {
  color: var(--muted);
  font-size: 11px;
}
.df-track {
  display: flex;
  justify-content: center;
}
.df-bar {
  display: grid;
  place-items: center;
  min-width: 34px;
  height: 34px;
  border: 1px solid rgb(255 255 255 / 70%);
  border-radius: 8px;
  box-shadow: 0 1px 3px rgb(101 118 220 / 25%);
  /* Darkens towards the bottom of the funnel. */
  background: color-mix(in srgb, var(--red-dark) calc(var(--shade) * 100%), #aab5f6);
  color: #fff;
  font-weight: 800;
  transition: width 0.35s ease;
}
.df-conversion {
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
  text-align: right;
}
.df-next {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--soft);
  font-size: 12.5px;
}
.df-action {
  height: 32px;
  padding: 0 14px;
  border: 0;
  border-radius: 8px;
  background: var(--red);
  color: #fff;
  font: 700 12px var(--font);
  line-height: 32px;
  text-decoration: none;
  cursor: pointer;
}
@media (max-width: 560px) {
  .df-stage {
    grid-template-columns: 1fr 40px;
  }
  .df-track {
    grid-column: 1 / -1;
    grid-row: 2;
    justify-content: flex-start;
  }
}
</style>
