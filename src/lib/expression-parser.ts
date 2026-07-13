// Token 类型
export type TokenType =
  | 'NUMBER'      // 数字
  | 'STRING'      // 字符串
  | 'BOOLEAN'     // 布尔值
  | 'IDENTIFIER'  // 标识符/变量名
  | 'OPERATOR'    // 运算符
  | 'LPAREN'      // 左括号
  | 'RPAREN'      // 右括号
  | 'COMMA'       // 逗号
  | 'EOF'         // 结束

export interface Token {
  type: TokenType
  value: string | number | boolean
  position: number
}

// 运算符优先级
const OPERATOR_PRECEDENCE: Record<string, number> = {
  '||': 1,
  '&&': 2,
  '==': 3,
  '!=': 3,
  '<': 4,
  '<=': 4,
  '>': 4,
  '>=': 4,
  '+': 5,
  '-': 5,
  '*': 6,
  '/': 6,
  '%': 6,
  '!': 7,
}

// 运算符到函数的映射
const OPERATORS: Record<string, (a: any, b?: any) => any> = {
  '+': (a, b) => a + b,
  '-': (a, b) => a - b,
  '*': (a, b) => a * b,
  '/': (a, b) => a / b,
  '%': (a, b) => a % b,
  '==': (a, b) => a === b,
  '!=': (a, b) => a !== b,
  '<': (a, b) => a < b,
  '<=': (a, b) => a <= b,
  '>': (a, b) => a > b,
  '>=': (a, b) => a >= b,
  '&&': (a, b) => a && b,
  '||': (a, b) => a || b,
  '!': (a) => !a,
}

export interface EvaluationContext {
  variables: Record<string, any>
  functions: Record<string, Function>
  visitCounts: Record<string, number>
  choiceCount: () => number
  turnsSince: (label: string) => number
  currentTurn: number
}

export class ExpressionParser {
  private tokens: Token[] = []
  private position: number = 0
  private context: EvaluationContext

  constructor(context: EvaluationContext) {
    this.context = context
  }

  parse(expression: string): any {
    if (!expression || expression.trim() === '') {
      return true // 空表达式默认为 true
    }

    this.tokens = this.tokenize(expression)
    this.position = 0
    return this.parseExpression()
  }

  private tokenize(expression: string): Token[] {
    const tokens: Token[] = []
    let i = 0

    while (i < expression.length) {
      const char = expression[i]

      // 跳过空白
      if (/\s/.test(char)) {
        i++
        continue
      }

      // 数字
      if (/\d/.test(char) || (char === '.' && /\d/.test(expression[i + 1]))) {
        let num = ''
        while (i < expression.length && /[\d.]/.test(expression[i])) {
          num += expression[i]
          i++
        }
        tokens.push({ type: 'NUMBER', value: parseFloat(num), position: i })
        continue
      }

      // 字符串
      if (char === '"' || char === "'") {
        const quote = char
        let str = ''
        i++ // 跳过开始引号
        while (i < expression.length && expression[i] !== quote) {
          if (expression[i] === '\\' && i + 1 < expression.length) {
            str += expression[i + 1]
            i += 2
          } else {
            str += expression[i]
            i++
          }
        }
        i++ // 跳过结束引号
        tokens.push({ type: 'STRING', value: str, position: i })
        continue
      }

      // 布尔值
      if (expression.substring(i, i + 4) === 'true') {
        tokens.push({ type: 'BOOLEAN', value: true, position: i })
        i += 4
        continue
      }
      if (expression.substring(i, i + 5) === 'false') {
        tokens.push({ type: 'BOOLEAN', value: false, position: i })
        i += 5
        continue
      }

      // 标识符/变量名
      if (/[a-zA-Z_]/.test(char)) {
        let id = ''
        while (i < expression.length && /[a-zA-Z0-9_]/.test(expression[i])) {
          id += expression[i]
          i++
        }
        // 检查是否为函数调用
        if (expression[i] === '(') {
          tokens.push({ type: 'IDENTIFIER', value: id, position: i })
        } else {
          tokens.push({ type: 'IDENTIFIER', value: id, position: i })
        }
        continue
      }

      // 双字符运算符
      if (i + 1 < expression.length) {
        const twoChar = expression.substring(i, i + 2)
        if (['==', '!=', '<=', '>=', '&&', '||'].includes(twoChar)) {
          tokens.push({ type: 'OPERATOR', value: twoChar, position: i })
          i += 2
          continue
        }
      }

      // 单字符运算符
      if ('+-*/%<>=!(),'.includes(char)) {
        tokens.push({ type: 'OPERATOR', value: char, position: i })
        i++
        continue
      }

      // 未知字符，跳过
      i++
    }

    tokens.push({ type: 'EOF', value: '', position: i })
    return tokens
  }

