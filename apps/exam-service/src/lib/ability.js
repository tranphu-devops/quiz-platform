import { AbilityBuilder, createMongoAbility } from '@casl/ability'

export function defineAbilityFor(user) {
  const { can, build } = new AbilityBuilder(createMongoAbility)

  if (user.role === 'admin') {
    can('manage', 'all')
  } else if (user.role === 'teacher') {
    can(['create', 'read', 'update', 'delete'], 'Exam', { created_by: user.id })
    can(['create', 'read', 'update', 'delete'], 'Collection', { created_by: user.id })
    can('read', 'Submission')
  } else {
    can('read', 'Exam', { is_published: true })
    can('read', 'Collection', { is_published: true })
    can('create', 'Submission')
    can('read', 'Submission', { user_id: user.id })
  }

  return build()
}
