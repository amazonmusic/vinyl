/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import ts from 'typescript'
import * as fs from 'fs'
import * as path from 'path'

export interface InterfaceInfo {
    name: string

    sourceFiles: string[]

    /**
     * The interface name and params, e.g. `Set<string>`
     */
    interfaceStr: string
    properties: PropertyInfo[]
    methods: MethodInfo[]
    extends: ExtendedInterface[]
    typeParameters: string[]
    indexSignature?: IndexSignatureInfo | undefined
}

export interface ExtendedInterface {
    name: string
    typeArguments?: string[] | undefined
    declarations?: ts.InterfaceDeclaration[]
}

export interface IndexSignatureInfo {
    keyType: string
    valueType: string
}

export interface PropertyInfo {
    name: string
    type: ts.TypeNode | undefined
    typeName: string
    optional: boolean
    computed?: boolean
}

export interface MethodInfo {
    name: string
    computed: boolean
}

export interface MockGeneratorOptions {
    library: string

    /**
     * A set of root files.
     */
    rootNames: string[]

    /**
     * The destination file path to write the mocks.
     */
    outFile: string

    /**
     * Typescript compilation options.
     */
    compilerOptions?: ts.CompilerOptions
    header?: string
    footer?: string
    interfaceFilter?: (interfaceInfo: InterfaceInfo) => boolean

    initializeMockClass?(interfaceInfo: InterfaceInfo): string
    createSpyMethod(
        interfaceInfo: InterfaceInfo,
        method: MethodInfo,
        key: string
    ): string
}

export function generateMocks(options: MockGeneratorOptions) {
    console.log('Analyzing TypeScript lib files...')
    const dir = path.dirname(options.outFile)
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
    }

    const rootNames = getRootNames(options)

    const program = ts.createProgram(rootNames, {
        ...options.compilerOptions,
        skipLibCheck: true,
        skipDefaultLibCheck: false,
    })

    const checker = program.getTypeChecker()

    const allInterfaces: InterfaceInfo[] = []
    for (const sourceFile of program.getSourceFiles()) {
        allInterfaces.push(...processSourceFile(sourceFile))
    }

    // The flattened interfaces will merge interfaces with the same name.
    const seen = new Set<string>()
    const flattened = allInterfaces
        .filter((info) => {
            if (seen.has(info.name)) return false
            seen.add(info.name)
            return true
        })
        .map((info) => flattenInterface({ info, allInterfaces }))
        .filter((info) => {
            if (
                !info.sourceFiles.some((file) => {
                    const baseName = path.basename(file)
                    return options.rootNames.includes(baseName)
                })
            ) {
                // Don't write interfaces that weren't included in the source files.
                return false
            }

            // Don't include interfaces that were excluded from the interfaceFilter.
            return !(options.interfaceFilter && !options.interfaceFilter(info))
        })

    const outFile = path.resolve(options.outFile)
    let content = options.header ?? ''

    for (const interfaceInfo of flattened) {
        content += generateMockClass({
            interfaceInfo,
            options,
            checker,
        })
        content += '\n'
    }

    content += options.footer ?? ''
    fs.writeFileSync(outFile, content, 'utf-8')
    console.log(`Generated ${outFile} with ${flattened.length} mocks`)
}

function getRootNames(options: MockGeneratorOptions): readonly string[] {
    const libUrl = import.meta.resolve(options.library)
    const libPath = path.dirname(new URL(libUrl).pathname)

    const libFiles = options.rootNames
        .map((file) => path.join(libPath, file))
        .filter((file) => {
            const exists = fs.existsSync(file)
            if (!exists) console.error('file not found:', file)
            return exists
        })

    console.log(`Found ${libFiles.length} TypeScript lib files`)
    return libFiles
}

function processSourceFile(sourceFile: ts.SourceFile): InterfaceInfo[] {
    const interfaces: InterfaceInfo[] = []

    const visit = (node: ts.Node): void => {
        if (ts.isInterfaceDeclaration(node)) {
            const interfaceInfo = processInterface(sourceFile, node)
            if (interfaceInfo) interfaces.push(interfaceInfo)
        }
    }

    ts.forEachChild(sourceFile, visit)
    return interfaces
}

