<script setup>
import { computed, ref, watch } from 'vue'
import { memojiFor } from './avatars'

/**
 * A member's picture, sized by whatever circle it is placed in: their photo,
 * or their 3D character when they have none or the photo fails to load.
 */
const props = defineProps({
  uid: { type: String, default: '' },
  photo: { type: String, default: '' },
})

const failed = ref(false)
watch(() => props.photo, () => (failed.value = false))

const usingPhoto = computed(() => !!props.photo && !failed.value)
const src = computed(() => (usingPhoto.value ? props.photo : memojiFor(props.uid)))
</script>

<template>
  <img
    class="member-avatar-img"
    :class="{ 'member-avatar-img--memoji': !usingPhoto }"
    :src="src"
    alt=""
    referrerpolicy="no-referrer"
    draggable="false"
    @error="failed = true"
  />
</template>

<style scoped>
.member-avatar-img {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}
.member-avatar-img--memoji {
  padding: 9%;
  object-fit: contain;
}
</style>
