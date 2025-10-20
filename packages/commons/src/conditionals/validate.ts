/* eslint-disable max-lines */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * OpenCRVS is also distributed under the terms of the Civil Registration
 * & Healthcare Disclaimer located at http://opencrvs.org/license.
 *
 * Copyright (C) The OpenCRVS Authors located at https://github.com/opencrvs/opencrvs-core/blob/master/AUTHORS.
 */

import Ajv from 'ajv/dist/2019'
import addFormats from 'ajv-formats'
import { ConditionalParameters, JSONSchema } from './conditionals'
import { formatISO, isAfter, isBefore } from 'date-fns'
import { ErrorMapCtx, z, ZodIssueOptionalMessage } from 'zod'
import { ActionUpdate, EventState } from '../events/ActionDocument'
import { ConditionalType, FieldConditional } from '../events/Conditional'
import { FieldConfig } from '../events/FieldConfig'
import { mapFieldTypeToZod } from '../events/FieldTypeMapping'
import { FieldUpdateValue } from '../events/FieldValue'
import { TranslationConfig } from '../events/TranslationConfig'
import { UUID } from '../uuid'
import { medicalAbbreviations } from './abbreviation'
import { illDefinedConditions } from './ill-defined'

const ajv = new Ajv({
  $data: true,
  allowUnionTypes: true,
  strict: false // Allow minContains and other newer features
})

const DataContext = z.object({
  rootData: z.object({
    $leafAdminStructureLocationIds: z.array(z.object({ id: UUID }))
  })
})

type DataContext = z.infer<typeof DataContext>

// https://ajv.js.org/packages/ajv-formats.html
addFormats(ajv)

/*
 * Custom keyword validator for date strings so the dates could be validated dynamically
 * For example, a validation could be "birth date needs to have happend 30 days before today"
 * or "death date needs to be after birth date + 30 days"
 *
 * Example schema:
 * {
 *   "type": "object",
 *   "properties": {
 *     "birthDate": {
 *       "type": "string",
 *       "daysFromNow": {
 *         "days": 30,
 *         "clause": "before"
 *       }
 *    }
 * }
 */
ajv.addKeyword({
  keyword: 'daysFromNow',
  type: 'string',
  schemaType: 'object',
  $data: true,
  errors: true,
  validate(
    schema: { days: number; clause: 'after' | 'before' },
    data: string,
    _: unknown,
    dataContext?: { rootData: unknown }
  ) {
    if (
      !(
        dataContext &&
        dataContext.rootData &&
        typeof dataContext.rootData === 'object' &&
        '$now' in dataContext.rootData &&
        typeof dataContext.rootData.$now === 'string'
      )
    ) {
      throw new Error('Validation context must contain $now')
    }

    const { days, clause } = schema
    if (typeof data !== 'string') {
      return false
    }

    const date = new Date(data)
    if (isNaN(date.getTime())) {
      return false
    }

    const now = new Date(dataContext.rootData.$now)
    const offsetDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

    return clause === 'after'
      ? isAfter(date, offsetDate)
      : isBefore(date, offsetDate)
  }
})

ajv.addKeyword({
  keyword: 'isLeafLevelLocation',
  type: 'string',
  schemaType: 'boolean',
  $data: true,
  errors: true,
  // @ts-ignore -- Force type. We will move this away from AJV next. Parsing the array will take seconds and is only called by core.
  validate(schema: {}, data: string, _: unknown, dataContext?: DataContext) {
    const locationIdInput = data

    const locations = dataContext?.rootData.$leafAdminStructureLocationIds ?? []

    return locations.some((location) => location.id === locationIdInput)
  }
})

ajv.addKeyword({
  keyword: 'sumOf',
  type: 'object',
  schemaType: 'object',
  errors: true,
  validate(schema: any, data: any) {
    const { sum, field1, field2 } = schema

    const total = data?.[sum]
    const num1 = data?.[field1]
    const num2 = data?.[field2]

    if (
      typeof total !== 'number' ||
      typeof num1 !== 'number' ||
      typeof num2 !== 'number'
    ) {
      return true
    }

    // Check if total === num1 + num2
    const valid = total === num1 + num2
    return valid
  }
})

