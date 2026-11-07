<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import { formatRent } from '@/services/listingsService'
import { getListings } from '@/services/listings'
import { useShortlist } from '@/services/shortlistService'
import { activeGroupId } from '@/services/activeGroup'
import { onAuthChange } from '@/services/authService'
import { submitEnquiry, subscribeToGroupEnquiries, } from '@/services/enquiryService'
import { getMemberProfiles } from '@/services/groupSummaryService'
import { watchGroupPreference } from '@/services/groupPreferencesService'
import { rankShortlist, scoreListings } from '@/services/listingScoring'
import { commuteKey, commuteMatrix, hasEstimates } from '@/services/routingService'
import CommuteChart from '@/components/listings/CommuteChart.vue'
import ListingMap from '@/components/listings/ListingMap.vue'
import ChartTooltip from '@/components/listings/ChartTooltip.vue'
import ScoreBreakdown from '@/components/listings/ScoreBreakdown.vue'

import {
  voteForListing,
  removeListingVote,
  subscribeToGroupVotes,
} from '@/services/groupShortlistService'

// Add/remove goes through shortlistService (shared with Browse) and follows the
// group picked on Home; votes and enquiries are scoped to that same group.
const { listingIds, entries, storageError, loading, isGroupMode, activeGroup, removeFromShortlist } =
  useShortlist()
const rawListings = ref([])

// Controls which tab is currently displayed.
const activeTab = ref('shortlist')
// Controls the view inside Property Comparison.
const comparisonView = ref('chart')

// Rough Singapore bounds, used to place real coordinates on the overview map.

// The current user's information
const currentUserId = ref('')
const currentUserDisplayName = ref('')
const currentUserPhotoURL = ref('')
const groupId = ref('')
const currentUserInitials = computed(() => {
  const displayName = currentUserDisplayName.value || 'CoRent member'
  const parts = displayName.trim().split(/\s+/).filter(Boolean)
  return parts.length > 1
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    : displayName.slice(0, 2).toUpperCase()
})

// Properties shared by everyone in the group
const groupListingIds = ref([])

// Votes shared by everyone in the group
const groupVotes = ref([])

// Enquiries shared by everyone in the group
const groupEnquiries = ref([])
const groupError = ref('')

// Group preferences and member profiles, for the group-match % (F-REQ-015)
const groupPreference = ref(null)
const memberProfiles = ref([])

// Door-to-door commute time per listing per member (F-REQ-017.5). Only the
// shortlist is measured: one OneMap request per listing per member is fine for
// a handful of listings and is not for the whole corpus.
const commutes = ref(new Map())
const commuteLoading = ref(false)

// Which shortlist card has its score breakdown open.
const expandedScoreId = ref('')

// Store the Firestore listeners so we can stop them later
let unsubscribeVotes = null
let unsubscribeEnquiries = null
let unsubscribePreference = null

const unsubscribeAuth = onAuthChange((user) => {
  currentUserId.value = user?.uid ?? ''
})

getListings()
  .then((all) => {
    rawListings.value = all
  })
  .catch((error) => {
    console.error('Error loading listings:', error)
    groupError.value = 'Unable to load listings.'
  })

function stopGroupListeners() {
  unsubscribeVotes?.()
  unsubscribeEnquiries?.()
  unsubscribePreference?.()
  unsubscribeVotes = unsubscribeEnquiries = unsubscribePreference = null
}

// Re-subscribe whenever the active group changes (or the user leaves it).
watch(
  groupId,
  (id) => {
    stopGroupListeners()
    groupVotes.value = []
    groupEnquiries.value = []
    groupPreference.value = null
    groupError.value = ''
    if (!id) return

    // Listen for shared voting changes
    unsubscribeVotes = subscribeToGroupVotes(
      id,
      (votes) => {
        groupVotes.value = votes
      },
      (error) => {
        groupError.value = error.message
      },
    )

    // Listen for enquiries submitted by the group
    unsubscribeEnquiries = subscribeToGroupEnquiries(
      id,
      (items) => {
        groupEnquiries.value = items
      },
      (error) => {
        console.error('Error loading group enquiries:', error)
      },
    )

    // The agreed preferences change as the group votes, so keep scores live.
    unsubscribePreference = watchGroupPreference(
      id,
      (preference) => {
        groupPreference.value = preference
      },
      (error) => {
        console.error('Error loading group preferences:', error)
      },
    )

  },
  { immediate: true },
)

// Reload profiles when members join or leave, not only when the group changes.
watch(
  () => (activeGroup.value?.memberIds ?? []).join(),
  async () => {
    try {
      memberProfiles.value = await getMemberProfiles(activeGroup.value?.memberIds ?? [])
    } catch (error) {
      console.error('Error loading member preferences:', error)
    }
  },
  { immediate: true },
)

onUnmounted(() => {
  stopGroupListeners()
  unsubscribeAuth?.()
})

// Members in the shape listingScoring expects.
const scoringMembers = computed(() =>
  (activeGroup.value?.memberIds ?? []).map((uid) => ({
    uid,
    name: activeGroup.value?.members?.find((member) => member.id === uid)?.name || 'Group member',
    profile: memberProfiles.value.find((profile) => profile.UserID === uid) || null,
  })),
)

// The shortlisted Housing_Listing records, in corpus order.
const shortlistedListings = computed(() =>
  rawListings.value.filter((l) => listingIds.value.includes(l.ListingID)),
)

// Members in the shape routingService expects. Only those who set a commute
// destination can be measured; the rest simply have no commute row.
const commuteMembers = computed(() =>
  scoringMembers.value
    .filter((member) => member.profile?.CommuteDestination?.Lat)
    .map((member) => ({
      id: member.uid,
      name: member.name,
      destination: member.profile.CommuteDestination,
      maxCommuteTime: member.profile.MaxCommuteTime ?? null,
    })),
)

// Commute destinations as ListingMap draws them: an orange marker per member,
// so the group can see the shortlist against the places they travel to.
const mapDestinations = computed(() =>
  commuteMembers.value.map((member) => ({
    MemberName: member.name,
    Address: member.destination?.Address ?? 'Commute destination',
    Lat: member.destination.Lat,
    Lng: member.destination.Lng,
  })),
)

// Recomputed when the shortlist or the members change. routingService caches
// results, so re-runs after the first are effectively free.
watch(
  () => [listingIds.value.join('|'), commuteMembers.value.map((m) => m.id).join('|')].join('//'),
  async () => {
    if (!shortlistedListings.value.length || !commuteMembers.value.length) {
      commutes.value = new Map()
      return
    }
    commuteLoading.value = true
    try {
      commutes.value = await commuteMatrix(shortlistedListings.value, commuteMembers.value)
    } catch {
      commutes.value = new Map()
    } finally {
      commuteLoading.value = false
    }
  },
  { immediate: true },
)

