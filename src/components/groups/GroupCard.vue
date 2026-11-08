<script setup>
import AppIcon from '@/components/AppIcon.vue'
import MemberAvatar from '@/components/MemberAvatar.vue'

defineProps({
  group: {
    type: Object,
    required: true,
  },
  // The group Browse and Shortlist are currently scoring against. A user can
  // belong to several, and without this marker there is no way to tell which
  // one the match percentages refer to.
  active: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['view-group'])
</script>

<template>
  <article class="group-card" :class="{ 'is-active': active }">
    <div class="group-icon" aria-hidden="true">
      <AppIcon name="users" :size="18" />
    </div>
    <div class="group-info">
      <div class="group-title-row">
        <h3>{{ group.name }}</h3>
        <span v-if="active" class="preview-label is-active">Active</span>
        <span v-else class="preview-label">Rental group</span>
      </div>
      <p class="group-meta">
        <span v-if="group.members?.length" class="face-stack" aria-hidden="true">
          <span
            v-for="member in group.members.slice(0, 5)"
            :key="member.id"
            class="face"
            :title="member.name"
          >
            <MemberAvatar :uid="member.id" :photo="member.photo || ''" />
          </span>
        </span>
        {{ group.memberCount }} {{ group.memberCount === 1 ? 'member' : 'members' }}
        <span aria-hidden="true">·</span>
        Invite code <strong>{{ group.inviteCode }}</strong>
      </p>
    </div>
    <button
      class="icon-btn"
      type="button"
      :aria-label="`Preview ${group.name}`"
      @click="emit('view-group', group.id)"
    >
      <AppIcon name="chevron" :size="16" />
    </button>
  </article>
</template>

<style scoped>
.group-card.is-active { border-color: var(--red); }
.face-stack { display: inline-flex; margin-right: 6px; vertical-align: middle; }
.face {
  width: 22px;
  height: 22px;
  margin-left: -6px;
  border: 1.5px solid #fff;
  border-radius: 50%;
  background: linear-gradient(145deg, #e6e9fd, #fbe9f1);
}
.face:first-child { margin-left: 0; }
.preview-label.is-active {
  background: var(--red-tint);
  color: var(--red);
  font-weight: 600;
}
.group-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.8rem 0.9rem;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.group-icon {
  display: grid;
  flex: none;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: var(--red-tint);
  color: var(--red);
}

.group-info { flex: 1; min-width: 0; }
.group-title-row { display: flex; align-items: center; gap: 0.5rem; }
.group-title-row h3 { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.preview-label {
  flex: none;
  padding: 2px 6px;
  border-radius: 999px;
  background: var(--soft);
  color: var(--muted);
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
}
.group-meta { margin-top: 0.25rem; color: var(--muted); font-size: 11px; }
.group-meta strong { color: var(--text); font-weight: 600; letter-spacing: 0.06em; }
</style>
