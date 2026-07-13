'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Lock, Unlock, CreditCard, QrCode, Link2, DollarSign, Shield, AlertTriangle,
  CheckCircle2, Info, Upload, X, Plus, Trash2, ChevronDown, ChevronUp,
  Globe, MessageCircle, Wallet, TrendingUp, BarChart3, AlertCircle,
  FileText, Sparkles, Star, Cookie
} from 'lucide-react'
import { Button } from '@editor/components/ui/button'
import { Toggle } from '@editor/components/ui/toggle'
import type { StoryGraph, StoryNode } from '@editor/types/editor'
import type {
  MonetizationConfig, PaymentMethod, PaymentGranularity,
  ThirdPartyPlatform, PaidChapter,
  MultiChannelConfig, ManualPaymentChannel, ThirdPartyChannel,
  IncomeRecord, ComplianceStatus
} from '@editor/lib/work-monetization'
import {
  generateSeedKey, hashSeedKey, generateWorkId, saveSeedKey, loadSeedKey,
  THIRD_PARTY_PLATFORMS, formatPrice, suggestPaidNodes, getMonetizationStats,
  SEED_KEY_PREFIX, DEFAULT_PRICE_OPTIONS
} from '@editor/lib/work-monetization'
import {
  loadIncomeTracking, addIncomeRecord, getComplianceStatus, deleteIncomeRecord
} from '@editor/lib/compliance-tracker'
import { showToast } from './toast'

interface MonetizationSettingsPanelProps {
  graph: StoryGraph
  config: MonetizationConfig | null
  onChange: (config: MonetizationConfig) => void
  workId: string
}

