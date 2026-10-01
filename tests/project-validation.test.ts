import { describe, expect, it } from 'vitest'
import { validateProjectDocument } from '../src/main/services/project.service'

describe('project validation', () => {
  it('accepts a versioned project document', () => {
    expect(validateProjectDocument({ version: 1, id: 'p', name: 'Projeto', photos: [], sheet: {}, placements: [], createdAt: 'now', updatedAt: 'now' }).version).toBe(1)
  })

  it('rejects malformed documents', () => {
    expect(() => validateProjectDocument({ version: 2 })).toThrow()
  })
})
