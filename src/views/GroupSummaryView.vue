<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import GroupPreferencesCard from '../components/groups/GroupPreferencesCard.vue'
import MemberRadarChart from '../components/groups/MemberRadarChart.vue'
import PriorityRanking from '../components/groups/PriorityRanking.vue'
import { formatCurrency } from '../components/profile/preferenceOptions.js'
import {
  PREFERENCE_SECTIONS as preferenceSections,
  PREFERENCE_ROWS,
  PRIORITY_FACTORS,
  RADAR_FACTORS,
  DEFAULT_PRIORITY_ORDER,
  SEARCH_FACTORS,
  analyseGroup,
  buildGroupPreference,
  buildVoteOptions,
  compareWithMember,
  flexibleMembers,
  groupMatchScore,
  matchScore,
  resolveBudget,
  summariseBudgetVotes,
  budgetSuggestion,
  formatRange,
  displayPreference as formatPreference,
} from '../services/groupAggregation.js'
import { saveGroupPreference, watchGroupPreference } from '../services/groupPreferencesService.js'
import {
  getMemberProfiles,
  getMyPrivateBudget,
  saveReady,
  saveVote,
  watchGroup,
  watchVotes,
} from '../services/groupSummaryService.js'
import { getCurrentUser } from '../services/authService.js'
import { getUserGroups } from '../services/groupService.js'

// /group-summary?groupId=<id> (the Group Details "View Group Summary" link) loads
// that group from Firestore and saves votes, finalised results and priorities
// for every member to see. Without a group ID (the sidebar link) it opens your
// only group, or lets you pick one.
const route = useRoute()
const groupId = computed(() => route.query.groupId || null)
// loading | ready | signed-out | no-group | choose-group | not-found | not-member | error
const loadState = ref('loading')
const userGroups = ref([])
const group = ref(null)
const users = ref([])
const profiles = ref([])
const viewer = ref({ uid: null, privateBudget: null })

// Ballots per factor, separate from profiles: votes[groupId][factorKey][uid].
// Budget ballots are a range per person ({ min, max, round }); others are { value, round }.
// finalised[groupId][factorKey] holds the locked-in result. Both come from Firestore.
const votes = ref({})
const finalised = ref({})
const ballotsFor = (key) => votes.value[group.value?.GroupID]?.[key] || {}
const finalFor = (key) => finalised.value[group.value?.GroupID]?.[key] ?? null
const viewerIsMember = computed(() =>
  members.value.some((member) => member.uid === viewer.value.uid),
)

function castVote(key, value) {
  const groupId = group.value?.GroupID
  if (!groupId || !viewerIsMember.value || finalFor(key) !== null) return
  // Only a factor that is being voted on takes votes: a conflict, or a shared
  // match whose issue started a vote.
  const voting = groupPreferenceRows.value.find((row) => row.key === key)?.voting
  if (voting?.mode !== 'vote') return
  if (key === 'budget') {
    // A budget vote is a range for this round.
    if (!(value?.min > 0 && value.max >= value.min)) return
    value = { min: value.min, max: value.max, round: rounds.value.budget || 0 }
  } else {
    // An option vote is for this round too, so a new vote starts from no votes.
    if (!voting.options.some((option) => option.value === value)) return
    value = { value, round: rounds.value[key] || 0 }
  }
  votes.value[groupId] ??= {}
  votes.value[groupId][key] ??= {}
  votes.value[groupId][key][viewer.value.uid] = value
  saveVote(groupId, viewer.value.uid, key, value).catch((error) => {
    console.error('Could not save vote:', error)
    saveState.value = 'error'
  })
}
// A result is finalised only when every member has clicked Confirm on it, like a
// ready button in games. A ready mark holds the result and round it was given
// for, so it lapses if the result changes or an issue reopens the vote.
const ready = ref({}) // { factorKey: { uid: { result, round } } }
const confirmAgain = ref({}) // { factorKey: round } after my ready mark lapsed in that round
// Both the votes and the saved record have arrived. Until then the page can't tell
// what is already finalised, so it never auto-finalises, clears marks or saves.
const loaded = ref({ votes: false, saved: false })
const synced = computed(() => loaded.value.votes && loaded.value.saved)
const resultKey = (leader) => JSON.stringify(leader?.value ?? null)
const readyFor = (key, leader) =>
  members.value
    .map(({ uid }) => uid)
    .filter((uid) => {
      const mark = ready.value[key]?.[uid]
      return leader && mark?.result === resultKey(leader) && mark.round === (rounds.value[key] || 0)
    })
function toggleReady(key) {
  const groupId = group.value?.GroupID
  const row = groupPreferenceRows.value.find((item) => item.key === key)
  const leader = row?.voting?.allVoted && row.voting.leader
  if (!groupId || !leader || !viewerIsMember.value || finalFor(key) !== null) return
  const mark = row.voting.readyMine
    ? null
    : { result: resultKey(leader), round: rounds.value[key] || 0 }
  delete confirmAgain.value[key]
  ready.value[key] ??= {}
  if (mark) ready.value[key][viewer.value.uid] = mark
  else delete ready.value[key][viewer.value.uid]
  saveReady(groupId, viewer.value.uid, key, mark).catch((error) => {
    console.error('Could not save ready:', error)
    saveState.value = 'error'
  })
}
function finalise(key, leader) {
  const final = { value: leader.value, label: leader.label }
  finalised.value[group.value.GroupID] ??= {}
  finalised.value[group.value.GroupID][key] = final
  delete issues.value[key]
  saveNow({ Finalised: { [key]: final }, Issues: { [key]: null } })
}
// Anyone unhappy with a finalised result raises an issue with a message. The
// result stays finalised while the issue is open; only the member who raised it
// then resolves it (the result stands) or starts a vote, which reopens the vote in
// a new round so everyone votes and confirms again. Who raised it is stored
// only to allow that and is never shown.
const issues = ref({}) // { factorKey: { message, open, by } }
const canDecide = (issue) => !issue.by || issue.by === viewer.value.uid
const rounds = ref({}) // { factorKey: round number }
function raiseIssue(key, message) {
  if (!viewerIsMember.value) return
  const issue = {
    message: String(message || '')
      .trim()
      .slice(0, 300),
    open: true,
    by: viewer.value.uid,
  }
  issues.value[key] = issue
  saveNow({ Issues: { [key]: issue } })
}
function resolveIssue(key) {
  if (!viewerIsMember.value || !issues.value[key] || !canDecide(issues.value[key])) return
  delete issues.value[key]
  saveNow({ Issues: { [key]: null } })
}
function startVote(key) {
  if (!viewerIsMember.value || !issues.value[key] || !canDecide(issues.value[key])) return
  delete finalised.value[group.value?.GroupID]?.[key]
  issues.value[key] = { ...issues.value[key], open: false }
  rounds.value[key] = (rounds.value[key] || 0) + 1
  saveNow({
    Finalised: { [key]: null },
    Issues: { [key]: issues.value[key] },
    Rounds: { [key]: rounds.value[key] },
  })
}

