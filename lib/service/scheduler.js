/**
 * Scheduler for async tasks
 * Recursive setTimeout guarantees a delay between job executions, setInterval – does not
 */
export default class Scheduler {
  /**
   * @example Schedule an async job that takes 1000ms every 500ms. Will wait 500 from completion
   *
   *
   *   const job = new Scheduler(async () => {
   *     return new Promise((resolve, reject) => {
   *       setTimeout(() => {
   *         resolve('YES')
   *       }, 1000)
   *     })
   *   }, 500)
   *
   *   job.stop()
   *
   * @param {Function} fn async function to schedule
   * @param {Number} interval how often to run the function in ms
   */
  constructor(fn, interval) {
    this.isRunning = true

    const wrappedFn = async () => {
      if (!this.isRunning) return

      await fn()
      this.timer = setTimeout(wrappedFn, interval)
    }
    // Set off immediately
    this.timer = setTimeout(wrappedFn, 0)
  }

  stop() {
    this.isRunning = false
  }
}