// Full scoring result per listing, commute included (F-REQ-015).
const scoredById = computed(() => {
  if (!isGroupMode.value) return new Map()
  return new Map(
    scoreListings(
      shortlistedListings.value,
      groupPreference.value,
      scoringMembers.value,
      commutes.value,
    ).map((entry) => [entry.listingId, entry]),
  )
})

// Group-match % per shortlisted listing; null means insufficient data (AC4).
const scoreById = computed(
  () => new Map([...scoredById.value].map(([id, entry]) => [id, entry.score])),
)

// True when any commute shown came from a straight-line estimate rather than
// OneMap, so the page can say so instead of implying it was measured.
const commutesEstimated = computed(() => hasEstimates(commutes.value))

// Map a Housing_Listing record onto the shape this page renders.
function toShortlistItem(l) {
  const n = [...String(l.ListingID)].reduce((a, c) => a + c.charCodeAt(0), 0) % 3
  return {
    id: l.ListingID,
    title: l.Title,
    price: l.MonthlyRent,
    area: l.Neighbourhood,
    image: l.ImageURL,
    areaSqm: l.AreaSqm, // Floor area in square metres
    beds: l.Bedrooms,
    available: l.IsAvailable,
    tone: ['', 'alt', 'cool'][n],

    match: scoreById.value.get(l.ListingID) ?? null,
    sampleVotes: 0,
    sampleComments: 0,
  }
}

// Photo URLs that failed to load, so the gradient shows through instead of a
// broken image icon. Vue tracks Set mutations, so add() re-renders.
const brokenImages = ref(new Set())

    if (!user) {
      groupError.value = 'Please log in to view your group shortlist.'
      return
    }

    currentUserId.value = user.uid
    currentUserDisplayName.value =
      user.displayName || user.email?.split('@')[0] || 'CoRent member'
    currentUserPhotoURL.value = user.photoURL || ''

    // 2. Find the group this user belongs to
    const groups = await getUserGroups(user.uid)

    if (groups.length === 0) {
      groupError.value = 'You are not currently in a group.'
      return
    }

    groupId.value = groups[0].id
    // Add any properties from the old local shortlist
    // into the group's shared shortlist.
    for (const listingId of listingIds.value) {
      try {
        await addGroupShortlist(
          groupId.value,
          listingId,
          currentUserId.value,
        )
      } catch (error) {
        console.error('Error adding property to group shortlist:', error)
      }
    }

    // 3. Load all available property listings
    const all = await getListings()
    listings.value = all.map(toShortlistItem)

    // 4. Listen for shared shortlist changes
    unsubscribeShortlist = subscribeToGroupShortlist(
      groupId.value,
      (items) => {
        groupListingIds.value = items.map((item) => item.listingId)
      },
      (error) => {
        groupError.value = error.message
      },
    )

    // 5. Listen for shared voting changes
    unsubscribeVotes = subscribeToGroupVotes(
      groupId.value,
      (votes) => {
        groupVotes.value = votes
      },
      (error) => {
        groupError.value = error.message
      },
    )

    // 6. Listen for enquiries submitted by the group
    unsubscribeEnquiries = subscribeToGroupEnquiries(
      groupId.value,
      (items) => {
        groupEnquiries.value = items
      },
      (error) => {
        console.error('Error loading group enquiries:', error)
      },
    )
  } catch (error) {
    console.error('Error loading group shortlist:', error)
    groupError.value = 'Unable to load your group shortlist.'
  }
})

onUnmounted(() => {
  if (unsubscribeShortlist) {
    unsubscribeShortlist()
  }

  if (unsubscribeVotes) {
    unsubscribeVotes()
  }

  if (unsubscribeEnquiries) unsubscribeEnquiries()
})
const selectedListingId = ref('')
const expandedCommentsId = ref('')
const enquiryDialogOpen = ref(false)
const emailReceipt = ref(false)
const enquiryError = ref('')
const agentContactDialogOpen = ref(false)

// In the order members added them.
const savedListings = computed(() =>
  listingIds.value
    .map((id) => rawListings.value.find((l) => l.ListingID === id))
    .filter(Boolean)
    .map(toShortlistItem),
)

function getVoteCount(listingId) {
  return groupVotes.value.filter(
    (vote) => vote.listingId === listingId,
  ).length
}

// Data used by the Property Comparison chart and table.
const comparisonListings = computed(() => {
  const byId = new Map(rawListings.value.map((l) => [l.ListingID, l]))
  return savedListings.value.map((listing) => {
    // Commute is per member, so the table carries the binding constraint: the
    // longest journey, and how many members it actually works for.
    const rows = commuteMembers.value
      .map((m) => commutes.value.get(commuteKey(listing.id, m.id)))
      .filter(Boolean)
    const measured = rows.filter((r) => r.source === 'onemap')
    return {
      ...listing,
      votes: getVoteCount(listing.id),
      region: byId.get(listing.id)?.Region ?? null,
      rentPerSqm: listing.areaSqm > 0 ? listing.price / listing.areaSqm : null,
      worstCommute: measured.length ? Math.max(...measured.map((r) => r.minutes)) : null,
      commuteOk: rows.length ? rows.filter((r) => r.withinLimit === true).length : null,
      commuteOf: rows.length,
    }
  })
})

/**
 * Axis labels that actually distinguish the bars.
 *
 * Every imported title opens with the same boilerplate — "Common Room (HDB)
 * for Rent in …" — so truncating from the left labelled all five bars
 * identically. Strip whatever prefix the shortlisted titles share and keep the
 * part that differs, which is the address.
 */
function distinctLabels(titles) {
  if (titles.length < 2) return titles.map((t) => t.trim())
  let prefix = titles[0]
  for (const title of titles.slice(1)) {
    let i = 0
    while (i < prefix.length && i < title.length && prefix[i] === title[i]) i += 1
    prefix = prefix.slice(0, i)
  }
  // Back off to a word boundary so no label starts mid-word.
  prefix = prefix.slice(0, prefix.lastIndexOf(' ') + 1)
  return titles.map((title) => (title.slice(prefix.length) || title).trim())
}

const axisLabels = computed(() =>
  distinctLabels(comparisonListings.value.map((l) => l.title || '')),
)
// Labels sit under bars spaced 560/n apart, so a fixed truncation that fits
// five listings collides at eight. Fit the label to the slot instead: at
// font-size 9 a character averages about 5.2px.
const labelChars = computed(() => {
  const n = Math.max(comparisonListings.value.length, 1)
  return Math.min(18, Math.max(6, Math.floor(560 / n / 5.2)))
})
const truncate = (text, max = labelChars.value) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text

/**
 * Group fit (F-REQ-020). Plotted first because it is the one quantity the
 * group is actually deciding on; rent and votes are near-identical across a
 * shortlist, so a rent chart alone separates nothing.
 *
 * The axis is an absolute 0-100, not scaled to the best candidate: a 62% must
 * look like 62% whether or not something better is on the shortlist
 * (NFR-REQ-06).
 */
