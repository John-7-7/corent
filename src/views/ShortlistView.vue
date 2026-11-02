<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import { formatRent } from '@/services/listingsService'
import { getListings } from '@/services/listings'
import { useShortlist } from '@/services/shortlistService'
import { getCurrentUser } from '@/services/authService'
import { getUserGroups } from '@/services/groupService'

import {
  addGroupShortlist,
  removeGroupShortlist,
  subscribeToGroupShortlist,
  voteForListing,
  removeListingVote,
  subscribeToGroupVotes,
} from '@/services/groupShortlistService'

const { listingIds, storageError } = useShortlist()
const listings = ref([])

// Rough Singapore bounds, used to place real coordinates on the overview map.
const SG = { north: 1.47, south: 1.22, west: 103.6, east: 104.05 }
const clampPct = (n) => `${Math.min(95, Math.max(5, n * 100)).toFixed(1)}%`

// The current user's information
const currentUserId = ref('')
const groupId = ref('')

// Properties shared by everyone in the group
const groupListingIds = ref([])

// Votes shared by everyone in the group
const groupVotes = ref([])

// Store the Firestore listeners so we can stop them later
let unsubscribeShortlist = null
let unsubscribeVotes = null

const groupError = ref('')

// Map a Housing_Listing record onto the shape this page renders.
function toShortlistItem(l) {
  const n = [...String(l.ListingID)].reduce((a, c) => a + c.charCodeAt(0), 0) % 3
  return {
    id: l.ListingID,
    title: l.Title,
    price: l.MonthlyRent,
    area: l.Neighbourhood,
    beds: l.Bedrooms,
    available: l.IsAvailable,
    tone: ['', 'alt', 'cool'][n],
    // null until F-REQ-015 can compute a real score.
    match: null,
    mapPosition: l.Coordinates && {
      left: clampPct((l.Coordinates.lng - SG.west) / (SG.east - SG.west)),
      top: clampPct((SG.north - l.Coordinates.lat) / (SG.north - SG.south)),
    },
    sampleVotes: 0,
    sampleComments: 0,
  }
}

onMounted(async () => {
  try {
    // 1. Get the currently logged-in user
    const user = await getCurrentUser()

    if (!user) {
      groupError.value = 'Please log in to view your group shortlist.'
      return
    }

    currentUserId.value = user.uid

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
})
const selectedListingId = ref('')
const expandedCommentsId = ref('')
const enquiryDialogOpen = ref(false)
const enquirySent = ref(false)
const enquiryError = ref('')

const savedListings = computed(() => {
  return listings.value.filter((l) =>
    groupListingIds.value.includes(l.id),
  )
})

function getVoteCount(listingId) {
  return groupVotes.value.filter(
    (vote) => vote.listingId === listingId,
  ).length
}

function hasUserVoted(listingId) {
  return groupVotes.value.some(
    (vote) =>
      vote.listingId === listingId &&
      vote.userId === currentUserId.value,
  )
}

// Rank shortlisted properties by vote count.
// If vote counts tie, use the higher group-match percentage.
const rankedListings = computed(() => {
  return [...savedListings.value].sort((a, b) => {
    // First: higher vote count comes first.
    const voteDifference = getVoteCount(b.id) - getVoteCount(a.id)

    if (voteDifference !== 0) {
      return voteDifference
    }
    // Second: higher match percentage comes first.
    // Only compare match scores when both are available.
    if (typeof a.match === 'number' && typeof b.match === 'number') {
      return b.match - a.match
    }
    return 0
  })
})

const enquiryListing = computed(
  () =>
    savedListings.value.find((listing) => listing.id === selectedListingId.value) ??
    savedListings.value[0] ??
    null,
)

function selectMapPin(listing) {
  selectedListingId.value = listing.id
  document.getElementById(`shortlist-${listing.id}`)?.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
  })
}

async function removeListing(id) {
  try {
    await removeGroupShortlist(groupId.value, id)
  } catch (error) {
    console.error('Error removing property:', error)
    groupError.value = 'Unable to remove this property.'
  }
}

