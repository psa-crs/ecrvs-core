/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * OpenCRVS is also distributed under the terms of the Civil Registration
 * & Healthcare Disclaimer located at http://opencrvs.org/license.
 *
 * Copyright (C) The OpenCRVS Authors located at https://github.com/opencrvs/opencrvs-core/blob/master/AUTHORS.
 */
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { FullDocumentPath } from '@opencrvs/commons/client'
import { precacheFile } from './useFileUpload'

/**
 * Regression test for the `net::ERR_INSUFFICIENT_RESOURCES` bug: workqueue
 * pages (e.g. via Sidebar/SearchResult pulling in `event.draft.list`) call
 * `precacheFile` for every draft attachment on every fetch/poll, with no
 * check for whether the file was already cached. `precacheFile` must skip
 * the network round trip entirely once a file is already in the browser
 * cache.
 */

function createFakeCacheStorage() {
  const store = new Map<string, Response>()
  const cache = {
    match: vi.fn(async (key: string) => store.get(key)),
    put: vi.fn(async (key: string, response: Response) => {
      store.set(key, response)
    }),
    delete: vi.fn(async (key: string) => store.delete(key))
  }
  return {
    keys: vi.fn(async () => ['workbox-runtime-v1']),
    open: vi.fn(async () => cache),
    _cache: cache
  }
}

describe('precacheFile', () => {
  const path = '/ocrvs/some-file.png' as FullDocumentPath
  const fetchMock = fetch as unknown as {
    mockResponseOnce: (body: string, init?: ResponseInit) => void
    resetMocks: () => void
    mock: { calls: unknown[][] }
  }

  beforeEach(() => {
    fetchMock.resetMocks()
  })

  test('fetches the presigned URL and downloads the file when not cached', async () => {
    const fakeCaches = createFakeCacheStorage()
    vi.stubGlobal('caches', fakeCaches)

    fetchMock.mockResponseOnce(
      JSON.stringify({ presignedURL: 'http://minio.local/signed' })
    )
    fetchMock.mockResponseOnce('file-bytes', {
      headers: { 'Content-Type': 'image/png' }
    })

    await precacheFile(path)

    expect(fetchMock.mock.calls).toHaveLength(2)
    expect(fakeCaches._cache.put).toHaveBeenCalledTimes(1)
  })

  test('skips fetching entirely when the file is already cached', async () => {
    const fakeCaches = createFakeCacheStorage()
    vi.stubGlobal('caches', fakeCaches)

    const url = new URL(path, window.config.MINIO_BASE_URL).toString()
    await fakeCaches._cache.put(url, new Response('cached-bytes'))

    await precacheFile(path)

    expect(fetchMock.mock.calls).toHaveLength(0)
  })
})