ajv.addKeyword({
  keyword: 'isAbbreviation',
  type: 'string',
  schemaType: 'boolean',
  errors: true,
  validate(schema: boolean, data: string) {
    if (!schema) return true

    if (typeof data !== 'string') {
      return true
    }

    const items = data
      .split(',')
      .map((item) => item.replace(/\./g, '').trim().toUpperCase())

    const foundAbbreviation = items.filter((item) =>
      medicalAbbreviations.some((abbr) => abbr.code.toUpperCase() === item)
    )

    if (foundAbbreviation.length && foundAbbreviation.length > 0) {
      return false
    }

    return true
  }
})

ajv.addKeyword({
  keyword: 'isIllDefined',
  type: 'object',
  schemaType: 'object',
  errors: true,
  validate(schema: { fields: string[]; threshold: number }, data: any) {
    const { fields, threshold } = schema
    if (!data || typeof data !== 'object') return true

    const causesOfDeath: string[] = fields
      .flatMap((field) =>
        (data?.[field] || '')
          .split(',')
          .map((v: string) => v.trim())
          .filter(Boolean)
      )
      .filter((val, index, self) => self.indexOf(val) === index)

    if (causesOfDeath.length === 0) return true

    // const illDefinedMatches: string[] = []
    let hasNonIllDefined = false

    for (const term of causesOfDeath) {
      const results = fuzzySearch(term, illDefinedConditions, threshold).filter(
        (entry) => entry.score >= 0 && entry.score < threshold
      )

      // if (results.length > 0) {
      //   illDefinedMatches.push(`${term}`)
      // }
      if (results.length === 0) {
        // Found at least one term that's NOT ill-defined
        hasNonIllDefined = true
        break
      }
    }

    return hasNonIllDefined
  }
})

ajv.addKeyword({
  keyword: 'checkChildName',
  type: 'object',
  schemaType: 'boolean', // 👈 schema is just true/false
  errors: true,
  validate(schema: boolean, data: any) {
    console.log(data)
    // if (!schema) return true // if keyword is false, skip validation

    // const childName = data?.childName
    // const fatherLastName = data?.fatherLastName
    // const motherLastName = data?.motherLastName

    // if (!childName) return true // allow empty name

    // const normalize = (v: string) => (v || '').trim().toLowerCase()

    // const child = normalize(childName)
    // const father = normalize(fatherLastName)
    // const mother = normalize(motherLastName)

    // const valid = child !== father && child !== mother

    // if (!valid) {
    //   (validate as any).errors = [
    //     {
    //       keyword: 'checkChildName',
    //       message: "Child's name should not match father's or mother's last name"
    //     }
    //   ]
    // }

    return true
  }
})

export function validate(schema: JSONSchema, data: ConditionalParameters) {
  const validator = ajv.getSchema(schema.$id) || ajv.compile(schema)

  const result = validator(data) as boolean

  return result
}

export function isOnline() {
  if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
    return navigator.onLine
  }
  // Server-side: assume always online
  return true
}

export function isConditionMet(
  conditional: JSONSchema,
  values: Record<string, unknown>
) {
  return validate(conditional, {
    $form: values,
    $now: formatISO(new Date(), { representation: 'date' }),
    $online: isOnline()
  })
}

function getConditionalActionsForField(
  field: FieldConfig,
  values: ConditionalParameters
) {
  if (!field.conditionals) {
    return []
  }
  return field.conditionals
    .filter((conditional) => validate(conditional.conditional, values))
    .map((conditional) => conditional.type)
}

export function areConditionsMet(
  conditions: FieldConditional[],
  values: Record<string, unknown>
) {
  return conditions.every((condition) =>
    isConditionMet(condition.conditional, values)
  )
}

