import { ref, computed } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import { client } from '@/api/client'

export interface AuthenticatedPlayer {
  playerId: string
  name: string
  isAdmin: boolean
}

export type LoginErrorCode = 'INVALID_CREDENTIALS' | 'VALIDATION_ERROR' | 'NETWORK_ERROR'

export type LoginResult =
  | { ok: true; player: AuthenticatedPlayer }
  | { ok: false; errorCode: LoginErrorCode; message: string }

export interface UseAuthReturn {
  currentPlayer: Readonly<Ref<AuthenticatedPlayer | null>>
  isAuthenticated: ComputedRef<boolean>
  isLoading: Readonly<Ref<boolean>>
  login(playerName: string, pin: string): Promise<LoginResult>
  logout(): Promise<void>
  restoreSession(): Promise<void>
}

const currentPlayer = ref<AuthenticatedPlayer | null>(null)
const isLoading = ref(false)
const isAuthenticated = computed(() => currentPlayer.value !== null)

export function useAuth(): UseAuthReturn {
  async function login(playerName: string, pin: string): Promise<LoginResult> {
    try {
      const res = await client.api.auth.login.$post({ json: { playerName, pin } })
      if (res.ok) {
        const data = await res.json()
        const player: AuthenticatedPlayer = { playerId: data.playerId, name: data.name, isAdmin: data.isAdmin }
        currentPlayer.value = player
        return { ok: true, player }
      }
      if (res.status === 401) {
        return {
          ok: false,
          errorCode: 'INVALID_CREDENTIALS',
          message: 'プレイヤー名またはPINが正しくありません',
        }
      }
      return {
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        message: '入力内容に誤りがあります',
      }
    } catch {
      return {
        ok: false,
        errorCode: 'NETWORK_ERROR',
        message: 'ネットワークエラーが発生しました',
      }
    }
  }

  async function logout(): Promise<void> {
    try {
      await client.api.auth.logout.$post()
    } catch {
      // APIエラーでもローカル状態をクリアする (Req 5.3)
    } finally {
      currentPlayer.value = null
    }
  }

  async function restoreSession(): Promise<void> {
    isLoading.value = true
    try {
      const res = await client.api.auth.me.$get()
      if (res.ok) {
        const data = await res.json()
        currentPlayer.value = { playerId: data.playerId, name: data.name, isAdmin: data.isAdmin }
      } else {
        currentPlayer.value = null
      }
    } catch {
      currentPlayer.value = null
    } finally {
      isLoading.value = false
    }
  }

  return {
    currentPlayer,
    isAuthenticated,
    isLoading,
    login,
    logout,
    restoreSession,
  }
}
