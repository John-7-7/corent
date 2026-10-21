<script setup>
import AppIcon from '@/components/AppIcon.vue'

defineProps({
  group: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['view-preview'])
</script>

<template>
  <article class="group-card">
    <div class="group-icon" aria-hidden="true">
      <AppIcon name="users" :size="18" />
    </div>
    <div class="group-info">
      <div class="group-title-row">
        <h3>{{ group.name }}</h3>
        <span class="preview-label">Preview</span>
      </div>
      <p class="group-meta">
        {{ group.memberCount }} {{ group.memberCount === 1 ? 'member' : 'members' }}
        <span aria-hidden="true">·</span>
        Invite code <strong>{{ group.inviteCode }}</strong>
      </p>
    </div>
    <button
      class="icon-btn"
      type="button"
      :aria-label="`Preview ${group.name}`"
      @click="emit('view-preview', group.id)"
    >
      <AppIcon name="chevron" :size="16" />
    </button>
  </article>
</template>

<style scoped>
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
