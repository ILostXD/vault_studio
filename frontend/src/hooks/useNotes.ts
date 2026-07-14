import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as notesApi from '../api/notes'
import type { NoteContentFormat } from '../types/api'

export const noteKeys = {
  all: ['notes'] as const,
  track: (trackId: string) => [...noteKeys.all, 'track', trackId] as const,
  project: (projectId: string) => [...noteKeys.all, 'project', projectId] as const,
}

export function useTrackNotes(trackId: string | null | undefined) {
  return useQuery({
    queryKey: noteKeys.track(trackId || ''),
    queryFn: () => notesApi.getTrackNotes(trackId!),
    enabled: !!trackId,
  })
}

export function useProjectNotes(projectId: string | null | undefined) {
  return useQuery({
    queryKey: noteKeys.project(projectId || ''),
    queryFn: () => notesApi.getProjectNotes(projectId!),
    enabled: !!projectId,
  })
}

export function useUpsertTrackNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ trackId, content, authorName, contentFormat }: { trackId: string; content: string; authorName: string; contentFormat: NoteContentFormat }) =>
      notesApi.upsertTrackNote(trackId, { content, author_name: authorName, content_format: contentFormat }),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: noteKeys.track(variables.trackId) })
      const previousNotes = queryClient.getQueryData(noteKeys.track(variables.trackId))
      queryClient.setQueryData(noteKeys.track(variables.trackId), (old: any) => {
        if (!old) return old
        const userNoteIndex = old.findIndex((note: any) => note.is_owner)
        if (userNoteIndex >= 0) {
          const updated = [...old]
          updated[userNoteIndex] = {
            ...updated[userNoteIndex],
            content: variables.content,
            content_format: variables.contentFormat,
          }
          return updated
        } else {
          return [
            ...old,
            {
              content: variables.content,
              author_name: variables.authorName,
              is_owner: true,
              content_format: variables.contentFormat,
            },
          ]
        }
      })
      return { previousNotes }
    },
    onError: (_err, variables, context) => {
      if (context?.previousNotes) {
        queryClient.setQueryData(noteKeys.track(variables.trackId), context.previousNotes)
      }
    },
    onSettled: (_data, _error, variables) => {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: noteKeys.track(variables.trackId) })
      }, 5000)
    },
  })
}

export function useUpsertProjectNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ projectId, content, authorName }: { projectId: string; content: string; authorName: string }) =>
      notesApi.upsertProjectNote(projectId, { content, author_name: authorName }),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: noteKeys.project(variables.projectId) })
      const previousNotes = queryClient.getQueryData(noteKeys.project(variables.projectId))
      queryClient.setQueryData(noteKeys.project(variables.projectId), (old: any) => {
        if (!old) return old
        const userNoteIndex = old.findIndex((note: any) => note.is_owner)
        if (userNoteIndex >= 0) {
          const updated = [...old]
          updated[userNoteIndex] = {
            ...updated[userNoteIndex],
            content: variables.content,
          }
          return updated
        } else {
          return [
            ...old,
            {
              content: variables.content,
              author_name: variables.authorName,
              is_owner: true,
            },
          ]
        }
      })
      return { previousNotes }
    },
    onError: (_err, variables, context) => {
      if (context?.previousNotes) {
        queryClient.setQueryData(noteKeys.project(variables.projectId), context.previousNotes)
      }
    },
    onSettled: (_data, _error, variables) => {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: noteKeys.project(variables.projectId) })
      }, 5000)
    },
  })
}

export function useDeleteNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (noteId: number) => notesApi.deleteNote(noteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: noteKeys.all })
    },
  })
}