const fitChartData = computed(() => {
  const items = comparisonListings.value
  if (!items.length) return []
  return items.map((listing, index) => ({
    ...listing,
    label: axisLabels.value[index] ?? listing.title,
    x: 80 + index * (560 / Math.max(items.length, 1)),
    fitHeight: listing.match !== null ? (listing.match / 100) * 180 : 0,
  }))
})
const hasAnyFit = computed(() => comparisonListings.value.some((l) => l.match !== null))

// Scale the rent and vote values into chart positions.
const chartData = computed(() => {
  const items = comparisonListings.value

  if (!items.length) return []

  const maxRent = Math.max(...items.map((l) => l.price), 1)

  return items.map((listing, index) => ({
    ...listing,
    label: axisLabels.value[index] ?? listing.title,
    x: 80 + index * (560 / Math.max(items.length, 1)),
    barHeight: (listing.price / maxRent) * 180,
  }))
})

/**
 * Hover and keyboard-focus readout for both charts (one at a time). Position
 * comes from the hit target's own box rather than the pointer, so a focused
 * bar reads the same as a hovered one and the tooltip does not jitter.
 */
const hovered = ref(null)
function showChartTip(chart, item, event) {
  const wrapper = event.currentTarget.closest('.comparison-chart-wrapper')
  if (!wrapper) return
  const mark = event.currentTarget.getBoundingClientRect()
  const box = wrapper.getBoundingClientRect()
  const top = mark.top - box.top
  // The readout carries a photo, so it is tall enough to be clipped by the
  // card when a bar sits near the top of the plot. Drop it below the column
  // when there is not room above.
  const ESTIMATED_HEIGHT = 190
  const TIP_HALF_WIDTH = 112
  const below = top < ESTIMATED_HEIGHT
  hovered.value = {
    chart,
    item,
    below,
    // Centred on the column, but kept inside the card: the first and last
    // bars sit close enough to the edge that a 212px readout would hang off.
    x: Math.min(
      Math.max(mark.left - box.left + mark.width / 2, TIP_HALF_WIDTH),
      Math.max(box.width - TIP_HALF_WIDTH, TIP_HALF_WIDTH),
    ),
    y: below ? mark.bottom - box.top + 8 : top,
  }
}
function hideChartTip() {
  hovered.value = null
}

// Votes on their own scale. Kept separate from chartData on purpose: one plot
// with two scales makes unrelated quantities look comparable.
const voteChartData = computed(() => {
  const items = comparisonListings.value
  if (!items.length) return []
  const maxVotes = Math.max(...items.map((l) => l.votes), 1)
  return items.map((listing, index) => ({
    ...listing,
    label: axisLabels.value[index] ?? listing.title,
    x: 80 + index * (560 / Math.max(items.length, 1)),
    voteHeight: (listing.votes / maxVotes) * 80,
  }))
})

// Nobody has voted yet: a row of zero-height bars says nothing, so say it.
const hasAnyVotes = computed(() => comparisonListings.value.some((l) => l.votes > 0))

/**
 * Who actually voted for each listing.
 *
 * The avatar row on every card used to render a hardcoded ['AT','BL','CM','DK']
 * — four invented members, identical on every card and in every group, sitting
 * next to a vote counter showing the real number. The two contradicted each
 * other. The data was already here: votes carry a userId and the group carries
 * names.
 */
const initialsOf = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return parts.slice(0, 2).map((part) => part[0].toUpperCase()).join('')
}

// Colour follows the person, not their position in the row, so a member keeps
// the same colour on every card however the votes are ordered.
const AVATAR_TONES = 4
const avatarTone = (uid) =>
  [...String(uid)].reduce((sum, char) => sum + char.charCodeAt(0), 0) % AVATAR_TONES

const MAX_AVATARS = 4

const votersByListing = computed(() => {
  const byListing = new Map()
  groupVotes.value.forEach((vote) => {
    if (!vote.listingId || !vote.userId) return
    const voters = byListing.get(vote.listingId) ?? []
    if (voters.some((voter) => voter.uid === vote.userId)) return
    const member = scoringMembers.value.find((m) => m.uid === vote.userId)
    voters.push({
      uid: vote.userId,
      name: member?.name || 'Group member',
      initials: initialsOf(member?.name),
      tone: avatarTone(vote.userId),
    })
    byListing.set(vote.listingId, voters)
  })
  return byListing
})

const votersFor = (listingId) => votersByListing.value.get(listingId) ?? []

function hasUserVoted(listingId) {
  return groupVotes.value.some(
    (vote) =>
      vote.listingId === listingId &&
      vote.userId === currentUserId.value,
  )
}

// Most votes first, group-match % breaking ties (F-REQ-018.7 and .9). The sort
// itself lives in listingScoring.rankShortlist so the Shortlist page and
// anything else that ranks cannot drift apart; this only maps the order back
// onto the records the template renders.
const rankedListings = computed(() => {
  const tally = Object.fromEntries(savedListings.value.map((l) => [l.id, getVoteCount(l.id)]))
  const byId = new Map(savedListings.value.map((l) => [l.id, l]))
  return rankShortlist(
    savedListings.value.map((l) => ({
      listingId: l.id,
      score: typeof l.match === 'number' ? l.match : null,
    })),
    tally,
  )
    .map((entry) => byId.get(entry.listingId))
    .filter(Boolean)
})

const enquiryListing = computed(
  () =>
    savedListings.value.find(
      (listing) => listing.id === selectedListingId.value,
    ) ?? null,
)

// ListingMap emits the raw Housing_Listing record; the shortlist cards are
// keyed by ListingID.
function selectMapPin(listing) {
  const id = listing.ListingID ?? listing.id
  selectedListingId.value = id
  document.getElementById(`shortlist-${id}`)?.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
  })
}

function hasEnquiryBeenSent(listingId) {
  return groupEnquiries.value.some(
    (enquiry) => enquiry.listingId === listingId,
  )
}

async function removeListing(id) {
  try {
    await removeFromShortlist(id)
    if (selectedListingId.value === id) selectedListingId.value = ''
  } catch (error) {
    console.error('Error removing property:', error)
    groupError.value = 'Unable to remove this property.'
  }
}

/** Who added a listing, for the group shortlist. Null in personal mode. */
const addedByFor = (listingId) =>
  entries.value.find((entry) => entry.listingId === listingId)?.addedByName ?? null

async function voteForProperty(listingId) {
  if (!groupId.value) {
    groupError.value = 'Join a group to vote on listings.'
    return
  }
  try {
    await voteForListing(
      groupId.value,
      listingId,
      currentUserId.value,
    )
  } catch (error) {
    console.error('Error voting for property:', error)
    groupError.value = 'Unable to submit your vote.'
  }
}