export function MonetizationSettingsPanel({
  graph,
  config,
  onChange,
  workId,
}: MonetizationSettingsPanelProps) {
  // 本地状态
  const [enabled, setEnabled] = useState(config?.enabled ?? false)
  const [granularity, setGranularity] = useState<PaymentGranularity>(config?.granularity ?? 'whole')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(config?.paymentMethod ?? 'wechat_manual')
  
  // 微信收款设置
  const [wechatQRCode, setWechatQRCode] = useState<string>(config?.wechatQRCode ?? '')
  const [wechatContact, setWechatContact] = useState<string>(config?.wechatContact ?? '')
  
  // 第三方平台设置
  const [thirdPartyPlatform, setThirdPartyPlatform] = useState<ThirdPartyPlatform>(
    config?.thirdParty?.platform ?? 'afdian'
  )
  const [thirdPartyLink, setThirdPartyLink] = useState<string>(config?.thirdParty?.link ?? '')
  const [thirdPartyCreatorName, setThirdPartyCreatorName] = useState<string>(
    config?.thirdParty?.creatorName ?? ''
  )
  
  // 多渠道配置
  const [multiChannel, setMultiChannel] = useState<MultiChannelConfig>(
    config?.multiChannel ?? {
      manualChannels: [],
      thirdPartyChannels: [],
      primaryChannel: 'afdian'
    }
  )
  
  // 多渠道各开关状态
  const [afdianEnabled, setAfdianEnabled] = useState(
    config?.multiChannel?.thirdPartyChannels?.some(c => c.platform === 'afdian') ?? false
  )
  const [afdianLink, setAfdianLink] = useState(
    config?.multiChannel?.thirdPartyChannels?.find(c => c.platform === 'afdian')?.link ?? ''
  )
  const [afdianCreatorName, setAfdianCreatorName] = useState(
    config?.multiChannel?.thirdPartyChannels?.find(c => c.platform === 'afdian')?.creatorName ?? ''
  )
  const [afdianPlanType, setAfdianPlanType] = useState<'subscription' | 'onetime'>(
    config?.multiChannel?.thirdPartyChannels?.find(c => c.platform === 'afdian')?.planType ?? 'subscription'
  )
  const [afdianAutoVerify, setAfdianAutoVerify] = useState(
    config?.multiChannel?.thirdPartyChannels?.find(c => c.platform === 'afdian')?.autoVerify ?? false
  )
  const [afdianVerifyEndpoint, setAfdianVerifyEndpoint] = useState(
    config?.multiChannel?.thirdPartyChannels?.find(c => c.platform === 'afdian')?.verifyEndpoint ?? ''
  )
  const [afdianPlatformUserId, setAfdianPlatformUserId] = useState(
    config?.multiChannel?.thirdPartyChannels?.find(c => c.platform === 'afdian')?.platformUserId ?? ''
  )
  const [afdianPlanId, setAfdianPlanId] = useState(
    config?.multiChannel?.thirdPartyChannels?.find(c => c.platform === 'afdian')?.planId ?? ''
  )

  const [mianbaoduoEnabled, setMianbaoduoEnabled] = useState(
    config?.multiChannel?.thirdPartyChannels?.some(c => c.platform === 'mianbaoduo') ?? false
  )
  const [mianbaoduoLink, setMianbaoduoLink] = useState(
    config?.multiChannel?.thirdPartyChannels?.find(c => c.platform === 'mianbaoduo')?.link ?? ''
  )
  const [mianbaoduoCreatorName, setMianbaoduoCreatorName] = useState(
    config?.multiChannel?.thirdPartyChannels?.find(c => c.platform === 'mianbaoduo')?.creatorName ?? ''
  )
  const [mianbaoduoAutoVerify, setMianbaoduoAutoVerify] = useState(
    config?.multiChannel?.thirdPartyChannels?.find(c => c.platform === 'mianbaoduo')?.autoVerify ?? false
  )
  const [mianbaoduoVerifyEndpoint, setMianbaoduoVerifyEndpoint] = useState(
    config?.multiChannel?.thirdPartyChannels?.find(c => c.platform === 'mianbaoduo')?.verifyEndpoint ?? ''
  )
  const [mianbaoduoPlatformUserId, setMianbaoduoPlatformUserId] = useState(
    config?.multiChannel?.thirdPartyChannels?.find(c => c.platform === 'mianbaoduo')?.platformUserId ?? ''
  )
  const [mianbaoduoPlanId, setMianbaoduoPlanId] = useState(
    config?.multiChannel?.thirdPartyChannels?.find(c => c.platform === 'mianbaoduo')?.planId ?? ''
  )

  const [manualWechatEnabled, setManualWechatEnabled] = useState(
    config?.multiChannel?.manualChannels?.some(c => c.type === 'wechat') ?? false
  )
  const [manualWechatQRCode, setManualWechatQRCode] = useState(
    config?.multiChannel?.manualChannels?.find(c => c.type === 'wechat')?.qrCode ?? ''
  )
  const [manualWechatContact, setManualWechatContact] = useState(
    config?.multiChannel?.manualChannels?.find(c => c.type === 'wechat')?.contact ?? ''
  )
  
  const [manualAlipayEnabled, setManualAlipayEnabled] = useState(
    config?.multiChannel?.manualChannels?.some(c => c.type === 'alipay') ?? false
  )
  const [manualAlipayQRCode, setManualAlipayQRCode] = useState(
    config?.multiChannel?.manualChannels?.find(c => c.type === 'alipay')?.qrCode ?? ''
  )
  const [manualAlipayContact, setManualAlipayContact] = useState(
    config?.multiChannel?.manualChannels?.find(c => c.type === 'alipay')?.contact ?? ''
  )
  
  const [primaryChannel, setPrimaryChannel] = useState<'manual' | 'afdian' | 'mianbaoduo' | 'patreon' | 'ko-fi'>(
    config?.multiChannel?.primaryChannel ?? 'afdian'
  )
  
  // 价格设置
  const [price, setPrice] = useState<number>(config?.price ?? 18.8)
  const [customPrice, setCustomPrice] = useState<string>('')
  
  // 付费节点设置
  const [paidNodes, setPaidNodes] = useState<string[]>(config?.paidNodes ?? [])
  const [paidChapters, setPaidChapters] = useState<PaidChapter[]>(config?.paidChapters ?? [])
  
  // 免费预览设置
  const [freePreviewNodes, setFreePreviewNodes] = useState<string[]>(
    config?.freePreviewNodes ?? []
  )
  const [freePreviewText, setFreePreviewText] = useState<string>(
    config?.freePreviewText ?? '前几章内容免费阅读，后续内容需要付费解锁。'
  )
  
  // 种子密钥状态
  const [seedKey, setSeedKey] = useState<string>('')
  const [seedKeyGenerated, setSeedKeyGenerated] = useState(false)
  const [showSeedKey, setShowSeedKey] = useState(false)
  
  const [expandedSection, setExpandedSection] = useState<string>('basic')
  const [qrCodePreview, setQrCodePreview] = useState<string>('')
  const [nodeFilter, setNodeFilter] = useState<string>('')
  
  // 合规状态
  const [complianceStatus, setComplianceStatus] = useState<ComplianceStatus | null>(null)
  const [showComplianceDetail, setShowComplianceDetail] = useState(false)
  
  // 收入记录
  const [incomeRecords, setIncomeRecords] = useState<IncomeRecord[]>([])
  const [showAddIncomeModal, setShowAddIncomeModal] = useState(false)
  const [newIncomeAmount, setNewIncomeAmount] = useState<string>('')
  const [newIncomeWorkTitle, setNewIncomeWorkTitle] = useState<string>('')
  const [newIncomeChannel, setNewIncomeChannel] = useState<IncomeRecord['channel']>('afdian')
  const [newIncomeNote, setNewIncomeNote] = useState<string>('')

  // 加载已有的种子密钥
  useEffect(() => {
    if (workId) {
      const existingKey = loadSeedKey(workId)
      if (existingKey) {
        setSeedKey(existingKey)
        setSeedKeyGenerated(true)
      }
    }
  }, [workId])

  // 初始化建议的付费节点
  useEffect(() => {
    if (!config && enabled && paidNodes.length === 0) {
      const { allEndingNodes } = suggestPaidNodes(graph)
      if (allEndingNodes.length > 0) {
        setPaidNodes(allEndingNodes)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])
  
  // 加载合规状态和收入记录
  useEffect(() => {
    const tracking = loadIncomeTracking()
    const currentYear = new Date().getFullYear()
    const yearRecords = tracking.records.filter(
      r => new Date(r.date).getFullYear() === currentYear
    ).sort((a, b) => b.date - a.date)
    setIncomeRecords(yearRecords)
    setComplianceStatus(getComplianceStatus())
  }, [])

  // 生成种子密钥
  const handleGenerateSeedKey = useCallback(async () => {
    const newKey = await generateSeedKey()
    setSeedKey(newKey)
    setSeedKeyGenerated(true)
    saveSeedKey(workId, newKey)
    showToast('success', '种子密钥已生成并保存到本地')
  }, [workId])

  // 上传收款码
  const handleUploadQRCode = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    if (!file.type.startsWith('image/')) {
      showToast('error', '请上传图片文件')
      return
    }
    
    if (file.size > 1024 * 1024) {
      showToast('error', '图片大小不能超过 1MB')
      return
    }
    
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result as string
      setWechatQRCode(base64)
      setQrCodePreview(base64)
    }
    reader.readAsDataURL(file)
  }, [])
  
  // 上传多渠道收款码
  const handleUploadMultiQRCode = useCallback((
    e: React.ChangeEvent<HTMLInputElement>,
    channel: 'wechat' | 'alipay' | 'stripe' | 'paypal'
  ) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    if (!file.type.startsWith('image/')) {
      showToast('error', '请上传图片文件')
      return
    }
    
    if (file.size > 1024 * 1024) {
      showToast('error', '图片大小不能超过 1MB')
      return
    }
    
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result as string
      if (channel === 'wechat') {
        setManualWechatQRCode(base64)
      } else {
        setManualAlipayQRCode(base64)
      }
    }
    reader.readAsDataURL(file)
  }, [])
  
  // 从第三方平台链接自动提取用户ID
  const extractPlatformUserId = useCallback((platform: string, link: string): string => {
    if (!link) return ''
    try {
      if (platform === 'afdian') {
        // https://afdian.net/@username 或 https://afdian.net/a/username
        const match = link.match(/afdian\.net\/(?:@|a\/)([^/?#]+)/)
        return match?.[1] || ''
      }
      if (platform === 'mianbaoduo') {
        // https://mianbaoduo.com/o/xxxxx
        const match = link.match(/mianbaoduo\.com\/o\/([^/?#]+)/)
        return match?.[1] || ''
      }
    } catch { /* ignore */ }
    return ''
  }, [])

  // 构建多渠道配置
  const buildMultiChannelConfig = useCallback((): MultiChannelConfig => {
    const thirdPartyChannels: ThirdPartyChannel[] = []
    const manualChannels: ManualPaymentChannel[] = []

    if (afdianEnabled) {
      thirdPartyChannels.push({
        platform: 'afdian',
        link: afdianLink,
        creatorName: afdianCreatorName,
        planType: afdianPlanType,
        autoVerify: afdianAutoVerify,
        verifyEndpoint: afdianVerifyEndpoint.trim() || undefined,
        platformUserId: afdianPlatformUserId.trim() || extractPlatformUserId('afdian', afdianLink) || undefined,
        planId: afdianPlanId.trim() || undefined,
      })
    }

    if (mianbaoduoEnabled) {
      thirdPartyChannels.push({
        platform: 'mianbaoduo',
        link: mianbaoduoLink,
        creatorName: mianbaoduoCreatorName,
        autoVerify: mianbaoduoAutoVerify,
        verifyEndpoint: mianbaoduoVerifyEndpoint.trim() || undefined,
        platformUserId: mianbaoduoPlatformUserId.trim() || extractPlatformUserId('mianbaoduo', mianbaoduoLink) || undefined,
        planId: mianbaoduoPlanId.trim() || undefined,
      })
    }

    if (manualWechatEnabled) {
      manualChannels.push({
        type: 'wechat',
        qrCode: manualWechatQRCode,
        contact: manualWechatContact,
      })
    }

    if (manualAlipayEnabled) {
      manualChannels.push({
        type: 'alipay',
        qrCode: manualAlipayQRCode,
        contact: manualAlipayContact,
      })
    }

    return {
      manualChannels,
      thirdPartyChannels,
      primaryChannel,
    }
  }, [
    afdianEnabled, afdianLink, afdianCreatorName, afdianPlanType,
    afdianAutoVerify, afdianVerifyEndpoint, afdianPlatformUserId, afdianPlanId,
    mianbaoduoEnabled, mianbaoduoLink, mianbaoduoCreatorName,
    mianbaoduoAutoVerify, mianbaoduoVerifyEndpoint, mianbaoduoPlatformUserId, mianbaoduoPlanId,
    manualWechatEnabled, manualWechatQRCode, manualWechatContact,
    manualAlipayEnabled, manualAlipayQRCode, manualAlipayContact,
    primaryChannel, extractPlatformUserId
  ])
  
  // 添加收入记录
  const handleAddIncomeRecord = useCallback(() => {
    const amount = parseFloat(newIncomeAmount)
    if (isNaN(amount) || amount <= 0) {
      showToast('error', '请输入有效的金额')
      return
    }
    if (!newIncomeWorkTitle.trim()) {
      showToast('error', '请输入作品名称')
      return
    }
    
    const record = addIncomeRecord({
      workId,
      workTitle: newIncomeWorkTitle.trim(),
      amount,
      channel: newIncomeChannel,
      date: Date.now(),
      note: newIncomeNote.trim() || undefined,
    })
    
    const currentYear = new Date().getFullYear()
    setIncomeRecords(prev => 
      [record, ...prev].filter(r => new Date(r.date).getFullYear() === currentYear)
    )
    setComplianceStatus(getComplianceStatus())
    
    setNewIncomeAmount('')
    setNewIncomeWorkTitle('')
    setNewIncomeChannel('afdian')
    setNewIncomeNote('')
    setShowAddIncomeModal(false)
    
    showToast('success', '收入记录已添加')
  }, [workId, newIncomeAmount, newIncomeWorkTitle, newIncomeChannel, newIncomeNote])
  
  // 删除收入记录
  const handleDeleteIncomeRecord = useCallback((id: string) => {
    deleteIncomeRecord(id)
    setIncomeRecords(prev => prev.filter(r => r.id !== id))
    setComplianceStatus(getComplianceStatus())
    showToast('success', '记录已删除')
  }, [])

  // 更新配置
  const updateConfig = useCallback(() => {
    if (!enabled) {
      onChange({
        enabled: false,
        granularity: 'whole',
        paymentMethod: 'wechat_manual',
        paidNodes: [],
        price: 0,
        workId,
      })
      return
    }

    // 验证必要字段
    if (paymentMethod === 'wechat_manual' || paymentMethod === 'both') {
      if (!wechatQRCode) {
        showToast('error', '请上传微信收款码')
        return
      }
    }

    if (paymentMethod === 'third_party' || paymentMethod === 'both') {
      if (!thirdPartyLink) {
        showToast('error', '请填写第三方平台购买链接')
        return
      }
    }
    
    // 多渠道模式验证
    if (paymentMethod === 'multi') {
      const config = buildMultiChannelConfig()
      const hasAnyChannel = config.manualChannels.length > 0 || config.thirdPartyChannels.length > 0
      if (!hasAnyChannel) {
        showToast('error', '请至少启用一个收款渠道')
        return
      }
      
      // 验证各启用渠道的必要字段
      if (afdianEnabled && !afdianLink) {
        showToast('error', '请填写爱发电主页链接')
        return
      }
      if (mianbaoduoEnabled && !mianbaoduoLink) {
        showToast('error', '请填写面包多商品链接')
        return
      }
      if (manualWechatEnabled && !manualWechatQRCode) {
        showToast('error', '请上传微信收款码')
        return
      }
      if (manualAlipayEnabled && !manualAlipayQRCode) {
        showToast('error', '请上传支付宝收款码')
        return
      }
    }

    if (paidNodes.length === 0) {
      showToast('error', '请选择需要付费的节点')
      return
    }

    if (!seedKeyGenerated) {
      showToast('error', '请生成种子密钥')
      return
    }

    const newConfig: MonetizationConfig = {
      enabled,
      granularity,
      paymentMethod,
      wechatQRCode: paymentMethod === 'wechat_manual' || paymentMethod === 'both' ? wechatQRCode : undefined,
      wechatContact: paymentMethod === 'wechat_manual' || paymentMethod === 'both' ? wechatContact : undefined,
      thirdParty: paymentMethod === 'third_party' || paymentMethod === 'both' ? {
        platform: thirdPartyPlatform,
        link: thirdPartyLink,
        creatorName: thirdPartyCreatorName,
      } : undefined,
      multiChannel: paymentMethod === 'multi' ? buildMultiChannelConfig() : undefined,
      paidNodes,
      paidChapters: granularity === 'chapter' ? paidChapters : undefined,
      price,
      freePreviewNodes: freePreviewNodes.length > 0 ? freePreviewNodes : undefined,
      freePreviewText: freePreviewText || undefined,
      workId,
      seedKey,
    }

    onChange(newConfig)
    showToast('success', '付费设置已保存')
  }, [
    enabled, granularity, paymentMethod, wechatQRCode, wechatContact,
    thirdPartyPlatform, thirdPartyLink, thirdPartyCreatorName,
    paidNodes, paidChapters, price, freePreviewNodes, freePreviewText,
    workId, seedKey, seedKeyGenerated, onChange,
    buildMultiChannelConfig,
    afdianEnabled, afdianLink, mianbaoduoEnabled, mianbaoduoLink,
    manualWechatEnabled, manualWechatQRCode, manualAlipayEnabled, manualAlipayQRCode
  ])

  // 统计信息
  const stats = useMemo(() => {
    return getMonetizationStats({
      enabled,
      paidNodes,
      paidChapters,
      price,
      freePreviewNodes,
    })
  }, [enabled, paidNodes, paidChapters, price, freePreviewNodes])

  // 获取节点列表（用于选择付费节点）
  const filteredNodes = useMemo(() => {
    const nodes = graph.nodes.filter(n => 
      n.type !== 'condition' && n.type !== 'gather' && n.type !== 'jump' && n.type !== 'random'
    )
    if (!nodeFilter) return nodes
    
    const filterLower = nodeFilter.toLowerCase()
    return nodes.filter(n => {
      const data = n.data as Record<string, unknown>
      const text = (data?.text as string || '').toLowerCase()
      const title = (data?.title as string || '').toLowerCase()
      return text.includes(filterLower) || title.includes(filterLower) || n.id.includes(filterLower)
    })
  }, [graph.nodes, nodeFilter])

  // 获取分组作为章节建议
  const chapterSuggestions = useMemo(() => {
    return suggestPaidNodes(graph).nodeGroups
  }, [graph])

  // 切换付费节点选中
  const togglePaidNode = useCallback((nodeId: string) => {
    setPaidNodes(prev => 
      prev.includes(nodeId) 
        ? prev.filter(id => id !== nodeId)
        : [...prev, nodeId]
    )
  }, [])

  // 批量选择分组作为付费章节
  const selectGroupAsChapter = useCallback((groupId: string, groupName: string) => {
    const group = chapterSuggestions.find(g => g.id === groupId)
    if (!group) return
    
    const chapter: PaidChapter = {
      id: groupId,
      name: groupName,
      nodeIds: group.nodes,
      price: price,
    }
    
    setPaidChapters(prev => {
      const exists = prev.find(ch => ch.id === groupId)
      if (exists) {
        return prev.filter(ch => ch.id !== groupId)
      }
      return [...prev, chapter]
    })
    
    // 同时更新付费节点列表
    setPaidNodes(prev => {
      const newNodes = [...prev]
      group.nodes.forEach(nodeId => {
        if (!newNodes.includes(nodeId)) {
          newNodes.push(nodeId)
        }
      })
      return newNodes
    })
  }, [chapterSuggestions, price])

  const toggleFreePreviewNode = useCallback((nodeId: string) => {
    setFreePreviewNodes(prev =>
      prev.includes(nodeId)
        ? prev.filter(id => id !== nodeId)
        : [...prev, nodeId]
    )
  }, [])
  
  // 合规状态颜色配置
  const getComplianceLevelConfig = (level: string) => {
    switch (level) {
      case 'safe':
        return { color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/30', label: '安全', icon: Shield }
      case 'notice':
        return { color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/30', label: '关注', icon: Info }
      case 'warning':
        return { color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/30', label: '警告', icon: AlertTriangle }
      case 'critical':
        return { color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/30', label: '严重', icon: AlertCircle }
      default:
        return { color: 'text-muted-foreground', bg: 'bg-muted', border: 'border-border', label: '未知', icon: Info }
    }
  }
  
  // 渠道名称映射
  const getChannelName = (channel: string) => {
    const names: Record<string, string> = {
      wechat: '微信',
      alipay: '支付宝',
      afdian: '爱发电',
      mianbaoduo: '面包多',
      other: '其他',
    }
    return names[channel] || channel
  }

  // 渲染节点选择器
  const renderNodeSelector = () => (
    <div className="space-y-3">
      {/* 搜索框 */}
      <div className="relative">
        <input
          type="text"
          value={nodeFilter}
          onChange={(e) => setNodeFilter(e.target.value)}
          placeholder="搜索节点..."
          className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        {nodeFilter && (
          <button
            onClick={() => setNodeFilter('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 快速选择：按分组/章节 */}
      {granularity === 'chapter' && chapterSuggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">快速选择章节：</p>
          <div className="flex flex-wrap gap-2">
            {chapterSuggestions.map(group => (
              <button
                key={group.id}
                onClick={() => selectGroupAsChapter(group.id, group.name)}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  paidChapters.find(ch => ch.id === group.id)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                }`}
              >
                {group.name} ({group.nodes.length}节点)
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 节点列表 */}
      <div className="max-h-[300px] overflow-y-auto space-y-1 border border-border rounded-lg p-2">
        {filteredNodes.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">没有可选择的节点</p>
        ) : (
          filteredNodes.map(node => {
            const data = node.data as Record<string, unknown>
            const isSelected = paidNodes.includes(node.id)
            const isFree = freePreviewNodes.includes(node.id)
            const nodeTypeLabel = getNodeTypeName(node.type)
            
            return (
              <div
                key={node.id}
                className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                  isSelected 
                    ? 'bg-primary/10 border border-primary/30'
                    : 'hover:bg-muted'
                }`}
                onClick={() => togglePaidNode(node.id)}
              >
                {/* 选中状态 */}
                <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                  isSelected ? 'bg-primary border-primary' : 'border-border'
                }`}>
                  {isSelected && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
                </div>
                
                {/* 节点类型图标 */}
                <span className="text-xs text-muted-foreground w-16">{nodeTypeLabel}</span>
                
                {/* 节点内容摘要 */}
                <span className="text-sm truncate flex-1">
                  {(data?.text as string || data?.title as string || node.id).slice(0, 40)}
                </span>
                
                {/* 免费预览标记 */}
                {isSelected && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleFreePreviewNode(node.id)
                    }}
                    className={`px-1.5 py-0.5 rounded text-xs ${
                      isFree 
                        ? 'bg-green-500/20 text-green-500'
                        : 'bg-muted text-muted-foreground hover:bg-green-500/10'
                    }`}
                  >
                    {isFree ? '免费' : '付费'}
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* 统计 */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>已选择 {paidNodes.length} 个付费节点</span>
        {freePreviewNodes.length > 0 && (
          <span className="text-green-500">其中 {freePreviewNodes.length} 个免费预览</span>
        )}
      </div>
    </div>
  )
  
  // 渲染合规状态栏
  const renderComplianceBanner = () => {
    if (!complianceStatus) return null
    
    const levelConfig = getComplianceLevelConfig(complianceStatus.warningLevel)
    const LevelIcon = levelConfig.icon
    
    return (
      <div 
        className={`border ${levelConfig.border} ${levelConfig.bg} rounded-xl overflow-hidden cursor-pointer transition-all`}
        onClick={() => setShowComplianceDetail(!showComplianceDetail)}
      >
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${levelConfig.bg}`}>
                <LevelIcon className={`w-5 h-5 ${levelConfig.color}`} />
              </div>
              <div>
                <p className={`font-medium ${levelConfig.color}`}>
                  合规状态：{levelConfig.label}
                </p>
                <p className="text-xs text-muted-foreground">
                  本年度收入 ¥{complianceStatus.currentYearIncome.toFixed(2)}
                  <span className="mx-2">·</span>
                  月均 ¥{complianceStatus.monthlyAverage.toFixed(2)}
                </p>
              </div>
            </div>
            {showComplianceDetail ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
        </div>
        
        {showComplianceDetail && (
          <div className="px-4 pb-4 border-t border-border/50 pt-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">本年度收入</p>
                <p className="text-lg font-bold">¥{complianceStatus.currentYearIncome.toFixed(2)}</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">月均收入</p>
                <p className="text-lg font-bold">¥{complianceStatus.monthlyAverage.toFixed(2)}</p>
              </div>
            </div>
            
            {complianceStatus.warnings.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">合规提醒</p>
                {complianceStatus.warnings.map((warning, idx) => {
                  const warnLevel = getComplianceLevelConfig(warning.level)
                  const WarnIcon = warnLevel.icon
                  return (
                    <div 
                      key={idx} 
                      className={`p-3 rounded-lg border ${warnLevel.border} ${warnLevel.bg}`}
                    >
                      <div className="flex items-start gap-2">
                        <WarnIcon className={`w-4 h-4 ${warnLevel.color} mt-0.5 flex-shrink-0`} />
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${warnLevel.color}`}>{warning.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">{warning.message}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            当前：¥{warning.current.toFixed(2)} / 阈值：¥{warning.threshold.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <p className="text-sm text-green-500 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  当前无合规风险，继续保持！
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }
  
  // 渲染多渠道配置UI
  const renderMultiChannelConfig = () => (
    <div className="space-y-4">
      {/* 爱发电 */}
      <div className={`space-y-3 p-3 rounded-lg border transition-colors ${
        afdianEnabled ? 'bg-amber-500/5 border-amber-500/30' : 'bg-muted/30 border-border'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <p className="text-sm font-medium">爱发电</p>
            <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-500 text-xs rounded">
              推荐·订阅制
            </span>
            <span className="text-xs text-muted-foreground">抽成 6%</span>
          </div>
          <Toggle
            checked={afdianEnabled}
            onChange={setAfdianEnabled}
            color="bg-amber-500"
          />
        </div>
        
        {afdianEnabled && (
          <div className="space-y-3 pt-1">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                爱发电主页链接
              </label>
              <input
                type="url"
                value={afdianLink}
                onChange={(e) => {
                  const val = e.target.value
                  setAfdianLink(val)
                  // 自动提取用户ID
                  const extracted = extractPlatformUserId('afdian', val)
                  if (extracted && !afdianPlatformUserId) {
                    setAfdianPlatformUserId(extracted)
                  }
                }}
                placeholder="https://afdian.net/@你的名字"
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
              {afdianPlatformUserId && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  已识别用户 ID：<span className="text-amber-500 font-mono">{afdianPlatformUserId}</span>
                </p>
              )}
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                创作者名称（可选）
              </label>
              <input
                type="text"
                value={afdianCreatorName}
                onChange={(e) => setAfdianCreatorName(e.target.value)}
                placeholder="你在爱发电的昵称"
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                模式
              </label>
              <div className="flex gap-2">
                {[
                  { id: 'subscription', label: '订阅制' },
                  { id: 'onetime', label: '一次性买断' },
                ].map(option => (
                  <button
                    key={option.id}
                    onClick={() => setAfdianPlanType(option.id as 'subscription' | 'onetime')}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                      afdianPlanType === option.id
                        ? 'bg-amber-500 text-white'
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 自动解锁开关 */}
            <div className={`p-3 rounded-lg border transition-colors ${
              afdianAutoVerify ? 'bg-amber-500/10 border-amber-500/20' : 'bg-muted/30 border-border'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Unlock className="w-4 h-4 text-amber-500" />
                  <div>
                    <p className="text-sm font-medium">读者自助解锁</p>
                    <p className="text-[11px] text-muted-foreground">
                      支付后输入订单号即可自动解锁，无需你手动发码
                    </p>
                  </div>
                </div>
                <Toggle
                  checked={afdianAutoVerify}
                  onChange={setAfdianAutoVerify}
                  color="bg-amber-500"
                  size="sm"
                />
              </div>

              {afdianAutoVerify && (
                <div className="mt-3 pt-3 border-t border-border/50 space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1">
                      验证服务地址（可选）
                      <span className="text-[10px] text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">高级</span>
                    </label>
                    <input
                      type="url"
                      value={afdianVerifyEndpoint}
                      onChange={(e) => setAfdianVerifyEndpoint(e.target.value)}
                      placeholder="留空则使用手动确认模式"
                      className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      如果不填，读者输入订单号后会显示"等待创作者确认"，你可在创作者中心一键确认
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">方案 ID（可选）</label>
                      <input
                        type="text"
                        value={afdianPlanId}
                        onChange={(e) => setAfdianPlanId(e.target.value)}
                        placeholder="限定可解锁的方案"
                        className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">用户 ID</label>
                      <input
                        type="text"
                        value={afdianPlatformUserId}
                        onChange={(e) => setAfdianPlatformUserId(e.target.value)}
                        placeholder="自动提取或手动填写"
                        className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* 面包多 */}
      <div className={`space-y-3 p-3 rounded-lg border transition-colors ${
        mianbaoduoEnabled ? 'bg-orange-500/5 border-orange-500/30' : 'bg-muted/30 border-border'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cookie className="w-4 h-4 text-orange-500" />
            <p className="text-sm font-medium">面包多</p>
            <span className="px-1.5 py-0.5 bg-orange-500/20 text-orange-500 text-xs rounded">
              推荐·买断制
            </span>
            <span className="text-xs text-muted-foreground">抽成 3%</span>
          </div>
          <Toggle
            checked={mianbaoduoEnabled}
            onChange={setMianbaoduoEnabled}
            color="bg-orange-500"
          />
        </div>
        
        {mianbaoduoEnabled && (
          <div className="space-y-3 pt-1">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                面包多商品链接
              </label>
              <input
                type="url"
                value={mianbaoduoLink}
                onChange={(e) => {
                  const val = e.target.value
                  setMianbaoduoLink(val)
                  const extracted = extractPlatformUserId('mianbaoduo', val)
                  if (extracted && !mianbaoduoPlatformUserId) {
                    setMianbaoduoPlatformUserId(extracted)
                  }
                }}
                placeholder="https://mianbaoduo.com/o/你的作品"
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
              />
              {mianbaoduoPlatformUserId && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  已识别商品 ID：<span className="text-orange-500 font-mono">{mianbaoduoPlatformUserId}</span>
                </p>
              )}
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                创作者名称（可选）
              </label>
              <input
                type="text"
                value={mianbaoduoCreatorName}
                onChange={(e) => setMianbaoduoCreatorName(e.target.value)}
                placeholder="你在面包多的昵称"
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
              />
            </div>

            {/* 自动解锁开关 */}
            <div className={`p-3 rounded-lg border transition-colors ${
              mianbaoduoAutoVerify ? 'bg-orange-500/10 border-orange-500/20' : 'bg-muted/30 border-border'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Unlock className="w-4 h-4 text-orange-500" />
                  <div>
                    <p className="text-sm font-medium">读者自助解锁</p>
                    <p className="text-[11px] text-muted-foreground">
                      支付后输入订单号即可自动解锁，无需你手动发码
                    </p>
                  </div>
                </div>
                <Toggle
                  checked={mianbaoduoAutoVerify}
                  onChange={setMianbaoduoAutoVerify}
                  color="bg-orange-500"
                  size="sm"
                />
              </div>

              {mianbaoduoAutoVerify && (
                <div className="mt-3 pt-3 border-t border-border/50 space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1">
                      验证服务地址（可选）
                      <span className="text-[10px] text-orange-500 bg-orange-500/10 px-1.5 py-0.5 rounded">高级</span>
                    </label>
                    <input
                      type="url"
                      value={mianbaoduoVerifyEndpoint}
                      onChange={(e) => setMianbaoduoVerifyEndpoint(e.target.value)}
                      placeholder="留空则使用手动确认模式"
                      className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      如果不填，读者输入订单号后会显示"等待创作者确认"，你可在创作者中心一键确认
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">商品 ID（可选）</label>
                      <input
                        type="text"
                        value={mianbaoduoPlanId}
                        onChange={(e) => setMianbaoduoPlanId(e.target.value)}
                        placeholder="限定可解锁的商品"
                        className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">店铺 ID</label>
                      <input
                        type="text"
                        value={mianbaoduoPlatformUserId}
                        onChange={(e) => setMianbaoduoPlatformUserId(e.target.value)}
                        placeholder="自动提取或手动填写"
                        className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* 个人收款码 */}
      <div className={`space-y-3 p-3 rounded-lg border transition-colors ${
        manualWechatEnabled || manualAlipayEnabled 
          ? 'bg-green-500/5 border-green-500/30' 
          : 'bg-muted/30 border-border'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-green-500" />
            <p className="text-sm font-medium">个人收款码</p>
            <span className="px-1.5 py-0.5 bg-green-500/20 text-green-500 text-xs rounded">
              零抽成
            </span>
            <span className="text-xs text-muted-foreground">有风控风险</span>
          </div>
        </div>
        
        <div className="space-y-3 pt-1">
          {/* 微信收款码 */}
          <div className="p-2 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-green-500" />
                <span className="text-xs font-medium">微信收款</span>
              </div>
              <Toggle
                checked={manualWechatEnabled}
                onChange={setManualWechatEnabled}
                color="bg-green-500"
                size="sm"
              />
            </div>
            
            {manualWechatEnabled && (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  {manualWechatQRCode ? (
                    <div className="relative">
                      <img
                        src={manualWechatQRCode}
                        alt="微信收款码"
                        className="w-16 h-16 rounded-lg object-cover border border-border"
                      />
                      <button
                        onClick={() => setManualWechatQRCode('')}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ) : (
                    <label className="w-16 h-16 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-green-500/50 transition-colors">
                      <Upload className="w-4 h-4 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground mt-0.5">上传</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleUploadMultiQRCode(e, 'wechat')}
                        className="hidden"
                      />
                    </label>
                  )}
                  <div className="flex-1">
                    <input
                      type="text"
                      value={manualWechatContact}
                      onChange={(e) => setManualWechatContact(e.target.value)}
                      placeholder="微信号（可选）"
                      className="w-full px-2 py-1.5 bg-muted border border-border rounded text-xs focus:outline-none focus:ring-2 focus:ring-green-500/50"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* 支付宝收款码 */}
          <div className="p-2 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-medium">支付宝收款</span>
              </div>
              <Toggle
                checked={manualAlipayEnabled}
                onChange={setManualAlipayEnabled}
                color="bg-blue-500"
                size="sm"
              />
            </div>
            
            {manualAlipayEnabled && (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  {manualAlipayQRCode ? (
                    <div className="relative">
                      <img
                        src={manualAlipayQRCode}
                        alt="支付宝收款码"
                        className="w-16 h-16 rounded-lg object-cover border border-border"
                      />
                      <button
                        onClick={() => setManualAlipayQRCode('')}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ) : (
                    <label className="w-16 h-16 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-500/50 transition-colors">
                      <Upload className="w-4 h-4 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground mt-0.5">上传</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleUploadMultiQRCode(e, 'alipay')}
                        className="hidden"
                      />
                    </label>
                  )}
                  <div className="flex-1">
                    <input
                      type="text"
                      value={manualAlipayContact}
                      onChange={(e) => setManualAlipayContact(e.target.value)}
                      placeholder="支付宝账号（可选）"
                      className="w-full px-2 py-1.5 bg-muted border border-border rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* 主推渠道选择 */}
      <div className="space-y-2">
        <p className="text-sm font-medium">主推渠道</p>
        <p className="text-xs text-muted-foreground">
          读者看到的第一个收款方式
        </p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'afdian', label: '爱发电', enabled: afdianEnabled, color: 'amber' },
            { id: 'mianbaoduo', label: '面包多', enabled: mianbaoduoEnabled, color: 'orange' },
            { id: 'manual', label: '收款码', enabled: manualWechatEnabled || manualAlipayEnabled, color: 'green' },
          ].map(option => (
            <button
              key={option.id}
              disabled={!option.enabled}
              onClick={() => setPrimaryChannel(option.id as typeof primaryChannel)}
              className={`p-2 rounded-lg text-xs transition-all relative ${
                !option.enabled
                  ? 'bg-muted/50 text-muted-foreground/50 cursor-not-allowed'
                  : primaryChannel === option.id
                    ? 'bg-primary text-primary-foreground ring-2 ring-primary/30'
                    : 'bg-muted hover:bg-muted/80'
              }`}
            >
              {primaryChannel === option.id && option.enabled && (
                <Star className="w-3 h-3 absolute top-1 right-1 fill-current" />
              )}
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
  
  // 渲染收入记录区域
  const renderIncomeSection = () => (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setExpandedSection(expandedSection === 'income' ? '' : 'income')}
        className="flex items-center justify-between w-full p-4 bg-muted/20 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          <span className="font-medium">收入记录与合规</span>
          {incomeRecords.length > 0 && (
            <span className="px-2 py-0.5 bg-primary/20 text-primary rounded text-xs">
              {incomeRecords.length} 条
            </span>
          )}
        </div>
        {expandedSection === 'income' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      
      {expandedSection === 'income' && (
        <div className="p-4 space-y-4">
          {/* 操作按钮 */}
          <div className="flex gap-2">
            <Button
              onClick={() => setShowAddIncomeModal(true)}
              size="sm"
              className="flex-1"
            >
              <Plus className="w-4 h-4 mr-2" />
              添加收入记录
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
            >
              <FileText className="w-4 h-4 mr-2" />
              合规指南
            </Button>
          </div>
          
          {/* 收入记录列表 */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">本年度收入记录</p>
            {incomeRecords.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">暂无收入记录</p>
                <p className="text-xs">添加收入记录以追踪合规状态</p>
              </div>
            ) : (
              <div className="max-h-[300px] overflow-y-auto space-y-1.5">
                {incomeRecords.map(record => (
                  <div
                    key={record.id}
                    className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{record.workTitle}</p>
                      <p className="text-xs text-muted-foreground">
                        {getChannelName(record.channel)}
                        <span className="mx-1.5">·</span>
                        {new Date(record.date).toLocaleDateString('zh-CN')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">¥{record.amount.toFixed(2)}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteIncomeRecord(record.id)}
                      className="p-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* 年度总计 */}
          {incomeRecords.length > 0 && (
            <div className="p-3 bg-muted/50 rounded-lg flex items-center justify-between">
              <span className="text-sm text-muted-foreground">本年度合计</span>
              <span className="text-lg font-bold">
                ¥{incomeRecords.reduce((sum, r) => sum + r.amount, 0).toFixed(2)}
              </span>
            </div>
          )}
        </div>
      )}
      
      {/* 添加收入记录弹窗 */}
      {showAddIncomeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-border rounded-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">添加收入记录</h3>
              <button
                onClick={() => setShowAddIncomeModal(false)}
                className="p-1 hover:bg-muted rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1 block">金额（元）</label>
                <input
                  type="number"
                  value={newIncomeAmount}
                  onChange={(e) => setNewIncomeAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  min="0"
                  step="0.01"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-1 block">作品名称</label>
                <input
                  type="text"
                  value={newIncomeWorkTitle}
                  onChange={(e) => setNewIncomeWorkTitle(e.target.value)}
                  placeholder="作品名称"
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-1 block">收款渠道</label>
                <select
                  value={newIncomeChannel}
                  onChange={(e) => setNewIncomeChannel(e.target.value as IncomeRecord['channel'])}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="afdian">爱发电</option>
                  <option value="mianbaoduo">面包多</option>
                  <option value="wechat">微信</option>
                  <option value="alipay">支付宝</option>
                  <option value="other">其他</option>
                </select>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-1 block">备注（可选）</label>
                <input
                  type="text"
                  value={newIncomeNote}
                  onChange={(e) => setNewIncomeNote(e.target.value)}
                  placeholder="订单号等备注信息"
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>
            
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowAddIncomeModal(false)}
              >
                取消
              </Button>
              <Button
                className="flex-1"
                onClick={handleAddIncomeRecord}
              >
                确认添加
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-4">
      {/* 合规状态栏 */}
      {renderComplianceBanner()}
      
      {/* 开启付费开关 */}
      <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl">
        <div className="flex items-center gap-3">
          <Lock className="w-5 h-5 text-primary" />
          <div>
            <p className="font-medium">开启付费解锁</p>
            <p className="text-xs text-muted-foreground">让读者付费解锁部分内容</p>
          </div>
        </div>
        <Toggle
          checked={enabled}
          onChange={setEnabled}
          color="bg-primary"
        />
      </div>

      {enabled && (
        <>
          {/* 基础设置 */}
          <div className="border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => setExpandedSection(expandedSection === 'basic' ? '' : 'basic')}
              className="flex items-center justify-between w-full p-4 bg-muted/20 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                <span className="font-medium">基础设置</span>
              </div>
              {expandedSection === 'basic' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            
            {expandedSection === 'basic' && (
              <div className="p-4 space-y-4">
                {/* 付费粒度 */}
                <div>
                  <label className="text-sm font-medium mb-2 block">付费粒度</label>
                  <div className="flex gap-2">
                    {[
                      { id: 'whole', label: '整本付费', desc: '一次付费解锁全部内容' },
                      { id: 'chapter', label: '按章节付费', desc: '每章节单独定价' },
                    ].map(option => (
                      <button
                        key={option.id}
                        onClick={() => setGranularity(option.id as PaymentGranularity)}
                        className={`flex-1 p-3 rounded-lg border transition-colors ${
                          granularity === option.id
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:border-primary/30'
                        }`}
                      >
                        <p className="font-medium text-sm">{option.label}</p>
                        <p className="text-xs text-muted-foreground mt-1">{option.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 价格设置 */}
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    {granularity === 'whole' ? '整本价格' : '默认章节价格'}
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {DEFAULT_PRICE_OPTIONS.map(p => (
                      <button
                        key={p}
                        onClick={() => setPrice(p)}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          price === p
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted hover:bg-muted/80'
                        }`}
                      >
                        ¥{p}
                      </button>
                    ))}
                    <input
                      type="number"
                      value={customPrice}
                      onChange={(e) => {
                        setCustomPrice(e.target.value)
                        const val = parseFloat(e.target.value)
                        if (val > 0) setPrice(val)
                      }}
                      placeholder="自定义"
                      className="w-20 px-2 py-1.5 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      min="0"
                      step="0.1"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    当前定价：{formatPrice(price)}
                  </p>
                </div>

                {/* 免费预览说明 */}
                <div>
                  <label className="text-sm font-medium mb-2 block">免费预览说明</label>
                  <textarea
                    value={freePreviewText}
                    onChange={(e) => setFreePreviewText(e.target.value)}
                    placeholder="告诉读者哪些内容可以免费阅读..."
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                    rows={2}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 收款方式设置 */}
          <div className="border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => setExpandedSection(expandedSection === 'payment' ? '' : 'payment')}
              className="flex items-center justify-between w-full p-4 bg-muted/20 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                <span className="font-medium">收款方式</span>
              </div>
              {expandedSection === 'payment' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            
            {expandedSection === 'payment' && (
              <div className="p-4 space-y-4">
                {/* 收款方式选择 */}
                <div>
                  <label className="text-sm font-medium mb-2 block">收款方式</label>
                  <div className="space-y-2">
                    {[
                      { id: 'multi', label: '多渠道收款', desc: '推荐：爱发电+面包多+收款码', icon: Wallet, badge: '推荐' },
                      { id: 'wechat_manual', label: '微信手动收款', desc: '适合刚开始，零门槛', icon: MessageCircle },
                      { id: 'third_party', label: '第三方平台', desc: '爱发电/面包多等', icon: Globe },
                      { id: 'both', label: '两种都支持', desc: '覆盖更多读者', icon: CreditCard },
                    ].map(option => (
                      <button
                        key={option.id}
                        onClick={() => setPaymentMethod(option.id as PaymentMethod)}
                        className={`flex items-center gap-3 w-full p-3 rounded-lg border transition-colors ${
                          paymentMethod === option.id
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:border-primary/30'
                        }`}
                      >
                        <option.icon className={`w-5 h-5 ${option.id === 'multi' ? 'text-amber-500' : ''}`} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{option.label}</p>
                            {option.badge && (
                              <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-500 text-[10px] rounded">
                                {option.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{option.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 多渠道收款配置 */}
                {paymentMethod === 'multi' && renderMultiChannelConfig()}

                {/* 微信收款设置 */}
                {(paymentMethod === 'wechat_manual' || paymentMethod === 'both') && (
                  <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <QrCode className="w-4 h-4" /> 微信收款码
                    </p>
                    
                    {/* 上传收款码 */}
                    <div className="flex items-center gap-4">
                      {qrCodePreview ? (
                        <div className="relative">
                          <img
                            src={qrCodePreview}
                            alt="收款码"
                            className="w-24 h-24 rounded-lg object-cover"
                          />
                          <button
                            onClick={() => {
                              setWechatQRCode('')
                              setQrCodePreview('')
                            }}
                            className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <label className="w-24 h-24 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
                          <Upload className="w-6 h-6 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground mt-1">上传</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleUploadQRCode}
                            className="hidden"
                          />
                        </label>
                      )}
                      <p className="text-xs text-muted-foreground">
                        上传你的微信收款码图片<br />
                        建议使用收款码截图
                      </p>
                    </div>

                    {/* 微信号（可选） */}
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        微信号（可选，方便读者联系）
                      </label>
                      <input
                        type="text"
                        value={wechatContact}
                        onChange={(e) => setWechatContact(e.target.value)}
                        placeholder="你的微信号"
                        className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>
                  </div>
                )}

                {/* 第三方平台设置 */}
                {(paymentMethod === 'third_party' || paymentMethod === 'both') && (
                  <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Link2 className="w-4 h-4" /> 第三方平台
                    </p>
                    
                    {/* 平台选择 */}
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">选择平台</label>
                      <select
                        value={thirdPartyPlatform}
                        onChange={(e) => setThirdPartyPlatform(e.target.value as ThirdPartyPlatform)}
                        className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      >
                        {Object.entries(THIRD_PARTY_PLATFORMS).map(([key, value]) => (
                          <option key={key} value={key}>
                            {value.name}（手续费 {value.fee}）
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 购买链接 */}
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        平台购买页链接
                      </label>
                      <input
                        type="url"
                        value={thirdPartyLink}
                        onChange={(e) => setThirdPartyLink(e.target.value)}
                        placeholder={`如 https://afdian.net/@yourname`}
                        className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>

                    {/* 创作者名称 */}
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        平台上的创作者名称（可选）
                      </label>
                      <input
                        type="text"
                        value={thirdPartyCreatorName}
                        onChange={(e) => setThirdPartyCreatorName(e.target.value)}
                        placeholder="读者在平台上看到的名称"
                        className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>

                    {/* 平台说明 */}
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      需要先在第三方平台注册账号并上架作品
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 付费内容设置 */}
          <div className="border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => setExpandedSection(expandedSection === 'content' ? '' : 'content')}
              className="flex items-center justify-between w-full p-4 bg-muted/20 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                <span className="font-medium">付费内容</span>
                {paidNodes.length > 0 && (
                  <span className="px-2 py-0.5 bg-primary/20 text-primary rounded text-xs">
                    {paidNodes.length} 节点
                  </span>
                )}
              </div>
              {expandedSection === 'content' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            
            {expandedSection === 'content' && (
              <div className="p-4">
                {renderNodeSelector()}
              </div>
            )}
          </div>

          {/* 种子密钥设置 */}
          <div className="border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => setExpandedSection(expandedSection === 'security' ? '' : 'security')}
              className="flex items-center justify-between w-full p-4 bg-muted/20 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                <span className="font-medium">安全密钥</span>
                {seedKeyGenerated && (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                )}
              </div>
              {expandedSection === 'security' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            
            {expandedSection === 'security' && (
              <div className="p-4 space-y-4">
                {/* 种子密钥状态 */}
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-sm font-medium mb-2">种子密钥</p>
                  
                  {seedKeyGenerated ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 px-3 py-2 bg-muted border border-border rounded font-mono text-sm">
                          {showSeedKey ? seedKey : SEED_KEY_PREFIX + '••••••••••••••••••••••••••••••••'}
                        </div>
                        <button
                          onClick={() => setShowSeedKey(!showSeedKey)}
                          className="p-2 bg-muted rounded hover:bg-muted/80 transition-colors"
                        >
                          {showSeedKey ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-xs text-green-500 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        已生成并保存到本地
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        种子密钥用于生成解锁码，请妥善保管
                      </p>
                      <Button
                        onClick={handleGenerateSeedKey}
                        size="sm"
                        className="w-full"
                      >
                        <Shield className="w-4 h-4 mr-2" />
                        生成种子密钥
                      </Button>
                    </div>
                  )}
                </div>

                {/* 安全提示 */}
                <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                  <p className="text-sm font-medium text-orange-500 flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4" />
                    安全提示
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• 种子密钥只有你自己知道，请勿泄露给任何人</li>
                    <li>• 建议备份到密码管理器（如 1Password）</li>
                    <li>• 密钥丢失后无法再生成解锁码（已发出的仍有效）</li>
                    <li>• 如怀疑泄露，可重新导出作品生成新密钥</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
          
          {/* 收入记录与合规 */}
          {renderIncomeSection()}

          {/* 统计概览 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-muted/30 rounded-lg text-center">
              <p className="text-xs text-muted-foreground">付费节点</p>
              <p className="font-bold text-lg">{stats.totalPaidNodes}</p>
            </div>
            <div className="p-3 bg-muted/30 rounded-lg text-center">
              <p className="text-xs text-muted-foreground">价格范围</p>
              <p className="font-bold text-lg">
                {formatPrice(stats.priceRange.min)} - {formatPrice(stats.priceRange.max)}
              </p>
            </div>
          </div>

          {/* 保存按钮 */}
          <Button
            onClick={updateConfig}
            className="w-full"
            disabled={!seedKeyGenerated}
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            保存付费设置
          </Button>
        </>
      )}
    </div>
  )
}

// 获取节点类型名称
function getNodeTypeName(type: string): string {
  const names: Record<string, string> = {
    dialogue: '对话',
    choice: '选择',
    ending: '结局',
    cg: 'CG',
    narration: '旁白',
    unlock: '解锁',
  }
  return names[type] || type
}

function Bread({ className }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 9a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z" />
      <path d="M3 9h18" />
      <path d="M12 6V3" />
      <path d="M7 14h10" />
    </svg>
  )
}
