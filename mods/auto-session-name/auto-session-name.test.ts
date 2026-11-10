import { describe, expect, test as it } from 'claude-code/testing'

const usage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }

describe('auto-session-name', () => {
  it('should name an unnamed session from its prompt', async ($, on) => {
    on('classic.UserPromptSubmit', () => ({}))
    on('model.complete', () => ({ value: { isAnswered: true, text: '"Fix login redirect bug."\n', usage } }))
    const result = await $.classic.UserPromptSubmit({ prompt: 'the login page redirects in a loop', source: 'user' })
    expect(result.sessionTitle).toBe('Fix login redirect bug')
  })

  it('should colour the prompt bar once the named turn completes', { options: { color: 'cyan' } }, async ($, on) => {
    on('classic.UserPromptSubmit', () => ({}))
    on('model.complete', () => ({ value: { isAnswered: true, text: 'Fix login redirect bug', usage } }))
    on('turn.complete', () => ({ text: '' }))
    const ran: string[] = []
    on('command.run', (_, e) => { ran.push(`${e.command} ${e.args}`.trim()); return { text: '' } })
    await $.classic.UserPromptSubmit({ prompt: 'the login page redirects in a loop', source: 'user' })
    await $.turn.complete({ reason: 'answer', answer: 'done' })
    await $.turn.complete({ reason: 'answer', answer: 'done again' })
    expect(ran).toEqual(['color cyan'])
  })

  it('should keep a colour already set with /color', { options: { color: 'cyan' } }, async ($, on) => {
    on('classic.UserPromptSubmit', () => ({}))
    on('model.complete', () => ({ value: { isAnswered: true, text: 'Fix login redirect bug', usage } }))
    on('turn.complete', () => ({ text: '' }))
    const ran: string[] = []
    on('command.run', (_, e) => { ran.push(`${e.command} ${e.args}`.trim()); return { text: '' } })
    await $.command.run({ command: 'color', args: 'red', origin: { kind: 'composer' } })
    await $.classic.UserPromptSubmit({ prompt: 'the login page redirects in a loop', source: 'user' })
    await $.turn.complete({ reason: 'answer', answer: 'done' })
    expect(ran).toEqual(['color red'])
  })

  it('should leave the prompt bar colour alone by default', async ($, on) => {
    on('classic.UserPromptSubmit', () => ({}))
    on('model.complete', () => ({ value: { isAnswered: true, text: 'Fix login redirect bug', usage } }))
    on('turn.complete', () => ({ text: '' }))
    const ran: string[] = []
    on('command.run', (_, e) => { ran.push(`${e.command} ${e.args}`.trim()); return { text: '' } })
    await $.classic.UserPromptSubmit({ prompt: 'the login page redirects in a loop', source: 'user' })
    await $.turn.complete({ reason: 'answer', answer: 'done' })
    expect(ran).toEqual([])
  })

  it('should leave a named session alone', async ($, on) => {
    on('classic.UserPromptSubmit', () => ({}))
    let asked = false
    on('model.complete', () => { asked = true; return { value: { isAnswered: true, text: 'Other', usage } } })
    const result = await $.classic.UserPromptSubmit({ prompt: 'carry on', session_title: 'My session' })
    expect(result.sessionTitle).toBeUndefined()
    expect(asked).toBe(false)
  })

  it('should skip machine-sent turns and slash commands', async ($, on) => {
    on('classic.UserPromptSubmit', () => ({}))
    let asked = false
    on('model.complete', () => { asked = true; return { value: { isAnswered: true, text: 'Other', usage } } })
    await $.classic.UserPromptSubmit({ prompt: 'task finished', source: 'system' })
    await $.classic.UserPromptSubmit({ prompt: '/clear' })
    expect(asked).toBe(false)
  })

  it('should re-title from recent prompts when the first prompt was short', async ($, on) => {
    on('classic.UserPromptSubmit', () => ({}))
    const asked: string[] = []
    on('model.complete', (_, e) => {
      asked.push(e.prompt)
      return { value: { isAnswered: true, text: asked.length === 1 ? 'Look at error' : 'Fix upload retry backoff', usage } }
    })
    const titles: (string | undefined)[] = []
    for (const prompt of ['look at this error', 'it is in the upload worker', 'the retry never backs off', 'make the backoff exponential', 'and add a test']) {
      const result = await $.classic.UserPromptSubmit({ prompt, source: 'user', session_title: titles.findLast(Boolean) })
      titles.push(result.sessionTitle)
    }
    expect(titles).toEqual(['Look at error', undefined, undefined, 'Fix upload retry backoff', undefined])
    expect(asked).toHaveLength(2)
    expect(asked[1]).toContain('make the backoff exponential')
  })

  it('should not re-title when the first prompt was detailed', async ($, on) => {
    on('classic.UserPromptSubmit', () => ({}))
    let asks = 0
    on('model.complete', () => { asks++; return { value: { isAnswered: true, text: 'Fix login redirect bug', usage } } })
    for (let i = 0; i < 5; i++) {
      await $.classic.UserPromptSubmit({ prompt: 'the login page redirects in a loop after sign-in', source: 'user' })
    }
    expect(asks).toBe(1)
  })

  it('should rename on the eighth prompt when the work has moved on', async ($, on) => {
    on('classic.UserPromptSubmit', () => ({}))
    const asked: string[] = []
    on('model.complete', (_, e) => {
      asked.push(e.prompt)
      return { value: { isAnswered: true, text: asked.length === 1 ? 'Fix login redirect bug' : 'Add upload retry backoff', usage } }
    })
    const titles: (string | undefined)[] = []
    for (let i = 0; i < 9; i++) {
      const prompt = i < 4 ? 'the login page redirects in a loop after sign-in' : 'now make the upload worker retry with backoff'
      const result = await $.classic.UserPromptSubmit({ prompt, source: 'user', session_title: titles.findLast(Boolean) })
      titles.push(result.sessionTitle)
    }
    expect(titles).toEqual(['Fix login redirect bug', undefined, undefined, undefined, undefined, undefined, undefined, 'Add upload retry backoff', undefined])
    expect(asked).toHaveLength(2)
    expect(asked[1]).toContain('The current title is "Fix login redirect bug"')
  })

  it('should keep the title when the check finds it still fits', async ($, on) => {
    on('classic.UserPromptSubmit', () => ({}))
    let asks = 0
    on('model.complete', () => { asks++; return { value: { isAnswered: true, text: asks === 1 ? 'Fix login redirect bug' : 'KEEP', usage } } })
    const titles: (string | undefined)[] = []
    for (let i = 0; i < 8; i++) {
      const result = await $.classic.UserPromptSubmit({ prompt: 'the login page redirects in a loop after sign-in', source: 'user', session_title: titles.findLast(Boolean) })
      titles.push(result.sessionTitle)
    }
    expect(titles.filter(Boolean)).toEqual(['Fix login redirect bug'])
    expect(asks).toBe(2)
  })

  it('should stop re-titling once the session is renamed', async ($, on) => {
    on('classic.UserPromptSubmit', () => ({}))
    let asks = 0
    on('model.complete', () => { asks++; return { value: { isAnswered: true, text: 'Look at error', usage } } })
    await $.classic.UserPromptSubmit({ prompt: 'look at this error', source: 'user' })
    for (let i = 0; i < 4; i++) {
      const result = await $.classic.UserPromptSubmit({ prompt: 'keep going', source: 'user', session_title: 'My session' })
      expect(result.sessionTitle).toBeUndefined()
    }
    expect(asks).toBe(1)
  })

  it('should pass the prompt through unnamed when the model fails', async ($, on) => {
    on('classic.UserPromptSubmit', () => ({}))
    on('model.complete', () => ({ value: { isAnswered: false, reason: 'empty-reply', usage } }))
    const result = await $.classic.UserPromptSubmit({ prompt: 'add a test' })
    expect(result.sessionTitle).toBeUndefined()
  })
})
