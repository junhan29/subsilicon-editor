'use client'

import { useEffect, useState } from 'react'
import { Settings2, X } from 'lucide-react'
import {
  type WorkflowValidationResult,
  validateWorkflow,
  WORKFLOW_PRESETS,
} from '@editor/lib/ai'

interface ComfyuiWorkflowDialogProps {
  open: boolean
  initialApiUrl: string
  initialWorkflowJson?: string
  onClose: () => void
  onSave: (data: { apiUrl: string; workflowJson?: string }) => void
}

/**
 * ComfyUI 工作流独立编辑面板。
 * 收敛 ComfyUI 的全部高级配置（地址 / 预设工作流 / JSON 编辑 / 校验），
 * 不再内联展开在设置对话框的槽位里，降低普通用户配置负担。
 */
export function ComfyuiWorkflowDialog({
  open,
  initialApiUrl,
  initialWorkflowJson,
  onClose,
  onSave,
}: ComfyuiWorkflowDialogProps) {
  const [apiUrl, setApiUrl] = useState(initialApiUrl)
  const [workflowJson, setWorkflowJson] = useState(initialWorkflowJson || '')
  const [validation, setValidation] = useState<WorkflowValidationResult | null>(null)

  // 每次打开时同步初始值
  useEffect(() => {
    if (open) {
      setApiUrl(initialApiUrl)
      setWorkflowJson(initialWorkflowJson || '')
      setValidation(null)
    }
  }, [open, initialApiUrl, initialWorkflowJson])

  if (!open) return null

  const handleSave = () => {
    onSave({ apiUrl: apiUrl.trim(), workflowJson: workflowJson.trim() || undefined })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[70] p-4">
      <div className="bg-muted rounded-xl w-full max-w-lg border border-border shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-gold-400" />
            <h3 className="text-sm font-semibold text-foreground">ComfyUI 工作流</h3>
            <span className="text-[9px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">高级</span>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-full hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          <p className="text-[10px] text-gold-400 leading-relaxed bg-gold-400/5 border border-gold-400/20 rounded p-2">
            ComfyUI 需本地部署（http://localhost:8188）。编辑器自动注入 prompt（CLIPTextEncode）和参考图（LoadImage）。新手请选「通义万相」。
          </p>

          {/* API 地址 */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">ComfyUI 地址</label>
            <input
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="http://localhost:8188"
              className="w-full h-8 text-xs rounded border border-border bg-secondary px-2 text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* 预设工作流 */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">预设工作流</label>
            <select
              value=""
              onChange={(e) => {
                const preset = WORKFLOW_PRESETS.find((p) => p.id === e.target.value)
                if (preset) {
                  setWorkflowJson(preset.workflowJson)
                  setValidation(null)
                }
              }}
              className="w-full h-8 text-xs rounded border border-border bg-secondary px-2 text-foreground"
            >
              <option value="">选择预设工作流…</option>
              {WORKFLOW_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* 工作流 JSON 编辑 */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground">工作流 JSON（API 格式）</label>
              <button
                onClick={() => setValidation(validateWorkflow(workflowJson))}
                className="text-[10px] text-cyan-400 hover:text-cyan-300"
              >
                校验工作流
              </button>
            </div>
            <textarea
              value={workflowJson}
              onChange={(e) => {
                setWorkflowJson(e.target.value)
                setValidation(null)
              }}
              placeholder="从 ComfyUI Save (API Format) 粘贴工作流 JSON，或选上方预设"
              rows={8}
              className="w-full text-[10px] font-mono rounded border border-border bg-secondary px-2 py-1.5 text-foreground placeholder:text-muted-foreground resize-y"
            />
          </div>

          {/* 校验结果 */}
          {validation && (
            <div className={`text-[9px] rounded p-1.5 space-y-0.5 ${validation.ok ? 'bg-emerald-500/10 text-emerald-300' : 'bg-primary/10 text-red-300'}`}>
              {validation.errors.map((e, i) => <p key={`e${i}`}>✕ {e}</p>)}
              {validation.warnings.map((w, i) => <p key={`w${i}`} className="text-gold-400">⚠ {w}</p>)}
              {validation.ok && validation.warnings.length === 0 && <p>✓ 工作流结构正确</p>}
              {validation.nodes.length > 0 && (
                <p className="text-muted-foreground pt-0.5">
                  节点：{validation.nodes.map((n) => {
                    const tag = n.injectable === 'reference_image' ? ' [参考图]' : n.injectable === 'prompt' ? ' [正向提示]' : n.injectable === 'negative_prompt' ? ' [负向提示]' : ''
                    return `${n.classType}${tag}`
                  }).join(' · ')}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-border">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 text-xs bg-gold-400/20 hover:bg-gold-400/30 text-gold-400 rounded transition-colors"
          >
            保存工作流
          </button>
        </div>
      </div>
    </div>
  )
}
