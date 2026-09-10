import { useEffect, useState } from 'react'
import type { Project } from '@/types/api'
import { fetchProjectCover, type CoverSize } from '@/api/projects'

const MAX_CACHE_ENTRIES = 100
const coverCache = new Map<string, string>()
const activeRefCounts = new Map<string, number>()

function trimCache() {
  if (coverCache.size <= MAX_CACHE_ENTRIES) return
  // Evict unreferenced covers starting from oldest inserted
  for (const [key, url] of coverCache.entries()) {
    if (coverCache.size <= MAX_CACHE_ENTRIES) break
    const count = activeRefCounts.get(key) ?? 0
    if (count <= 0) {
      URL.revokeObjectURL(url)
      coverCache.delete(key)
      activeRefCounts.delete(key)
    }
  }
}

export function getCachedCoverUrl(
  project?: { public_id: string; cover_url?: string | null },
  size?: CoverSize
): string | null {
  if (!project?.cover_url) return null
  const cacheKey = `${project.public_id}|${project.cover_url}|${size ?? 'default'}`
  return coverCache.get(cacheKey) ?? null
}

export function preloadCover(
  project: { public_id: string; cover_url?: string | null },
  size?: CoverSize
): void {
  if (!project?.cover_url) return
  const cacheKey = `${project.public_id}|${project.cover_url}|${size ?? 'default'}`
  if (coverCache.has(cacheKey)) return

  fetchProjectCover(project.public_id, project.cover_url, size)
    .then((blob) => {
      if (coverCache.has(cacheKey)) return
      const url = URL.createObjectURL(blob)
      coverCache.set(cacheKey, url)
      trimCache()
    })
    .catch(() => {})
}

export function useProjectCoverImage(
  project?: Pick<Project, 'public_id' | 'cover_url'> | Project,
  size?: CoverSize
) {
  const cacheKey = project?.cover_url
    ? `${project.public_id}|${project.cover_url}|${size ?? 'default'}`
    : null
  const cachedValue = cacheKey ? coverCache.get(cacheKey) ?? null : null
  const [imageUrl, setImageUrl] = useState<string | null>(cachedValue)
  const [isLoading, setIsLoading] = useState(!cachedValue && !!cacheKey && !!project?.cover_url)

  useEffect(() => {
    if (!project?.public_id || !project?.cover_url) {
      setImageUrl(null)
      setIsLoading(false)
      return
    }
    const currentCacheKey = `${project.public_id}|${project.cover_url}|${size ?? 'default'}`

    // Increment active consumer ref count
    activeRefCounts.set(currentCacheKey, (activeRefCounts.get(currentCacheKey) ?? 0) + 1)

    const cached = coverCache.get(currentCacheKey)
    if (cached) {
      setImageUrl(cached)
      setIsLoading(false)
      return () => {
        const next = (activeRefCounts.get(currentCacheKey) ?? 1) - 1
        if (next <= 0) activeRefCounts.delete(currentCacheKey)
        else activeRefCounts.set(currentCacheKey, next)
        trimCache()
      }
    }

    let cancelled = false
    let createdUrl: string | null = null
    setIsLoading(true)

    fetchProjectCover(project.public_id, project.cover_url, size)
      .then((blob) => {
        if (cancelled) return
        createdUrl = URL.createObjectURL(blob)
        coverCache.set(currentCacheKey, createdUrl)
        setImageUrl(createdUrl)
        trimCache()
      })
      .catch(() => {
        if (!cancelled) setImageUrl(null)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
      const next = (activeRefCounts.get(currentCacheKey) ?? 1) - 1
      if (next <= 0) activeRefCounts.delete(currentCacheKey)
      else activeRefCounts.set(currentCacheKey, next)

      // If cancelled before cached, revoke the temporary URL
      if (createdUrl && !coverCache.has(currentCacheKey)) {
        URL.revokeObjectURL(createdUrl)
      }
      trimCache()
    }
  }, [project?.public_id, project?.cover_url, size])

  return { imageUrl: imageUrl ?? cachedValue, isLoading }
}
