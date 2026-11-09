import { strict as assert } from 'node:assert'
import { schemaOf, unwrapAspNet } from './schema.mjs'
const obj = unwrapAspNet({ d: JSON.stringify([{ X: 106.2, Y: 9.9, Speed: 45, Plate: '51A-...', SecretToken: 'dont-save' }]) })
const s = schemaOf(obj)
assert.deepEqual(s, [{X:'number',Y:'number',Speed:'number',Plate:'string','[sensitive-field]':'redacted'}])
const txt = JSON.stringify(s)
assert(!txt.includes('51A-') && !txt.includes('106.2') && !txt.includes('dont-save'))
console.log('PASS: schema-only output and no raw values')
