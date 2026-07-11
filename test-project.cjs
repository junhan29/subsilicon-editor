// Simple test to verify the project can be opened
const testProjectPath = '/Users/seey/Desktop/测试.json'
const fs = require('fs')

// Read the test project file
const content = fs.readFileSync(testProjectPath, 'utf-8')
console.log('Test project content:', content)

// Parse it
const graph = JSON.parse(content)
console.log('Parsed graph:', {
  title: graph.title,
  nodes: graph.nodes?.length || 0,
  edges: graph.edges?.length || 0,
  settings: graph.settings
})

// Verify it matches expected structure
const expectedFields = ['title', 'description', 'templateId', 'characters', 'variables', 'nodes', 'edges', 'settings', 'assets', 'scenes', 'audios', 'groups', 'annotations']
const allFieldsPresent = expectedFields.every(field => field in graph)
console.log('All required fields present:', allFieldsPresent)

if (allFieldsPresent) {
  console.log('✅ Test project is valid and can be opened')
} else {
  console.log('❌ Test project is missing some fields')
}