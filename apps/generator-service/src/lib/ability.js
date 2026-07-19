import { AbilityBuilder, createMongoAbility } from '@casl/ability'

// Only teacher/admin may generate exams from a document — a student key
// grants nothing useful here, same rationale as the Teacher API key feature.
export function defineAbilityFor(user) {
  const { can, build } = new AbilityBuilder(createMongoAbility)

  if (user.role === 'admin' || user.role === 'teacher') {
    can('manage', 'Generation')
  }

  return build()
}