async function unvoteForProperty(listingId) {
  try {
    await removeListingVote(
      groupId.value,
      listingId,
      currentUserId.value,
    )
  } catch (error) {
    console.error('Error removing vote:', error)
    groupError.value = 'Unable to remove your vote.'
  }
}

async function confirmEnquiry() {
  if (!enquiryListing.value) {
    enquiryError.value = 'Add a listing to your shortlist before submitting an enquiry.'
    return
  }

  if (hasEnquiryBeenSent(enquiryListing.value.id)) {
    enquiryError.value = 'Your group has already submitted an enquiry for this listing.'
    return
  }

  if (!groupId.value || !currentUserId.value) {
    enquiryError.value = 'Join a group to submit an enquiry.'
    return
  }

  try {
    enquiryError.value = ''

    await submitEnquiry(
      groupId.value,
      currentUserId.value,
      {
        ListingID: enquiryListing.value.id,
        Title: enquiryListing.value.title,
      },
      emailReceipt.value,
    )

    emailReceipt.value = false
    enquiryDialogOpen.value = false
    agentContactDialogOpen.value = true
  } catch (error) {
    console.error('Error submitting enquiry:', error)
    enquiryError.value = 'Unable to submit your enquiry. Please try again.'
  }
}
</script>

<template>
  <div>
    <header class="page-head">
      <h1>{{ activeTab === 'shortlist' ? 'Shortlist' : 'Analytics' }}</h1>

      <p v-if="activeTab === 'shortlist'">
        {{ savedListings.length }}
        {{ savedListings.length === 1 ? 'listing' : 'listings' }}
        shortlisted
        <template v-if="isGroupMode"> · shared with {{ activeGroup?.name }}</template>
        <template v-else> · only on this device until you join a group</template>
      </p>

      <p v-else>
        Compare your group's shortlisted properties.
      </p>
    </header>

    <!-- Tab navigation -->
    <nav class="shortlist-tabs" aria-label="Shortlist sections">
      <button
        type="button"
        :class="{ 'shortlist-tab--active': activeTab === 'shortlist' }"
        @click="activeTab = 'shortlist'"
      >
        <AppIcon name="bookmark" :size="14" />
        Shortlist
      </button>

      <button
        type="button"
        :class="{ 'shortlist-tab--active': activeTab === 'analytics' }"
        @click="activeTab = 'analytics'"
      >
        <AppIcon name="chart" :size="14" />
        Analytics
      </button>
    </nav>

    <main v-if="activeTab === 'shortlist'" class="content">
      <section class="shortlist-layout">
        <aside
          v-if="savedListings.length"
          class="consensus-banner"
          aria-label="Group shortlist status"
        >
          <span>
            <strong>Group shortlist</strong>
            <small>Votes are shared with all group members.</small>
          </span>
        </aside>

        <section class="location-section" aria-labelledby="location-overview-title">
          <h2 id="location-overview-title">Location Overview</h2>
          <ListingMap
            v-if="shortlistedListings.length"
            :listings="shortlistedListings"
            :destinations="mapDestinations"
            @select="selectMapPin"
          />
          <p v-else class="map-empty">Save listings to see their locations here.</p>
          <p v-if="shortlistedListings.length" class="map-hint">
            Select a pin to highlight its listing below.
            <template v-if="mapDestinations.length">
              Orange markers are members' commute destinations.
            </template>
          </p>
        </section>

        <p v-if="storageError || groupError" class="error-message" role="alert">
          {{ storageError || groupError }}
        </p>
        <p v-else-if="loading" class="muted">Loading your group's shortlist…</p>

        <div v-if="savedListings.length" class="listing-list">
          <article
            v-for="listing in rankedListings"
            :id="`shortlist-${listing.id}`"
            :key="listing.id"
            class="listing-card"
            :class="{
              'listing-card--selected': selectedListingId === listing.id,
              'listing-card--unavailable': !listing.available,
            }"
            @click="selectedListingId = listing.id"
          >
            <div class="listing-main">
              <div class="listing-photo" :class="`listing-photo--${listing.tone || 'warm'}`">
                <!-- The gradient behind this is the fallback, not the design:
                     99.co photo URLs are signed and expire. -->
                <img
                  v-if="listing.image && !brokenImages.has(listing.id)"
                  :src="listing.image"
                  alt=""
                  loading="lazy"
                  @error="brokenImages.add(listing.id)"
                />
                <span v-if="!listing.available" class="availability">Unavailable</span>
              </div>
              <div class="listing-info">
                <div class="listing-title-row">
                  <h3>{{ listing.title }}</h3>
                  <span
                    v-if="hasEnquiryBeenSent(listing.id)"
                    class="enquiry-sent-badge"
                  >
                    <AppIcon name="check" :size="12" />
                    Enquiry sent
                  </span>
                  <div class="listing-title-actions">
                    <span v-if="listing.match !== null" class="match-pill">{{ listing.match }}%</span>
                    <button
                      class="remove-listing"
                      type="button"
                      :aria-label="`Remove ${listing.title} from shortlist`"
                      @click="removeListing(listing.id)"
                    >
                      <AppIcon name="bookmark" :size="13" :fill="true" />
                    </button>
                  </div>
                </div>
                <p class="rent">{{ formatRent(listing.price) }}<span>/mo</span></p>
                <p class="listing-meta">
                  <AppIcon name="pin" :size="12" />
                  {{ listing.area }} · {{ listing.beds > 0 ? `${listing.beds} rooms` : 'Bedrooms not listed' }}
                  <template v-if="addedByFor(listing.id)">
                    · added by {{ addedByFor(listing.id) }}
                  </template>
                </p>

                <div class="social-row">
                  <div
                    v-if="hasUserVoted(listing.id)"
                    class="member-avatars"
                    :aria-label="`${currentUserDisplayName} voted`"
                  >
                    <img
                      v-if="currentUserPhotoURL"
                      class="member-avatar"
                      :src="currentUserPhotoURL"
                      alt=""
                    />
                    <span v-else class="member-avatar">{{ currentUserInitials }}</span>
                  </div>
                  <span v-else class="small muted">No votes yet</span>
                  <button
                    class="vote-button"
                    type="button"
                    :class="{ 'vote-button--active': hasUserVoted(listing.id) }"
                    :aria-label="hasUserVoted(listing.id)
                      ? `Remove your vote from ${listing.title}`
                      : `Vote for ${listing.title}`"
                    @click="hasUserVoted(listing.id)
                      ? unvoteForProperty(listing.id)
                      : voteForProperty(listing.id)"
                  >
                    <AppIcon v-if="hasUserVoted(listing.id)" name="check" :size="13" />
                    {{ hasUserVoted(listing.id) ? 'Voted' : 'Vote for this' }}
                    <span class="vote-count">{{ getVoteCount(listing.id) }}</span>
                  </button>
                </div>
              </div>
            </div>

            <button
              v-if="scoredById.get(listing.id)"
              class="comments-toggle"
              type="button"
              :aria-expanded="expandedScoreId === listing.id"
              @click.stop="expandedScoreId = expandedScoreId === listing.id ? '' : listing.id"
            >
              <span>
                <AppIcon name="chart" :size="13" />
                {{ expandedScoreId === listing.id ? 'Hide' : 'Why' }} this score
              </span>
              <AppIcon
                class="comments-chevron"
                :class="{ 'comments-chevron--open': expandedScoreId === listing.id }"
                name="chevron"
                :size="14"
              />
            </button>

            <div v-if="expandedScoreId === listing.id" class="score-panel" @click.stop>
              <ScoreBreakdown
                :result="scoredById.get(listing.id)"
                :rank="rankedListings.findIndex((l) => l.id === listing.id) + 1"
                :votes="getVoteCount(listing.id)"
              />
            </div>

            <button
              class="comments-toggle"
              type="button"
              :aria-expanded="expandedCommentsId === listing.id"
              @click="expandedCommentsId = expandedCommentsId === listing.id ? '' : listing.id"
            >
              <span><AppIcon name="message" :size="13" /> {{ listing.sampleComments }} comments</span>
              <AppIcon class="comments-chevron" :class="{ 'comments-chevron--open': expandedCommentsId === listing.id }" name="chevron" :size="14" />
            </button>
            <div v-if="expandedCommentsId === listing.id" class="comments-panel">
              Sample comment count only. Group comments are not connected yet.
            </div>
          </article>

          <div class="enquiry-area">
            <button
              class="enquiry-button"
              type="button"
              :disabled="
                !enquiryListing ||
                hasEnquiryBeenSent(enquiryListing.id)
              "
              @click="enquiryError = ''; enquiryDialogOpen = true"
            >
              {{
                !enquiryListing
                  ? 'Select a listing first'
                  : hasEnquiryBeenSent(enquiryListing.id)
                    ? 'Enquiry already sent'
                    : 'Submit Enquiry'
              }}
            </button>

            <p class="enquiry-note">
              Notifies all group members and assigns a property agent.
            </p>

            <p
              v-if="enquiryError"
              class="enquiry-message"
              role="alert"
            >
              {{ enquiryError }}
            </p>
          </div>
        </div>

        <section v-else class="empty-state">
          <span class="empty-icon"><AppIcon name="bookmark" :size="22" /></span>
          <h2>Your shortlist is empty</h2>
          <p>Save listings from Browse to see them here.</p>
          <RouterLink class="btn btn-primary" to="/listings">Browse listings</RouterLink>
        </section>
      </section>
    </main>

    <!-- Analytics tab -->
    <main v-else class="content">
      <section class="analytics-layout">

        <div class="analytics-heading">
          <h2>Property Comparison</h2>
          <p>
            Compare shortlisted properties based on rental price,
            group votes and property size.
          </p>
        </div>

        <!-- Switch between chart and table -->
        <div class="comparison-switcher">
          <button
            type="button"
            :class="{ 'comparison-switcher--active': comparisonView === 'chart' }"
            @click="comparisonView = 'chart'"
          >
            Chart View
          </button>

          <button
            type="button"
            :class="{ 'comparison-switcher--active': comparisonView === 'table' }"
            @click="comparisonView = 'table'"
          >
            Table View
          </button>
        </div>

        <!-- Group fit: the chart the shortlist is actually decided on. -->
        <div
          v-if="comparisonView === 'chart' && comparisonListings.length"
          class="comparison-chart-wrapper"
        >
          <h3 class="chart-subhead">Group fit</h3>
          <p class="chart-note">
            How well each listing meets the preferences your group agreed. The axis is a
            fixed 0–100%, so a listing's bar does not change when others are added or removed.
          </p>
          <div class="comparison-chart-scroll">
            <svg
              viewBox="0 0 680 280"
              class="comparison-chart"
              role="img"
              aria-label="Group match percentage of each shortlisted property"
            >
              <line x1="55" y1="220" x2="640" y2="220" stroke="#ddd" />
              <!-- A fixed reference at 100%, so the bars are read against the
                   scale rather than against each other. -->
              <line x1="55" y1="40" x2="640" y2="40" stroke="#ddd" stroke-dasharray="4 4" />
              <text x="50" y="43" text-anchor="end" font-size="9" fill="currentColor">100%</text>

              <g v-for="item in fitChartData" :key="`f-${item.id}`">
                <rect
                  v-if="item.match !== null"
                  :x="item.x - 18"
                  :y="220 - item.fitHeight"
                  width="36"
                  :height="item.fitHeight"
                  rx="4"
                  fill="#12916a"
                />
                <text
                  :x="item.x"
                  :y="210 - item.fitHeight"
                  text-anchor="middle"
                  font-size="10"
                  fill="currentColor"
                >
                  {{ item.match !== null ? `${item.match}%` : 'No data' }}
                </text>
                <text :x="item.x" y="238" text-anchor="middle" font-size="9" fill="currentColor">
                  {{ truncate(item.label) }}
                </text>
                <rect
                  class="bar-hit"
                  :x="item.x - 26"
                  y="30"
                  width="52"
                  height="190"
                  tabindex="0"
                  role="button"
                  :aria-label="`${item.title}, ${item.match !== null ? `${item.match}% group match` : 'no group match data'}`"
                  @pointerenter="showChartTip('fit', item, $event)"
                  @pointerleave="hideChartTip"
                  @focus="showChartTip('fit', item, $event)"
                  @blur="hideChartTip"
                />
              </g>
            </svg>
          </div>
          <p v-if="!hasAnyFit" class="chart-note">
            No percentages yet — your group has not agreed its preferences, so there is
            nothing to score these against.
          </p>

          <ChartTooltip
            v-if="hovered && hovered.chart === 'fit'"
            :item="hovered.item"
            :x="hovered.x"
            :y="hovered.y"
            :below="hovered.below"
            :value="hovered.item.match !== null ? `${hovered.item.match}%` : 'No data'"
            unit="group fit"
          />
        </div>

        <!-- Chart View -->
        <div
          v-if="comparisonView === 'chart' && comparisonListings.length"
          class="comparison-chart-wrapper"
        >
          <h3 class="chart-subhead">Monthly rent</h3>
          <p class="chart-note">
            Rent, group fit and votes each get their own chart. Plotting them together
            would invite comparing scales that have nothing in common.
          </p>

          <div class="comparison-chart-scroll">
            <svg
              viewBox="0 0 680 280"
              class="comparison-chart"
              role="img"
              aria-label="Monthly rent of each shortlisted property"
            >
              <!-- Chart baseline -->
              <line
                x1="55" y1="220"
                x2="640" y2="220"
                stroke="#ddd"
              />

              <!-- Rent bars -->
              <g v-for="item in chartData" :key="item.id">
                <rect
                  :x="item.x - 18"
                  :y="220 - item.barHeight"
                  width="36"
                  :height="item.barHeight"
                  rx="4"
                  fill="#c05a21"
                />

                <text
                  :x="item.x"
                  :y="210 - item.barHeight"
                  text-anchor="middle"
                  font-size="10"
                  fill="currentColor"
                >
                  {{ Math.round(item.price / 100) / 10 }}k
                </text>

                <text
                  :x="item.x"
                  y="238"
                  text-anchor="middle"
                  font-size="9"
                  fill="currentColor"
                >
                  {{ truncate(item.label) }}
                </text>

                <!-- Hit target: the whole column, not just the painted bar, so
                     a short bar is as easy to reach as a tall one. -->
                <rect
                  class="bar-hit"
                  :x="item.x - 26"
                  y="30"
                  width="52"
                  height="190"
                  tabindex="0"
                  role="button"
                  :aria-label="`${item.title}, $${item.price} per month`"
                  @pointerenter="showChartTip('rent', item, $event)"
                  @pointerleave="hideChartTip"
                  @focus="showChartTip('rent', item, $event)"
                  @blur="hideChartTip"
                />
              </g>

