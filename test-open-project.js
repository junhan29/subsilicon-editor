// 测试打开项目功能的脚本
const fs = require('fs')
const path = require('path')

const testFile = '/Users/seey/Desktop/测试.json'

console.log('=== 测试打开项目功能 ===')
console.log('测试文件:', testFile)

// 读取文件
try {
  const content = fs.readFileSync(testFile, 'utf-8')
  console.log('文件内容:', content.substring(0, 100))
  
  const graph = JSON.parse(content)
  console.log('解析成功:', graph.title)
  console.log('节点数量:', graph.nodes?.length || 0)
  console.log('边数量:', graph.edges?.length || 0)
  
  // 验证必需字段
  const requiredFields = ['title', 'nodes', 'edges', 'settings']
  const missingFields = requiredFields.filter(f => !(f in graph))
  if (missingFields.length > 0) {
    console.log('缺少字段:', missingFields)
  } else {
    console.log('所有必需字段都存在')
  }
  
  console.log('=== 测试通过 ===')
} catch (error) {
  console.error('测试失败:', error.message)
}