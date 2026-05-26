/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Maybe } from '@/util/type'
import type {
    DeviceInfoRule,
    SystemInfoLikeRule,
    SystemInfoRule,
    TokenizedUserAgent,
} from './tokenizeUserAgent'
import { tokenQuery } from './tokenizeUserAgent'
import type { UaDeviceInfo } from './UserAgentInfo'

/**
 * A rule to match platform information (parts outside parentheticals).
 *
 * @param name The exact name to use if there's a match.
 * @param expr
 */
export function uaPlatformRule(name: string, expr: string): SystemInfoRule {
    return uaName(name, (t) => t.platform.query(expr))
}

/**
 * A rule to match system information. (Matches parts within parentheticals.)
 *
 * @param name The exact name to use if there's a match.
 * @param expr
 * @param hasVersion If true, the version will be inferred from the matched part.
 */
export function uaSystemRule(
    name: string,
    expr: string,
    hasVersion: boolean
): SystemInfoRule {
    return (t) => {
        const found = t.system.query(expr)
        if (!found) return null
        const version = hasVersion ? found.version : null
        return { name, version }
    }
}

/**
 * A rule to match platform or system information.
 *
 * @param name The exact name to use if there's a match.
 * @param expr A token expression.
 */
export function uaPlatformOrSystemRule(
    name: string,
    expr: string
): SystemInfoRule {
    return uaName(name, (t) =>
        tokenQuery(
            expr,
            (tokens) => t.platform.get(...tokens) || t.system.get(...tokens)
        )
    )
}

/**
 * Changes the name of the Name/Version part returned from the given rule.
 *
 * @param name
 * @param rule
 */
export function uaName(name: string, rule: SystemInfoRule): SystemInfoRule {
    return (t) => {
        const found = rule(t)
        return found && { name, version: found.version }
    }
}

export function uaSystemLike(
    name: string,
    derived: readonly string[]
): SystemInfoLikeRule {
    return (_, systemInfo) => {
        return derived.some((name) => name === systemInfo?.name)
            ? {
                  name,
                  version: null,
              }
            : null
    }
}

/**
 * A rule to match system or platform information, providing vendor and type information.
 *
 * @param vendor The device make/vendor to use when there's a match.
 * @param type The type of device, e.g. 'mobile' or 'tablet'.
 * @param expr The token expression to use to determine a match. If there is a match, the
 * matched name will be used as the model unless model is explicit.
 * @param model If defined, will be used as the model string instead of the matched expression
 * name.
 */
export function uaDeviceRule(
    vendor: string | null,
    type: string | null,
    expr: string,
    model?: Maybe<string>
): DeviceInfoRule {
    return (t: TokenizedUserAgent): UaDeviceInfo | null => {
        const found = tokenQuery(
            expr,
            (tokens) => t.system.get(...tokens) || t.platform.get(...tokens)
        )
        return (
            found && {
                vendor: vendor,
                model: model === undefined ? found.name : model,
                type,
            }
        )
    }
}

/**
 * A rule that executes a regex, transforming the match result.
 *
 * @param expr
 * @param onMatch When the expression matches, onMatch will be given the RegExpExecArray and return
 * the final info object.
 */
export function regexRule<T>(
    expr: RegExp,
    onMatch: (match: RegExpMatchArray) => T
): (t: TokenizedUserAgent) => T | null {
    return (t) => {
        const match = expr.exec(t.userAgent)
        if (!match) return null
        return onMatch(match)
    }
}
