import { AbilityBuilder, createMongoAbility } from '@casl/ability'

// Every authenticated user manages their own preferences/targets; admin
// subscription + queue-log routes use a manual req.user.role === 'admin'
// check instead (same pattern as generator-service's platform-key routes),
// so this ability only needs to cover the self-service surface.
export function defineAbilityFor(user) {
  const { can, build } = new AbilityBuilder(createMongoAbility)

  if (user.role === 'admin') {
    can('manage', 'all')
  } else if (user.role !== 'banned') {
    can('manage', 'NotificationPreference', { user_id: user.id })
  }

  return build()
}
