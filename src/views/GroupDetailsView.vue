<script setup>
import { computed } from 'vue'

const props = defineProps({
  group: {
    type: Object,
    default: null,
  },
  members: {
    type: Array,
    default: () => [],
  },
  inviteUrl: {
    type: String,
    default: '',
  },
  loading: {
    type: Boolean,
    default: false,
  },
  error: {
    type: String,
    default: '',
  },
  copying: {
    type: Boolean,
    default: false,
  },
  copyFeedback: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['copy-invite', 'view-summary'])
const memberCount = computed(() => props.members.length)

// Display initials derived from the actual member name.
function getInitials(name) {
  if (!name?.trim()) return '?'
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function getPreferenceStatus(member) {
  if (member.preferencesReady === true) return 'Preferences ready'
  if (member.preferencesReady === false) return 'Preferences pending'
  return 'Status unavailable'
}
</script>

<template>
  <section class="group-page" :aria-busy="loading">
    <header class="page-header">
      <h1>My Group</h1>
      <p>View your rental group and invite your future housemates.</p>
    </header>

    <div v-if="loading" class="state-card" role="status">Loading details… </div>

    <div v-else-if="error" class="state-card error-message" role="alert">
      {{ error }}
    </div>

    <div v-else-if="!group" class="state-card">
      <h2>No group selected</h2>
      <p>Choose a group from Home to view its details.</p>
      <RouterLink class="text-link" to="/home">Go to Home</RouterLink>
    </div>

    <div v-else class="group-card">
      <section class="group-section">
        <h2 class="section-label">Group name</h2> //for further checking later!
        <p class="group-name">{{ group.name || 'Unnamed group' }}</p>
      </section>

      <section class="group-section">
        <label class="section-label" for="invite-link">Invite housemates</label> //invite members

        <template v-if="inviteUrl">
          <div class="invite-row">
            <input
              id="invite-link"
              class="invite-input"
              type="text"
              :value="inviteUrl"
              readonly
            />

            <button
              class="copy-button"
              type="button"
              :disabled="copying"
              @click="emit('copy-invite', inviteUrl)"
            >
              {{ copying ? 'Copying…' : 'Copy link' }}
            </button>
          </div>

          <p class="helper-text">
            Share this link with your housemates so they can join your group.
          </p>
        </template>

        <p v-else class="helper-text">
          No invitation link is available for this group.
        </p>

        <p v-if="copyFeedback" class="feedback" role="status">
          {{ copyFeedback }}
        </p>
      </section>

      <!-- Member rows come from the supplied group membership data --> 
      <section class="group-section">
        <h2 class="members-heading">Members ({{ memberCount }})</h2>
        <ul v-if="members.length" class="member-list">
          <li
            v-for="member in members"
            :key="member.id"
            class="member"
          >
            <span class="avatar" aria-hidden="true">
              {{ getInitials(member.name) }}
            </span>

            <div class="member-info">
              <span class="member-name">
                {{ member.name || 'Name unavailable' }}
              </span>
              <span v-if="member.role" class="member-role">
                {{ member.role }}
              </span>
            </div>

            <span
              class="status"
              :class="{
                ready: member.preferencesReady === true,
                pending: member.preferencesReady === false,
              }"
            >
              {{ getPreferenceStatus(member) }}
            </span>
          </li>
        </ul>

        <p v-else class="helper-text">No members to display.</p>
      </section>

      <!-- open summary --> 
      <button
        class="primary-button"
        type="button"
        :disabled="!group.id"
        @click="emit('view-summary', group.id)"
      >
        View Group Summary
      </button>
    </div>
  </section>
</template>

<style scoped>
/* ooverall page layout */
.group-page {
  width: 100%;
  max-width: 760px;
  margin: 0 auto;
  padding: 32px 24px;
  box-sizing: border-box;
  color: var(--text, #242424);
}

.page-header {
  margin-bottom: 24px;
}

.page-header h1 {
  margin: 0 0 8px;
  font-size: 26px;
}

.page-header p,
.state-card p {
  color: #737373;
  font-size: 14px;
  line-height: 1.6;
}

.group-card,
.state-card {
  padding: 28px;
  background: #fff;
  border: 1px solid var(--line, #e9e9e9);
  border-radius: 16px;
}

.state-card h2 {
  margin-top: 0;
  font-size: 18px;
}

.error-message {
  color: #b42318;
}

.group-section + .group-section {
  margin-top: 28px;
}

/* group name */
.section-label {
  display: block;
  margin: 0 0 10px;
  color: #737373;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.group-name {
  margin: 0;
  padding: 12px 14px;
  background: #fafafa;
  border: 1px solid var(--line, #e9e9e9);
  border-radius: 9px;
  font-size: 14px;
  overflow-wrap: anywhere;
}

/* invite link */
.invite-row {
  display: flex;
  gap: 10px;
}

.invite-input {
  flex: 1;
  width: 100%;
  min-width: 0;
  padding: 12px 14px;
  box-sizing: border-box;
  border: 1px solid var(--line, #e9e9e9);
  border-radius: 9px;
  background: #fafafa;
  color: #737373;
  font: inherit;
  font-size: 12px;
}

.copy-button {
  flex-shrink: 0;
  padding: 10px 14px;
  border: 0;
  border-radius: 9px;
  background: var(--red-tint, #fff0f3);
  color: var(--red, #ed003b);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.helper-text,
.feedback {
  margin: 9px 0 0;
  font-size: 12px;
  line-height: 1.5;
}

.helper-text {
  color: #737373;
}

/* group members */
.members-heading {
  margin: 0 0 16px;
  font-size: 15px;
}

.member-list {
  display: grid;
  gap: 18px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.member {
  display: flex;
  align-items: center;
  gap: 12px;
}

.avatar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: var(--red, #ed003b);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
}

.member-info {
  display: grid;
  flex: 1;
  min-width: 0;
  gap: 4px;
}

.member-name {
  font-size: 13px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.member-role {
  color: #737373;
  font-size: 11px;
}

.status {
  padding: 5px 8px;
  border-radius: 20px;
  background: #f2f2f2;
  color: #626262;
  font-size: 10px;
  line-height: 1.4;
  text-align: center;
}

.ready {
  background: #e9f8f2;
  color: #16765b;
}

.pending {
  background: #fff5df;
  color: #8a6010;
}

.primary-button {
  width: 100%;
  min-height: 44px;
  margin-top: 28px;
  padding: 10px 16px;
  border: 0;
  border-radius: 9px;
  background: var(--red, #ed003b);
  color: #fff;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.text-link {
  color: var(--red, #ed003b);
}

button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

button:focus-visible,
input:focus-visible,
a:focus-visible {
  outline: 2px solid var(--red, #ed003b);
  outline-offset: 3px;
}

/* mobile layout - maybe can remove this if we no need and it overcomplicates things */
@media (max-width: 720px) {
  .group-page {
    padding: 24px 16px 100px;
  }

  .group-card,
  .state-card {
    padding: 20px;
  }
}

@media (max-width: 420px) {
  .invite-row {
    flex-direction: column;
  }

  .member {
    flex-wrap: wrap;
  }

  .status {
    margin-left: 50px;
  }
}
</style>