</svg>
          </div>

          <p class="chart-note">
            Higher bars indicate higher monthly rent. Hover or tab to a bar for the full listing.
          </p>

          <ChartTooltip
            v-if="hovered && hovered.chart === 'rent'"
            :item="hovered.item"
            :x="hovered.x"
            :y="hovered.y"
            :below="hovered.below"
            :value="`$${hovered.item.price.toLocaleString('en-SG')}`"
            unit="per month"
          />
        </div>
        <!-- Group votes: its own chart, because votes and dollars do not
             share a scale (F-REQ-018.6). -->
        <div
          v-if="comparisonView === 'chart' && comparisonListings.length"
          class="comparison-chart-wrapper"
        >
          <h3 class="chart-subhead">Group votes</h3>
          <div class="comparison-chart-scroll">
            <svg
              viewBox="0 0 680 150"
              class="comparison-chart"
              role="img"
              aria-label="Number of group votes for each shortlisted property"
            >
              <line x1="55" y1="110" x2="640" y2="110" stroke="#ddd" />
              <g v-for="item in voteChartData" :key="`v-${item.id}`">
                <rect
                  :x="item.x - 18"
                  :y="110 - item.voteHeight"
                  width="36"
                  :height="item.voteHeight"
                  rx="4"
                  fill="#2f6bd4"
                />
                <text
                  :x="item.x"
                  :y="102 - item.voteHeight"
                  text-anchor="middle"
                  font-size="10"
                  fill="currentColor"
                >
                  {{ item.votes }}
                </text>
                <text :x="item.x" y="128" text-anchor="middle" font-size="9" fill="currentColor">
                  {{ truncate(item.label) }}
                </text>
                <rect
                  class="bar-hit"
                  :x="item.x - 26"
                  y="20"
                  width="52"
                  height="90"
                  tabindex="0"
                  role="button"
                  :aria-label="`${item.title}, ${item.votes} votes`"
                  @pointerenter="showChartTip('votes', item, $event)"
                  @pointerleave="hideChartTip"
                  @focus="showChartTip('votes', item, $event)"
                  @blur="hideChartTip"
                />
              </g>
            </svg>
          </div>
          <p v-if="!hasAnyVotes" class="chart-note">
            Nobody has voted yet, so every bar is empty. Vote on a listing from its card above.
          </p>

          <ChartTooltip
            v-if="hovered && hovered.chart === 'votes'"
            :item="hovered.item"
            :x="hovered.x"
            :y="hovered.y"
            :below="hovered.below"
            :value="hovered.item.votes"
            :unit="hovered.item.votes === 1 ? 'vote' : 'votes'"
          />
        </div>

        <!-- Commute per member (F-REQ-017.5) -->
        <div v-if="isGroupMode" class="comparison-chart-wrapper">
          <p v-if="commuteLoading" class="muted">Working out commute times…</p>
          <p v-else-if="!commuteMembers.length" class="muted">
            No commute destinations set yet. Members can add one in their profile.
          </p>
          <template v-else>
            <CommuteChart
              :listings="shortlistedListings"
              :members="scoringMembers"
              :matrix="commutes"
            />
            <p v-if="commutesEstimated" class="chart-note">
              Some times are straight-line estimates because OneMap routing was
              unavailable. Estimates are shown but do not count towards the match %.
            </p>
          </template>
        </div>

        <!-- Table View -->
        <div
          v-if="comparisonView === 'table' && comparisonListings.length"
          class="comparison-table-wrapper"
        >
          <table class="comparison-table">
            <thead>
              <tr>
                <th>Property</th>
                <th>Group fit</th>
                <th>Monthly Rent</th>
                <th>Per person</th>
                <th>Group Votes</th>
                <th>Longest commute</th>
                <th>Bedrooms</th>
                <th>Region</th>
                <th>Floor Area</th>
                <th>Rent / sqm</th>
              </tr>
            </thead>

            <tbody>
              <tr
                v-for="listing in comparisonListings"
                :key="listing.id"
              >
                <td>{{ listing.title }}</td>
                <td>{{ listing.match !== null ? `${listing.match}%` : 'No data' }}</td>
                <td>{{ formatRent(listing.price) }}</td>
                <td>
                  {{
                    groupPreference?.HouseholdSize
                      ? formatRent(Math.round(listing.price / groupPreference.HouseholdSize))
                      : '—'
                  }}
                </td>
                <td>{{ listing.votes }}</td>
                <td>
                  <template v-if="listing.worstCommute !== null">
                    {{ listing.worstCommute }} min
                    <span class="muted">({{ listing.commuteOk }}/{{ listing.commuteOf }} within limit)</span>
                  </template>
                  <template v-else>No data</template>
                </td>
                <td>{{ listing.beds ?? 'Not listed' }}</td>
                <td>{{ listing.region ?? '—' }}</td>
                <td>
                  {{ listing.areaSqm ? `${listing.areaSqm} sqm` : 'N/A' }}
                </td>
                <td>
                  {{
                    listing.rentPerSqm !== null
                      ? `$${listing.rentPerSqm.toFixed(2)}`
                      : 'N/A'
                  }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Empty State -->
        <div
          v-if="!comparisonListings.length"
          class="analytics-placeholder"
        >
          <h3>No properties to compare yet</h3>
          <p>
            Add properties to your group shortlist to start comparing them.
          </p>
        </div>

      </section>
    </main>

    <Teleport to="body">
      <div
        v-if="enquiryDialogOpen"
        class="enquiry-backdrop"
        @click.self="enquiryDialogOpen = false"
        @keydown.esc="enquiryDialogOpen = false"
      >
        <section
          class="enquiry-dialog"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="enquiry-title"
          aria-describedby="enquiry-description"
        >
          <h2 id="enquiry-title">Submit enquiry?</h2>
          <p id="enquiry-description">
            You're about to submit an enquiry for
            <strong>{{ enquiryListing?.title }}</strong>
            to the property agent. This action cannot be undone.
          </p>
          <label class="email-receipt-option">
            <input
              v-model="emailReceipt"
              type="checkbox"
            />
            <span>Email me a receipt of this enquiry</span>
          </label>
          <button class="enquiry-button" type="button" @click="confirmEnquiry">
            Yes, Submit Enquiry
          </button>
          <button class="enquiry-cancel" type="button" @click="enquiryDialogOpen = false">
            Cancel
          </button>
        </section>
      </div>
    </Teleport>
    <Teleport to="body">
      <div
        v-if="agentContactDialogOpen"
        class="enquiry-backdrop"
        @click.self="agentContactDialogOpen = false"
      >
        <section class="enquiry-dialog">
          <h2>Enquiry Submitted!</h2>

          <p>
            Your enquiry for
            <strong>{{ enquiryListing?.title }}</strong>
            has been submitted successfully.
          </p>

          <div class="agent-contact">
            <h3>Property Agent Contact</h3>

            <span class="sample-agent-label">
              SAMPLE CONTACT DETAILS
            </span>

            <div class="agent-detail">
              <AppIcon name="user" :size="16" />
              <span>Property Agent: Jane</span>
            </div>

            <div class="agent-detail">
              <AppIcon name="phone" :size="16" />
              <span>+65 6000 0000</span>
            </div>

            <div class="agent-detail">
              <AppIcon name="mail" :size="16" />
              <span>jane@gmail.com</span>
            </div>
          </div>

          <p class="agent-disclaimer">
            These are placeholder contact details.
          </p>

          <button
            class="enquiry-button"
            type="button"
            @click="agentContactDialogOpen = false"
          >
            Close
          </button>
        </section>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.shortlist-layout {
  display: grid;
  width: min(100%, 720px);
  gap: 12px;
  margin: 0 auto;
}

.consensus-banner {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 12px 14px;
  border: 1px solid #d6eadf;
  border-radius: 14px;
  background: #eff7f2;
}

.consensus-icon {
  display: grid;
  flex: 0 0 32px;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #57b788;
  color: #fff;
}

.consensus-banner strong,
.consensus-banner small {
  display: block;
}

.consensus-banner strong {
  font-size: 13px;
}

.consensus-banner small {
  margin-top: 2px;
  color: #68776e;
  font-size: 11px;
}

.consensus-banner .sample-notice {
  color: #8a7260;
  font-size: 10px;
}

.location-section h2 {
  margin: 0 0 7px;
  font-size: 13px;
}

.map-empty {
  display: grid;
  place-items: center;
  min-height: 160px;
  margin: 0;
  border: 1px dashed var(--chip-line);
  border-radius: 8px;
  color: #71806f;
  font-size: 12px;
}

.map-hint {
  margin-top: 5px;
  color: #999;
  font-size: 10px;
  text-align: center;
}

.listing-list {
  display: grid;
  gap: 10px;
}

.listing-card {
  overflow: hidden;
  border: 1px solid #e7e5e2;
  border-radius: 15px;
  background: #fff;
  box-shadow: 0 2px 5px rgb(0 0 0 / 7%);
  transition: border-color 0.15s, box-shadow 0.15s;
}

.listing-card--selected {
  border-color: #cf3538;
  box-shadow: 0 0 0 2px rgb(200 41 47 / 13%), 0 2px 5px rgb(0 0 0 / 7%);
}

.listing-card--unavailable {
  opacity: 0.78;
}

.listing-main {
  display: flex;
  min-height: 102px;
}

.listing-photo {
  position: relative;
  overflow: hidden;
  flex: 0 0 102px;
  min-height: 102px;
  background:
    linear-gradient(135deg, rgb(246 240 228 / 10%), rgb(34 34 34 / 35%)),
    linear-gradient(135deg, #c2ad94 0%, #eee1ce 45%, #887d70 100%);
}

.listing-photo--alt {
  background:
    linear-gradient(135deg, rgb(246 240 228 / 10%), rgb(34 34 34 / 35%)),
    linear-gradient(135deg, #a5a18f 0%, #d8d5bd 45%, #747a71 100%);
}

.listing-photo--cool {
  background:
    linear-gradient(135deg, rgb(246 240 228 / 10%), rgb(34 34 34 / 35%)),
    linear-gradient(135deg, #a8b3b6 0%, #dce1dc 45%, #788b8a 100%);
}

.listing-photo img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.availability {
  position: absolute;
  top: 5px;
  left: 5px;
  padding: 3px 6px;
  border-radius: 999px;
  background: #fff;
  color: var(--muted);
  font-size: 9px;
  font-weight: 700;
}

.listing-info {
  flex: 1;
  min-width: 0;
  padding: 10px 11px 8px;
}

.listing-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.listing-title-row h3 {
  min-width: 0;
  font-size: 13px;
  line-height: 1.35;
}

.listing-title-actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 5px;
}

.match-pill {
  flex: none;
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--red-tint);
  color: var(--red);
  font-size: 10px;
  font-weight: 700;
}

.remove-listing {
  display: grid;
  width: 23px;
  height: 23px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: #f7f5f4;
  color: var(--red);
  cursor: pointer;
}

.rent {
  margin-top: 3px;
  color: var(--red);
  font-size: 14px;
  font-weight: 700;
}

.rent span {
  color: var(--muted);
  font-size: 10px;
  font-weight: 400;
}

.listing-meta {
  display: flex;
  align-items: center;
  gap: 3px;
  margin-top: 2px;
  color: var(--muted);
  font-size: 10px;
}

.social-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 5px;
}

.member-avatars {
  display: flex;
}

.member-avatar {
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: var(--red);
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  object-fit: cover;
}

.vote-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border: 1px solid #0f7d5b;
  border-radius: 999px;
  background: #0f7d5b;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 150ms ease, border-color 150ms ease;
}

