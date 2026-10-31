<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import BudgetVote from './BudgetVote.vue'
import OptionVote from './OptionVote.vue'

const props = defineProps({
  memberCount: { type: Number, default: 0 },
  rows: { type: Array, default: () => [] },
  // { uid, name, initials, color } for avatars on vote options.
  members: { type: Array, default: () => [] },
})
const emit = defineEmits(['vote', 'ready', 'raise-issue', 'resolve-issue', 'start-vote'])
const dialog = ref(null)
const selectedKey = ref(null)
const selected = computed(() => props.rows.find((row) => row.key === selectedKey.value))
const memberFor = (uid) => props.members.find((member) => member.uid === uid)

async function openDetails(key) {
  selectedKey.value = key
  await nextTick()
  dialog.value.showModal()
}
function closeOnBackdrop(event) {
  if (event.target !== dialog.value) return
  const rect = dialog.value.getBoundingClientRect()
  if (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  )
    dialog.value.close()
}
watch([selected, () => props.memberCount], ([row, count]) => {
  if (!row || count < 2) dialog.value?.close()
})

// An open issue sits on a finalised result until someone resolves it or starts a vote.
const hasIssue = (item) => Boolean(item.issue && (item.issue.open || !item.voting?.finalised))
// "Issue raised" only while the issue is undecided; a vote it started shows as a vote.
const statusLabel = (item) =>
  item.issue?.open
    ? 'Issue raised'
    : item.voting?.settledShared
      ? '✓ Shared match'
      : item.voting?.finalised
        ? '✓ Finalised'
        : item.voting?.confirming
          ? 'Confirmation'
          : item.voting?.flagged
            ? 'Discuss together'
            : item.needsAttention
              ? item.status === 'conflict'
                ? 'Conflict'
                : 'Discuss together'
              : item.voting?.mode === 'vote'
                ? 'Vote reopened' // a shared match an issue reopened
                : item.status === 'shared'
                  ? '✓ Shared match'
                  : null
// Raise an issue: a short message for the group, sent without a name.
const issueOpen = ref(false)
const issueMessage = ref('')
watch(selectedKey, () => {
  issueOpen.value = false
  issueMessage.value = ''
})
function sendIssue() {
  emit('raise-issue', selected.value.key, issueMessage.value)
  issueOpen.value = false
  issueMessage.value = ''
}

// Confirm button: everyone clicks it to finalise; each click adds that member's avatar.
const readyLabel = (voting) =>
  !voting.allVoted
    ? `Waiting for ${props.memberCount - voting.total} more ${
        props.memberCount - voting.total === 1 ? 'vote' : 'votes'
      }`
    : voting.flagged
      ? 'No overlap · change a vote'
      : !voting.leader
        ? 'Tied · change a vote'
        : voting.readyMine
          ? 'Confirmed ✓'
          : `Confirm ${voting.leader.label}`
</script>