  private currentToken(): Token {
    return this.tokens[this.position] || { type: 'EOF', value: '', position: 0 }
  }

  private eat(type: TokenType): Token {
    const token = this.currentToken()
    if (token.type !== type) {
      throw new Error(`Expected ${type} but got ${token.type} at position ${token.position}`)
    }
    this.position++
    return token
  }

  private peek(): Token {
    return this.tokens[this.position] || { type: 'EOF', value: '', position: 0 }
  }

  /**
   * 解析表达式 - 使用递归下降解析器
   * 优先级从低到高：|| -> && -> == != -> < <= > >= -> + - -> * / % -> ! -> 函数调用
   */
  private parseExpression(): any {
    return this.parseLogicalOr()
  }

  private parseLogicalOr(): any {
    let left = this.parseLogicalAnd()
    while (this.currentToken().type === 'OPERATOR' && this.currentToken().value === '||') {
      this.eat('OPERATOR')
      const right = this.parseLogicalAnd()
      left = left || right
    }
    return left
  }

  private parseLogicalAnd(): any {
    let left = this.parseEquality()
    while (this.currentToken().type === 'OPERATOR' && this.currentToken().value === '&&') {
      this.eat('OPERATOR')
      const right = this.parseEquality()
      left = left && right
    }
    return left
  }

  private parseEquality(): any {
    let left = this.parseComparison()
    while (this.currentToken().type === 'OPERATOR' && ['==', '!='].includes(this.currentToken().value as string)) {
      const op = this.eat('OPERATOR').value
      const right = this.parseComparison()
      if (op === '==') {
        left = left === right
      } else {
        left = left !== right
      }
    }
    return left
  }

  private parseComparison(): any {
    let left = this.parseAdditive()
    while (this.currentToken().type === 'OPERATOR' && ['<', '<=', '>', '>='].includes(this.currentToken().value as string)) {
      const op = this.eat('OPERATOR').value
      const right = this.parseAdditive()
      switch (op) {
        case '<': left = left < right; break
        case '<=': left = left <= right; break
        case '>': left = left > right; break
        case '>=': left = left >= right; break
      }
    }
    return left
  }

  private parseAdditive(): any {
    let left = this.parseMultiplicative()
    while (this.currentToken().type === 'OPERATOR' && ['+', '-'].includes(this.currentToken().value as string)) {
      const op = this.eat('OPERATOR').value
      const right = this.parseMultiplicative()
      if (op === '+') {
        left = left + right
      } else {
        left = left - right
      }
    }
    return left
  }

  private parseMultiplicative(): any {
    let left = this.parseUnary()
    while (this.currentToken().type === 'OPERATOR' && ['*', '/', '%'].includes(this.currentToken().value as string)) {
      const op = this.eat('OPERATOR').value
      const right = this.parseUnary()
      switch (op) {
        case '*': left = left * right; break
        case '/': left = right !== 0 ? left / right : 0; break
        case '%': left = right !== 0 ? left % right : 0; break
      }
    }
    return left
  }

  private parseUnary(): any {
    if (this.currentToken().type === 'OPERATOR' && this.currentToken().value === '!') {
      this.eat('OPERATOR')
      return !this.parseUnary()
    }
    if (this.currentToken().type === 'OPERATOR' && this.currentToken().value === '-') {
      this.eat('OPERATOR')
      return -this.parseUnary()
    }
    return this.parsePrimary()
  }