function isFieldConditionMet(
  field: FieldConfig,
  form: ActionUpdate | EventState,
  conditionalType: ConditionalType
) {
  const hasRule = (field.conditionals ?? []).some(
    (conditional) => conditional.type === conditionalType
  )

  if (!hasRule) {
    return true
  }

  const validConditionals = getConditionalActionsForField(field, {
    $form: form,
    $now: formatISO(new Date(), {
      representation: 'date'
    }),
    $online: isOnline()
  })

  return validConditionals.includes(conditionalType)
}

export function isFieldVisible(
  field: FieldConfig,
  form: ActionUpdate | EventState
) {
  return isFieldConditionMet(field, form, ConditionalType.SHOW)
}

export function getOnlyVisibleFormValues(
  field: FieldConfig[],
  form: EventState
) {
  return field.reduce((acc, f) => {
    if (isFieldVisible(f, form) && form[f.id] !== undefined) {
      acc[f.id] = form[f.id]
    }
    return acc
  }, {} as EventState)
}

function isFieldEmptyAndNotRequired(field: FieldConfig, form: ActionUpdate) {
  const fieldValue = form[field.id]
  return !field.required && (fieldValue === undefined || fieldValue === '')
}

export function isFieldEnabled(
  field: FieldConfig,
  form: ActionUpdate | EventState
) {
  return isFieldConditionMet(field, form, ConditionalType.ENABLE)
}

// Fields are displayed on review if both the 'ConditionalType.SHOW' and 'ConditionalType.DISPLAY_ON_REVIEW' conditions are met
export function isFieldDisplayedOnReview(
  field: FieldConfig,
  form: ActionUpdate | EventState
) {
  return (
    isFieldVisible(field, form) &&
    isFieldConditionMet(field, form, ConditionalType.DISPLAY_ON_REVIEW)
  )
}

export const errorMessages = {
  hiddenField: {
    id: 'error.hidden',
    defaultMessage: 'Hidden or disabled field should not receive a value',
    description:
      'Error message when field is hidden or disabled, but a value was received'
  },
  invalidDate: {
    defaultMessage: 'Invalid date field',
    description: 'Error message when date field is invalid',
    id: 'error.invalidDate'
  },
  invalidEmail: {
    defaultMessage: 'Invalid email address',
    description: 'Error message when email address is invalid',
    id: 'error.invalidEmail'
  },
  requiredField: {
    defaultMessage: 'Required',
    description: 'Error message when required field is missing',
    id: 'error.required'
  },
  invalidInput: {
    defaultMessage: 'Invalid input',
    description: 'Error message when generic field is invalid',
    id: 'error.invalid'
  },
  unexpectedField: {
    defaultMessage: 'Unexpected field',
    description: 'Error message when field is not expected',
    id: 'error.unexpectedField'
  },
  correctionNotAllowed: {
    defaultMessage: 'Correction not allowed for field',
    description: 'Error message when correction is not allowed for field',
    id: 'error.correctionNotAllowed'
  }
}

function createIntlError(message: TranslationConfig) {
  return {
    message: {
      message
    }
  }
}

/**
 * Form error message definitions for Zod validation errors.
 * Overrides zod internal type error messages (string) to match the OpenCRVS error messages (TranslationConfig).
 */
function zodToIntlErrorMap(issue: ZodIssueOptionalMessage, _ctx: ErrorMapCtx) {
  // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
  switch (issue.code) {
    case 'invalid_string': {
      if (_ctx.data === '') {
        return createIntlError(errorMessages.requiredField)
      }

      if (issue.validation === 'date') {
        return createIntlError(errorMessages.invalidDate)
      }

      if (issue.validation === 'email') {
        return createIntlError(errorMessages.invalidEmail)
      }

      break
    }

    case 'invalid_type': {
      if (
        issue.expected !== issue.received &&
        (issue.received === 'undefined' || issue.received === 'null')
      ) {
        return createIntlError(errorMessages.requiredField)
      }

      break
    }
    case 'too_small': {
      if (issue.message === undefined) {
        return createIntlError(errorMessages.requiredField)
      }

      break
    }
    case 'invalid_union': {
      for (const { issues } of issue.unionErrors) {
        for (const e of issues) {
          if (
            zodToIntlErrorMap(e, _ctx).message.message.id !== 'error.required'
          ) {
            return createIntlError(errorMessages.invalidInput)
          }
        }
      }
      return createIntlError(errorMessages.requiredField)
    }
  }

  return createIntlError(errorMessages.invalidInput)
}