function flattenInterface({
    info,
    allInterfaces,
}: {
    info: InterfaceInfo
    allInterfaces: readonly InterfaceInfo[]
}): InterfaceInfo {
    const merged: InterfaceInfo = {
        name: info.name,
        sourceFiles: [...info.sourceFiles],
        interfaceStr: info.interfaceStr,
        properties: [],
        methods: [],
        extends: info.extends,
        typeParameters: info.typeParameters,
        indexSignature: info.indexSignature,
    }

    const openList: ExtendedInterface[] = [
        {
            name: info.name,
        },
        ...info.extends,
    ]

    const mergedInterfaces = new Set<InterfaceInfo>()
    while (openList.length) {
        const next = openList.shift()!
        const bases = allInterfaces.filter(
            (i) => i.name === next.name && !mergedInterfaces.has(i)
        )
        for (const base of bases) {
            openList.push(...base.extends)
            mergedInterfaces.add(base)
            const baseParams = base.typeParameters
            const actuals = next.typeArguments ?? []

            for (const sourceFile of base.sourceFiles) {
                if (!merged.sourceFiles.includes(sourceFile)) {
                    merged.sourceFiles.push(sourceFile)
                }
            }

            for (const p of base.properties) {
                if (!merged.properties.some((x) => x.name === p.name)) {
                    const typeName = substituteTypeParams({
                        type: p.typeName,
                        params: baseParams,
                        actuals,
                    })
                    merged.properties.push({ ...p, typeName })
                }
            }

            for (const m of base.methods) {
                if (!merged.methods.some((x) => x.name === m.name)) {
                    merged.methods.push({
                        ...m,
                    })
                }
            }

            if (base.indexSignature && !merged.indexSignature) {
                merged.indexSignature = {
                    keyType: base.indexSignature.keyType,
                    valueType: substituteTypeParams({
                        type: base.indexSignature.valueType,
                        params: baseParams,
                        actuals: actuals,
                    }),
                }
            }
        }
    }
    return merged
}

function substituteTypeParams({
    type,
    params,
    actuals,
}: {
    type: string
    params: string[]
    actuals: string[]
}): string {
    if (!params.length || !actuals.length) return type
    return params.reduce((t, param, i) => {
        const actual = actuals[i] ?? 'any'
        const paramClean = param.replace(/(?:extends|=).*$/, '').trim()
        return t
            .replace(new RegExp(`\\b${param}\\b`, 'g'), actual)
            .replace(new RegExp(`\\b${paramClean}\\b`, 'g'), actual)
    }, type)
}

function processInterface(
    sourceFile: ts.SourceFile,
    node: ts.InterfaceDeclaration
): InterfaceInfo | null {
    const name = node.name.text
    if (name.startsWith('_')) return null

    if (
        node.members.some(
            (m) =>
                ts.isCallSignatureDeclaration(m) ||
                ts.isConstructSignatureDeclaration(m)
        )
    ) {
        // Reject interfaces that are callable (function-like) or constructable
        return null
    }

    const typeParameters: string[] =
        node.typeParameters?.map((tp) => tp.getText(sourceFile)) ?? []

    const cleanParamNames = typeParameters.map((p) =>
        p.replace(/(?:extends|=).*$/, '').trim()
    )

    const implementsParams =
        cleanParamNames.length > 0 ? `<${cleanParamNames.join(', ')}>` : ''

    const interfaceStr = `${name}${implementsParams}`
    const interfaceInfo: InterfaceInfo = {
        name,
        sourceFiles: [sourceFile.fileName],
        interfaceStr,
        properties: [],
        methods: [],
        extends: [],
        typeParameters,
    }

    if (node.heritageClauses) {
        for (const heritage of node.heritageClauses) {
            if (heritage.token === ts.SyntaxKind.ExtendsKeyword) {
                interfaceInfo.extends = heritage.types.map((type) => {
                    return {
                        name: type.expression.getText(sourceFile),
                        typeArguments: type.typeArguments?.map((arg) =>
                            arg.getText(sourceFile)
                        ),
                    }
                })
            }
        }
    }

    const accessorTypes = new Map<
        string,
        {
            getter?: ts.TypeNode | undefined
            setter?: ts.TypeNode | undefined
        }
    >()

    for (const member of node.members) {
        if (ts.isPropertySignature(member)) {
            interfaceInfo.properties.push(processProperty(sourceFile, member))
        } else if (ts.isMethodSignature(member)) {
            interfaceInfo.methods.push(processMethod(sourceFile, member))
        } else if (ts.isIndexSignatureDeclaration(member)) {
            const key = member.parameters[0]
            const keyType = getTypeName(sourceFile, key.type)
            const valueType = getTypeName(sourceFile, member.type)
            interfaceInfo.indexSignature = { keyType, valueType }
        } else if (ts.isGetAccessor(member)) {
            const name = getPropertyName(sourceFile, member.name)
            const entry = accessorTypes.get(name) ?? {}
            entry.getter = member.type
            accessorTypes.set(name, entry)
        } else if (ts.isSetAccessor(member)) {
            const name = getPropertyName(sourceFile, member.name)
            const entry = accessorTypes.get(name) ?? {}
            entry.setter = member.parameters[0].type
            accessorTypes.set(name, entry)
        }
    }

    for (const [name, { getter, setter }] of accessorTypes.entries()) {
        const prop = combineAccessorTypes(sourceFile, name, getter, setter)
        interfaceInfo.properties.push(prop)
    }

    return interfaceInfo
}

