/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { last } from '@/util/collection/array'
import { memoize } from '@/util/fun/memoize'
import { substringBefore, tokenizeWords } from '@/util/string/string'
import type { Maybe } from '@/util/type'
import type { Version } from '@/client/Version'
import { parseVersion } from '@/client/Version'
import type { UaDeviceInfo, UaSystemInfo } from './UserAgentInfo'

const MAX_USER_AGENT_LENGTH = 500

/**
 * Separates system and platform parts.
 * group 1 - System group (The entire parenthetical)
 * group 2 - Platform name part
 * group 3 - Platform version part
 */
const userAgentRegex = /[([]([^\])]*)[\])]|([^\s/([]+)(?:\/(\S+))?/g

/**
 * In system parts, (semicolon separated sections within a parenthetical), captures the parts when
 * there is a version part separated by a slash.
 *
 * group 1 - The part before the Name/Version
 * group 2 - The Name in Name/Version
 * group 3 - The Version in Name/Version
 */
const nameVersionRegex = /(.*?)([^\s/([]+)\/(\S+)\s*$/i

/**
 * Matches a version-like string in a system part.
 * Slightly more strict than the {@link parseVersion} Regex.
 */
const versionRegex = /\s\w*\d(?:[._]\d+)*[\w-._]*/g

/**
 * Builds a tokenized user agent for faster queries.
 *
 * @param userAgent
 */
export function tokenizeUserAgent(userAgent: string): TokenizedUserAgent {
    userAgent = userAgent.substring(0, MAX_USER_AGENT_LENGTH)
    const systemParts: UserAgentPart[] = []
    const platformParts: UserAgentPart[] = []
    let match: Array<string | undefined> | null
    while ((match = userAgentRegex.exec(userAgent))) {
        if (match[1]) {
            // System part
            const split = match[1].split(';')
            split.forEach((section) => {
                const versionMatch = nameVersionRegex.exec(section)
                if (versionMatch) {
                    // name is the part before the Name/Version pair
                    const name = versionMatch[1].trim()
                    const versionStr = versionMatch[3]
                    systemParts.push({
                        name,
                        version: parseVersion(versionStr),
                        tokens: tokenizeWords(section),
                    })
                } else {
                    // No Name/Version pair
                    // Finds the last version-like string in the section, if any exists.
                    const versionMatches = section.match(versionRegex)
                    systemParts.push({
                        name: section.trim(),
                        // Finds the first version-like string in the section, if any exists.
                        version: parseVersion(last(versionMatches)),
                        tokens: tokenizeWords(section),
                    })
                }
            })
        } else {
            // Platform part
            const name = match[2]!
            platformParts.push({
                name,
                version: parseVersionPart(match[3] ?? ''),
                tokens: tokenizeWords(name),
            })
        }
    }
    return {
        userAgent,
        system: new TokenizedInfo(systemParts),
        platform: new TokenizedInfo(platformParts),
    } as const
}

function parseVersionPart(str: string): Version | null {
    // If there are multiple versions, e.g. `Firefox/85.0/10csO9CgK-99` use the first.
    return parseVersion(substringBefore(str, '/'))
}

/**
 * A User Agent rule takes a tokenized user agent, and if the rule matches, returns the Browser
 * or Platform
 * information. Otherwise, returns null.
 */
export type SystemInfoRule = (
    tokenizedUa: TokenizedUserAgent
) => UaSystemInfo | null

/**
 * A User Agent rule takes a tokenized user agent, and if the rule matches, returns the Device
 * information. Otherwise, returns null.
 */
export type DeviceInfoRule = (
    tokenizedUa: TokenizedUserAgent
) => UaDeviceInfo | null

/**
 * A User Agent rule takes a tokenized user agent, and if the rule matches, returns the Browser
 * or Platform
 * information. Otherwise, returns null.
 */
export type SystemInfoLikeRule = (
    tokenizedUa: TokenizedUserAgent,
    systemInfo: UaSystemInfo | null
) => UaSystemInfo | null

/**
 * The ruleset to use when parsing a user agent.
 * Rules are expected to be from most specific to least.
 */
export interface UserAgentRules {
    readonly browserRules: readonly SystemInfoRule[]
    readonly browserLikeRules: readonly SystemInfoLikeRule[]
    readonly osRules: readonly SystemInfoRule[]
    readonly osLikeRules: readonly SystemInfoLikeRule[]
    readonly deviceRules: readonly DeviceInfoRule[]
}

/**
 * A tokenized user agent.
 * A common format for user agents:
 * `Mozilla/5.0 (<system-information>) <platform> (<platform-details>) [extensions]`
 *
 */
export interface TokenizedUserAgent {
    /**
     * The original user agent.
     */
    readonly userAgent: string

    /**
     * The tokenized system and platform details or extensions (parts within parenthetical sections
     * separated by semicolons.)
     */
    readonly system: TokenizedInfo

    /**
     * The tokenized platform info (parts outside parenthetical sections, separated by
     * whitespace.)
     */
    readonly platform: TokenizedInfo
}

/**
 * A parsed system or extension part of the user agent. (A section within a parenthetical)
 */
export interface UserAgentPart extends UaSystemInfo {
    readonly name: string
    readonly version: Version | null
    readonly tokens: readonly string[]
}

export class TokenizedInfo {
    /**
     * A token map of lowercase token strings to name/version pairs.
     */
    private readonly tokenMap: ReadonlyMap<string, UserAgentPart>

    constructor(readonly parts: UserAgentPart[]) {
        const map: Map<string, UserAgentPart> = new Map()
        parts.forEach((part) => {
            part.tokens.forEach((token) => {
                if (
                    !map.has(token) ||
                    map.get(token)!.tokens.length > part.tokens.length
                )
                    // When there is a token key collision, the parts with fewer tokens take
                    // precedence in the map. This allows the parts with more tokens to be
                    // disambiguated using the tokens not shared.
                    map.set(token, part)
            })
        })
        this.tokenMap = map
    }

    /**
     * Given lowercase tokens of only alpha characters, returns the mapped token part if all tokens
     * are contained in the section.
     */
    get(...tokens: readonly string[]): UaSystemInfo | null {
        for (const token of tokens) {
            const part = this.tokenMap.get(token)
            if (!part) return null
            if (tokens.every((iToken) => part.tokens.includes(iToken))) {
                return { name: part.name, version: part.version }
            }
        }
        return null
    }

    /**
     * Given an expression of logical operators, returns the name and version of the part
     * that matches the expression.
     *
     * Logical operators currently supported: | for OR and & for AND.
     * Operands between operators will be tokenized via {@link tokenizeWords}.
     *
     * @param expr The expression of tokens and operators. Example: 'windows phone|windows&mobile'
     * will match when one part has both 'windows' and 'phone' or there are two parts, one with
     * 'windows' and another part with 'mobile'
     * (Case insensitive)
     */
    query(expr: string): UaSystemInfo | null {
        return tokenQuery(expr, (tokens) => this.get(...tokens))
    }
}

/**
 * Executes a logical expression mapping tokens with a predicate, using the result as operands.
 *
 * Logical operators currently supported: | for OR and & for AND.
 * Operands between operators will be tokenized via {@link tokenizeWords}.
 *
 * @param expr The expression of tokens and operators.
 * @param predicate Each token set operand will be mapped using this function.
 */
export function tokenQuery<T>(
    expr: string,
    predicate: (tokens: readonly string[]) => Maybe<T>
): T | null {
    const parsedExpr = parsedExpression(expr)
    for (const orGroup of parsedExpr) {
        let found: Maybe<T> = null
        for (const words of orGroup) {
            found = predicate(words)
            if (found == null) break
        }
        if (found) return found
    }
    return null
}

const parsedExpression = memoize(
    (expr: string): readonly string[][][] => {
        return expr.split('|').map((g) => g.split('&').map(tokenizeWords))
    },
    (expr) => expr
)
