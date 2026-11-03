import { api } from './client'
import { useEffect } from 'react'

export async function fetchProjects() {
  const { data } = await api.get('/projects')
  return data.projects
}

export async function fetchProject(projectId) {
  const { data } = await api.get(`/projects/${projectId}`)
  return data.project
}

export async function fetchSprints(projectId) {
  const { data } = await api.get(`/projects/${projectId}/sprints`)
  return data.sprints
}

export async function fetchTodos(projectId, filters = {}) {
  const { data } = await api.get(`/projects/${projectId}/todos`, { params: filters })
  return data.todos
}

export async function fetchSprintBoard(sprintId) {
  const { data } = await api.get(`/sprints/${sprintId}/todos`)
  return data
}

export function publishDataChange(projectId) {
  window.dispatchEvent(new CustomEvent('kanbot:data-changed', { detail: { projectId } }))
}

export function useProjectRefresh(projectId, refresh) {
  useEffect(() => {
    const handler = (event) => {
      if (!event.detail?.projectId || event.detail.projectId === projectId) refresh()
    }
    window.addEventListener('kanbot:data-changed', handler)
    return () => window.removeEventListener('kanbot:data-changed', handler)
  }, [projectId, refresh])
}
