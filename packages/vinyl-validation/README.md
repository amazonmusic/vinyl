# @amazon/vinyl-validation

[![Website](https://img.shields.io/badge/website-amazonmusic.github.io%2Fvinyl-blue)](https://amazonmusic.github.io/vinyl)
[![npm](https://img.shields.io/npm/v/@amazon/vinyl-validation.svg)](https://www.npmjs.com/package/@amazon/vinyl-validation)
[![size](https://img.shields.io/bundlejs/size/@amazon/vinyl-validation.svg?label=size)](https://bundlejs.com/?q=@amazon/vinyl-validation)

A TypeScript-first validation library for runtime type checking and schema
validation. Composable validators for primitives, objects, arrays, sets,
records, tuples, functions, and unions, with strong inference of the result
type.

## Install

```shell
npm install @amazon/vinyl-validation
```

## Basic Usage

```typescript
import { string, number } from '@amazon/vinyl-validation'

const nameValidator = string().notEmpty()
const ageValidator = number().gte(0)

nameValidator.isValid('John') // true
ageValidator.isValid(-5) // false

// Get validation errors
const errors = nameValidator.validate('')
// [{ message: 'Expected: not empty, but was: "". At: ', path: [] }]
```

## Core Validators

### Primitive Types

```typescript
import { string, number, boolean, symbol, any } from '@amazon/vinyl-validation'

const stringValidator = string()
const numberValidator = number()
const booleanValidator = boolean()
const symbolValidator = symbol()
const anyValidator = any() // accepts any value
```

### Null and Undefined

```typescript
import {
    exactlyNull,
    exactlyUndefined,
    nullish,
} from '@amazon/vinyl-validation'

const nullValidator = exactlyNull() // only null
const undefinedValidator = exactlyUndefined() // only undefined
const nullishValidator = nullish() // null or undefined
```

### Value Matching

```typescript
import { isOneOf, instanceOf } from '@amazon/vinyl-validation'

const statusValidator = isOneOf('active', 'inactive', 'pending')

const dateValidator = instanceOf(Date)
const errorValidator = instanceOf(Error)
```

## String Validation

```typescript
import { string } from '@amazon/vinyl-validation'

const validator = string()
    .notEmpty()
    .minLength(3)
    .maxLength(50)
    .noWhitespace()
    .matches(/^[a-z]+$/)

validator.isValid('hello') // true
validator.isValid('') // false (empty)
validator.isValid('ab') // false (too short)
```

## Number Validation

```typescript
import { number } from '@amazon/vinyl-validation'

const validator = number().gte(0).lte(100).within(1, 99).safeInteger().finite()

validator.isValid(50) // true
validator.isValid(-1) // false (less than 0)
validator.isValid(Infinity) // false (not finite)
```

## Object Validation

```typescript
import {
    object,
    string,
    number,
    isOneOf,
    array,
} from '@amazon/vinyl-validation'

const userValidator = object({
    name: string().notEmpty(),
    age: number().gte(0),
    email: string().matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
})

const user = { name: 'John', age: 30, email: 'john@example.com' }
userValidator.isValid(user) // true

// Extend existing schemas
const adminValidator = userValidator.extend({
    role: isOneOf('admin', 'superadmin'),
    permissions: array(string()),
})
```

## Array Validation

```typescript
import { array, string, number, tuple, boolean } from '@amazon/vinyl-validation'

const stringArrayValidator = array(string())

const numberArrayValidator = array(number().gte(0))
    .minLength(1)
    .maxLength(10)
    .notEmpty()

// Tuples (fixed-length, positional)
const coordinateValidator = tuple(number(), number()) // [x, y]
const personValidator = tuple(string(), number(), boolean()) // [name, age, active]

stringArrayValidator.isValid(['a', 'b', 'c']) // true
coordinateValidator.isValid([10, 20]) // true
coordinateValidator.isValid([10, 20, 30]) // false (wrong length)
```

## Record Validation

```typescript
import { record, recordValues, string, number } from '@amazon/vinyl-validation'

const scoresValidator = recordValues(number().gte(0))

const configValidator = record(
    string().matches(/^[A-Z_]+$/),
    string().notEmpty()
)

scoresValidator.isValid({ alice: 95, bob: 87 }) // true
configValidator.isValid({ API_KEY: 'secret', DB_URL: 'localhost' }) // true
```

## Set Validation

```typescript
import { set, string } from '@amazon/vinyl-validation'

const tagValidator = set(string().notEmpty())

tagValidator.isValid(new Set(['tag1', 'tag2'])) // true
tagValidator.isValid(new Set(['tag1', ''])) // false (empty string)
```

## Function Validation

```typescript
import { func } from '@amazon/vinyl-validation'

const functionValidator = func().withArity(2).withMinArity(1).withMaxArity(3)

functionValidator.isValid((a, b) => a + b) // true
functionValidator.isValid(() => 'hello') // false (wrong arity)
```

## Optional and Nullable Values

```typescript
import { string } from '@amazon/vinyl-validation'

const optionalName = string().optional() // allows undefined
const nullableName = string().nullable() // allows null
const maybeName = string().maybe() // allows null or undefined

optionalName.isValid(undefined) // true
nullableName.isValid(null) // true
maybeName.isValid(null) // true
maybeName.isValid(undefined) // true
```

## Combining Validators

### OR Logic

```typescript
import { orValidators, string, number } from '@amazon/vinyl-validation'

const stringOrNumber = orValidators(string(), number())

stringOrNumber.isValid('hello') // true
stringOrNumber.isValid(42) // true
stringOrNumber.isValid(true) // false
```

### AND Logic

```typescript
import { andValidators, string } from '@amazon/vinyl-validation'

const shortUppercaseString = andValidators(
    string().maxLength(10),
    string().matches(/^[A-Z]+$/)
)

shortUppercaseString.isValid('HELLO') // true
shortUppercaseString.isValid('hello') // false (not uppercase)
shortUppercaseString.isValid('VERYLONGSTRING') // false (too long)
```

## Custom Validators

```typescript
import { custom } from '@amazon/vinyl-validation'

const evenNumberValidator = custom<number>(
    'even number',
    (input): input is number => typeof input === 'number' && input % 2 === 0
)

evenNumberValidator.isValid(4) // true
evenNumberValidator.isValid(3) // false
```

## Validation Options

```typescript
import { string, object } from '@amazon/vinyl-validation'

const validator = object({
    name: string().notEmpty(),
    email: string().matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
})

// Collect all errors (default: stop at first error)
const errors = validator.validate({ name: '', email: 'invalid' }, { all: true })
```

## Error Handling

```typescript
import { ValidationError } from '@amazon/vinyl-util'
import { string } from '@amazon/vinyl-validation'

const validator = string().notEmpty()

try {
    validator.assert('') // throws ValidationError if invalid
} catch (error) {
    if (error instanceof ValidationError) {
        console.log(error.message)
    }
}
```

## TypeScript Integration

```typescript
import { object, string, number, array } from '@amazon/vinyl-validation'

interface User {
    name: string
    age?: number
    tags: string[]
}

const userValidator = object<User>({
    name: string(),
    age: number().optional(),
    tags: array(string()),
})

function processUser(data: unknown) {
    if (userValidator.isValid(data)) {
        console.log(data.name) // typed as string
    }
}
```

## License

Apache-2.0
