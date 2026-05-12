import { hc } from 'hono/client'
import type { AppType } from '../../../backend/src/index'

export const client = hc<AppType>(import.meta.env.VITE_API_BASE_URL ?? '/', {
  fetch: (input: RequestInfo | URL, init?: RequestInit) =>
    fetch(input, { ...init, credentials: 'include' }),
})

export type ApiClient = typeof client