// mode 'vote': members vote (a conflict, or a shared match reopened by an issue).
// mode 'shared': a shared match is settled as it is, so it can take an issue.
function votingFor(factor, mode = 'vote') {
  const ballots = ballotsFor(factor.key)
  // Votes only count in the round they were cast, so Start vote begins with none.
  // An option ballot is { value, round }; an older plain value counts in round 0.
  const round = rounds.value[factor.key] || 0
  const choiceOf = (ballot) =>
    ballot && typeof ballot === 'object'
      ? ballot.round === round
        ? ballot.value
        : null
      : round === 0
        ? (ballot ?? null)
        : null
  const choices = Object.fromEntries(
    members.value.map(({ uid }) => [
      uid,
      factor.key === 'budget' ? ballots[uid] : choiceOf(ballots[uid]),
    ]),
  )
  const voters = members.value.filter((member) => choices[member.uid] != null)
  const base = {
    total: voters.length,
    allVoted: voters.length === members.value.length,
    canVote: viewerIsMember.value,
    // A shared match counts as settled without being stored (settledShared); a
    // voted result wins.
    finalised:
      finalFor(factor.key) ??
      (mode === 'shared' ? { value: { shared: factor.value }, label: factor.value } : null),
    settledShared: mode === 'shared' && finalFor(factor.key) === null,
    mode,
  }
  // A ready mark only counts for the result it was given for. If a changed vote
  // changes the result, the mark lapses: my page clears it (so it can't come back
  // if the votes swing back) and asks me to confirm again. A changed vote that
  // keeps the same result leaves everyone ready.
  const withReady = (voting) => {
    const readyIds = voting.allVoted ? readyFor(factor.key, voting.leader) : []
    const myMark = ready.value[factor.key]?.[viewer.value.uid]
    const readyMine = readyIds.includes(viewer.value.uid)
    // Everyone voted and there's a result: it now only needs everyone to confirm.
    const confirming = Boolean(voting.allVoted && voting.leader && !voting.finalised)
    return {
      ...voting,
      confirming,
      countLabel: confirming
        ? `${readyIds.length}/${members.value.length} confirmed`
        : voting.countLabel,
      leading: confirming ? voting.leader.label : voting.leading,
      ready: readyIds,
      readyMine,
      readyLapsed: Boolean(
        myMark && myMark.round === (rounds.value[factor.key] || 0) && !readyMine,
      ),
      confirmAgain: confirmAgain.value[factor.key] === round && !readyMine,
    }
  }
  if (mode === 'shared') {
    return {
      ...base,
      type: factor.key === 'budget' ? 'range' : 'options',
      allVoted: true,
      options: [],
      flexible: [],
      mine: null,
      leader: null,
      ready: [],
      readyMine: false,
    }
  }
  if (factor.key === 'budget') {
    // Everyone votes a range (the suggestion or their own); the result is the
    // overlap of all of them. Only votes members actually cast count.
    const inRound = (vote) =>
      Number.isFinite(vote?.min) && Number.isFinite(vote?.max) && (vote.round ?? 0) === round
    // The ideal when budgets conflict; the shared range when an issue reopened it.
    const shared = resolveBudget(members.value)
    const suggestion =
      budgetSuggestion(members.value) ??
      (shared.max == null ? null : { min: shared.min, max: shared.max })
    const summary = summariseBudgetVotes(members.value, ballots, round, viewer.value.uid)
    const mine = ballots[viewer.value.uid]
    const label = (range) => formatRange(range.min, range.max, formatCurrency)
    return withReady({
      ...base,
      suggestion,
      myRange: myBudgetRange.value,
      type: 'range',
      total: summary.submitted,
      allVoted: summary.submitted === members.value.length,
      countLabel: `${summary.submitted}/${members.value.length} voted`,
      flagged: summary.flagged,
      summary,
      // Older ballots were a single amount; only this round's ranges count as mine.
      mine: inRound(mine) ? { min: mine.min, max: mine.max } : null,
      leader: summary.result ? { value: summary.result, label: label(summary.result) } : null,
      leading: summary.flagged
        ? 'No overlap · discuss together'
        : summary.overlap
          ? `${label(summary.overlap)} so far`
          : summary.submitted
            ? 'No overlap so far'
            : null,
    })
  }
  const options = (factor.voteOptions ?? buildVoteOptions(factor.key, members.value)).map(
    (option) => ({
      ...option,
      count: voters.filter((member) => choices[member.uid] === option.value).length,
    }),
  )
  const highest = Math.max(0, ...options.map((option) => option.count))
  const leaders = options.filter((option) => highest > 0 && option.count === highest)
  return withReady({
    ...base,
    type: 'options',
    countLabel: `${voters.length}/${members.value.length} voted`,
    options,
    flexible: flexibleMembers(factor.key, members.value),
    mine: choices[viewer.value.uid] ?? null,
    leader: leaders.length === 1 ? leaders[0] : null,
    // Until everyone votes it's only a lead or a tie; once everyone has voted a tie
    // needs a changed vote (a clear result shows as decided, see withReady).
    leading: !voters.length
      ? null
      : leaders.length !== 1
        ? base.allVoted
          ? 'Tied · change a vote'
          : 'Vote tied'
        : `${leaders[0].label} leading`,
  })
}
// The group's priority ranking, most important first. Loaded from and saved to
// Group_Preferences with the rest of the group preference.
const priorities = ref([...DEFAULT_PRIORITY_ORDER])
const viewMode = ref(null)
const selectedUid = ref(null)
const preferencesDialog = ref(null)
const privateHint = ref(null)
const privacyExplanation =
  "Only you can see your private budget. Other members' private budgets stay hidden."

