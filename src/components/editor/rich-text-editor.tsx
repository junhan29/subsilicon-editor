'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect } from 'react'

// TipTap 的 EditorContent 类型与 React 18 JSX 类型存在兼容性问题
const TiptapEditorContent = ({ editor }: { editor: NonNullable<ReturnType<typeof useEditor>> }) => {
  const EC = EditorContent as unknown as React.FC<{ editor: NonNullable<ReturnType<typeof useEditor>> }>
  return <EC editor={editor} />
}

interface RichTextEditorProps {
  content: string
  onChange?: (html: string) => void
  placeholder?: string
  editable?: boolean
  className?: string
  minHeight?: string
}

/**
 * 富文本编辑器组件 (基于 Tiptap)
 * 支持：加粗、斜体、标题、列表、链接、占位符
 */
export function RichTextEditor({
  content,
  onChange,
  placeholder = '请输入内容...',
  editable = true,
  className = '',
  minHeight = '200px',
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-amber-600 underline hover:text-amber-700',
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose max-w-none focus:outline-none',
        style: `min-height: ${minHeight}`,
      },
    },
  })

  // 外部内容更新时同步
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  // 外部可编辑状态更新
  useEffect(() => {
    if (editor) {
      editor.setEditable(editable)
    }
  }, [editable, editor])

  if (!editor) {
    return (
      <div className={`border border-input rounded-lg p-4 bg-background ${className}`}>
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-muted rounded w-3/4" />
          <div className="h-4 bg-muted rounded w-1/2" />
        </div>
      </div>
    )
  }

  return (
    <div className={`border border-input rounded-lg overflow-hidden bg-background ${className}`}>
      {editable && (
        <div className="flex items-center gap-1 p-2 border-b bg-muted/30 flex-wrap">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-1.5 rounded hover:bg-muted ${editor.isActive('bold') ? 'bg-muted text-amber-700' : 'text-muted-foreground'}`}
            title="加粗"
          >
            <span className="font-bold text-sm">B</span>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-1.5 rounded hover:bg-muted ${editor.isActive('italic') ? 'bg-muted text-amber-700' : 'text-muted-foreground'}`}
            title="斜体"
          >
            <span className="italic text-sm">I</span>
          </button>
          <div className="w-px h-5 bg-border mx-1" />
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`p-1.5 rounded hover:bg-muted ${editor.isActive('heading', { level: 1 }) ? 'bg-muted text-amber-700' : 'text-muted-foreground'}`}
            title="标题1"
          >
            <span className="text-xs font-bold">H1</span>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`p-1.5 rounded hover:bg-muted ${editor.isActive('heading', { level: 2 }) ? 'bg-muted text-amber-700' : 'text-muted-foreground'}`}
            title="标题2"
          >
            <span className="text-xs font-bold">H2</span>
          </button>
          <div className="w-px h-5 bg-border mx-1" />
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-1.5 rounded hover:bg-muted ${editor.isActive('bulletList') ? 'bg-muted text-amber-700' : 'text-muted-foreground'}`}
            title="无序列表"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-1.5 rounded hover:bg-muted ${editor.isActive('orderedList') ? 'bg-muted text-amber-700' : 'text-muted-foreground'}`}
            title="有序列表"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
            </svg>
          </button>
          <div className="w-px h-5 bg-border mx-1" />
          <button
            type="button"
            onClick={() => {
              const url = window.prompt('输入链接地址')
              if (url) {
                editor.chain().focus().setLink({ href: url }).run()
              }
            }}
            className={`p-1.5 rounded hover:bg-muted ${editor.isActive('link') ? 'bg-muted text-amber-700' : 'text-muted-foreground'}`}
            title="添加链接"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </button>
        </div>
      )}
      {editor && <TiptapEditorContent editor={editor} />}
    </div>
  )
}

/**
 * 纯展示模式富文本（只读）
 */
export function RichTextViewer({ content, className = '' }: { content: string; className?: string }) {
  return (
    <div
      className={`prose prose-sm sm:prose max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  )
}