/**
 * Custom error map for Zod to override the default error messages in intl-formik format.
 */
export type CustomZodToIntlErrorMap = {
  /** Zod by default expects { message: string } */
  message: {
    /** Override it to match current intl-formik model */
    message: TranslationConfig
  }
}

/**
 * Each field can have custom validations defined in the field configuration.
 * It is separate from standard field type validations. e.g. "is this a valid date" vs "is this date in the future"
 * @see validateFieldInput
 * @returns list of error messages for the field
 *
 */
function runCustomFieldValidations({
  field,
  conditionalParameters
}: {
  field: FieldConfig
  conditionalParameters: ConditionalParameters
}) {
  return (field.validation ?? [])
    .filter((validation) => {
      return !validate(validation.validator, conditionalParameters)
    })
    .map((validation) => ({ message: validation.message }))
}

/**
 * Validates primitive fields defined by the FieldConfig type.
 * e.g. email is proper format, date is a valid date, etc.
 * for custom validations @see runCustomFieldValidations
 */
export function validateFieldInput({
  field,
  value
}: {
  field: FieldConfig
  value: FieldUpdateValue
}) {
  const zodType = mapFieldTypeToZod(field.type, field.required)
  // @ts-expect-error
  const rawError = zodType.safeParse(value, { errorMap: zodToIntlErrorMap })

  // We have overridden the standard error messages
  return (rawError.error?.issues.map((issue) => issue.message) ??
    []) as unknown as {
    message: TranslationConfig
  }[]
}

export function runStructuralValidations({
  field,
  values
}: {
  field: FieldConfig
  values: ActionUpdate
}) {
  if (
    !isFieldVisible(field, values) ||
    isFieldEmptyAndNotRequired(field, values)
  ) {
    return {
      errors: []
    }
  }

  const fieldValidationResult = validateFieldInput({
    field,
    value: values[field.id]
  })

  return {
    errors: fieldValidationResult
  }
}

export function runFieldValidations({
  field,
  values,
  context
}: {
  field: FieldConfig
  values: ActionUpdate
  context?: { leafAdminStructureLocationIds: Array<{ id: UUID }> }
}) {
  if (
    !isFieldVisible(field, values) ||
    isFieldEmptyAndNotRequired(field, values)
  ) {
    return {
      errors: []
    }
  }

  const conditionalParameters = {
    $form: values,
    $now: formatISO(new Date(), { representation: 'date' }),
    /**
     * In real use cases, there can be hundreds of thousands of locations.
     * Make sure that the context contains only the locations that are needed for validation.
     * E.g. if the user is a leaf admin, only the leaf locations under their admin structure are needed.
     *
     * Loading few megabytes of locations to memory just for validation is not efficient and will choke the application.
     */
    $leafAdminStructureLocationIds:
      context?.leafAdminStructureLocationIds ?? [],
    $online: isOnline()
  }

  const fieldValidationResult = validateFieldInput({
    field,
    value: values[field.id]
  })

  const customValidationResults = runCustomFieldValidations({
    field,
    conditionalParameters
  })

  return {
    // Assumes that custom validation errors are based on the field type, and extend the validation.
    errors: [...fieldValidationResult, ...customValidationResults]
  }
}

