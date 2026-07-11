import type { ConditionGroup, ConditionClause, StoryVariable } from '@editor/types/editor'

function generateId(): string {
  return Math.random().toString(36).slice(2, 11)
}

function escapeStringValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function formatClauseValue(clause: ConditionClause): string {
  if (clause.valueType === 'string') {
    return `'${escapeStringValue(String(clause.value))}'`
  }
  if (clause.valueType === 'boolean') {
    return clause.value ? 'true' : 'false'
  }
  return String(clause.value)
}

function buildClauseExpression(clause: ConditionClause): string {
  const varName = clause.variable
  const value = formatClauseValue(clause)

  switch (clause.operator) {
    case 'contains':
      return `${varName}.includes(${value})`
    case 'startsWith':
      return `${varName}.startsWith(${value})`
    case 'endsWith':
      return `${varName}.endsWith(${value})`
    case '==':
      return `${varName} === ${value}`
    case '!=':
      return `${varName} !== ${value}`
    default:
      return `${varName} ${clause.operator} ${value}`
  }
}

export function buildExpression(groups: ConditionGroup[]): string {
  if (!groups || groups.length === 0) {
    return ''
  }

  const groupExpressions: string[] = []

  for (const group of groups) {
    if (!group.clauses || group.clauses.length === 0) {
      continue
    }

    const clauseExpressions = group.clauses.map(buildClauseExpression)
    const groupExpr = clauseExpressions.join(group.logic === 'AND' ? ' && ' : ' || ')

    if (group.clauses.length > 1 && groups.length > 1) {
      groupExpressions.push(`(${groupExpr})`)
    } else {
      groupExpressions.push(groupExpr)
    }
  }

  if (groupExpressions.length === 0) {
    return ''
  }

  return groupExpressions.join(' && ')
}

interface ParsedClause {
  variable: string
  operator: string
  value: string | number | boolean
  valueType: 'string' | 'number' | 'boolean'
}

function tokenizeSimple(expr: string): string[] {
  const tokens: string[] = []
  let i = 0

  while (i < expr.length) {
    const char = expr[i]

    if (/\s/.test(char)) {
      i++
      continue
    }

    if (char === '"' || char === "'") {
      const quote = char
      let str = ''
      i++
      while (i < expr.length && expr[i] !== quote) {
        if (expr[i] === '\\' && i + 1 < expr.length) {
          str += expr[i + 1]
          i += 2
        } else {
          str += expr[i]
          i++
        }
      }
      i++
      tokens.push(`'${str}'`)
      continue
    }

    if (/[a-zA-Z_]/.test(char)) {
      let id = ''
      while (i < expr.length && /[a-zA-Z0-9_]/.test(expr[i])) {
        id += expr[i]
        i++
      }
      tokens.push(id)
      continue
    }

    if (/\d/.test(char) || (char === '.' && /\d/.test(expr[i + 1]))) {
      let num = ''
      while (i < expr.length && /[\d.]/.test(expr[i])) {
        num += expr[i]
        i++
      }
      tokens.push(num)
      continue
    }

    if (i + 1 < expr.length) {
      const twoChar = expr.substring(i, i + 2)
      if (['===', '!==', '<=', '>=', '&&', '||', '==', '!='].includes(twoChar)) {
        tokens.push(twoChar)
        i += 2
        continue
      }
    }

    if ('<>!()'.includes(char)) {
      tokens.push(char)
      i++
      continue
    }

    i++
  }

  return tokens
}

