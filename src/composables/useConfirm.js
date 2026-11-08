import { reactive } from 'vue'

// One confirmation prompt for the whole app, rendered by ConfirmDialog.vue
// (mounted once in App.vue). Any page can ask before a remove or delete:
//
//   if (!(await confirmAction({ title: 'Remove listing?', confirmLabel: 'Remove' }))) return
//
// Resolves true when the user confirms, false when they cancel or dismiss.

const DEFAULTS = {
  title: 'Are you sure?',
  message: '',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  // 'danger' for removes and deletes, 'default' for anything else.
  tone: 'danger',
}

export const confirmState = reactive({ open: false, hostMounted: false, ...DEFAULTS })

let pendingResolve = null

export function confirmAction(options = {}) {
  // Without the dialog mounted (e.g. a page rendered on its own), still ask.
  if (!confirmState.hostMounted) {
    return Promise.resolve(
      window.confirm([options.title, options.message].filter(Boolean).join('\n\n')),
    )
  }
  // A newer prompt replaces an unanswered one, which counts as cancelled.
  pendingResolve?.(false)
  Object.assign(confirmState, DEFAULTS, options, { open: true })
  return new Promise((resolve) => {
    pendingResolve = resolve
  })
}

export function settleConfirm(confirmed) {
  confirmState.open = false
  const resolve = pendingResolve
  pendingResolve = null
  resolve?.(confirmed)
}
