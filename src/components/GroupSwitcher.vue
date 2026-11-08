<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import MemberAvatar from '@/components/MemberAvatar.vue'
import { activeGroup, availableGroups, setActiveGroup } from '@/services/activeGroup'

/**
 * Which group the app is working in, shown on every page, with a menu to make
 * another of your groups the active one. Only one group is active at a time:
 * Browse scores, the Shortlist and Group Summary all follow it.
 */
const open = ref(false)
const root = ref(null)

const groups = computed(() =>
  [...availableGroups.value].sort((a, b) =>
    a.id === activeGroup.value?.id ? -1 : b.id === activeGroup.value?.id ? 1 : (a.name || '').localeCompare(b.name || ''),
  ),
)

function choose(group) {
  setActiveGroup(group.id)
  open.value = false
}

function onDocumentClick(event) {
  if (open.value && root.value && !root.value.contains(event.target)) open.value = false
}
function onKeydown(event) {
  if (event.key === 'Escape') open.value = false
}
onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div ref="root" class="gs">
    <button
      type="button"
      class="gs-trigger"
      :aria-expanded="open"
      aria-haspopup="menu"
      :title="activeGroup ? `Active group: ${activeGroup.name}` : 'You are not in a group yet'"
      @click="open = !open"
    >
      <span class="gs-dot" :class="{ 'gs-dot--on': activeGroup }" aria-hidden="true"></span>
      <span class="gs-text">
        <small>Active group</small>
        <strong>{{ activeGroup?.name || 'No group yet' }}</strong>
      </span>
      <AppIcon class="gs-chevron" :class="{ 'gs-chevron--open': open }" name="chevron" :size="14" />
    </button>

    <div v-if="open" class="gs-menu" role="menu" aria-label="Your groups">
      <p class="gs-menu-head">Your groups</p>
      <p v-if="!groups.length" class="gs-empty">You haven't joined a group yet.</p>
      <ul v-else>
        <li v-for="group in groups" :key="group.id">
          <div class="gs-row" :class="{ 'gs-row--active': group.id === activeGroup?.id }">
            <span class="gs-faces" aria-hidden="true">
              <span v-for="member in (group.members || []).slice(0, 3)" :key="member.id" class="gs-face">
                <MemberAvatar :uid="member.id" :photo="member.photo || ''" />
              </span>
            </span>
            <span class="gs-name">
              <strong>{{ group.name }}</strong>
              <small>{{ group.memberCount ?? group.members?.length ?? 0 }} members</small>
            </span>
            <span v-if="group.id === activeGroup?.id" class="gs-pill gs-pill--active">Active</span>
            <button
              v-else
              type="button"
              role="menuitem"
              class="gs-pill gs-pill--set"
              :aria-label="`Make ${group.name} the active group`"
              @click="choose(group)"
            >
              Set active
            </button>
          </div>
        </li>
      </ul>
      <p v-if="groups.length > 1" class="gs-note">
        Inactive groups keep their shortlist and votes; you see one group's details at a time.
      </p>
      <RouterLink class="gs-manage" to="/home" @click="open = false">Create or join a group</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.gs {
  position: relative;
}
.gs-trigger {
  display: flex;
  gap: 9px;
  align-items: center;
  max-width: 240px;
  height: 46px;
  padding: 0 12px 0 14px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgb(255 255 255 / 80%);
  box-shadow: 0 2px 10px rgb(42 45 62 / 8%);
  color: var(--text);
  cursor: pointer;
  backdrop-filter: var(--glass-blur);
}
.gs-trigger:hover {
  border-color: var(--red);
}
.gs-dot {
  flex: none;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--disabled);
}
.gs-dot--on {
  background: var(--ok);
  box-shadow: 0 0 0 3px var(--ok-tint);
}
.gs-text {
  display: grid;
  min-width: 0;
  line-height: 1.2;
  text-align: left;
}
.gs-text small {
  color: var(--muted);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}
.gs-text strong {
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gs-chevron {
  flex: none;
  color: var(--muted);
  transform: rotate(90deg);
  transition: transform 0.15s ease;
}
.gs-chevron--open {
  transform: rotate(-90deg);
}
.gs-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 20;
  width: 330px;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 16px 40px rgb(42 45 62 / 18%);
}
.gs-menu-head {
  margin: 2px 6px 8px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.gs-menu ul {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.gs-row {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 8px;
  border-radius: 10px;
}
.gs-row--active {
  background: var(--soft);
}
.gs-faces {
  display: flex;
  flex: none;
  width: 52px;
}
.gs-face {
  width: 24px;
  height: 24px;
  margin-left: -8px;
  border: 1.5px solid #fff;
  border-radius: 50%;
  background: linear-gradient(145deg, #e6e9fd, #fbe9f1);
}
.gs-face:first-child {
  margin-left: 0;
}
.gs-name {
  display: grid;
  flex: 1;
  min-width: 0;
  line-height: 1.25;
}
.gs-name strong {
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gs-name small {
  color: var(--muted);
  font-size: 11px;
}
.gs-pill {
  flex: none;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
}
.gs-pill--active {
  background: var(--ok-tint);
  color: var(--ok);
}
.gs-pill--set {
  border: 1px solid var(--chip-line);
  background: #fff;
  color: var(--text);
  cursor: pointer;
}
.gs-pill--set:hover {
  border-color: var(--red);
  color: var(--red-dark);
}
.gs-empty,
.gs-note {
  margin: 6px;
  color: var(--muted);
  font-size: 11.5px;
}
.gs-manage {
  display: block;
  margin-top: 6px;
  padding: 8px;
  border-top: 1px solid var(--line);
  color: var(--red-dark);
  font-size: 12.5px;
  font-weight: 700;
  text-align: center;
  text-decoration: none;
}
@media (max-width: 900px) {
  .gs-text small {
    display: none;
  }
}
</style>