function parseClausesFromTokens(
  tokens: string[],
  variables: StoryVariable[]
): { clauses: ParsedClause[]; logic: 'AND' | 'OR' } | null {
  const varMap = new Map(variables.map((v) => [v.name, v]))
  const clauses: ParsedClause[] = []
  let logic: 'AND' | 'OR' = 'AND'
  let foundLogic = false

  let i = 0
  while (i < tokens.length) {
    const token = tokens[i]

    if (token === '&&') {
      if (!foundLogic) {
        logic = 'AND'
        foundLogic = true
      }
      i++
      continue
    }

    if (token === '||') {
      if (!foundLogic) {
        logic = 'OR'
        foundLogic = true
      }
      i++
      continue
    }

    if (varMap.has(token)) {
      const varName = token
      const variable = varMap.get(varName)!
      i++

      if (i < tokens.length && tokens[i] === '.') {
        i++
        if (i < tokens.length) {
          const method = tokens[i]
          i++
          if (i < tokens.length && tokens[i] === '(') {
            i++
            if (i < tokens.length) {
              let value: string | number | boolean = ''
              let valueType: 'string' | 'number' | 'boolean' = 'string'

              const valToken = tokens[i]
              if (valToken.startsWith("'") && valToken.endsWith("'")) {
                value = valToken.slice(1, -1)
                valueType = 'string'
              } else if (!isNaN(Number(valToken))) {
                value = Number(valToken)
                valueType = 'number'
              } else if (valToken === 'true') {
                value = true
                valueType = 'boolean'
              } else if (valToken === 'false') {
                value = false
                valueType = 'boolean'
              }
              i++

              if (i < tokens.length && tokens[i] === ')') {
                i++
              }

              let op: ConditionClause['operator'] = '=='
              if (method === 'includes') {
                op = 'contains'
              } else if (method === 'startsWith') {
                op = 'startsWith'
              } else if (method === 'endsWith') {
                op = 'endsWith'
              }

              clauses.push({
                variable: varName,
                operator: op,
                value,
                valueType,
              })
              continue
            }
          }
        }
      }

      if (i < tokens.length) {
        const opToken = tokens[i]
        let op: ConditionClause['operator'] = '=='

        if (opToken === '===' || opToken === '==') {
          op = '=='
        } else if (opToken === '!==' || opToken === '!=') {
          op = '!='
        } else if (opToken === '>') {
          op = '>'
        } else if (opToken === '>=') {
          op = '>='
        } else if (opToken === '<') {
          op = '<'
        } else if (opToken === '<=') {
          op = '<='
        } else {
          i++
          continue
        }

        i++

        if (i < tokens.length) {
          const valToken = tokens[i]
          let value: string | number | boolean = ''
          let valueType: 'string' | 'number' | 'boolean' = variable.type

          if (valToken.startsWith("'") && valToken.endsWith("'")) {
            value = valToken.slice(1, -1)
            valueType = 'string'
          } else if (!isNaN(Number(valToken))) {
            value = Number(valToken)
            valueType = 'number'
          } else if (valToken === 'true') {
            value = true
            valueType = 'boolean'
          } else if (valToken === 'false') {
            value = false
            valueType = 'boolean'
          } else if (varMap.has(valToken)) {
            value = valToken
            valueType = variable.type
          }

          i++

          clauses.push({
            variable: varName,
            operator: op,
            value,
            valueType,
          })
          continue
        }
      }
    }

    i++
  }

  if (clauses.length === 0) {
    return null
  }

  return { clauses, logic }
}

export function parseExpression(expr: string, variables: StoryVariable[]): ConditionGroup[] {
  if (!expr || expr.trim() === '') {
    return []
  }

  try {
    const tokens = tokenizeSimple(expr)

    let depth = 0
    const groupRanges: Array<{ start: number; end: number }> = []
    let currentStart = -1

    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i] === '(') {
        if (depth === 0) {
          currentStart = i + 1
        }
        depth++
      } else if (tokens[i] === ')') {
        depth--
        if (depth === 0 && currentStart >= 0) {
          groupRanges.push({ start: currentStart, end: i })
          currentStart = -1
        }
      }
    }

    if (groupRanges.length > 0) {
      const groups: ConditionGroup[] = []

      for (const range of groupRanges) {
        const groupTokens = tokens.slice(range.start, range.end)
        const result = parseClausesFromTokens(groupTokens, variables)
        if (result && result.clauses.length > 0) {
          groups.push({
            id: generateId(),
            logic: result.logic,
            clauses: result.clauses.map((c) => ({
              id: generateId(),
              ...c,
            })) as ConditionClause[],
          })
        }
      }

      if (groups.length > 0) {
        return groups
      }
    }

    const result = parseClausesFromTokens(tokens, variables)
    if (result && result.clauses.length > 0) {
      return [
        {
          id: generateId(),
          logic: 'AND',
          clauses: result.clauses.map((c) => ({
            id: generateId(),
            ...c,
          })) as ConditionClause[],
        },
      ]
    }

    return []
  } catch {
    return []
  }
}

export function createEmptyGroup(): ConditionGroup {
  return {
    id: generateId(),
    logic: 'AND',
    clauses: [],
  }
}

export function createEmptyClause(variableName: string = '', variableType: 'string' | 'number' | 'boolean' = 'string'): ConditionClause {
  let defaultOperator: ConditionClause['operator'] = '=='
  let defaultValue: string | number | boolean = ''

  if (variableType === 'number') {
    defaultOperator = '>'
    defaultValue = 0
  } else if (variableType === 'boolean') {
    defaultOperator = '=='
    defaultValue = true
  } else {
    defaultOperator = '=='
    defaultValue = ''
  }

  return {
    id: generateId(),
    variable: variableName,
    operator: defaultOperator,
    value: defaultValue,
    valueType: variableType,
  }
}