<template>
  <section class="card group-preferences-card" aria-label="Group preferences">
    <h2>Group preferences</h2>
    <p v-if="memberCount < 2" class="empty-state">At least two members are needed.</p>
    <div v-else class="preference-boxes">
      <button
        v-for="item in rows"
        :key="item.key"
        type="button"
        class="preference-box"
        :class="{
          'needs-attention': (item.needsAttention && !item.voting?.finalised) || hasIssue(item),
          'is-shared': (item.status === 'shared' || item.voting?.finalised) && !hasIssue(item),
        }"
        :aria-label="item.title + ': view details'"
        aria-haspopup="dialog"
        @click="openDetails(item.key)"
      >
        <span class="box-heading">
          <span>{{ item.title }}</span>
          <span class="expand-icon" aria-hidden="true">+</span>
        </span>
        <span v-if="statusLabel(item)" class="status-row">
          <span class="status-label">{{ statusLabel(item) }}</span>
          <span v-if="item.voting && !item.voting.finalised" class="vote-count">{{
            item.voting.countLabel
          }}</span>
        </span>
        <span class="preference-value">{{ item.value }}</span>
      </button>
    </div>
    <dialog
      ref="dialog"
      class="factor-dialog"
      aria-labelledby="factor-dialog-title"
      @click="closeOnBackdrop"
      @close="selectedKey = null"
    >
      <template v-if="selected">
        <div class="dialog-heading">
          <h2 id="factor-dialog-title">{{ selected.title }}</h2>
          <button
            type="button"
            class="close-popup"
            aria-label="Close preference details"
            autofocus
            @click="dialog.close()"
          >
            ×
          </button>
        </div>
        <!-- Every preference shows its sweet-spot panel; this box is only for an issue. -->
        <div
          v-if="hasIssue(selected)"
          class="popup-summary"
          :class="{
            'needs-attention':
              (selected.needsAttention && !selected.voting?.finalised) || hasIssue(selected),
            'is-shared':
              (selected.status === 'shared' || selected.voting?.finalised) && !hasIssue(selected),
          }"
        >
          <span v-if="statusLabel(selected)" class="status-label">{{ statusLabel(selected) }}</span>
          <!-- An open issue shows its message instead of the result. -->
          <template v-if="hasIssue(selected)">
            <strong class="summary-value issue-message">{{
              selected.issue.message ? `“${selected.issue.message}”` : 'No message'
            }}</strong>
            <span v-if="selected.voting?.finalised" class="issue-note"
              >Agreed: {{ selected.voting.finalised.label }}</span
            >
            <span v-else-if="selected.voting?.leading" class="issue-note"
              >Now: {{ selected.voting.leading }}</span
            >
          </template>
          <strong v-else class="summary-value">{{ selected.value }}</strong>
        </div>

        <BudgetVote
          v-if="selected.budget"
          :bars="selected.budget"
          :voting="selected.voting"
          :disabled="!selected.voting?.canVote || selected.voting?.readyMine"
          @vote="emit('vote', selected.key, $event)"
        />
        <OptionVote
          v-else
          :item="selected"
          :disabled="!selected.voting?.canVote || selected.voting?.readyMine"
          @vote="emit('vote', selected.key, $event)"
        />

        <template v-if="selected.voting">
          <div class="finalise-row">
            <form
              v-if="selected.voting.finalised && issueOpen"
              class="issue-form"
              @submit.prevent="sendIssue"
            >
              <label>
                <span>What's the issue?</span>
                <textarea v-model="issueMessage" rows="3" maxlength="300" required></textarea>
              </label>
              <div class="issue-actions">
                <button type="button" class="btn btn-secondary" @click="issueOpen = false">
                  Cancel
                </button>
                <button type="submit" class="btn btn-primary" :disabled="!issueMessage.trim()">
                  Raise issue
                </button>
              </div>
            </form>
            <!-- An open issue: whoever raised it keeps the result or starts a new vote;
                 everyone else is asked to talk it through. -->
            <p
              v-else-if="
                selected.voting.finalised && hasIssue(selected) && !selected.issue.canDecide
              "
              class="discuss-note"
            >
              Discuss this with your group.
            </p>
            <div v-else-if="selected.voting.finalised && hasIssue(selected)" class="issue-actions">
              <button
                type="button"
                class="btn btn-secondary"
                @click="emit('resolve-issue', selected.key)"
              >
                Resolved
              </button>
              <button
                type="button"
                class="btn btn-primary"
                @click="emit('start-vote', selected.key)"
              >
                Start vote
              </button>
            </div>
            <button
              v-else-if="selected.voting.finalised"
              type="button"
              class="btn btn-secondary"
              @click="issueOpen = true"
            >
              Raise an issue
            </button>
            <p
              v-if="!selected.voting.finalised && selected.voting.confirmAgain"
              class="confirm-note"
            >
              Votes changed since you confirmed. Check the result and confirm again.
            </p>
            <button
              v-if="!selected.voting.finalised"
              type="button"
              class="ready-button"
              :class="{ 'is-ready': selected.voting.readyMine }"
              :aria-pressed="selected.voting.readyMine"
              :disabled="!selected.voting.allVoted || !selected.voting.leader"
              @click="emit('ready', selected.key)"
            >
              <span>{{ readyLabel(selected.voting) }}</span>
              <span v-if="selected.voting.ready.length" class="avatars">
                <span
                  v-for="uid in selected.voting.ready"
                  :key="uid"
                  class="mini-avatar"
                  :style="{ background: memberFor(uid)?.color }"
                  :title="memberFor(uid)?.name"
                  >{{ memberFor(uid)?.initials }}</span
                >
              </span>
              <span class="ready-count">{{ selected.voting.ready.length }}/{{ memberCount }}</span>
            </button>
          </div>
        </template>
      </template>
    </dialog>
  </section>
</template>