async function voteForProperty(listingId) {
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

function confirmEnquiry() {
  if (!enquiryListing.value) {
    enquiryError.value = 'Add a listing to your shortlist before submitting an enquiry.'
    return
  }
  enquirySent.value = true
  enquiryDialogOpen.value = false
}
</script>

<template>
  <div>
    <header class="page-head">
      <h1>Shortlist</h1>
      <p>{{ savedListings.length }} {{ savedListings.length === 1 ? 'listing' : 'listings' }} shortlisted</p>
    </header>

    <main class="content">
      <section class="shortlist-layout">
        <aside
          v-if="savedListings.length"
          class="consensus-banner"
          aria-label="Group shortlist status"
        >
          <span class="consensus-icon">
            <AppIcon name="check" :size="16" />
          </span>
          <span>
            <strong>Group shortlist</strong>
            <small>Votes are shared with all group members.</small>
          </span>
        </aside>

        <section class="location-section" aria-labelledby="location-overview-title">
          <h2 id="location-overview-title">Location Overview</h2>
          <div
            class="location-map"
            :class="{ 'location-map--empty': !savedListings.length }"
            role="group"
            aria-label="Shortlisted listing locations overview"
          >
            <span class="road road--horizontal road--one" aria-hidden="true" />
            <span class="road road--horizontal road--two" aria-hidden="true" />
            <span class="road road--vertical road--one" aria-hidden="true" />
            <span class="road road--vertical road--two" aria-hidden="true" />
            <span class="map-label" aria-hidden="true">SINGAPORE</span>

            <button
              v-for="listing in savedListings"
              :key="listing.id"
              class="map-pin"
              :class="{ 'map-pin--selected': selectedListingId === listing.id }"
              :style="listing.mapPosition"
              type="button"
              :aria-label="listing.title"
              @click="selectMapPin(listing)"
            >
              <span>{{ listing.match !== null ? `${listing.match}%` : formatRent(listing.price) }}</span>
              <i aria-hidden="true" />
            </button>
            <p v-if="!savedListings.length" class="map-empty">
              Save listings to see their locations here.
            </p>
          </div>
          <p class="map-hint">Select a pin to highlight its listing below.</p>
        </section>

        <p v-if="storageError" class="error-message" role="alert">{{ storageError }}</p>

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
          >
            <div class="listing-main">
              <div class="listing-photo" :class="`listing-photo--${listing.tone || 'warm'}`">
                <span v-if="!listing.available" class="availability">Unavailable</span>
              </div>
              <div class="listing-info">
                <div class="listing-title-row">
                  <h3>{{ listing.title }}</h3>
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
                  {{ listing.area }} · {{ listing.beds }} rooms
                </p>

                <div class="social-row">
                  <div class="member-avatars" aria-label="Sample group members">
                    <span v-for="(member, index) in ['AT', 'BL', 'CM', 'DK']" :key="member" :class="`member-avatar member-avatar--${index}`">
                      {{ member }}
                    </span>
                  </div>
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
                    <AppIcon name="thumbs-up" :size="12" />
                    {{ hasUserVoted(listing.id) ? 'Voted' : 'Vote' }}
                    ({{ getVoteCount(listing.id) }})
                  </button>
                </div>
              </div>
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
            <div v-if="enquirySent" class="enquiry-success" role="status">
              <span class="enquiry-success-icon"><AppIcon name="check" :size="17" /></span>
              <strong>Enquiry sent!</strong>
            </div>
            <button
              v-else
              class="enquiry-button"
              type="button"
              @click="enquiryError = ''; enquiryDialogOpen = true"
            >
              Submit Enquiry
            </button>
            <p class="enquiry-note">Notifies all group members and assigns a property agent.</p>
            <p v-if="enquiryError" class="enquiry-message" role="alert">{{ enquiryError }}</p>
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
          <button class="enquiry-button" type="button" @click="confirmEnquiry">
            Yes, Submit Enquiry
          </button>
          <button class="enquiry-cancel" type="button" @click="enquiryDialogOpen = false">
            Cancel
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

.location-map {
  position: relative;
  height: 190px;
  overflow: hidden;
  border: 1px solid #dce5d5;
  border-radius: 14px;
  background-color: #edf0e5;
  background-image:
    linear-gradient(90deg, transparent 0 12%, #e3e5d7 12% 13.2%, transparent 13.2% 31%, #e3e5d7 31% 32.2%, transparent 32.2% 72%, #e3e5d7 72% 73.2%, transparent 73.2%),
    linear-gradient(0deg, transparent 0 20%, #e0dfcf 20% 25%, transparent 25% 50%, #e0dfcf 50% 57%, transparent 57% 80%, #e0dfcf 80% 85%, transparent 85%);
}

.location-map::before,
.location-map::after {
  position: absolute;
  content: '';
  background: #d9d7c5;
}

.location-map::before {
  top: 0;
  bottom: 0;
  left: 48%;
  width: 9px;
}

.location-map::after {
  top: 43%;
  right: 0;
  left: 0;
  height: 8px;
}

.road {
  position: absolute;
  z-index: 1;
  display: block;
  background: #e3e5d7;
}

.road--horizontal {
  right: 0;
  left: 0;
  height: 7px;
}

.road--horizontal.road--one {
  top: 33%;
}

.road--horizontal.road--two {
  top: 78%;
}

.road--vertical {
  top: 0;
  bottom: 0;
  width: 7px;
}

.road--vertical.road--one {
  left: 34%;
}

.road--vertical.road--two {
  left: 66%;
}

.map-label {
  position: absolute;
  z-index: 1;
  top: 52%;
  left: 43%;
  color: #c4c1ad;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.map-pin {
  position: absolute;
  z-index: 2;
  display: grid;
  justify-items: center;
  padding: 0;
  transform: translate(-50%, -50%);
  border: 0;
  background: transparent;
  cursor: pointer;
}

.map-pin span {
  padding: 3px 7px;
  border: 1px solid #f1d5d5;
  border-radius: 999px;
  background: #fff;
  color: var(--red);
  box-shadow: 0 1px 4px rgb(0 0 0 / 12%);
  font-size: 10px;
  font-weight: 700;
}

.map-pin i {
  width: 2px;
  height: 9px;
  background: var(--red);
}

.map-pin i::after {
  display: block;
  width: 7px;
  height: 7px;
  margin: 5px 0 0 -2.5px;
  border: 1px solid #fff;
  border-radius: 50%;
  background: var(--red);
  content: '';
}

.map-pin--selected span {
  background: var(--red);
  color: #fff;
  transform: scale(1.1);
}

.location-map--empty {
  background-color: #f1f2ed;
}

.map-empty {
  position: absolute;
  z-index: 2;
  inset: 0;
  display: grid;
  place-items: center;
  margin: 0;
  background: rgb(237 240 229 / 58%);
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
  padding-left: 1px;
}

.member-avatar {
  display: grid;
  width: 17px;
  height: 17px;
  margin-left: -2px;
  place-items: center;
  border: 1px solid #fff;
  border-radius: 50%;
  color: #fff;
  font-size: 6px;
  font-weight: 700;
}

.member-avatar--0 { background: #cf343c; }
.member-avatar--1 { background: #5089d6; }
.member-avatar--2 { background: #49a886; }
.member-avatar--3 { background: #e6a23b; }

.vote-button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border: 1px solid #e4e2df;
  border-radius: 999px;
  background: #fff;
  color: #606060;
  font-size: 10px;
}

.vote-button:disabled {
  cursor: not-allowed;
}

.sample-tag {
  color: #9b8068;
  font-size: 9px;
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

@media (max-width: 560px) {
  .listing-photo {
    flex-basis: 82px;
  }

  .listing-info {
    padding: 8px;
  }

  .social-row {
    gap: 4px;
  }

  .sample-tag {
    display: none;
  }
}
</style>
