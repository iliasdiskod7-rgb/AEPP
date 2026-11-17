/** Browser regression check: pass an isolated Playwright Page and a running Vite URL. */
export async function verifyGlossaEditor(page, baseURL = 'http://localhost:5173') {
  await page.goto(baseURL)
  await page.getByRole('button', { name: 'Διερμηνευτής ΓΛΩΣΣΑΣ', exact: true }).first().click()
  await page.locator('.monaco-editor').first().waitFor()
  const lexical = await page.evaluate(async () => {
    const { monaco } = await import('/src/interpreter/monacoSetup.ts')
    const { glossaLanguage, registerGlossaLanguage } = await import('/src/interpreter/glossaLanguage.ts')
    registerGlossaLanguage(monaco)
    registerGlossaLanguage(monaco)
    let checked = 0
    for (const [group, type] of [
      ['control', 'keyword.control'], ['declarations', 'type.keyword'],
      ['io', 'keyword.io'], ['wordOperators', 'operator'], ['constants', 'constant'],
    ]) {
      for (const word of glossaLanguage[group]) {
        for (const input of [word, word.toLocaleLowerCase('el-GR')]) {
          if (monaco.editor.tokenize(input, 'glossa')[0][0].type !== type + '.glossa') throw Error(input)
          checked++
        }
      }
    }
    const categories = input => monaco.editor.tokenize(input, 'glossa')[0]
      .filter(token => token.type !== 'white.glossa').map(token => token.type)
    const samples = [
      ['x <- 5 + 3', ['identifier', 'operator', 'number', 'operator', 'number']],
      ['ΟΣΟ x < 10 ΕΠΑΝΑΛΑΒΕ', ['keyword.control', 'identifier', 'operator', 'number', 'keyword.control']],
      ['! σχόλιο', ['comment']],
      ["ΓΡΑΨΕ 'ΑΝ ! κείμενο' \"ΟΣΟ ! κείμενο\"", ['keyword.io', 'string', 'string']],
      ['ΑΝΑΖΗΤΗΣΗ <- 3.14', ['identifier', 'operator', 'number']],
    ]
    for (const [input, expected] of samples) {
      if (JSON.stringify(categories(input)) !== JSON.stringify(expected.map(type => type + '.glossa'))) throw Error(input)
    }
    window.__glossaBrowserOriginal = monaco.editor.getEditors()[0].getValue()
    return { checkedWords: checked, samples: samples.length }
  })
  try {
    for (const [theme, operator, number, keyword, comment, string] of [
      ['glossa-light', 'rgb(234, 88, 12)', 'rgb(219, 39, 119)', 'rgb(147, 51, 234)', 'rgb(100, 116, 139)', 'rgb(22, 163, 74)'],
      ['glossa-dark', 'rgb(251, 146, 60)', 'rgb(244, 114, 182)', 'rgb(192, 132, 252)', 'rgb(148, 163, 184)', 'rgb(74, 222, 128)'],
    ]) {
      await page.evaluate(async theme => {
        const { monaco } = await import('/src/interpreter/monacoSetup.ts')
        monaco.editor.setTheme(theme)
        monaco.editor.getEditors()[0].setValue("x <- 5 + 3\nΟΣΟ x < 10 ΕΠΑΝΑΛΑΒΕ\n! σχόλιο\nΓΡΑΨΕ 'κείμενο' ΑΛΗΘΗΣ")
      }, theme)
      await page.waitForFunction(({ operator, number, keyword, comment, string }) => {
        const leaves = [...document.querySelectorAll('.monaco-editor .view-line span')].filter(span => !span.children.length)
        const color = text => {
          const span = leaves.find(span => span.textContent.trim() === text)
          return span && getComputedStyle(span).color
        }
        const note = leaves.find(span => span.textContent.startsWith('!'))
        return color('<-') === operator && color('5') === number && color('ΟΣΟ') === keyword &&
          color("'κείμενο'") === string && color('ΑΛΗΘΗΣ') === number &&
          note && getComputedStyle(note).color === comment && getComputedStyle(note).fontStyle === 'italic'
      }, { operator, number, keyword, comment, string })
    }
    await page.evaluate(async () => {
      const { monaco } = await import('/src/interpreter/monacoSetup.ts')
      const editor = monaco.editor.getEditors()[0]
      editor.setValue('x <- 5 + 3')
      editor.setPosition({ lineNumber: 1, column: 11 })
      editor.focus()
    })
    await page.keyboard.type(' + 7')
    await page.waitForFunction(async () => {
      const { monaco } = await import('/src/interpreter/monacoSetup.ts')
      return monaco.editor.getEditors()[0].getValue() === 'x <- 5 + 3 + 7'
    })
    await page.keyboard.press('F9')
    await page.locator('.glossa-breakpoint').waitFor()
    await page.keyboard.press('F9')
    await page.locator('.glossa-breakpoint').waitFor({ state: 'detached' })
    await page.keyboard.press('Control+z')
    await page.waitForFunction(async () => {
      const { monaco } = await import('/src/interpreter/monacoSetup.ts')
      return monaco.editor.getEditors()[0].getValue() === 'x <- 5 + 3'
    })
    return { ...lexical, themes: 2, typing: true, undo: true, keyboardBreakpoints: true }
  } finally {
    await page.evaluate(async () => {
      const { monaco } = await import('/src/interpreter/monacoSetup.ts')
      monaco.editor.getEditors()[0].setValue(window.__glossaBrowserOriginal)
      delete window.__glossaBrowserOriginal
      monaco.editor.setTheme(document.documentElement.dataset.theme === 'dark' ? 'glossa-dark' : 'glossa-light')
    })
  }
}