export function getValidatorsForField(
  fieldId: FieldConfig['id'],
  validations: NonNullable<FieldConfig['validation']>
): NonNullable<FieldConfig['validation']> {
  return validations
    .map(({ validator, message }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const jsonSchema = validator as any

      const $form = jsonSchema.properties.$form

      /*
       * If you are working with nested "composite fields" like address or name,
       * It is useful to change the validation to only include the specific fields without the parent layer
       * for the full form field so
       *
       * {'some.field.id': {'properties': {a: Validator, b: Validator}}} will be transformed to
       * {a: Validator, b: Validator}
       */
      if ($form.properties?.[fieldId]?.type === 'object') {
        return {
          message,
          validator: {
            ...jsonSchema,
            properties: {
              $form: {
                type: 'object',
                properties: $form.properties?.[fieldId]?.properties || {},
                required: $form.properties?.[fieldId]?.required || []
              }
            }
          }
        }
      }

      if (!$form.properties?.[fieldId]) {
        return null
      }

      return {
        message,
        validator: {
          ...jsonSchema,
          $id: jsonSchema.$id + '.' + fieldId,
          properties: {
            $form: {
              type: 'object',
              properties: {
                [fieldId]: $form.properties?.[fieldId]
              },
              required: $form.required?.includes(fieldId) ? [fieldId] : []
            }
          }
        }
      }
    })
    .filter((x) => x !== null) as NonNullable<FieldConfig['validation']>
}

export function areCertificateConditionsMet(
  conditions: FieldConditional[],
  values: Record<string, unknown>
) {
  return conditions.every((condition) => {
    return ajv.validate(condition.conditional, values)
  })
}

function levenshtein(a: string, b: string): number {
  const tmp: number[][] = []

  for (let i = 0; i <= a.length; i++) {
    tmp[i] = [i]
  }

  for (let j = 0; j <= b.length; j++) {
    tmp[0][j] = j
  }

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      tmp[i][j] = Math.min(
        tmp[i - 1][j] + 1, // deletion
        tmp[i][j - 1] + 1, // insertion
        tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1) // substitution
      )
    }
  }

  return tmp[a.length][b.length]
}

function fuzzySearch(
  query: string,
  list: string[],
  threshold: number,
  limit = 3
): { item: string; score: number }[] {
  const COMMON_WORDS = new Set([
    'failure',
    'disease',
    'syndrome',
    'acute',
    // 'chronic',
    'unspecified',
    // 'undetermine',
    'shock'
  ])

  const normalize = (str: string) =>
    str
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // remove punctuation
      .trim()

  const tokenize = (str: string) =>
    normalize(str)
      .split(/\s+/)
      .filter((w) => w.length >= 3)

  const queryWords = tokenize(query)

  if (queryWords.length === 0) return []

  const results: { item: string; score: number }[] = []

  for (const item of list) {
    const itemWords = tokenize(item)

    // Fast exact match
    if (normalize(query) === normalize(item)) {
      results.push({ item, score: 0 })
      break
    }

    let totalScore = 0
    let matchCount = 0
    let largeMismatchFound = false

    for (const qWord of queryWords) {
      let bestScore = Infinity

      for (const iWord of itemWords) {
        const dist = levenshtein(qWord, iWord)
        const normDist = dist / Math.max(qWord.length, iWord.length)

        if (normDist < bestScore) bestScore = normDist
      }

      if (bestScore !== Infinity) {
        const weight = COMMON_WORDS.has(qWord) ? 0.5 : 1
        totalScore += bestScore * weight
        matchCount++

        // Apply a large mismatch penalty early
        if (bestScore > 0.4) {
          // If there's a significant mismatch, apply early penalty
          largeMismatchFound = true
          totalScore += 0.5 // Apply additional penalty to the score
        }
      }
    }

    if (matchCount > 0) {
      const avgScore = totalScore / matchCount

      // If we detected a large mismatch, add a penalty to the final score
      if (largeMismatchFound) {
        results.push({ item, score: avgScore + 0.5 }) // Boost the score if mismatch was too large
      } else {
        if (avgScore <= threshold) {
          results.push({ item, score: avgScore })
        }
      }
    }
  }

  return results.sort((a, b) => a.score - b.score).slice(0, limit)
}