.vote-button:hover:not(:disabled) {
  background: #0d6e50;
  border-color: #0d6e50;
}

.vote-button:focus-visible {
  outline: 2px solid #0d6e50;
  outline-offset: 2px;
}

/* Voted: the action is done, so it stops competing for attention — but it is
   still the control that undoes the vote, so it stays clearly a button. */
.vote-button--active {
  background: #fff;
  color: #0d6e50;
  border-color: #0f7d5b;
}

.vote-button--active:hover:not(:disabled) {
  background: #eaf6f1;
  border-color: #0d6e50;
}

/* The tally rides along inside the button; a bare "(0)" looked like part of
   the label rather than a count. */
.vote-count {
  display: inline-grid;
  place-items: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: rgb(255 255 255 / 25%);
  font-size: 11px;
  font-weight: 700;
}

.vote-button--active .vote-count {
  background: #e3f1ec;
}

.vote-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.sample-tag {
  color: #9b8068;
  font-size: 9px;
}

.score-panel {
  padding: 0.9rem 1rem 1rem;
  border-top: 1px solid var(--line);
}

.comments-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 32px;
  padding: 0 12px;
  border: 0;
  border-top: 1px solid #f1f0ef;
  background: #fff;
  color: #68798a;
  cursor: pointer;
}