function combineAccessorTypes(
    sourceFile: ts.SourceFile,
    propertyName: string,
    getterType?: ts.TypeNode,
    setterType?: ts.TypeNode
): PropertyInfo {
    const getterTypeName = getterType?.getText(sourceFile)
    const setterTypeName = setterType?.getText(sourceFile)
    let type: ts.TypeNode
    let typeName: string
    if (getterType && !setterType) {
        type = getterType
        typeName = getterTypeName!
    } else if (!getterType && setterType) {
        type = setterType
        typeName = setterTypeName!
    } else if (getterTypeName === setterTypeName) {
        type = getterType!
        typeName = getterTypeName!
    } else {
        type = ts.factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword)
        typeName = `any`
    }
    const computed = /^\s*Symbol\./.test(propertyName)
    return { name: propertyName, type, typeName, optional: false, computed }
}

function processProperty(
    sourceFile: ts.SourceFile,
    node: ts.PropertySignature
): PropertyInfo {
    const name = getPropertyName(sourceFile, node.name)
    const type = node.type
    const typeName = getTypeName(sourceFile, type)
    const optional = !!node.questionToken
    const computed = ts.isComputedPropertyName(node.name)
    return { name, type, typeName, optional, computed }
}

function processMethod(
    sourceFile: ts.SourceFile,
    node: ts.MethodSignature
): MethodInfo {
    const name = getPropertyName(sourceFile, node.name)
    const computed = ts.isComputedPropertyName(node.name)

    return { name, computed }
}

function getPropertyName(
    sourceFile: ts.SourceFile,
    name: ts.PropertyName | undefined
): string {
    if (!name) return 'unknown'
    if (ts.isComputedPropertyName(name)) {
        return name.expression.getText(sourceFile)
    }
    return name.getText(sourceFile)
}

function getTypeName(
    sourceFile: ts.SourceFile,
    type: ts.TypeNode | undefined
): string {
    return type == null ? 'any' : type.getText(sourceFile)
}

function generateMockClass({
    interfaceInfo,
    options,
    checker,
}: {
    interfaceInfo: InterfaceInfo
    options: MockGeneratorOptions
    checker: ts.TypeChecker
}): string {
    const typeParams =
        interfaceInfo.typeParameters.length > 0
            ? `<${interfaceInfo.typeParameters.join(', ')}>`
            : ''
    let content = `export class Mock${interfaceInfo.name}${typeParams} implements ${interfaceInfo.interfaceStr} {\n`

    if (options.initializeMockClass)
        content += options.initializeMockClass(interfaceInfo)

    if (interfaceInfo.indexSignature) {
        content += `    [key: ${interfaceInfo.indexSignature.keyType}]: ${interfaceInfo.indexSignature.valueType};\n\n`
    }

    for (const prop of interfaceInfo.properties) {
        const optional = prop.optional ? '?' : ''
        const name = prop.computed ? `[${prop.name}]` : prop.name
        if (prop.type && !prop.optional) {
            const value = getDefaultValueFromTypeNode({
                node: prop.type,
                checker,
            })
            content += `    ${name}${optional}: ${prop.typeName} = ${value};\n`
        }
    }

    if (
        interfaceInfo.properties.length > 0 &&
        interfaceInfo.methods.length > 0
    ) {
        content += '\n'
    }

    const generated = new Set<string>()
    for (const method of interfaceInfo.methods) {
        if (!generated.has(method.name)) {
            generated.add(method.name)
            content += generateMockMethod({
                interfaceInfo,
                method,
                options,
            })
        }
    }

    content += '}\n'
    return content
}

