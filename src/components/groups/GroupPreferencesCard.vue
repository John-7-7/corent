<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import BudgetMaxVote from './BudgetMaxVote.vue'

const props = defineProps({
  memberCount: { type: Number, default: 0 },
  rows: { type: Array, default: () => [] },
  // { uid, name, initials, color } for avatars on vote options.
  members: { type: Array, default: () => [] },
  budgetScale: { type: Object, default: () => ({ min: 500, max: 5000, step: 50 }) },
  budgetInitial: { type: Number, default: null },
})
const emit = defineEmits(['vote', 'finalise', 'reopen'])
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

const statusLabel = (item) =>
  item.voting?.finalised
    ? '✓ Finalised'
    : item.needsAttention
      ? item.status === 'conflict'
        ? 'Conflict'
        : 'Discuss together'
      : item.status === 'shared'
        ? '✓ Shared match'
        : null
const finaliseLabel = (voting) =>
  !voting.allVoted
    ? `Finalise · waiting for ${props.memberCount - voting.total} ${
        props.memberCount - voting.total === 1 ? 'vote' : 'votes'
      }`
    : voting.leader
      ? `Finalise: ${voting.leader.label}`
      : 'Tied · change a vote to finalise'
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
          'needs-attention': item.needsAttention && !item.voting?.finalised,
          'is-shared': item.status === 'shared' || item.voting?.finalised,
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
          <span v-if="item.voting && !item.voting.finalised" class="vote-count"
            >{{ item.voting.total }}/{{ memberCount }} voted</span
          >
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
        <div
          class="popup-summary"
          :class="{
            'needs-attention': selected.needsAttention && !selected.voting?.finalised,
            'is-shared': selected.status === 'shared' || selected.voting?.finalised,
          }"
        >
          <span v-if="statusLabel(selected)" class="status-label">{{ statusLabel(selected) }}</span>
          <strong class="summary-value">{{ selected.value }}</strong>
        </div>

        <template v-if="selected.voting">
          <BudgetMaxVote
            v-if="selected.voting.type === 'range'"
            :summary="selected.voting.summary"
            :mine="selected.voting.mine"
            :initial="budgetInitial"
            :scale="budgetScale"
            :member-count="memberCount"
            :disabled="!selected.voting.canVote || Boolean(selected.voting.finalised)"
            @vote="emit('vote', selected.key, $event)"
          />

          <fieldset
            v-else
            class="voting-options"
            :disabled="!selected.voting.canVote || Boolean(selected.voting.finalised)"
          >
            <legend>Your vote</legend>
            <label
              v-for="option in selected.voting.options"
              :key="option.value"
              class="vote-option"
              :class="{ 'my-vote': selected.voting.mine === option.value }"
            >
              <input
                type="radio"
                :name="`vote-${selected.key}`"
                :value="option.value"
                :checked="selected.voting.mine === option.value"
                @change="emit('vote', selected.key, option.value)"
              />
              <strong class="option-label">{{ option.label }}</strong>
              <span class="avatars" :aria-label="`Preferred by ${option.supporters.length}`">
                <span
                  v-for="uid in option.supporters"
                  :key="uid"
                  class="mini-avatar"
                  :style="{ background: memberFor(uid)?.color }"
                  :title="memberFor(uid)?.name"
                  >{{ memberFor(uid)?.initials }}</span
                >
              </span>
              <span class="option-votes"
                >{{ option.count }} {{ option.count === 1 ? 'vote' : 'votes' }}</span
              >
            </label>
            <div v-if="selected.voting.flexible.length" class="vote-option is-flexible">
              <span class="option-label">No preference</span>
              <span class="avatars">
                <span
                  v-for="uid in selected.voting.flexible"
                  :key="uid"
                  class="mini-avatar"
                  :style="{ background: memberFor(uid)?.color }"
                  :title="memberFor(uid)?.name"
                  >{{ memberFor(uid)?.initials }}</span
                >
              </span>
            </div>
          </fieldset>

          <div class="finalise-row">
            <template v-if="selected.voting.finalised">
              <button type="button" class="btn btn-secondary" @click="emit('reopen', selected.key)">
                Reopen vote
              </button>
            </template>
            <button
              v-else
              type="button"
              class="btn btn-primary"
              :disabled="!selected.voting.allVoted || !selected.voting.leader"
              @click="emit('finalise', selected.key)"
            >
              {{ finaliseLabel(selected.voting) }}
            </button>
          </div>
        </template>

        <ul v-else class="member-list">
          <li v-for="member in selected.details" :key="member.uid">
            <span
              class="mini-avatar"
              :style="{ background: memberFor(member.uid)?.color }"
              aria-hidden="true"
              >{{ memberFor(member.uid)?.initials }}</span
            >
            <span class="member-name">{{ member.name }}</span>
            <span class="member-value">{{ member.value }}</span>
          </li>
        </ul>
      </template>
    </dialog>
  </section>
</template>

<style scoped>
.voting-options {
  border: 0;
  padding: 0;
  margin: 18px 0 0;
}
.voting-options legend {
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 10px;
}
.vote-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  margin-bottom: 8px;
  border: 1px solid var(--line);
  border-radius: 10px;
  cursor: pointer;
  font-size: 14px;
}
.option-label {
  min-width: 0;
  overflow-wrap: anywhere;
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
.option-votes {
  min-width: 56px;
  color: #6d6863;
  font-size: 12px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.vote-option.my-vote {
  border-color: var(--text, #161616);
  background: #f6f5f4;
}
.vote-option.is-flexible {
  border-style: dashed;
  color: #6d6863;
  cursor: default;
}
.vote-option input {
  accent-color: var(--text, #161616);
  width: 16px;
  height: 16px;
}
.vote-option:focus-within {
  outline: 2px solid var(--text, #161616);
  outline-offset: 2px;
}
.voting-options:disabled .vote-option {
  cursor: default;
  opacity: 0.75;
}
.finalise-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
.finalise-row .btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.member-list {
  display: grid;
  gap: 8px;
  margin: 16px 0 0;
  padding: 0;
  list-style: none;
}
.member-list li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  background: #f8f7f6;
  font-size: 13px;
}
.member-list .mini-avatar {
  border: 0;
}
.member-name {
  width: 64px;
  flex-shrink: 0;
  color: #625d58;
}
.member-value {
  min-width: 0;
  font-weight: 600;
  overflow-wrap: anywhere;
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
