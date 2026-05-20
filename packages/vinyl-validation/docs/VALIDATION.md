# Validation

A TypeScript-first validation library for runtime type checking and schema
validation.

## Installation

```bash
npm install @amazon/vinyl-validation
```

## Basic Usage

```typescript
import { string, number, object, array } from '@amazon/vinyl-validation'

// Create validators
const nameValidator = string().notEmpty()
const ageValidator = number().gte(0)

// Validate values
console.log(nameValidator.isValid('John')) // true
console.log(ageValidator.isValid(-5)) // false

// Get validation errors
const errors = nameValidator.validate('')
console.log(errors) // [{ message: 'Expected: not empty, but was: "". At: ', path: [] }]
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

// Literal values
const statusValidator = isOneOf('active', 'inactive', 'pending')

// Instance checking
const dateValidator = instanceOf(Date)
const errorValidator = instanceOf(Error)
```

## String Validation

```typescript
import { string } from '@amazon/vinyl-validation'

const validator = string()
    .notEmpty() // not empty string
    .minLength(3) // at least 3 characters
    .maxLength(50) // at most 50 characters
    .noWhitespace() // no whitespace characters
    .matches(/^[a-z]+$/) // matches regex pattern

// Usage
validator.isValid('hello') // true
validator.isValid('') // false (empty)
validator.isValid('ab') // false (too short)
```

## Number Validation

```typescript
import { number } from '@amazon/vinyl-validation'

const validator = number()
    .gte(0) // greater than or equal to 0
    .gt(0) // greater than 0
    .lte(100) // less than or equal to 100
    .lt(100) // less than 100
    .within(1, 99) // between 1 and 99 (inclusive)
    .safeInteger() // safe integer
    .finite() // finite number

// Usage
validator.isValid(50) // true
validator.isValid(-1) // false (less than 0)
validator.isValid(Infinity) // false (not finite)
```

## Object Validation

```typescript
import { object, string, number } from '@amazon/vinyl-validation'

const userValidator = object({
    name: string().notEmpty(),
    age: number().gte(0),
    email: string().matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
})

// Usage
const user = { name: 'John', age: 30, email: 'john@example.com' }
console.log(userValidator.isValid(user)) // true

// Extend existing schemas
const adminValidator = userValidator.extend({
    role: isOneOf('admin', 'superadmin'),
    permissions: array(string()),
})
```

## Array Validation

```typescript
import { array, string, number, tuple } from '@amazon/vinyl-validation'

// Array of strings
const stringArrayValidator = array(string())

// Array of numbers with constraints
const numberArrayValidator = array(number().gte(0))
    .minLength(1) // at least 1 element
    .maxLength(10) // at most 10 elements
    .notEmpty() // not empty array

// Tuple validation (fixed-length array with specific types)
const coordinateValidator = tuple(number(), number()) // [x, y]
const personValidator = tuple(string(), number(), boolean()) // [name, age, active]

// Usage
stringArrayValidator.isValid(['a', 'b', 'c']) // true
coordinateValidator.isValid([10, 20]) // true
coordinateValidator.isValid([10, 20, 30]) // false (wrong length)
```

## Record Validation

```typescript
import { record, recordValues, string, number } from '@amazon/vinyl-validation'

// Record with string keys and number values
const scoresValidator = recordValues(number().gte(0))

// Record with specific key and value types
const configValidator = record(
    string().matches(/^[A-Z_]+$/), // keys must be uppercase with underscores
    string().notEmpty() // values must be non-empty strings
)

// Usage
scoresValidator.isValid({ alice: 95, bob: 87 }) // true
configValidator.isValid({ API_KEY: 'secret', DB_URL: 'localhost' }) // true
```

## Set Validation

```typescript
import { set, string } from '@amazon/vinyl-validation'

const tagValidator = set(string().notEmpty())

// Usage
tagValidator.isValid(new Set(['tag1', 'tag2'])) // true
tagValidator.isValid(new Set(['tag1', ''])) // false (empty string)
```

## Function Validation

```typescript
import { func } from '@amazon/vinyl-validation'

const functionValidator = func()
    .withArity(2) // exactly 2 parameters
    .withMinArity(1) // at least 1 parameter
    .withMaxArity(3) // at most 3 parameters

// Usage
functionValidator.isValid((a, b) => a + b) // true
functionValidator.isValid(() => 'hello') // false (wrong arity)
```

## Optional and Nullable Values

```typescript
import { string, number } from '@amazon/vinyl-validation'

// Optional (allows undefined)
const optionalName = string().optional()

// Nullable (allows null)
const nullableName = string().nullable()

// Maybe (allows null or undefined)
const maybeName = string().maybe()

// Usage
optionalName.isValid(undefined) // true
nullableName.isValid(null) // true
maybeName.isValid(null) // true
maybeName.isValid(undefined) // true
```

## Combining Validators

### OR Logic

```typescript
import { or, string, number } from '@amazon/vinyl-validation'

const stringOrNumber = or(string(), number())

stringOrNumber.isValid('hello') // true
stringOrNumber.isValid(42) // true
stringOrNumber.isValid(true) // false
```

### AND Logic

```typescript
import { and, string } from '@amazon/vinyl-validation'

const shortUppercaseString = and(
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

// With custom stringify function
const positiveValidator = custom<number>(
    'positive number',
    (input): input is number => typeof input === 'number' && input > 0,
    (input) => `number: ${input}`
)

// Usage
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

console.log(errors)
// [
//   { message: 'Expected: not empty, but was: "". At: name', path: ['name'] },
//   { message: 'Expected: matches /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/, but was: "invalid". At: email', path: ['email'] }
// ]
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
        console.log(error.message) // validation error details
    }
}

// Or use validate() for non-throwing validation
const errors = validator.validate('')
if (errors.length > 0) {
    console.log('Validation failed:', errors)
}
```

## TypeScript Integration

The idiomatic usage is to start with an interface and create a schema for it:

```typescript
import { object, string, number, array } from '@amazon/vinyl-validation'

// Define your interface first
interface User {
    name: string
    age?: number
    tags: string[]
}

// Create a validator that matches the interface
const userValidator = object<User>({
    name: string(),
    age: number().optional(),
    tags: array(string()),
})

// Type-safe validation
function processUser(data: unknown) {
    if (userValidator.isValid(data)) {
        // data is now typed as User
        console.log(data.name) // TypeScript knows this is a string
    }
}
```
