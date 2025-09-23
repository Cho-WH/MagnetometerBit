import { store, actions } from './state.js'

const randomBetween = (min, max) => Math.random() * (max - min) + min

export const initMockTelemetry = () => {
  let timerId = null

  const pushSample = () => {
    const variance = 20
    const x = randomBetween(-variance, variance)
    const y = randomBetween(-variance, variance)
    const z = randomBetween(-variance, variance)
    const strength = Math.sqrt(x * x + y * y + z * z) + 40

    store.dispatch(
      actions.setSample({
        timestamp: Date.now(),
        x,
        y,
        z,
        strength,
      })
    )
  }

  const start = () => {
    if (timerId) return
    timerId = window.setInterval(pushSample, 1000)
  }

  const stop = () => {
    if (!timerId) return
    window.clearInterval(timerId)
    timerId = null
  }

  const handleState = (state) => {
    if (state.connectionStatus === 'connected') {
      stop()
    } else {
      start()
    }
  }

  const unsubscribe = store.subscribe(handleState)

  start()

  return () => {
    stop()
    unsubscribe?.()
  }
}
