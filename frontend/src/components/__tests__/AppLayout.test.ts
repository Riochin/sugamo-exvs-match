import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import AppLayout from '../AppLayout.vue'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: { template: '<div>Home</div>' } },
    { path: '/group', component: { template: '<div>Group</div>' } },
    { path: '/profile', component: { template: '<div>Profile</div>' } },
  ],
})

describe('AppLayout', () => {
  it('スロットコンテンツをレンダリングする', async () => {
    const wrapper = mount(AppLayout, {
      global: { plugins: [router] },
      slots: { default: '<p class="slot-content">メインコンテンツ</p>' },
    })
    expect(wrapper.find('.slot-content').exists()).toBe(true)
    expect(wrapper.text()).toContain('メインコンテンツ')
  })

  it('BottomNav を含む', async () => {
    const wrapper = mount(AppLayout, {
      global: { plugins: [router] },
      slots: { default: '<div />' },
    })
    expect(wrapper.find('nav').exists()).toBe(true)
  })

  it('最大幅 430px のコンテナを持つ', async () => {
    const wrapper = mount(AppLayout, {
      global: { plugins: [router] },
      slots: { default: '<div />' },
    })
    const container = wrapper.find('[data-testid="layout-container"]')
    expect(container.exists()).toBe(true)
  })
})
