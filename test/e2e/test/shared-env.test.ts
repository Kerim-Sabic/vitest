import { expect, test } from 'vitest'
import { runInlineTests, StableTestFileOrderSorter } from '../../test-utils'

test.for([
  { pool: 'forks', isolate: false },
  { pool: 'threads', isolate: false },
  { pool: 'forks', isolate: true },
  { pool: 'threads', isolate: true },
])('environment setup is counted once per setup: %j', async ({ pool, isolate }) => {
  const { ctx, stderr } = await runInlineTests(
    {
      '1.test.js': "import { test } from 'vitest'; test('one', () => {})",
      '2.test.js': "import { test } from 'vitest'; test('two', () => {})",
      '3.test.js': "import { test } from 'vitest'; test('three', () => {})",
      '4.test.js': "import { test } from 'vitest'; test('four', () => {})",
    },
    { pool, isolate, maxWorkers: 2, environment: 'happy-dom', watch: true },
  )

  expect(stderr).toBe('')
  const files = ctx!.state.getFiles()
  expect(files).toHaveLength(4)
  expect(files.every((file) => file.result?.state === 'pass')).toBe(true)
  expect(files.filter((file) => file.environmentLoad! > 0)).toHaveLength(isolate ? 4 : 2)
  expect(files.filter((file) => file.environmentLoad === 0)).toHaveLength(isolate ? 0 : 2)

  await ctx!.rerunTestSpecifications(
    ctx!.state.getTestModules().map((testModule) => testModule.toTestSpecification()),
  )
  const rerunFiles = ctx!.state.getFiles()
  expect(rerunFiles).toHaveLength(4)
  expect(rerunFiles.every((file) => file.result?.state === 'pass')).toBe(true)
  expect(rerunFiles.filter((file) => file.environmentLoad! > 0)).toHaveLength(isolate ? 4 : 2)
  expect(rerunFiles.filter((file) => file.environmentLoad === 0)).toHaveLength(isolate ? 0 : 2)
})

test.each([1, 2])(
  'the environment is shared between tests with maxWorkers: %s',
  async (maxWorkers) => {
    const testCode = `
test('document is the same', () => {
  expect(__vitest_worker__.ctx.config.isolate).toBe(false)
  expect(__vitest_worker__.ctx.config.maxWorkers).toBe(${maxWorkers})
  expect(globalThis.__document ??= document).toBe(document)
})
    `
    const { stderr } = await runInlineTests(
      {
        '1.test.js': testCode,
        '2.test.js': testCode,
        '3.test.js': testCode,
        '4.test.js': testCode,
        'vitest.config.js': {
          test: {
            environment: 'happy-dom',
            globals: true,
            isolate: false,
          },
        },
      },
      {
        sequence: { sequencer: StableTestFileOrderSorter },
        maxWorkers,
      },
    )

    expect(stderr).toBe('')
  },
)