  private parsePrimary(): any {
    const token = this.currentToken()

    // 括号
    if (token.type === 'OPERATOR' && token.value === '(') {
      this.eat('LPAREN')
      const result = this.parseExpression()
      this.eat('RPAREN')
      return result
    }

    // 数字
    if (token.type === 'NUMBER') {
      this.eat('NUMBER')
      return token.value
    }

    // 字符串
    if (token.type === 'STRING') {
      this.eat('STRING')
      return token.value
    }

    // 布尔值
    if (token.type === 'BOOLEAN') {
      this.eat('BOOLEAN')
      return token.value
    }

    // 标识符/变量/函数
    if (token.type === 'IDENTIFIER') {
      const name = this.eat('IDENTIFIER').value as string

      // 函数调用
      if (this.currentToken().type === 'OPERATOR' && this.currentToken().value === '(') {
        this.eat('LPAREN')
        const args: any[] = []
        if (this.currentToken().type !== 'OPERATOR' || this.currentToken().value !== ')') {
          args.push(this.parseExpression())
          while (this.currentToken().type === 'OPERATOR' && this.currentToken().value === ',') {
            this.eat('COMMA')
            args.push(this.parseExpression())
          }
        }
        this.eat('RPAREN')
        return this.callFunction(name, args)
      }

      // 变量
      return this.getVariable(name)
    }

    // EOF
    if (token.type === 'EOF') {
      return undefined
    }

    throw new Error(`Unexpected token: ${token.type} at position ${token.position}`)
  }

  private getVariable(name: string): any {
    // 检查内置变量
    if (name in this.context.variables) {
      return this.context.variables[name]
    }
    // 检查内置函数（未调用形式）
    if (name in this.context.functions) {
      return this.context.functions[name]
    }
    return undefined
  }

  private callFunction(name: string, args: any[]): any {
    const func = this.context.functions[name]
    if (func) {
      return func(...args)
    }
    // 内置函数
    switch (name.toUpperCase()) {
      case 'RANDOM':
        if (args.length === 2) {
          const [min, max] = args
          return Math.floor(Math.random() * (max - min + 1)) + min
        }
        return Math.random()
      case 'CHOICE_COUNT':
        return this.context.choiceCount()
      case 'TURNS_SINCE':
        return this.context.turnsSince(args[0])
      case 'VISIT_COUNT':
        return this.context.visitCounts[args[0]] || 0
      case 'HAS':
        return args[0] in this.context.variables
      case 'SET':
        if (args.length >= 2) {
          this.context.variables[args[0]] = args[1]
          return args[1]
        }
        return undefined
      default:
        throw new Error(`Unknown function: ${name}`)
    }
  }
}

export function createDefaultContext(variables: Record<string, any> = {}): EvaluationContext {
  return {
    variables,
    functions: {},
    visitCounts: {},
    choiceCount: () => 0,
    turnsSince: () => 0,
    currentTurn: 0,
  }
}

export function validateExpression(expression: string): { valid: boolean; error?: string } {
  try {
    const parser = new ExpressionParser(createDefaultContext())
    parser.parse(expression)
    return { valid: true }
  } catch (e) {
    return { valid: false, error: (e as Error).message }
  }
}

export function extractVariables(expression: string): string[] {
  const parser = new ExpressionParser(createDefaultContext())
  const tokens = parser['tokenize'](expression)
  const variables: string[] = []

  for (const token of tokens) {
    if (token.type === 'IDENTIFIER') {
      const nextToken = tokens[tokens.indexOf(token) + 1]
      // 如果下一个 token 不是 '('，则是变量而非函数
      if (!nextToken || (nextToken.type !== 'OPERATOR' || nextToken.value !== '(')) {
        if (!variables.includes(token.value as string)) {
          variables.push(token.value as string)
        }
      }
    }
  }

  return variables
}