function generateMockMethod({
    interfaceInfo,
    method,
    options,
}: {
    interfaceInfo: InterfaceInfo
    method: MethodInfo
    options: MockGeneratorOptions
}): string {
    const name = method.computed ? `[${method.name}]` : method.name
    const key = method.computed ? method.name : `'${method.name}'`
    return `    ${name} = ${options.createSpyMethod(interfaceInfo, method, key)};\n`
}

export function getDefaultValueFromTypeNode({
    node,
    checker,
}: {
    node: ts.TypeNode
    checker: ts.TypeChecker
}): string {
    if (ts.isUnionTypeNode(node)) {
        const types = node.types.map((t) => checker.getTypeFromTypeNode(t))
        // Process the individual types
        const preferred =
            types.find((t) => !(t.flags & ts.TypeFlags.Object)) ?? types[0]
        return getDefaultValueFromType({
            type: preferred,
            checker,
            visited: new Set(),
        })
    }
    return getDefaultValueFromType({
        type: checker.getTypeFromTypeNode(node),
        checker,
        visited: new Set(),
    })
}

export function getDefaultValueFromType({
    type,
    checker,
    visited,
}: {
    type: ts.Type
    checker: ts.TypeChecker
    visited: Set<ts.Type>
}): string {
    if (visited.has(type)) return 'undefined as any'
    visited.add(type)
    const flags = type.flags

    if (flags & ts.TypeFlags.String) return `''`
    if (flags & ts.TypeFlags.Number) return '0'
    if (flags & ts.TypeFlags.Boolean) return 'false'
    if (flags & ts.TypeFlags.Null) return 'null'
    if (
        flags & ts.TypeFlags.Undefined ||
        flags & ts.TypeFlags.Void ||
        flags & ts.TypeFlags.Any ||
        flags & ts.TypeFlags.Unknown
    )
        return 'undefined'

    if (flags & ts.TypeFlags.StringLiteral) {
        return `'${(type as ts.StringLiteralType).value}'`
    }
    if (flags & ts.TypeFlags.NumberLiteral) {
        return `${(type as ts.NumberLiteralType).value}`
    }
    if (flags & ts.TypeFlags.BooleanLiteral) {
        return checker.typeToString(type)
    }
    if (flags & ts.TypeFlags.BigIntLiteral) {
        const bigInt = type as ts.BigIntLiteralType
        const value = bigInt.value.base10Value
        return bigInt.value.negative ? `-${value}n` : `${value}n`
    }

    if (type.isUnion()) {
        // Process the individual types
        const preferred =
            type.types.find((t) => !(t.flags & ts.TypeFlags.Object)) ??
            type.types[0]
        return getDefaultValueFromType({
            type: preferred,
            checker,
            visited,
        })
    }

    if (flags & ts.TypeFlags.Object) {
        const name = type.symbol.escapedName.toString()
        switch (name) {
            case 'Array':
            case 'ReadonlyArray':
                return '[]'
            case 'Set':
                return 'new Set()'
            case 'Map':
                return 'new Map()'
            case 'WeakSet':
                return 'new WeakSet()'
            case 'WeakMap':
                return 'new WeakMap()'
            case 'Record':
                return '{}'
            case 'Date':
                return 'new Date()'
            case 'RegExp':
                return '/.*/'
            case 'ArrayBuffer':
                return 'new ArrayBuffer(0)'
            case 'SharedArrayBuffer':
                return 'new SharedArrayBuffer(0)'
            case 'DataView':
                return 'new DataView(new ArrayBuffer(0))'
            case 'Uint8Array':
            case 'Uint16Array':
            case 'Uint32Array':
            case 'Int8Array':
            case 'Int16Array':
            case 'Int32Array':
            case 'Float32Array':
            case 'Float64Array':
            case 'BigInt64Array':
            case 'BigUint64Array':
                return `new ${name}(0)`
        }
    }

    return 'undefined as any'
}