<style scoped>
/* Shown when my confirmation lapsed because the votes changed the result. */
.confirm-note {
  width: 100%;
  margin: 0 0 8px;
  color: var(--warn, #8a5a00);
  font-size: 13px;
  font-weight: 600;
}
/* Like a game's ready button: avatars stack up as members confirm. */
.ready-button {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--text, #161616);
  border-radius: 10px;
  background: var(--text, #161616);
  color: #fff;
  font: inherit;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}
.ready-button.is-ready {
  border-color: var(--ok, #2e7d5b);
  background: var(--ok-tint, #e2f3ea);
  color: var(--ok, #2e7d5b);
}
.ready-button:disabled {
  border-color: var(--line, #ebe8e6);
  background: var(--soft, #efeeec);
  color: #8c8883;
  cursor: default;
}
.ready-button .avatars {
  margin-left: auto;
}
.ready-count {
  margin-left: auto;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.ready-button .avatars + .ready-count {
  margin-left: 0;
}
.issue-message {
  font-size: 15px;
  font-style: italic;
}
.issue-form {
  display: grid;
  gap: 10px;
  width: 100%;
}
.issue-form label {
  display: grid;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
}
.issue-form textarea {
  padding: 10px;
  border: 1px solid var(--line, #ebe8e6);
  border-radius: 8px;
  font: inherit;
  font-size: 13px;
  resize: vertical;
}
.issue-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.discuss-note {
  margin: 0;
  color: #6d6863;
  font-size: 12px;
}
.issue-note {
  display: block;
  margin-top: 4px;
  color: var(--warn, #8a5a00);
  font-size: 12px;
}
.avatars {
  display: flex;
  margin-left: auto;
}
.mini-avatar {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border: 2px solid #fff;
  border-radius: 50%;
  background: #8c8883;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
}
.avatars .mini-avatar + .mini-avatar {
  margin-left: -6px;
}
/* Confirm (or Raise an issue) stays pinned to the popup's bottom, so it's always in reach. */
.finalise-row {
  position: sticky;
  bottom: -24px;
  z-index: 3;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  margin: 16px -24px -24px;
  padding: 12px 24px 24px;
  border-top: 1px solid var(--line, #ebe8e6);
  background: white;
}
.finalise-row .btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
h2 {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 700;
}
.preference-boxes {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.preference-box {
  min-width: 0;
  min-height: 138px;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #fafafa;
  color: var(--text);
  cursor: pointer;
  text-align: left;
  font: inherit;
  transition:
    box-shadow 0.15s,
    border-color 0.15s;
}
button:focus-visible {
  outline: 2px solid var(--text, #161616);
  outline-offset: 3px;
}
.preference-box:hover {
  box-shadow: 0 3px 12px #00000012;
  border-color: #a9a9a9;
}
.box-heading {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.4;
}
.box-heading > span:first-child {
  min-width: 0;
  overflow-wrap: anywhere;
}
.preference-value {
  display: block;
  margin-top: 10px;
  font-size: 17px;
  font-weight: 750;
  line-height: 1.4;
  overflow-wrap: anywhere;
}
.needs-attention {
  border-color: #ecd29a;
  background: var(--warn-tint, #fdf1d6);
  color: #6b4700;
}
.is-shared {
  border-color: #b9ddc9;
  background: #eff9f3;
  color: #216443;
}
.status-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  margin-top: 6px;
}
.status-row .status-label {
  margin-top: 0;
}
.vote-count {
  padding: 1px 7px;
  border: 1px solid currentColor;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.status-label {
  display: block;
  margin-top: 6px;
  font-size: 11px;
  font-weight: 700;
}
.expand-icon {
  flex-shrink: 0;
  font-size: 18px;
}
.factor-dialog {
  box-sizing: border-box;
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
.factor-dialog::backdrop {
  background: #201b2859;
}
:global(body:has(.factor-dialog[open])) {
  overflow: hidden;
}
.dialog-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}
.dialog-heading h2 {
  margin: 0;
}
.close-popup {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 50%;
  background: #f6f5f4;
  color: #625d58;
  font-size: 24px;
  cursor: pointer;
}
.popup-summary {
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #fafafa;
}
.popup-summary.needs-attention {
  border-color: #ecd29a;
  background: var(--warn-tint, #fdf1d6);
}
.popup-summary.is-shared {
  border-color: #b9ddc9;
  background: #eff9f3;
}
.popup-summary .status-label {
  margin-top: 0;
  margin-bottom: 6px;
}
.summary-value {
  font-size: 20px;
  line-height: 1.4;
  overflow-wrap: anywhere;
}
.empty-state {
  margin-top: 14px;
  color: #737373;
  font-size: 12px;
}
@media (max-width: 720px) {
  .factor-dialog {
    padding: 16px;
  }
}
@media (max-width: 420px) {
  .preference-boxes {
    gap: 8px;
  }
  .preference-box {
    padding: 10px;
  }
  .preference-value {
    font-size: 15px;
  }
}
</style>
