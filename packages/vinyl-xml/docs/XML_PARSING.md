# XML Parsing

Amazon Vinyl provides a fast way to parse XML documents into a type-safe object
that is validated against an XSD schema.

To create a parser for a schema, first create the Type definitions for the shape
of the document.

There are many ways to do this, for the Dash 2011 schema we used
[CXSD](https://github.com/charto/cxsd) (MIT Licensed). Take the type
definitions, and discard their generated parser.

Using the type definitions we can build a ruleset following the XSD. This is a
manual process; follow the XSD closely to match min/max occurrences, defaults,
and required attributes.

MPDType example, following the
[MPDType definition](https://github.com/Dash-Industry-Forum/MPEG-Conformance-and-reference-source/blob/master/conformance/MPDValidator/schemas/DASH-MPD.xsd):

```typescript
const mpdType: XmlRules<MPDtype> = {
    ProgramInformation: elements(programInformationType),
    BaseURL: elements(baseURLType),
    Location: elements({ _content: charactersString }),
    Period: elements(periodType, { minOccurs: 1 }),
    Metrics: elements(metricsType),
    EssentialProperty: elements(descriptorType),
    SupplementalProperty: elements(descriptorType),
    UTCTiming: elements(descriptorType),
    availabilityEndTime: attrDateTime,
    availabilityStartTime: attrDateTime,
    id: attrString,
    maxSegmentDuration: attr(parseDuration, stringifyDuration),
    maxSubsegmentDuration: attr(parseDuration, stringifyDuration),
    mediaPresentationDuration: attr(parseDuration, stringifyDuration),
    minBufferTime: attr(parseDuration, stringifyDuration, { required: true }),
    minimumUpdatePeriod: attr(parseDuration, stringifyDuration),
    profiles: attr(parseProfiles, stringifyProfiles, { required: true }),
    publishTime: attrDateTime,
    suggestedPresentationDelay: attr(parseDuration, stringifyDuration),
    timeShiftBufferDepth: attr(parseDuration, stringifyDuration),
    type: attr(parsePresentationTypeType, stringify, {
        default: 'static',
    } as const),
} as const
```

_Style note - abbreviations should be cased as they are in the XSD, this follows
the exception noted in the
[TS style guide](https://google.github.io/styleguide/tsguide.html#identifiers-abbreviations)
we follow._

`XmlRules` definitions are meant to be human-readable and easy for the
TypeScript compiler to validate that the rule matches the type definition.
Before this rule set can be used by the parser or stringifier, it must be mapped
to a more performant machine-friendly version.

Map the rules using `mapXmlRules`:

```typescript
const dashDrmRulesMapped = mapXmlRules(dashDrmRules)
```

XmlRules maps XML content to a typed object using the following four rules:

- `attr` Attributes
- `element` Elements with a max occurrence of 1.
- `elements` Elements, as an array.
- `characters` Text nodes (concatenated).

Attribute and characters handlers provide parse and stringify functions to
serialize/deserialize the value from the XML.

From the ruleset, we can create an XML handler for the SAX parser:

```typescript
const dashManifestHandler = new ParseXmlHandlerImpl(dashDrmRulesMapped)
```

_Concurrency note: A handler is stateful while parsing a document, so if there
are multiple workers parsing documents simultaneously, a handler per worker
thread must be created._

With the handler now we can parse XML into a validated type-safe object matching
our type definition.

```typescript
export function parseDashManifest(manifest: string): DashDrmManifest {
    return parseXml(manifest, dashManifestHandler)
}
```

The overall process is as follows:

`parseXml` is given an XML string, and a content handler. A content handler
abstractly provides methods for opening and closing XML nodes. Based on an XSD
schema, we can build a content handler `XmlRules` that knows how each node
should be processed.

At a low level, `parseXml` uses `StringParser` to read XML content. As elements
are opened and closed, and attributes or text nodes are read, the corresponding
content handler method is invoked. Validating against the schema rules as the
document is read gives the added benefit of knowing the exact XML source
location of the invalid document.

## Namespaces

Namespaces are not optional, if an XSD schema uses a namespace, the namespace
must be defined in the rules.

For example:

```typescript
export const dashNamespaceUri = 'urn:mpeg:dash:schema:mpd:2011'

export const dashManifestXmlRules: XmlRules<DashManifest> = {
    MPD: element(mpdType, {
        required: true,
        namespaceUri: dashNamespaceUri,
    }),
} as const
```

Namespaces follow correct scoping and defaulting rules.

https://www.w3.org/TR/REC-xml-names/

For XmlRules, namespaces inherit that of the parent rule unless overridden. When
using `stringifyXml`, defining namespace prefixes is supported, but optional. If
a prefix isn't specified, one will be generated if the default namespace isn't
used.

## Merging Schemas

In many cases, an XML document has multiple XSD definitions.

These can be merged using `mergeXmlRules`.

Example:

```typescript
const dashDrmRules = mergeXmlRules(
    dashManifestXmlRules,
    createDashProtectionXmlRules(cencXmlRules),
    createDashProtectionXmlRules(playreadyXmlRules)
)
```

The `mergeXmlRules` utility ensures that the combined schema definitions are
compatible. When the rules represent separate XSD schemas with different
namespace uris, there generally isn't overlap.

## Stringify

`XmlRules` provides both deserializers and serializers, so the same mapped
ruleset can be used in both the content handler for `parseXml` and
`stringifyXml`.

```typescript
stringifyXml(xmlString, dashDrmRulesMapped)
```

### Element Ordering

In an XML Schema, order matters for `xs:sequence` definitions. Amazon Vinyl
`XmlRules` maps define properties in this order. This doesn't matter for
parsing, but it does for serialization to pass schema. This means that
serialization relies on the ES6 requirement that object keys are ordered by
insertion. Many ES5 browsers also follow this rule, but this means that
`xmlStringify` will not be to spec for browsers not following this requirement.
XML serialization is not required for playback, only deserialization.

## Limitations

The parser currently ignores processing instructions and supports only the
default standard XML entities. This isn't a necessary feature for our purposes.

## Parent References

Parsed XML nodes have a reference to their parent elements in the assigned
attribute `parent`. These references are non-enumerable and will be correctly
reassigned when using the `clone` utility. They will not be included if
serialized using `JSON.stringify`. Type definitions may include a `parent`
definition. The type is not enforced by the rule-sets and is expected to
correspond to the type of parent to which the element may belong, or it may
simply be typed as `any`.

## Name Conflicts

In certain edge cases, an XSD may describe element or attribute rules that
cannot be mapped 1:1 with property names. Cases include:

- If the child element or attribute name is an ES6 reserved word such as
  `public`, `private`, `get`, `set`, etc.
- If the name is an internally used reserved word: `parent` or `clone`.
- If a child element local name matches an attribute name. In these cases, when
  defining an XML rule, choose a different property name, and provide a
  'localPart' value to the rule configuration.

For example:

```typescript
import { attrString } from '@amazon/vinyl-xml'

type MyType = { _parent: string }

export const myXmlRules: XmlRules<MyType> = {
    _parent: attrString({ localPart: 'parent' }),
} as const
```