.comments-toggle > span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  font-weight: 600;
}

.comments-chevron {
  color: #aaa;
  transition: transform 0.15s;
}

.comments-chevron--open {
  transform: rotate(90deg);
}

.comments-panel {
  padding: 10px 12px;
  border-top: 1px solid #f1f0ef;
  background: #fafafa;
  color: var(--muted);
  font-size: 11px;
}

.enquiry-area {
  display: grid;
  gap: 6px;
  text-align: center;
}

.enquiry-button {
  min-height: 44px;
  border: 0;
  border-radius: 11px;
  background: var(--red);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.enquiry-button:hover {
  background: var(--red-dark);
}

.enquiry-note,
.enquiry-message {
  color: #999;
  font-size: 10px;
}

.enquiry-message {
  color: var(--warn);
}

.enquiry-success {
  display: flex;
  min-height: 48px;
  align-items: center;
  justify-content: center;
  gap: 9px;
  border: 1px solid #cde6d7;
  border-radius: 11px;
  background: #eff8f2;
  color: #26744f;
  font-size: 14px;
}

.enquiry-success-icon {
  display: grid;
  width: 25px;
  height: 25px;
  place-items: center;
  border-radius: 50%;
  background: #43a875;
  color: #fff;
}

.enquiry-backdrop {
  position: fixed;
  z-index: 100;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgb(20 20 20 / 48%);
}

.enquiry-dialog {
  display: grid;
  width: min(100%, 440px);
  gap: 12px;
  padding: 24px;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 16px 48px rgb(0 0 0 / 20%);
}

.enquiry-dialog h2 {
  font-size: 18px;
}

.enquiry-dialog p {
  margin: 0 0 8px;
  color: #5f5f5f;
  font-size: 13px;
  line-height: 1.55;
}

.enquiry-dialog p strong {
  color: var(--text);
}

.enquiry-dialog .enquiry-button,
.enquiry-cancel {
  min-height: 48px;
  border-radius: 11px;
  font-size: 13px;
  font-weight: 700;
}

.enquiry-cancel {
  border: 1px solid var(--red);
  background: #fff;
  color: var(--red);
  cursor: pointer;
}

.enquiry-cancel:hover {
  background: var(--red-tint);
}

.empty-state {
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 34px 20px;
  border: 1px dashed var(--chip-line);
  border-radius: 12px;
  background: #fff;
  text-align: center;
}

.empty-icon {
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  border-radius: 50%;
  background: var(--red-tint);
  color: var(--red);
}

.empty-state p {
  color: var(--muted);
  font-size: 13px;
}

.error-message {
  color: var(--red);
  font-size: 13px;
}

.agent-contact {
  display: grid;
  gap: 12px;
  padding: 16px;
  border: 1px solid #e7e5e2;
  border-radius: 12px;
  background: #faf9f8;
}

.agent-contact h3 {
  font-size: 14px;
}

.sample-agent-label {
  color: #b7791f;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.agent-detail {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #555;
  font-size: 12px;
}

.agent-disclaimer {
  color: #999 !important;
  font-size: 10px !important;
}

.enquiry-sent-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 9px;
  border-radius: 20px;
  background: #e8f5e9;
  color: #287a3e;
  font-size: 11px;
  font-weight: 600;
}

