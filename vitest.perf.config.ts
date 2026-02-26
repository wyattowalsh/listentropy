import { mergeConfig } from 'vitest/config'

import baseConfig, { DEFAULT_VITEST_TEST_EXCLUDE } from './vitest.config'

const perfConfig = mergeConfig(baseConfig, {})

if (!perfConfig.test) {
  perfConfig.test = {}
}

// `mergeConfig` concatenates arrays, so reset excludes explicitly for perf-only runs.
perfConfig.test.exclude = [...DEFAULT_VITEST_TEST_EXCLUDE]

export default perfConfig