// Only show this group's members. A missing profile is a data-loading problem,
// not a separate submission step for joining the group.
const members = computed(() => {
  const memberIds = [...new Set(group.value?.Members ?? [])]
  // Move Me first for display without changing the stored membership array.
  memberIds.sort((a, b) => Number(b === viewer.value.uid) - Number(a === viewer.value.uid))
  return memberIds.map((uid) => ({
    uid,
    name:
      uid === viewer.value.uid
        ? 'Me'
        : users.value.find((user) => user.UserID === uid)?.Username || 'Group member',
    initials: (users.value.find((user) => user.UserID === uid)?.Username || '?')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join('')
      .toUpperCase(),
    profile: profiles.value.find((profile) => profile.UserID === uid) || null,
  }))
})
// Same colours as the member avatars (.member-avatar), so charts match the list.
const AVATAR_COLORS = ['#bd1745', '#326dcc', '#198463', '#a96b0c']
const memberColor = (uid) =>
  AVATAR_COLORS[members.value.findIndex((member) => member.uid === uid) % AVATAR_COLORS.length]
const avatarMembers = computed(() =>
  members.value.map(({ uid, name, initials }) => ({
    uid,
    name,
    initials,
    color: memberColor(uid),
  })),
)

const selectedMember = computed(
  () => members.value.find((member) => member.uid === selectedUid.value) || null,
)

async function openPreferences(mode) {
  viewMode.value = mode
  privateHint.value = null
  await nextTick()
  preferencesDialog.value?.showModal()
}

function selectMember(uid) {
  selectedUid.value = uid
  return openPreferences('individual')
}

function resetPopup() {
  viewMode.value = null
  selectedUid.value = null
  privateHint.value = null
}

function closeOnBackdrop(event) {
  if (event.target !== preferencesDialog.value) return
  const bounds = preferencesDialog.value.getBoundingClientRect()
  if (
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom
  ) {
    preferencesDialog.value.close()
  }
}

// Member popups may show the viewer's own private budget; group results never do.
const displayPreference = (profile, row) => formatPreference(profile, row, viewer.value)
const overviewKeys = [
  'budget',
  'PreferredLocations',
  'MaxCommuteTime',
  'PreferredMoveInDate',
  'bedrooms',
  'PropertyType',
]
const overviewRows = overviewKeys.map((key) => PREFERENCE_ROWS.find((row) => row.key === key))
const detailRows = PREFERENCE_ROWS.filter((row) => !overviewKeys.includes(row.key))
// The group only votes on and finalises what listing search filters by.
// Lifestyle preferences stay in the member comparison.
const cardKeys = SEARCH_FACTORS
const attentionStatuses = ['conflict', 'discussion']
// Budget is only voted when shared budgets don't overlap or some are private.
const needsVote = (factor) => attentionStatuses.includes(factor.status)

// Analyse public profiles only. The viewer's private budget is never used here.
const preferenceAnalysis = computed(() => analyseGroup(members.value))

const groupPreferenceRows = computed(() => {
  const rows = preferenceAnalysis.value
    .filter((factor) => cardKeys.includes(factor.key))
    .map((factor) => {
      const item = {
        ...factor,
        needsAttention: needsVote(factor),
        details: factor.details.map((detail) => ({ ...detail })),
      }
      // Older issues were saved as true or a name and had already reopened the vote.
      // Older open issues have no raiser, so any member may decide them.
      const issue = issues.value[factor.key]
      item.issue = issue
        ? { message: issue.message || '', open: issue.open === true, canDecide: canDecide(issue) }
        : null
      // Everyone's shared budget as a bar; private budgets stay out of the group view.
      if (factor.key === 'budget') item.budget = budgetBars.value
      // A conflict is voted on. A shared match is settled as it is, unless an issue
      // on it started a vote (the issue stays, closed, until the vote is finalised).
      const voteMode =
        (item.needsAttention && (factor.key === 'budget' || factor.voteOptions?.length)) ||
        (factor.status === 'shared' && issue && !issue.open && finalFor(factor.key) === null)
      if (voteMode || factor.status === 'shared') {
        item.voting = votingFor(factor, voteMode ? 'vote' : 'shared')
        // An undecided issue: the status says Issue raised. Once a vote starts, the
        // card shows the vote again.
        if (item.issue?.open) item.value = ''
        else if (item.voting.finalised) item.value = item.voting.finalised.label
        else if (item.voting.leading) item.value = item.voting.leading
      }
      return item
    })
  const rank = (item) =>
    item.voting?.finalised ? 3 : ({ conflict: 0, discussion: 1, unavailable: 2 }[item.status] ?? 3)
  return rows.sort((a, b) => rank(a) - rank(b))
})

