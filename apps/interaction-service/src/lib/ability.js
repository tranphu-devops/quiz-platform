import { AbilityBuilder, createMongoAbility } from '@casl/ability'

export function defineAbilityFor(user) {
  const { can, build } = new AbilityBuilder(createMongoAbility)

  if (user.role === 'banned') {
    // no permissions
  } else if (user.role === 'admin') {
    can('manage', 'all')
  } else if (user.role === 'teacher') {
    // Any logged-in user may comment; author-only moderation
    can(['create', 'read'], 'Comment')
    can(['update', 'delete'], 'Comment', { user_id: user.id })
    // Reports on exams the teacher owns: read + respond
    can(['read', 'respond'], 'Report', { exam_owner_id: user.id })
    can('read', 'Report', { reporter_id: user.id })
  } else {
    // student
    can(['create', 'read'], 'Comment')
    can(['update', 'delete'], 'Comment', { user_id: user.id })
    can(['create', 'delete'], 'Like')
    can('create', 'Report')
    can('read', 'Report', { reporter_id: user.id })
  }

  return build()
}
