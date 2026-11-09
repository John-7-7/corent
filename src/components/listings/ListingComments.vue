<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import MemberAvatar from '@/components/MemberAvatar.vue'
import { onAuthChange } from '@/services/authService'
import { confirmAction } from '@/composables/useConfirm'
import {
  COMMENT_MAX_LENGTH,
  addListingComment,
  deleteListingComment,
  subscribeToListingComments,
} from '@/services/commentService'

/**
 * The group's comment thread on one listing (live, shared by every member).
 *
 * Pass `comments` when the parent already listens to the whole group (the
 * Shortlist page does, for the counts on every card); leave it out and the
 * component listens to this one listing itself (the Browse detail panel).
 */
const props = defineProps({
  groupId: { type: String, default: '' },
  listingId: { type: String, required: true },
  comments: { type: Array, default: null },
  listingTitle: { type: String, default: '' },
})

const user = ref(null)
const ownComments = ref([])
const loadError = ref('')
const draft = ref('')
const posting = ref(false)
const postError = ref('')
const deletingId = ref('')

const stopAuth = onAuthChange((next) => (user.value = next))

let stopComments = null
watch(
  () => [props.groupId, props.listingId, props.comments === null],
  ([groupId, listingId, selfListen]) => {
    stopComments?.()
    stopComments = null
    ownComments.value = []
    loadError.value = ''
    if (!selfListen || !groupId || !listingId) return
    stopComments = subscribeToListingComments(
      groupId,
      listingId,
      (items) => (ownComments.value = items),
      () => (loadError.value = 'Comments could not be loaded.'),
    )
  },
  { immediate: true },
)

// Relative times ("3 min ago") are refreshed once a minute.
const now = ref(Date.now())
const ticker = setInterval(() => (now.value = Date.now()), 60_000)

onUnmounted(() => {
  stopAuth?.()
  stopComments?.()
  clearInterval(ticker)
})

const thread = computed(() => props.comments ?? ownComments.value)
const remaining = computed(() => COMMENT_MAX_LENGTH - draft.value.length)
const canPost = computed(
  () => !!draft.value.trim() && remaining.value >= 0 && !posting.value && !!user.value,
)

const relative = new Intl.RelativeTimeFormat('en-SG', { numeric: 'auto' })
function timeAgo(ms) {
  const seconds = Math.round((ms - now.value) / 1000)
  if (Math.abs(seconds) < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return relative.format(hours, 'hour')
  const days = Math.round(hours / 24)
  if (Math.abs(days) < 7) return relative.format(days, 'day')
  return new Date(ms).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })
}


async function post() {
  if (!canPost.value) return
  posting.value = true
  postError.value = ''
  try {
    await addListingComment(props.groupId, props.listingId, user.value, draft.value)
    draft.value = ''
  } catch (error) {
    console.error('Error posting comment:', error)
    postError.value = error.message?.startsWith('Write') || error.message?.startsWith('Comments')
      ? error.message
      : 'Your comment could not be posted. Please try again.'
  } finally {
    posting.value = false
  }
}

function onKeydown(event) {
  // Cmd/Ctrl + Enter posts; plain Enter keeps adding lines.
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault()
    post()
  }
}

async function remove(comment) {
  const confirmed = await confirmAction({
    title: 'Delete your comment?',
    message: `Your comment will be removed for everyone in the group${
      props.listingTitle ? ` on "${props.listingTitle}"` : ''
    }. This can't be undone.`,
    confirmLabel: 'Delete comment',
  })
  if (!confirmed) return
  deletingId.value = comment.id
  try {
    await deleteListingComment(props.groupId, comment.id)
  } catch (error) {
    console.error('Error deleting comment:', error)
    postError.value = 'That comment could not be deleted. Please try again.'
  } finally {
    deletingId.value = ''
  }
}
</script>