// My own budget range, even if private, since only I see how options compare to it.
const myBudgetRange = computed(() => {
  const me = members.value.find((member) => member.uid === viewer.value.uid)?.profile
  const budget = me?.IsBudgetPrivate ? viewer.value.privateBudget : me
  return Number.isFinite(budget?.BudgetMin) && Number.isFinite(budget?.BudgetMax)
    ? { min: budget.BudgetMin, max: budget.BudgetMax }
    : null
})

// The budget panel: one bar per shared budget, the shared range, and how many
// members keep theirs private (they are left out, never shown).
const budgetBars = computed(() => {
  const shared = members.value.filter(
    ({ profile: p }) =>
      p?.IsBudgetPrivate === false && Number.isFinite(p.BudgetMin) && Number.isFinite(p.BudgetMax),
  )
  const resolved = resolveBudget(members.value)
  return {
    members: shared.map(({ uid, name, profile: p }) => ({
      uid,
      name,
      color: memberColor(uid),
      min: p.BudgetMin,
      max: p.BudgetMax,
    })),
    hidden: members.value.filter(({ profile: p }) => p?.IsBudgetPrivate).length,
    shared: resolved.max == null ? null : { min: resolved.min, max: resolved.max },
  }
})

// Overall compatibility: the average match of every pair of members (public data only).
const compatibility = computed(() => {
  const score = groupMatchScore(members.value, priorities.value)
  if (score == null) return null
  const open = groupPreferenceRows.value.filter(
    (row) => row.needsAttention && !row.voting?.finalised,
  )
  return {
    score,
    conflicts: open.filter((row) => row.status === 'conflict').length,
    discussions: open.filter((row) => row.status !== 'conflict').length,
  }
})
// Once all four search preferences are settled, the card says so; the score
// itself stays member compatibility, since finalising doesn't change profiles.
const searchAgreed = computed(() => groupPreference.value.IsComplete)
const compatibilityVerdict = computed(() => {
  const score = compatibility.value?.score
  if (searchAgreed.value) return '✓ Search preferences agreed'
  if (score == null) return 'Not enough preferences to compare yet'
  if (score >= 80) return 'Strong match'
  if (score >= 60) return 'Some differences to discuss'
  return 'Major differences to resolve'
})

// Me against each other member. My own budget is used even when private,
// because only I see this view; theirs only when they share it.
const memberComparisons = computed(() => {
  const me = members.value.find((member) => member.uid === viewer.value.uid)
  if (!me) return []
  const myBudget = me.profile?.IsBudgetPrivate ? viewer.value.privateBudget : me.profile
  return members.value
    .filter((member) => member.uid !== me.uid)
    .map((member) => {
      const rows = compareWithMember(me.profile, member.profile, {
        myBudget,
        name: member.name,
      })
      return {
        uid: member.uid,
        name: member.name,
        color: memberColor(member.uid),
        rows,
        score: matchScore(rows, priorities.value),
      }
    })
})
// Table rows map onto comparison keys; both commute rows share one comparison.
// Only the radar's preferences are shaded; every other row keeps the default colour.
const COMPARE_KEY = { MaxCommuteTime: 'commute', CommuteDestination: 'commute' }
const SHADED_KEYS = RADAR_FACTORS.map((factor) => factor.key)
const comparisonCell = (uid, rowKey) => {
  const key = COMPARE_KEY[rowKey] || rowKey
  if (!SHADED_KEYS.includes(key)) return null
  return memberComparisons.value
    .find((comparison) => comparison.uid === uid)
    ?.rows.find((row) => row.key === key)
}

// What the group agreed, ready for listing search (Group_Preferences/{GroupID}).
const decisions = computed(() =>
  Object.fromEntries(
    Object.entries(finalised.value[group.value?.GroupID] || {}).map(([key, final]) => [
      key,
      final.value,
    ]),
  ),
)
const groupPreference = computed(() =>
  buildGroupPreference({
    groupId: group.value?.GroupID,
    members: members.value,
    analysis: preferenceAnalysis.value,
    decisions: decisions.value,
    priorities: priorities.value,
  }),
)

// Saving Group_Preferences/{GroupID} with the finalised votes. Saved whenever a
// member finalises, reopens or re-ranks, so listing search never reads a stale
// record (a reopened vote saves IsComplete false).
const router = useRouter()
const saveState = ref('idle') // idle | saving | saved | error
let saveTimer = null
// Saves the group preference summary plus only the decisions that changed
// (see saveGroupPreference). Nothing is saved until the page has loaded the saved
// record and the votes, so a half-loaded page can't write over them.
async function saveNow(changes = {}) {
  clearTimeout(saveTimer)
  if (!synced.value) return false
  saveState.value = 'saving'
  try {
    await saveGroupPreference(groupPreference.value, viewer.value.uid, changes)
    saveState.value = 'saved'
    return true
  } catch (error) {
    console.error('Could not save group preferences:', error)
    saveState.value = 'error'
    return false
  }
}
// My lapsed ready marks are cleared, with a note to confirm the new result.
watch(
  () =>
    !synced.value
      ? []
      : groupPreferenceRows.value
          .filter(({ voting }) => voting?.readyLapsed && !voting.finalised)
          .map(({ key }) => key),
  (keys) =>
    keys.forEach((key) => {
      confirmAgain.value[key] = rounds.value[key] || 0
      delete ready.value[key]?.[viewer.value.uid]
      saveReady(group.value.GroupID, viewer.value.uid, key, null).catch((error) =>
        console.error('Could not clear ready:', error),
      )
    }),
)
// Once every member is ready on the same result, it is finalised. Every open page
// sees this, so it doesn't depend on who clicked last.
watch(
  () =>
    !synced.value
      ? []
      : groupPreferenceRows.value
          .filter(({ voting }) => voting && !voting.finalised && voting.leader)
          .filter(({ voting }) => voting.ready.length === members.value.length)
          .map(({ key, voting }) => ({ key, leader: voting.leader })),
  (complete) => complete.forEach(({ key, leader }) => finalise(key, leader)),
)

