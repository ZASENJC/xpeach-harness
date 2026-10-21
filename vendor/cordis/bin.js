#!/usr/bin/env node

import { Context } from '@xpeach/xph-cordis'
import { pathToFileURL } from 'node:url'
import Loader from '@xpeach/xph-cordis-plugin-loader'

const ctx = new Context()
ctx.baseUrl = pathToFileURL(process.cwd()).href + '/'

await ctx.plugin(Loader)
await ctx.loader.create({
  name: '@xpeach/xph-cordis-plugin-include',
  config: {
    path: './cordis.yml',
  },
})