/* Shortlist and Analytics tabs */
.shortlist-tabs {
  display: flex;
  width: min(100% - 32px, 720px);
  gap: 8px;
  margin: 0 auto 20px;
  padding: 5px;
  border: 1px solid #e7e5e2;
  border-radius: 12px;
  background: #f7f6f4;
}

.shortlist-tabs button {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 40px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: #777;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.shortlist-tabs button.shortlist-tab--active {
  background: #fff;
  color: var(--red);
  box-shadow: 0 1px 4px rgb(0 0 0 / 8%);
}

/* Analytics layout */
.analytics-layout {
  display: grid;
  width: min(100%, 720px);
  gap: 16px;
  margin: 0 auto;
}

.analytics-heading h2 {
  margin-bottom: 5px;
  font-size: 16px;
}

.analytics-heading p {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
}

.analytics-placeholder {
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 40px 20px;
  border: 1px dashed var(--chip-line);
  border-radius: 14px;
  background: #fff;
  color: var(--muted);
  text-align: center;
}

.analytics-placeholder h3 {
  color: var(--text);
  font-size: 14px;
}

.analytics-placeholder p {
  font-size: 12px;
}

/* Chart and table view switcher */
.comparison-switcher {
  display: flex;
  gap: 8px;
  padding: 5px;
  border-radius: 10px;
  background: #f7f6f4;
}

.comparison-switcher button {
  flex: 1;
  padding: 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.comparison-switcher button.comparison-switcher--active {
  background: white;
  color: var(--red);
  box-shadow: 0 1px 4px rgb(0 0 0 / 8%);
}

/* Comparison table */
.comparison-table-wrapper {
  width: 100%;
  overflow-x: auto;
  border: 1px solid var(--chip-line);
  border-radius: 12px;
  background: white;
}

.comparison-table {
  width: 100%;
  min-width: 650px;
  border-collapse: collapse;
  text-align: left;
  font-size: 12px;
}

.comparison-table th,
.comparison-table td {
  padding: 14px 12px;
  border-bottom: 1px solid var(--chip-line);
}

.comparison-table th {
  background: #f7f6f4;
  color: var(--muted);
  font-weight: 600;
  white-space: nowrap;
}

.comparison-table td {
  color: var(--text);
}

.comparison-table tbody tr:last-child td {
  border-bottom: none;
}

/* Property comparison chart */
.comparison-chart-wrapper {
  position: relative;
  padding: 18px;
  border: 1px solid var(--chip-line);
  border-radius: 12px;
  background: white;
}

/* Transparent column over each bar: the hit area is the whole column so a
   short bar is as easy to reach as a tall one. */
.bar-hit {
  fill: transparent;
  cursor: pointer;
  outline: none;
}
.bar-hit:hover,
.bar-hit:focus-visible {
  fill: rgba(0, 0, 0, 0.04);
}
.bar-hit:focus-visible {
  stroke: var(--text);
  stroke-width: 1.5;
}


.comparison-chart-scroll {
  width: 100%;
  overflow-x: auto;
}

.comparison-chart {
  display: block;
  width: 100%;
  min-width: 580px;
  overflow: visible;
}

.chart-note {
  margin: 12px 0;
  max-width: 62ch;
  color: var(--muted);
  font-size: 11px;
}

.chart-subhead {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 600;
}

</style>