// Re-ranking saves after a short pause, so dragging doesn't write every step.
function savePrioritiesSoon() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(saveNow, 800)
}

// Applies the saved record from Firestore: finalised votes and the ranking.
function applySavedPreference(id, saved) {
  loaded.value.saved = true
  finalised.value = { [id]: saved?.Finalised || {} }
  issues.value = saved?.Issues || {}
  rounds.value = saved?.Rounds || {}
  const ranked = PRIORITY_FACTORS.filter(({ field }) => saved?.Priorities?.[field] > 0)
    .sort((a, b) => saved.Priorities[a.field] - saved.Priorities[b.field])
    .map(({ key }) => key)
  if (ranked.length === PRIORITY_FACTORS.length) priorities.value = ranked
}

// Loading. Live listeners keep the group, ballots and saved record in sync
// across members; member profiles are re-read when the member list changes.
let stopListeners = []
function stopWatching() {
  stopListeners.forEach((stop) => stop())
  stopListeners = []
}
// No group ID: open the user's only group, or list them to pick from.
async function pickGroup(user) {
  try {
    userGroups.value = await getUserGroups(user.uid)
  } catch (error) {
    console.error('Could not load your groups:', error)
    loadState.value = 'error'
    return
  }
  if (groupId.value) return // a group was picked meanwhile
  if (userGroups.value.length === 1) {
    router.replace({ query: { groupId: userGroups.value[0].id } })
  } else {
    loadState.value = userGroups.value.length ? 'choose-group' : 'no-group'
  }
}
async function loadGroup(id) {
  stopWatching()
  group.value = null
  votes.value = {}
  ready.value = {}
  finalised.value = {}
  issues.value = {}
  rounds.value = {}
  priorities.value = [...DEFAULT_PRIORITY_ORDER]
  confirmAgain.value = {}
  loaded.value = { votes: false, saved: false }
  saveState.value = 'idle'

  loadState.value = 'loading'
  const user = await getCurrentUser()
  if (id !== groupId.value) return // navigated away meanwhile
  if (!user) {
    loadState.value = 'signed-out'
    return
  }
  if (!id) return pickGroup(user)
  viewer.value = { uid: user.uid, privateBudget: null }
  getMyPrivateBudget(user.uid)
    .then((budget) => (viewer.value = { ...viewer.value, privateBudget: budget }))
    .catch((error) => console.error('Could not load your private budget:', error))

  const fail = (error) => {
    console.error('Could not load the group:', error)
    loadState.value = 'error'
  }
  let memberKey = null
  stopListeners.push(
    watchGroup(
      id,
      async (data) => {
        if (!data) return (loadState.value = 'not-found')
        const memberIds = data.Members || []
        if (!memberIds.includes(user.uid)) return (loadState.value = 'not-member')
        if (memberIds.join() !== memberKey) {
          memberKey = memberIds.join()
          try {
            profiles.value = await getMemberProfiles(memberIds)
          } catch (error) {
            return fail(error)
          }
        }
        // Names come with the group, so a rename shows straight away.
        users.value = data.users
        group.value = data
        loadState.value = 'ready'
      },
      fail,
    ),
    watchVotes(
      id,
      (ballots, readyMarks) => {
        votes.value = { [id]: ballots }
        ready.value = readyMarks
        loaded.value.votes = true
      },
      fail,
    ),
    watchGroupPreference(id, (saved) => applySavedPreference(id, saved), fail),
  )
}
watch(groupId, loadGroup, { immediate: true })
onBeforeUnmount(() => {
  stopWatching()
  clearTimeout(saveTimer)
})
const loadMessages = {
  loading: { title: 'Loading group…' },
  // Login sends you back here afterwards.
  'signed-out': {
    title: 'Sign in to see your group',
    link: { path: '/login', query: { redirect: route.fullPath } },
    action: 'Sign in',
  },
  'no-group': {
    title: 'No group yet',
    text: 'Create or join a group from Home to compare preferences.',
    link: '/home',
    action: 'Go to Home',
  },
  'choose-group': { title: 'Choose a group' },
  'not-found': { title: 'Group not found', link: '/home', action: 'Go to Home' },
  'not-member': {
    title: "You're not in this group",
    text: 'Ask a member to add you, or pick one of your groups from Home.',
    link: '/home',
    action: 'Go to Home',
  },
  error: { title: "Couldn't load this group", text: 'Check your connection and refresh.' },
}
// Comparisons need the viewer's own profile.
const viewerHasProfile = computed(
  () => !!members.value.find((member) => member.uid === viewer.value.uid)?.profile,
)

async function searchListings() {
  if (await saveNow()) router.push('/listings')
}
const saveMessage = computed(
  () =>
    ({
      saving: 'Saving…',
      saved: '✓ Saved for the group',
      error: "Couldn't save. Try again.",
    })[saveState.value] || '',
)
</script>

