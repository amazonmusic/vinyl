/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

// Validates the presence of a license header at the top of each file.
// Ported from eslint-plugin-license-header to oxlint's JS plugin API.

const LINEBREAK_MATCHER = /\r\n|[\r\n\u2028\u2029]/u

/** @type {import('oxlint').Rule} */
export default {
    meta: {
        type: 'layout',
        docs: {
            description: 'validate the presence of a license header',
        },
        fixable: 'code',
        schema: [
            {
                type: ['string', 'array'],
                items: { type: 'string' },
            },
        ],
    },

    create(context) {
        const sourceCode = context.sourceCode

        const newlineChar = getNewlineCharacter(sourceCode)
        const separator = `${newlineChar}${newlineChar}`

        const [pathOrLicense] = context.options
        // We only support the array form (list of header lines) that this repo uses.
        const licenseHeader = replaceNewlines(
            Array.isArray(pathOrLicense)
                ? pathOrLicense.join('\n')
                : String(pathOrLicense),
            newlineChar
        )

        function getNewlineCharacter(sc) {
            const match = LINEBREAK_MATCHER.exec(sc.getText())
            return (match && match[0]) || '\n'
        }

        function replaceNewlines(text, nl) {
            return text.replace(new RegExp(LINEBREAK_MATCHER.source, 'gu'), nl)
        }

        function isLicenseHeader(node) {
            return /(Copyright|@license|SPDX-License-Identifier)\b/i.test(
                node.value
            )
        }

        function hasValidText(comment) {
            return sourceCode.getText(comment) === licenseHeader
        }

        function findLicenseComment(comments) {
            for (const comment of comments) {
                if (isLicenseHeader(comment)) return comment
            }
            return null
        }

        return {
            Program(programNode) {
                const firstStatement = programNode.body[0]
                // Only consider comments that lead the file, i.e. those before
                // the first statement (or all comments when the file has none).
                const comments = firstStatement
                    ? sourceCode.getCommentsBefore(firstStatement)
                    : sourceCode.getAllComments()
                const licenseNode = findLicenseComment(comments)

                if (licenseNode) {
                    if (!hasValidText(licenseNode)) {
                        context.report({
                            node: licenseNode,
                            message: 'Invalid license header',
                            fix(fixer) {
                                return fixer.replaceText(
                                    licenseNode,
                                    licenseHeader
                                )
                            },
                        })
                        return
                    }

                    const idx = comments.indexOf(licenseNode)
                    const previousSibling = comments[idx - 1]
                    const nextSibling = comments[idx + 1] || firstStatement

                    if (nextSibling) {
                        const lLocEnd = licenseNode.loc.end.line
                        const nLocStart = nextSibling.loc.start.line
                        const fix = (fixer) =>
                            fixer.replaceTextRange(
                                [licenseNode.range[1], nextSibling.range[0]],
                                separator
                            )

                        if (nLocStart - lLocEnd > 2) {
                            context.report({
                                node: licenseNode,
                                message:
                                    'Superfluous new lines after license header',
                                fix,
                            })
                        }
                        if (nLocStart - lLocEnd < 2) {
                            context.report({
                                node: licenseNode,
                                message:
                                    'Missing new line after license header',
                                fix,
                            })
                        }
                    }

                    if (previousSibling) {
                        const lLocStart = licenseNode.loc.start.line
                        const nLocEnd = previousSibling.loc.end.line
                        const fix = (fixer) =>
                            fixer.replaceTextRange(
                                [
                                    previousSibling.range[1],
                                    licenseNode.range[0],
                                ],
                                separator
                            )

                        if (lLocStart - nLocEnd > 2) {
                            context.report({
                                node: licenseNode,
                                message:
                                    'Superfluous new lines before license header',
                                fix,
                            })
                        }
                        if (lLocStart - nLocEnd < 2) {
                            context.report({
                                node: licenseNode,
                                message:
                                    'Missing new line before license header',
                                fix,
                            })
                        }
                    } else if (licenseNode.loc.start.line !== 1) {
                        context.report({
                            node: licenseNode,
                            message:
                                'Superfluous new lines before license header',
                            fix(fixer) {
                                return fixer.replaceTextRange(
                                    [0, licenseNode.range[0]],
                                    ''
                                )
                            },
                        })
                    }
                } else {
                    const beforeNode = comments[0] || firstStatement
                    context.report({
                        node: beforeNode || programNode,
                        message: 'Missing license header',
                        fix(fixer) {
                            const endRange = beforeNode
                                ? beforeNode.range[0]
                                : programNode.range[1]
                            return fixer.replaceTextRange(
                                [0, endRange],
                                `${licenseHeader}${separator}`
                            )
                        },
                    })
                }
            },
        }
    },
}