<template>
  <div class="lc" @click.stop>
    <p v-if="!groupId" class="lc-empty">
      Comments are shared with your group. Join or create a group on Home to start a discussion.
    </p>

    <template v-else>
      <p v-if="loadError" class="lc-error" role="alert">{{ loadError }}</p>
      <p v-else-if="!thread.length" class="lc-empty">
        No comments yet. Start the discussion for your group.
      </p>

      <ul v-else class="lc-list" aria-label="Comments">
        <li v-for="comment in thread" :key="comment.id" class="lc-item" :class="{ 'lc-item--pending': comment.pending }">
          <span class="lc-avatar" aria-hidden="true">
            <MemberAvatar :uid="comment.userId" :photo="comment.authorPhotoURL || ''" />
          </span>
          <div class="lc-body">
            <p class="lc-meta">
              <strong>{{ comment.userId === user?.uid ? 'You' : comment.authorName }}</strong>
              <span>{{ comment.pending ? 'Posting…' : timeAgo(comment.createdAtMs) }}</span>
            </p>
            <p class="lc-text">{{ comment.text }}</p>
          </div>
          <button
            v-if="comment.userId === user?.uid && !comment.pending"
            type="button"
            class="lc-delete"
            :disabled="deletingId === comment.id"
            :aria-label="`Delete your comment: ${comment.text.slice(0, 40)}`"
            @click="remove(comment)"
          >
            <AppIcon name="x" :size="13" />
          </button>
        </li>
      </ul>

      <form class="lc-form" @submit.prevent="post">
        <label class="sr-only" :for="`lc-input-${listingId}`">Add a comment</label>
        <textarea
          :id="`lc-input-${listingId}`"
          v-model="draft"
          rows="2"
          :maxlength="COMMENT_MAX_LENGTH + 50"
          placeholder="Add a comment for your group…"
          @keydown="onKeydown"
        ></textarea>
        <div class="lc-actions">
          <span class="lc-hint" :class="{ 'lc-hint--over': remaining < 0 }">
            <template v-if="remaining < 100">{{ remaining }} characters left</template>
            <template v-else>⌘/Ctrl + Enter to post</template>
          </span>
          <button type="submit" class="lc-post" :disabled="!canPost">
            {{ posting ? 'Posting…' : 'Post' }}
          </button>
        </div>
        <p v-if="postError" class="lc-error" role="alert">{{ postError }}</p>
      </form>
    </template>
  </div>
</template>

<style scoped>
.lc {
  display: grid;
  gap: 10px;
  font-size: 12.5px;
  cursor: default;
}
.lc-empty {
  color: var(--muted);
  font-size: 12px;
}
.lc-error {
  color: var(--error);
  font-size: 12px;
}
.lc-list {
  display: grid;
  gap: 10px;
  max-height: 260px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}
.lc-item {
  display: grid;
  grid-template-columns: 28px 1fr auto;
  gap: 9px;
  align-items: start;
}
.lc-item--pending {
  opacity: 0.6;
}
.lc-avatar {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  overflow: hidden;
  border-radius: 50%;
  background: var(--red-tint);
  color: var(--red-dark);
  font-size: 10.5px;
  font-weight: 700;
}
.lc-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.lc-body {
  min-width: 0;
}
.lc-meta {
  display: flex;
  gap: 8px;
  align-items: baseline;
  color: var(--muted);
  font-size: 11px;
}
.lc-meta strong {
  color: var(--text);
  font-size: 12px;
}
.lc-text {
  margin-top: 2px;
  color: var(--text);
  line-height: 1.5;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.lc-delete {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
}
.lc-delete:hover {
  background: var(--error-tint);
  color: var(--error);
}
.lc-form {
  display: grid;
  gap: 6px;
}
.lc-form textarea {
  width: 100%;
  min-height: 52px;
  padding: 8px 10px;
  border: 1px solid var(--chip-line);
  border-radius: 10px;
  background: #fff;
  color: var(--text);
  font: inherit;
  resize: vertical;
}
.lc-form textarea:focus {
  border-color: var(--red);
  outline: none;
  box-shadow: 0 0 0 3px var(--red-tint);
}
.lc-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.lc-hint {
  color: var(--muted);
  font-size: 11px;
}
.lc-hint--over {
  color: var(--error);
  font-weight: 600;
}
.lc-post {
  height: 30px;
  padding: 0 14px;
  border: 0;
  border-radius: 8px;
  background: var(--red);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
.lc-post:disabled {
  background: var(--red-disabled);
  cursor: not-allowed;
}
</style>
