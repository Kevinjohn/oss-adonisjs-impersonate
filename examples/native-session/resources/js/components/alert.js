export default function alertData({ autoDismiss = true } = {}) {
  return {
    isVisible: false,
    dismiss() {
      this.isVisible = false
    },
    init() {
      setTimeout(() => {
        this.isVisible = true
      }, 80)
      if (autoDismiss !== false) {
        setTimeout(() => {
          this.dismiss()
        }, 5000)
      }
    },
  }
}
