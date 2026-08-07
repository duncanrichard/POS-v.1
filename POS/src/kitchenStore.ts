export type KitchenStatus = 'draft' | 'fixed' | 'preparing' | 'ready'
export type KitchenOrder = {
  id: string; number: string; status: KitchenStatus; createdAt: string; fixedAt?: string; completedAt?: string
  businessDate?: string
  tableNumber?: number
  source?: string
  serverTicketId?: string
  orderType: string
  items: Array<{ name: string; size?: string; quantity: number; note?: string; addons?: string[] }>
}

const KEY = 'posphere.kitchenOrders'
const channel = () => typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('posphere-kitchen') : null
const dateKey = (value: string | Date = new Date()) => {
  const date = typeof value === 'string' ? new Date(value) : value
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const readStoredOrders = (): KitchenOrder[] => {
  const electronOrders = window.ipcRenderer?.sendSync('kitchen-orders-read') as KitchenOrder[] | null | undefined
  if (Array.isArray(electronOrders)) return electronOrders

  const browserOrders = JSON.parse(localStorage.getItem(KEY) || '[]') as KitchenOrder[]
  if (browserOrders.length) window.ipcRenderer?.send('kitchen-orders-write', browserOrders)
  return browserOrders
}

export const readKitchenOrders = (): KitchenOrder[] => {
  try {
    const orders = readStoredOrders().map((order) => ({
      ...order,
      businessDate: order.businessDate || dateKey(order.createdAt),
      completedAt: order.completedAt || (order.status === 'ready' ? order.fixedAt || order.createdAt : undefined),
    }))
    const used = new Set<string>()
    let sequence = Math.max(127, Number(localStorage.getItem('posphere.orderSequence') || 127))
    let changed = false
    orders
      .slice()
      .sort((first, second) => new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime())
      .forEach((order) => {
        if (!/^\d{6}$/.test(order.number) || used.has(order.number)) {
          sequence += 1
          order.number = String(sequence).padStart(6, '0')
          changed = true
        } else {
          used.add(order.number)
          sequence = Math.max(sequence, Number(order.number))
        }
        used.add(order.number)
      })
    if (changed) writeKitchenOrders(orders)
    localStorage.setItem('posphere.orderSequence', String(sequence))
    return orders
  } catch { return [] }
}
export const writeKitchenOrders = (orders: KitchenOrder[]) => {
  localStorage.setItem(KEY, JSON.stringify(orders))
  window.ipcRenderer?.send('kitchen-orders-write', orders)
  const bus = channel(); bus?.postMessage('refresh'); bus?.close()
}
export const upsertKitchenOrder = (order: KitchenOrder) => {
  order.businessDate ||= dateKey(order.createdAt)
  const orders = readKitchenOrders(); const index = orders.findIndex((item) => item.id === order.id)
  if (index >= 0) orders[index] = order; else orders.unshift(order)
  writeKitchenOrders(orders.slice(0, 80))
}
