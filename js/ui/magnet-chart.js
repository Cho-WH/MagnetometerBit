import { store } from '../state.js'
import { formatTimestamp } from '../utils/format.js'

const axisConfig = {
  strength: { label: 'Strength', color: '#38bdf8' },
  x: { label: 'X 축', color: '#f97316' },
  y: { label: 'Y 축', color: '#22c55e' },
  z: { label: 'Z 축', color: '#a855f7' },
}

const HISTORY_WINDOW = 120

export const initMagnetChart = () => {
  const root = document.querySelector('[data-component="magnet-chart"]')
  if (!root) return

  const canvas = root.querySelector('canvas')
  const emptyEl = root.querySelector('[data-bind="empty"]')
  const axesEl = root.querySelector('[data-bind="axes"]')

  if (!canvas) return

  const Chart = window.Chart
  if (!Chart) {
    if (emptyEl) {
      emptyEl.textContent = 'Chart.js 로드를 실패했습니다.'
      emptyEl.style.display = 'flex'
    }
    return
  }

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return
  }

  const chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: {
            color: '#94a3b8',
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 6,
          },
          grid: {
            color: 'rgba(148, 163, 184, 0.1)',
          },
        },
        y: {
          ticks: {
            color: '#94a3b8',
          },
          grid: {
            color: 'rgba(148, 163, 184, 0.1)',
          },
        },
      },
      plugins: {
        legend: {
          labels: {
            color: '#e2e8f0',
          },
        },
        tooltip: {
          callbacks: {
            label(context) {
              const value = context.parsed.y
              if (typeof value !== 'number') {
                return `${context.dataset.label}`
              }
              return `${context.dataset.label}: ${value.toFixed(2)} µT`
            },
          },
        },
      },
    },
  })

  const render = (state) => {
    const samples = state.history.slice(-HISTORY_WINDOW)
    const hasData = samples.length > 0

    if (axesEl) {
      const axesLabel = state.selectedAxes.map((axis) => axisConfig[axis]?.label ?? axis).join(', ')
      axesEl.textContent = `표시 축: ${axesLabel || '—'}`
    }

    if (!hasData) {
      chart.data.labels = []
      chart.data.datasets = []
      chart.update('none')
      if (emptyEl) {
        emptyEl.hidden = false
      }
      return
    }

    const labels = samples.map((sample) => formatTimestamp(sample.timestamp))
    const datasets = state.selectedAxes.map((axis) => {
      const config = axisConfig[axis]
      return {
        label: config?.label ?? axis,
        data: samples.map((sample) => sample[axis]),
        borderColor: config?.color ?? '#38bdf8',
        backgroundColor: `${config?.color ?? '#38bdf8'}33`,
        tension: 0.25,
        fill: false,
        pointRadius: 0,
        borderWidth: 2,
      }
    })

    chart.data.labels = labels
    chart.data.datasets = datasets
    chart.update('none')

    if (emptyEl) {
      emptyEl.hidden = true
    }
  }

  const unsubscribe = store.subscribe(render)

  return () => {
    unsubscribe?.()
    chart.destroy()
  }
}
