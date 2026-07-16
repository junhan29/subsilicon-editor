'use client'

import { Label } from '@editor/components/ui/label'
import { Input } from '@editor/components/ui/input'
import { Textarea } from '@editor/components/ui/textarea'
import { Button } from '@editor/components/ui/button'
import { LocalFileInput } from './local-file-input'
import type { BasePanelProps } from './shared-props'

export function UnlockPanel({ node, onUpdateNode }: BasePanelProps) {
  const { data, id } = node

  return (
    <>
      <div className="space-y-2">
        <Label className="text-xs">解锁标题</Label>
        <Input
          value={(data as any).title || ''}
          onChange={(e) => onUpdateNode(id, { ...data, title: e.target.value })}
          placeholder="解锁内容"
          className="text-sm"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs">解锁价格（元）</Label>
        <Input
          type="number"
          value={(data as any).price || 1}
          onChange={(e) => onUpdateNode(id, { ...data, price: Number(e.target.value) })}
          className="text-sm"
          min={1}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs">解锁描述</Label>
        <Textarea
          value={(data as any).description || ''}
          onChange={(e) => onUpdateNode(id, { ...data, description: e.target.value })}
          placeholder="描述解锁后可获得的内容..."
          className="min-h-[60px] resize-none text-sm"
        />
      </div>

      {/* 付款方式 */}
      <div className="flex items-center gap-2 pt-1">
        <div className="flex-1 h-px bg-border" />
        <span className="text-[10px] text-muted-foreground">读者付款方式</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <div className="space-y-2">
        <Label className="text-xs">收款方式</Label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { id: 'wechat_qr', label: '微信收款码', icon: '💬' },
            { id: 'alipay_qr', label: '支付宝收款码', icon: '📱' },
            { id: 'wechat_contact', label: '微信联系', icon: '👤' },
            { id: 'other_contact', label: '其他方式', icon: '📧' },
          ].map((method) => {
            const isActive = (data as any).paymentMethod === method.id
            return (
              <button
                key={method.id}
                onClick={() => onUpdateNode(id, { ...data, paymentMethod: isActive ? '' : method.id })}
                className={`py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                  isActive ? 'bg-amber-500 text-white' : 'bg-muted hover:bg-muted/80'
                }`}
              >
                {method.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* 收款码上传 */}
      {(data as any).paymentMethod === 'wechat_qr' || (data as any).paymentMethod === 'alipay_qr' ? (
        <div className="space-y-2">
          <Label className="text-xs">
            {(data as any).paymentMethod === 'wechat_qr' ? '微信收款码' : '支付宝收款码'}
          </Label>
          <LocalFileInput
            accept="image/*"
            maxSize={10 * 1024 * 1024}
            value={(data as any).qrCodeUrl || ''}
            onChange={(base64) => onUpdateNode(id, { ...data, qrCodeUrl: base64 })}
            placeholder="上传收款码图片"
          />
          {(data as any).qrCodeUrl && (
            <div className="relative rounded-lg overflow-hidden border border-border w-32 h-32 mx-auto">
              <img
                src={(data as any).qrCodeUrl}
                alt="收款码"
                className="w-full h-full object-contain"
              />
            </div>
          )}
        </div>
      ) : null}

      {/* 联系方式 */}
      {(data as any).paymentMethod === 'wechat_contact' || (data as any).paymentMethod === 'other_contact' ? (
        <div className="space-y-2">
          <Label className="text-xs">
            {(data as any).paymentMethod === 'wechat_contact' ? '微信号' : '联系方式'}
          </Label>
          <Input
            value={(data as any).contactInfo || ''}
            onChange={(e) => onUpdateNode(id, { ...data, contactInfo: e.target.value })}
            placeholder={
              (data as any).paymentMethod === 'wechat_contact'
                ? '输入微信号或手机号'
                : '输入联系方式（如邮箱、QQ等）'
            }
            className="text-sm"
          />
          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground">联系说明（可选）</Label>
            <Input
              value={(data as any).contactMessage || ''}
              onChange={(e) => onUpdateNode(id, { ...data, contactMessage: e.target.value })}
              placeholder={'如：添加时请备注"作品名+解锁"'}
              className="text-sm"
            />
          </div>
        </div>
      ) : null}

      <p className="text-[10px] text-amber-600 bg-amber-50 rounded-lg px-2.5 py-2">
        提示：读者将通过上述方式联系创作者完成付费解锁，平台不参与交易。
      </p>
    </>
  )
}