import { computed, ref, watch, onUnmounted } from 'vue'
import { activeGroup, activeGroupId } from './activeGroup'
import { watchGroupPreference } from './groupPreferencesService'
import { getMemberProfiles } from './groupSummaryService'
import { scoreListings } from './listingScoring'
import { cachedCommuteMatrix } from './routingService'

/**
 * Group-match scores for a set of listings (F-REQ-015), for any page that
 * wants to show them.
 *
 * Commute is read from routingService's cache rather than measured: a page
 * showing hundreds of listings cannot route them all. The Shortlist page does
 * its own routing because it holds few enough to afford it, and because the
 * cache is shared, a listing routed there carries its measured commute here
 * too — so the same listing shows the same percentage everywhere.
 *
 * @param listings a ref or computed holding the listing records to score
 */
export function useGroupScoring(listings) {
  const groupPreference = ref(null)
  const memberProfiles = ref([])
  let unsubscribePreference = null

  watch(
    activeGroupId,
    async (id) => {
      unsubscribePreference?.()
      unsubscribePreference = null
      groupPreference.value = null
      memberProfiles.value = []
      if (!id) return
      unsubscribePreference = watchGroupPreference(
        id,
        (preference) => (groupPreference.value = preference),
        () => (groupPreference.value = null),
      )
      try {
        memberProfiles.value = await getMemberProfiles(activeGroup.value?.memberIds ?? [])
      } catch {
        memberProfiles.value = []
      }
    },
    { immediate: true },
  )
  onUnmounted(() => unsubscribePreference?.())

  const scoringMembers = computed(() =>
    (activeGroup.value?.memberIds ?? []).map((uid) => ({
      uid,
      name: activeGroup.value?.members?.find((member) => member.id === uid)?.name || 'Group member',
      profile: memberProfiles.value.find((profile) => profile.UserID === uid) || null,
    })),
  )

  // Only members who set a destination can have a commute measured.
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

  const scoredById = computed(() => {
    const records = listings.value ?? []
    if (!activeGroupId.value || !groupPreference.value || !records.length) return new Map()
    const matrix = cachedCommuteMatrix(records, commuteMembers.value)
    return new Map(
      scoreListings(records, groupPreference.value, scoringMembers.value, matrix).map((entry) => [
        entry.listingId,
        entry,
      ]),
    )
  })

  return {
    groupPreference,
    memberProfiles,
    scoringMembers,
    commuteMembers,
    scoredById,
    /** The percentage for one listing, or null when there is nothing to score against. */
    scoreOf: (listing) => scoredById.value.get(listing.ListingID)?.score ?? null,
    /** True once the group has agreed enough for a score to mean anything. */
    canScore: computed(() => scoredById.value.size > 0),
  }
}
