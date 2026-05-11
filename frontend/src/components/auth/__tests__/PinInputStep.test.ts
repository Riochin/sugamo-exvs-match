import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PinInputStep from '../PinInputStep.vue'

describe('PinInputStep', () => {
  it('playerName が画面に表示される', () => {
    const wrapper = mount(PinInputStep, {
      props: { playerName: 'Alice', isSubmitting: false, error: null },
    })
    expect(wrapper.text()).toContain('Alice')
  })

  it('4つの input が inputmode="numeric" maxlength="1" で横並びに表示される', () => {
    const wrapper = mount(PinInputStep, {
      props: { playerName: 'Alice', isSubmitting: false, error: null },
    })
    const inputs = wrapper.findAll('input')
    expect(inputs).toHaveLength(4)
    inputs.forEach((input) => {
      expect(input.attributes('inputmode')).toBe('numeric')
      expect(input.attributes('maxlength')).toBe('1')
    })
  })

  it('4桁入力完了時に submit イベントが emit される', async () => {
    const wrapper = mount(PinInputStep, {
      props: { playerName: 'Alice', isSubmitting: false, error: null },
    })
    const inputs = wrapper.findAll('input')

    await inputs[0].setValue('1')
    await inputs[1].setValue('2')
    await inputs[2].setValue('3')
    await inputs[3].setValue('4')

    expect(wrapper.emitted('submit')).toEqual([['1234']])
  })

  it('isSubmitting が true のとき全 input が disabled になる', () => {
    const wrapper = mount(PinInputStep, {
      props: { playerName: 'Alice', isSubmitting: true, error: null },
    })
    const inputs = wrapper.findAll('input')
    inputs.forEach((input) => {
      expect(input.attributes('disabled')).toBeDefined()
    })
  })

  it('isSubmitting が true のときローディングインジケータが表示される', () => {
    const wrapper = mount(PinInputStep, {
      props: { playerName: 'Alice', isSubmitting: true, error: null },
    })
    expect(wrapper.find('[data-testid="submitting-indicator"]').exists()).toBe(true)
  })

  it('error が非null のときエラーメッセージが表示される', () => {
    const wrapper = mount(PinInputStep, {
      props: { playerName: 'Alice', isSubmitting: false, error: 'PINが正しくありません' },
    })
    expect(wrapper.find('[data-testid="error-message"]').text()).toContain('PINが正しくありません')
  })

  it('error が更新されると pin 値がリセットされる', async () => {
    const wrapper = mount(PinInputStep, {
      props: { playerName: 'Alice', isSubmitting: false, error: null },
    })
    const inputs = wrapper.findAll('input')
    await inputs[0].setValue('1')
    await inputs[0].trigger('input')

    await wrapper.setProps({ error: 'PINが正しくありません' })

    const updatedInputs = wrapper.findAll('input')
    updatedInputs.forEach((input) => {
      expect((input.element as HTMLInputElement).value).toBe('')
    })
  })

  it('戻るボタンをクリックすると back イベントが emit される', async () => {
    const wrapper = mount(PinInputStep, {
      props: { playerName: 'Alice', isSubmitting: false, error: null },
    })
    await wrapper.find('[data-testid="back-button"]').trigger('click')
    expect(wrapper.emitted('back')).toBeTruthy()
  })

  it('autocomplete="off" が設定されている', () => {
    const wrapper = mount(PinInputStep, {
      props: { playerName: 'Alice', isSubmitting: false, error: null },
    })
    const inputs = wrapper.findAll('input')
    inputs.forEach((input) => {
      expect(input.attributes('autocomplete')).toBe('off')
    })
  })
})
