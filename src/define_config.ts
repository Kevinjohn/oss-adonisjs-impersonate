import type { MasqueradeConfig } from './types.js'
import { boundedString } from './bounded_string.js'

/** Validate synchronously; resolving the store is deferred to service creation. */
export function defineConfig<User, Request>(
  config: MasqueradeConfig<User, Request>
): MasqueradeConfig<User, Request> {
  const fail = () => {
    throw new TypeError('Invalid masquerade configuration')
  }
  if (
    !config ||
    Object.keys(config).some(
      (key) =>
        ![
          'authority',
          'policy',
          'store',
          'durationSeconds',
          'maxDurationSeconds',
          'contextEnforcement',
          'retention',
        ].includes(key)
    )
  )
    fail()
  const authority = config.authority
  if (
    !authority ||
    Object.keys(authority).some(
      (key) =>
        !['namespace', 'guard', 'incarnation', 'securityStamp', 'inspectAccount'].includes(key)
    ) ||
    !boundedString(authority.namespace, 128) ||
    !/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(authority.namespace) ||
    !boundedString(authority.guard, 128) ||
    !(authority.incarnation === 'id' || typeof authority.incarnation === 'function') ||
    typeof authority.securityStamp !== 'function' ||
    typeof authority.inspectAccount !== 'function'
  )
    fail()
  if (
    !config.policy ||
    typeof config.policy.canMasquerade !== 'function' ||
    Object.keys(config.policy).some((key) => !['canMasquerade', 'canUseRequest'].includes(key)) ||
    (config.policy.canUseRequest !== undefined &&
      typeof config.policy.canUseRequest !== 'function') ||
    typeof config.store !== 'function'
  )
    fail()
  const max = config.maxDurationSeconds === undefined ? 3600 : config.maxDurationSeconds
  const duration = config.durationSeconds === undefined ? 900 : config.durationSeconds
  if (
    !Number.isInteger(max) ||
    max < 60 ||
    max > 3600 ||
    !Number.isInteger(duration) ||
    duration < 60 ||
    duration > max
  )
    fail()
  if (!['report', 'enforce'].includes(config.contextEnforcement)) fail()
  if (
    config.retention !== 'host-managed' &&
    (!config.retention ||
      Object.keys(config.retention).some((key) => key !== 'days') ||
      !Number.isSafeInteger(config.retention.days) ||
      config.retention.days < 1)
  )
    fail()
  return Object.freeze({
    authority: Object.freeze({
      namespace: authority.namespace,
      guard: authority.guard,
      incarnation:
        typeof authority.incarnation === 'function'
          ? authority.incarnation.bind(authority)
          : authority.incarnation,
      securityStamp: authority.securityStamp.bind(authority),
      inspectAccount: authority.inspectAccount.bind(authority),
    }),
    policy: Object.freeze({
      canMasquerade: config.policy.canMasquerade.bind(config.policy),
      ...(config.policy.canUseRequest
        ? { canUseRequest: config.policy.canUseRequest.bind(config.policy) }
        : {}),
    }),
    store: config.store.bind(config),
    contextEnforcement: config.contextEnforcement,
    retention:
      typeof config.retention === 'object'
        ? Object.freeze({ days: config.retention.days })
        : config.retention,
    durationSeconds: duration,
    maxDurationSeconds: max,
  })
}
