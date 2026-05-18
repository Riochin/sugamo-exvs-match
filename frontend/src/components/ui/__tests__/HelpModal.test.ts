import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import HelpModal from '../HelpModal.vue'

describe('HelpModal', () => {
  it('visible=false のとき何も表示されない', () => {
    const wrapper = mount(HelpModal, {
      props: { visible: false, title: 'テスト' },
    })
    expect(wrapper.find('[data-testid="help-modal"]').exists()).toBe(false)
  })

  it('visible=true のときモーダルが表示される', () => {
    const wrapper = mount(HelpModal, {
      props: { visible: true, title: 'テスト' },
    })
    expect(wrapper.find('[data-testid="help-modal"]').exists()).toBe(true)
  })

  it('title prop がヘッダーに表示される', () => {
    const wrapper = mount(HelpModal, {
      props: { visible: true, title: '大会の使い方' },
    })
    expect(wrapper.text()).toContain('大会の使い方')
  })

  it('slot コンテンツが描画される', () => {
    const wrapper = mount(HelpModal, {
      props: { visible: true, title: 'テスト' },
      slots: { default: '<p class="slot-test">スロットコンテンツ</p>' },
    })
    expect(wrapper.find('.slot-test').exists()).toBe(true)
    expect(wrapper.text()).toContain('スロットコンテンツ')
  })

  it('とじるボタンクリックで close イベントが発火する', async () => {
    const wrapper = mount(HelpModal, {
      props: { visible: true, title: 'テスト' },
    })
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('背景（バックドロップ）クリックで close イベントが発火する', async () => {
    const wrapper = mount(HelpModal, {
      props: { visible: true, title: 'テスト' },
    })
    await wrapper.find('[data-testid="help-modal"]').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })
})
