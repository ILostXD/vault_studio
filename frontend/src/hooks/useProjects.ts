import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Project, UpdateProjectRequest } from '../types/api'
import * as projectsApi from '../api/projects'
import { useExport } from '../contexts/ExportContext'
import { onWSMessage, offWSMessage } from './useWebSocket'

export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (folderId?: number | 'root') => [...projectKeys.lists(), { folderId }] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
}

/** @param folderId - If 'root', returns root-level projects. If number, returns projects in that folder. If undefined, returns all. */
export function useProjects(folderId?: number | 'root') {
  return useQuery({
    queryKey: projectKeys.list(folderId),
    queryFn: () => projectsApi.getProjects(folderId),
  })
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: projectKeys.detail(id as string),
    queryFn: () => projectsApi.getProject(id as string),
    enabled: !!id,
  })
}

export function useCreateProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: projectsApi.createProject,
    onSuccess: (newProject) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() })
      queryClient.setQueryData(projectKeys.detail(newProject.public_id), newProject)
    },
  })
}

export function useUpdateProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProjectRequest }) =>
      projectsApi.updateProject(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: projectKeys.detail(id) })
      const previousProject = queryClient.getQueryData<Project>(
        projectKeys.detail(id)
      )
      if (previousProject) {
        queryClient.setQueryData<Project>(projectKeys.detail(id), {
          ...previousProject,
          ...data,
          updated_at: new Date().toISOString(),
        })
      }
      return { previousProject }
    },
    onError: (_err, { id }, context) => {
      if (context?.previousProject) {
        queryClient.setQueryData(projectKeys.detail(id), context.previousProject)
      }
    },
    onSettled: (_data, _error, { id }) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() })
    },
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: projectsApi.deleteProject,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: projectKeys.lists() })
      const previousProjects = queryClient.getQueryData<Project[]>(
        projectKeys.list()
      )
      if (previousProjects) {
        queryClient.setQueryData<Project[]>(
          projectKeys.list(),
          previousProjects.filter((p) => p.public_id !== id)
        )
      }
      return { previousProjects }
    },
    onError: (_err, _id, context) => {
      if (context?.previousProjects) {
        queryClient.setQueryData(projectKeys.list(), context.previousProjects)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() })
      queryClient.invalidateQueries({ queryKey: ['folders'] })
    },
  })
}

export function useMoveProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, folderId }: { id: string; folderId: number | null }) =>
      projectsApi.moveProject(id, { folder_id: folderId }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() })
      queryClient.invalidateQueries({ queryKey: ['folders'] })
    },
  })
}

export function useMoveProjectsToFolder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: {
      projectIds?: string[]
      projects?: projectsApi.ProjectWithOrder[]
      folderId: number
    }) => projectsApi.moveProjectsToFolder(params),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() })
      queryClient.invalidateQueries({ queryKey: ['folders'] })
    },
  })
}

export function useDuplicateProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => projectsApi.duplicateProject(id),
    onSuccess: (newProject) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() })
      queryClient.invalidateQueries({ queryKey: ['folders'] })
      queryClient.setQueryData(projectKeys.detail(newProject.public_id), newProject)
    },
  })
}

export function useExportProject() {
  const { startExport, updateExport, completeExport, failExport, dismissExport } = useExport()

  return useMutation({
    mutationFn: async ({ id, projectName }: { id: string; projectName: string }) => {
      const exportId = startExport({
        title: projectName,
        phase: 'preparing',
        statusText: 'Preparing project package...',
      })

      let downloading = false
      const listener = (message: { type: string; payload: unknown }) => {
        if (message.type !== 'project_export_progress' || downloading) return
        const p = message.payload as { export_id: string; loaded: number; total: number; filename: string }
        if (p.export_id !== exportId) return
        updateExport(exportId, {
          phase: 'preparing',
          progress: p.total > 0 ? Math.min(100, p.loaded / p.total * 100) : undefined,
          statusText: `Preparing ZIP: ${p.filename}`,
        })
      }
      onWSMessage(listener)
      try {
        const result = await projectsApi.exportProject(id, `${projectName}.zip`, exportId, (loadedBytes, totalBytes) => {
          downloading = true
          const loadedMb = (loadedBytes / (1024 * 1024)).toFixed(1)
          if (totalBytes && totalBytes > 0) {
            const pct = Math.min(100, (loadedBytes / totalBytes) * 100)
            updateExport(exportId, {
              phase: 'downloading',
              progress: pct,
              statusText: `Downloading ${loadedMb} / ${(totalBytes / (1024 * 1024)).toFixed(1)} MB`,
            })
          } else {
            updateExport(exportId, {
              phase: 'downloading',
              progress: undefined,
              statusText: `Downloading ${loadedMb} MB...`,
            })
          }
        })

        if (result.cancelled) dismissExport(exportId)
        else completeExport(exportId, 'ZIP download ready')
        return result
      } catch (err) {
        failExport(exportId, err instanceof Error ? err.message : 'Failed to export project')
        throw err
      } finally {
        offWSMessage(listener)
      }
    },
  })
}

export function useUpdateProjectNotes() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, notes, authorName }: { id: string; notes: string; authorName?: string }) =>
      projectsApi.updateProjectNotes(id, notes, authorName),
    onSuccess: (updatedProject) => {
      queryClient.setQueryData(projectKeys.detail(updatedProject.public_id), updatedProject)
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() })
    },
  })
}

export function usePrefetchProjects() {
  const queryClient = useQueryClient()

  return () => {
    queryClient.prefetchQuery({
      queryKey: projectKeys.list(),
      queryFn: () => projectsApi.getProjects(),
    })
  }
}