<template>
  <div>
    <header class="page-head">
      <h1>Group Summary</h1>
    </header>

    <div class="content">
      <div class="summary-layout">
        <section v-if="loadState !== 'ready'" class="card" role="status">
          <h2>{{ loadMessages[loadState].title }}</h2>
          <p v-if="loadMessages[loadState].text" class="table-description">
            {{ loadMessages[loadState].text }}
          </p>
          <RouterLink
            v-if="loadMessages[loadState].link"
            :to="loadMessages[loadState].link"
            class="btn btn-primary"
            >{{ loadMessages[loadState].action }}</RouterLink
          >
          <ul v-if="loadState === 'choose-group'" class="group-choices">
            <li v-for="choice in userGroups" :key="choice.id">
              <RouterLink :to="{ query: { groupId: choice.id } }" class="btn btn-secondary">
                {{ choice.name }}
              </RouterLink>
            </li>
          </ul>
        </section>
        <template v-else-if="group">
          <section v-if="!viewerHasProfile" class="card profile-prompt">
            <h2>Create your profile to compare</h2>
            <p class="table-description">Your matches and votes need your own preferences first.</p>
            <RouterLink to="/profile" class="btn btn-primary">Set up profile</RouterLink>
          </section>
          <!-- Yi Phu's layout, with our interactive members card in second place. -->
          <div class="summary-grid">
            <div class="summary-column">
              <section class="card alignment-card">
                <h2>Group alignment</h2>
                <div class="alignment-content">
                  <div
                    class="alignment-circle"
                    role="img"
                    :style="{ '--score': compatibility?.score ?? 0 }"
                    :aria-label="
                      compatibility
                        ? `Compatibility score ${compatibility.score} out of 100`
                        : 'Compatibility score not calculated'
                    "
                  >
                    <span>{{ compatibility ? `${compatibility.score}%` : '—' }}</span>
                  </div>
                  <div>
                    <h3>Overall compatibility</h3>
                    <p class="alignment-verdict" :class="{ 'is-agreed': searchAgreed }">
                      {{ compatibilityVerdict }}
                    </p>
                    <p v-if="compatibility && searchAgreed" class="alignment-meta">
                      {{ compatibility.score }}% member compatibility ·
                      {{
                        compatibility.score >= 80 ? 'strong match' : 'lifestyle differences remain'
                      }}
                    </p>
                    <p v-else-if="compatibility" class="alignment-meta">
                      {{ compatibility.conflicts }}
                      {{ compatibility.conflicts === 1 ? 'conflict' : 'conflicts' }} ·
                      {{ compatibility.discussions }} to discuss
                    </p>
                  </div>
                </div>
              </section>
              <section class="card" aria-labelledby="members-title">
                <div class="group-heading">
                  <div>
                    <h2 id="members-title">Group members</h2>
                    <p class="group-description">
                      {{ group.GroupName }} · {{ members.length }} members
                    </p>
                  </div>
                  <button
                    v-if="members.length"
                    type="button"
                    class="btn btn-secondary"
                    aria-haspopup="dialog"
                    aria-controls="member-preferences"
                    @click="openPreferences('table')"
                  >
                    Compare all members
                  </button>
                </div>
                <div
                  class="member-avatars"
                  role="group"
                  aria-label="Select a member to view preferences"
                >
                  <button
                    v-for="member in members"
                    :key="member.uid"
                    type="button"
                    class="member-button"
                    :aria-label="
                      member.uid === viewer.uid
                        ? 'View my preferences'
                        : `View ${member.name}'s preferences`
                    "
                    aria-haspopup="dialog"
                    aria-controls="member-preferences"
                    @click="selectMember(member.uid)"
                  >
                    <span class="member-avatar" aria-hidden="true">{{ member.initials }}</span>
                    <span class="member-name">{{ member.name }}</span>
                  </button>
                </div>
              </section>

              <GroupPreferencesCard
                :member-count="members.length"
                :rows="groupPreferenceRows"
                :members="avatarMembers"
                @vote="castVote"
                @ready="toggleReady"
                @raise-issue="raiseIssue"
                @resolve-issue="resolveIssue"
                @start-vote="startVote"
              />
            </div>

            <div class="summary-column">
              <section class="card">
                <h2>Your match with each member</h2>
                <MemberRadarChart :comparisons="memberComparisons" :axes="RADAR_FACTORS" />
              </section>

              <section class="card">
                <h2>Set group priorities</h2>
                <PriorityRanking
                  v-model="priorities"
                  :factors="PRIORITY_FACTORS"
                  @update:model-value="savePrioritiesSoon"
                />
                <p class="implementation-note">
                  Drag to rank. #1 counts most in match scores and listing search.
                </p>
              </section>
            </div>
          </div>

          <footer class="page-actions">
            <button
              v-if="groupPreference.IsComplete"
              type="button"
              class="btn btn-primary btn-block"
              :disabled="saveState === 'saving'"
              @click="searchListings"
            >
              Search listings with group preference
            </button>
            <button v-else type="button" class="btn btn-primary btn-block" disabled>
              Finalise {{ groupPreference.PendingPreferences.length }} more to search listings
            </button>
            <p v-if="saveMessage" class="save-status" :class="`is-${saveState}`" role="status">
              {{ saveMessage }}
            </p>
          </footer>

          <dialog
            v-if="members.length"
            ref="preferencesDialog"
            id="member-preferences"
            class="preferences-dialog"
            :class="{ 'comparison-dialog': viewMode === 'table' }"
            aria-labelledby="preferences-title"
            @close="resetPopup"
            @click="closeOnBackdrop"
          >
            <div class="group-heading">
              <h2 id="preferences-title">
                {{
                  viewMode === 'table'
                    ? 'Member preferences'
                    : selectedMember?.uid === viewer.uid
                      ? 'My preferences'
                      : `${selectedMember?.name}'s preferences`
                }}
              </h2>
              <button
                type="button"
                class="close-popup"
                aria-label="Close preferences"
                autofocus
                @click="preferencesDialog.close()"
              >
                ×
              </button>
            </div>

            <div v-if="viewMode === 'individual' && selectedMember" class="individual-view">
              <template v-if="selectedMember.profile">
                <dl class="preference-grid">
                  <div v-for="row in overviewRows" :key="row.key">
                    <dt>{{ row.label }}</dt>
                    <dd>
                      {{ displayPreference(selectedMember.profile, row) }}
                      <span
                        v-if="row.key === 'budget' && selectedMember.profile.IsBudgetPrivate"
                        class="privacy-info"
                        @mouseenter="privateHint = selectedMember.uid"
                        @mouseleave="privateHint = null"
                        @keydown.esc.stop="privateHint = null"
                      >
                        <button
                          type="button"
                          class="privacy-badge"
                          aria-label="Private budget information"
                          :aria-describedby="
                            privateHint === selectedMember.uid
                              ? 'individual-budget-privacy'
                              : undefined
                          "
                          @click="privateHint = selectedMember.uid"
                          @focus="privateHint = selectedMember.uid"
                          @blur="privateHint = null"
                        >
                          P
                        </button>
                        <span
                          v-if="privateHint === selectedMember.uid"
                          id="individual-budget-privacy"
                          class="privacy-tooltip"
                          role="tooltip"
                          >{{ privacyExplanation }}</span
                        >
                      </span>
                    </dd>
                  </div>
                </dl>
                <details :key="selectedMember.uid" class="more-preferences">
                  <summary>More preferences ({{ detailRows.length }})</summary>
                  <dl class="preference-grid">
                    <div v-for="row in detailRows" :key="row.key">
                      <dt>{{ row.label }}</dt>
                      <dd>{{ displayPreference(selectedMember.profile, row) }}</dd>
                    </div>
                  </dl>
                </details>
              </template>
              <p v-else class="table-description" role="status">
                We couldn't load this member's preferences. Please try again later.
              </p>
            </div>

            <div
              v-if="viewMode === 'table'"
              class="table-scroll"
              role="region"
              aria-label="Member preference comparison"
              tabindex="0"
            >
              <table>
                <caption class="sr-only">
                  Each member's preferences compared with yours for
                  {{
                    group.GroupName
                  }}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Preference</th>
                    <th v-for="member in members" :key="member.uid" scope="col">
                      <span class="column-name">{{ member.name }}</span>
                    </th>
                  </tr>
                </thead>
                <tbody v-for="section in preferenceSections" :key="section.title">
                  <tr class="section-row">
                    <th :colspan="members.length + 1" scope="rowgroup">{{ section.title }}</th>
                  </tr>
                  <tr v-for="row in section.rows" :key="row.key">
                    <th scope="row">{{ row.label }}</th>
                    <td
                      v-for="member in members"
                      :key="member.uid"
                      :class="{
                        'missing-value': !member.profile,
                        'cell-match':
                          member.uid !== viewer.uid &&
                          comparisonCell(member.uid, row.key)?.state === 'compatible',
                        'cell-partial':
                          member.uid !== viewer.uid &&
                          comparisonCell(member.uid, row.key)?.state === 'discuss',
                        'cell-differ':
                          member.uid !== viewer.uid &&
                          comparisonCell(member.uid, row.key)?.state === 'conflict',
                      }"
                      :title="
                        member.uid === viewer.uid
                          ? undefined
                          : comparisonCell(member.uid, row.key)?.reason
                      "
                    >
                      {{ displayPreference(member.profile, row) }}
                      <span
                        v-if="member.uid !== viewer.uid && comparisonCell(member.uid, row.key)"
                        class="sr-only"
                      >
                        ({{
                          comparisonCell(member.uid, row.key).state === 'compatible'
                            ? 'works with yours'
                            : comparisonCell(member.uid, row.key).state === 'unknown'
                              ? 'not compared'
                              : comparisonCell(member.uid, row.key).state === 'discuss'
                                ? 'partly works with yours'
                                : 'differs from yours'
                        }})
                      </span>
                      <span
                        v-if="row.key === 'budget' && member.profile?.IsBudgetPrivate"
                        class="privacy-info"
                        @mouseenter="privateHint = member.uid"
                        @mouseleave="privateHint = null"
                        @keydown.esc.stop="privateHint = null"
                      >
                        <button
                          type="button"
                          class="privacy-badge"
                          aria-label="Private budget information"
                          :aria-describedby="
                            privateHint === member.uid ? `budget-privacy-${member.uid}` : undefined
                          "
                          @click="privateHint = member.uid"
                          @focus="privateHint = member.uid"
                          @blur="privateHint = null"
                        >
                          P
                        </button>
                        <span
                          v-if="privateHint === member.uid"
                          :id="`budget-privacy-${member.uid}`"
                          class="privacy-tooltip"
                          role="tooltip"
                          >{{ privacyExplanation }}</span
                        >
                      </span>
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">Match with you</th>
                    <td v-for="member in members" :key="member.uid" class="match-cell">
                      {{
                        member.uid === viewer.uid
                          ? '—'
                          : `${memberComparisons.find((item) => item.uid === member.uid)?.score ?? '—'}%`
                      }}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </dialog>
          <p v-else class="card">This group has no members to compare yet.</p>
        </template>
        <section v-else class="card">
          <h2>No group selected</h2>
          <p class="table-description">Create or join a group from Home to compare preferences.</p>
          <RouterLink to="/home" class="btn btn-primary">Go to Home</RouterLink>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.summary-layout {
  max-width: 1100px;
  margin: 0 auto;
}
.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
  margin-top: 20px;
}
.summary-column {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 20px;
}
.summary-grid .card {
  padding: 24px;
  border: 1px solid var(--line, #e9e9e9);
  border-radius: 14px;
  background: #fff;
}
.summary-grid h2 {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 700;
}
.section-description {
  margin: 0;
  color: #737373;
  font-size: 13px;
  line-height: 1.6;
}
.alignment-content {
  display: flex;
  align-items: center;
  gap: 18px;
  margin-top: 20px;
}
.alignment-content h3 {
  margin: 0 0 6px;
  font-size: 16px;
}
.alignment-circle {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 82px;
  height: 82px;
  border-radius: 50%;
  /* Ring fills clockwise to the score; the white disc covers the centre. */
  background:
    radial-gradient(closest-side, #fff calc(100% - 7px), transparent calc(100% - 6px)),
    conic-gradient(var(--red, #ed003b) calc(var(--score) * 1%), var(--red-tint, #fff0f3) 0);
  color: var(--red, #ed003b);
  font-size: 25px;
  font-weight: 700;
}
.chart-area {
  display: flex;
  min-height: 230px;
  margin-top: 18px;
  padding: 20px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px dashed var(--line);
  border-radius: 10px;
  background: #fafafa;
  color: #737373;
  text-align: center;
  font-size: 13px;
}
.chart-area small {
  font-size: 11px;
}
.alignment-verdict {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}
.alignment-verdict.is-agreed {
  color: var(--ok, #2e7d5b);
}
.alignment-meta {
  margin: 4px 0 0;
  color: #737373;
  font-size: 12px;
  line-height: 1.5;
}
.implementation-note {
  margin: 14px 0 0;
  color: #737373;
  font-size: 11px;
}
.page-actions {
  margin-top: 24px;
}
.profile-prompt {
  margin-bottom: 20px;
}
.group-choices {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 14px 0 0;
  padding: 0;
  list-style: none;
}
.save-status {
  margin: 8px 0 0;
  color: #737373;
  font-size: 12px;
  text-align: center;
}
.save-status.is-saved {
  color: var(--ok, #2e7d5b);
}
.save-status.is-error {
  color: #9b1c2c;
}
@media (max-width: 960px) {
  .summary-grid {
    grid-template-columns: 1fr;
  }
}
.group-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.group-description,
.table-description {
  margin-top: 5px;
  color: #6d6863;
  font-size: 12px;
  line-height: 1.6;
}
.table-description {
  margin-bottom: 12px;
}
.member-avatars {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  margin-top: 18px;
}
.member-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 64px;
  padding: 4px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #625d58;
  font: inherit;
  cursor: pointer;
}
.member-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: #bd1745;
  color: white;
  font-size: 20px;
  font-weight: 600;
}
.member-button:nth-child(4n + 2) .member-avatar {
  background: #326dcc;
}
.member-button:nth-child(4n + 3) .member-avatar {
  background: #198463;
}
.member-button:nth-child(4n + 4) .member-avatar {
  background: #a96b0c;
}
.member-button:hover .member-avatar {
  outline: 2px solid var(--red);
  outline-offset: 3px;
}
.member-button:hover .member-name {
  color: var(--red);
  font-weight: 600;
}
.member-button:focus-visible {
  outline: 2px solid var(--red);
  outline-offset: 3px;
}
.member-name {
  max-width: 100%;
  overflow-wrap: anywhere;
  font-size: 12px;
}
.preferences-dialog {
  margin: auto;
  padding: 24px;
  width: min(680px, calc(100vw - 32px));
  max-width: calc(100vw - 32px);
  max-height: 85dvh;
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: white;
  color: var(--text);
  box-shadow: 0 16px 60px #0003;
  min-width: 0;
}
.cell-match {
  background: #e9f6ee;
}
.cell-partial {
  background: #fdf5dc;
}
.cell-differ {
  background: #fcebec;
}
.match-cell {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.page-actions .btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.comparison-dialog {
  width: min(1100px, calc(100vw - 32px));
}
.preferences-dialog::backdrop {
  background: #201b2859;
}
:global(body:has(.preferences-dialog[open])) {
  overflow: hidden;
}
.close-popup {
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 50%;
  background: #f6f5f4;
  color: #625d58;
  font-size: 24px;
  cursor: pointer;
}
.close-popup:focus-visible {
  outline: 2px solid var(--red);
  outline-offset: 2px;
}
.individual-view,
.scroll-hint {
  margin-top: 14px;
}
.privacy-info {
  display: inline-block;
  position: relative;
  margin-left: 5px;
  vertical-align: middle;
}
.privacy-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 1px solid #d8c5ed;
  border-radius: 50%;
  background: #f1e9fa;
  color: #703da0;
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}
.privacy-badge:focus-visible {
  outline: 2px solid #703da0;
  outline-offset: 2px;
}
.privacy-tooltip {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 3;
  width: 200px;
  max-width: calc(100vw - 72px);
  padding: 10px 12px;
  border: 1px solid #d8c5ed;
  border-radius: 8px;
  background: #faf6ff;
  color: #513069;
  box-shadow: 0 4px 12px #5130691a;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.5;
}
.table-scroll .privacy-tooltip {
  left: auto;
  right: 0;
}
.preference-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px 20px;
  margin: 18px 0;
}
.preference-grid dt {
  font-size: 11px;
  color: #6d6863;
  margin-bottom: 4px;
}
.preference-grid dd {
  margin: 0;
  font-size: 13px;
  overflow-wrap: anywhere;
}
.more-preferences {
  border-top: 1px solid var(--line);
  padding-top: 12px;
}
.more-preferences summary {
  cursor: pointer;
  color: var(--red);
  font-size: 12px;
}
.scroll-hint {
  color: #6d6863;
  font-size: 11px;
  margin-bottom: 10px;
}
.table-scroll {
  overflow: auto;
  max-height: 420px;
  border: 1px solid var(--line);
  border-radius: 8px;
}
table {
  width: 100%;
  min-width: 780px;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 12px;
}
th,
td {
  min-width: 150px;
  max-width: 240px;
  padding: 13px 14px;
  text-align: left;
  vertical-align: top;
  border-bottom: 1px solid var(--line);
  overflow-wrap: anywhere;
}
thead th {
  background: #faf9f8;
  position: sticky;
  top: 0;
  z-index: 1;
}
th[scope='row'] {
  font-weight: 500;
  color: #625d58;
}
.column-name {
  display: block;
  font-size: 13px;
}
.section-row th {
  background: #f6f5f4;
  font-size: 11px;
  font-weight: 600;
  color: #625d58;
}
.missing-value {
  color: #827b74;
  font-style: italic;
}
tbody:last-child tr:last-child th,
tbody:last-child tr:last-child td {
  border-bottom: 0;
}
@media (max-width: 720px) {
  .preference-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .preferences-dialog {
    padding: 16px;
  }
}
</style>
