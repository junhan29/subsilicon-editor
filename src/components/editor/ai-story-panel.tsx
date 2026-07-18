'use client'

import { useState, useCallback } from 'react'
import { Sparkles, Play, Users, MapPin, Clock, Smile, Copy, Check, Download, BookOpen, Wand2 } from 'lucide-react'
import { Button } from '@editor/components/ui/button'
import { Input } from '@editor/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@editor/components/ui/select'
import { Slider } from '@editor/components/ui/slider'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@editor/components/ui/card'
import { Badge } from '@editor/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@editor/components/ui/tabs'
import { ScrollArea } from '@editor/components/ui/scroll-area'
import { showToast } from './toast'
import { AiSettingsDialog } from './ai-settings-dialog'
import {
  generateFullStory,
  generateCharacterDetail,
  generateDialogue,
  generateSceneDescription,
  type AiFullStoryResult,
  type AiCharacter,
} from '@editor/lib/ai-service'
import { convertAiStoryToGraph, convertAiCharacterToStoryCharacter } from '@editor/lib/ai-story-converter'
import type { StoryNode, StoryEdge, StoryCharacter } from '@editor/types/editor'

interface AiStoryPanelProps {
  onApplyStory: (nodes: StoryNode[], edges: StoryEdge[], characters: StoryCharacter[], title: string) => void
  onAddCharacters: (characters: StoryCharacter[]) => void
}

const GENRES = [
  { value: 'romance', label: '恋爱', icon: '💕' },
  { value: 'adventure', label: '冒险', icon: '⚔️' },
  { value: 'mystery', label: '悬疑', icon: '🔍' },
  { value: 'fantasy', label: '奇幻', icon: '🧙' },
  { value: 'scifi', label: '科幻', icon: '🚀' },
  { value: 'comedy', label: '喜剧', icon: '😄' },
  { value: 'horror', label: '恐怖', icon: '👻' },
  { value: 'drama', label: '剧情', icon: '🎭' },
]

const EMOTIONS = ['开心', '悲伤', '愤怒', '惊讶', '紧张', '浪漫', '神秘']

export function AiStoryPanel({ onApplyStory, onAddCharacters }: AiStoryPanelProps) {
  const [tab, setTab] = useState('full-story')
  const [showSettings, setShowSettings] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedStory, setGeneratedStory] = useState<AiFullStoryResult | null>(null)
  const [generatedCharacter, setGeneratedCharacter] = useState<AiCharacter | null>(null)
  const [generatedDialogue, setGeneratedDialogue] = useState<{ character: string; text: string; emotion?: string }[]>([])
  const [generatedScene, setGeneratedScene] = useState<{ description: string; mood: string; lighting: string } | null>(null)

  const [storyTopic, setStoryTopic] = useState('')
  const [storyGenre, setStoryGenre] = useState('fantasy')
  const [storyCharacterCount, setStoryCharacterCount] = useState(3)
  const [storySceneCount, setStorySceneCount] = useState(5)

  const [charName, setCharName] = useState('')
  const [charPersonality, setCharPersonality] = useState('')
  const [charGenre, setCharGenre] = useState('general')

  const [dialogueCharacters, setDialogueCharacters] = useState('')
  const [dialogueContext, setDialogueContext] = useState('')
  const [dialogueEmotion, setDialogueEmotion] = useState('')

  const [sceneLocation, setSceneLocation] = useState('')
  const [sceneTimeOfDay, setSceneTimeOfDay] = useState('')
  const [sceneMood, setSceneMood] = useState('')

  const handleGenerateFullStory = useCallback(async () => {
    if (!storyTopic.trim()) {
      showToast('error', '请输入故事主题')
      return
    }
    setIsGenerating(true)
    try {
      const result = await generateFullStory(
        storyTopic,
        storyGenre,
        storyCharacterCount,
        storySceneCount
      )
      setGeneratedStory(result)
      showToast('success', `故事「${result.title}」生成成功！`)
    } catch (error) {
      if (error instanceof Error && 'needsConfig' in error && (error as { needsConfig: boolean }).needsConfig) {
        setShowSettings(true)
        showToast('error', '创境未配置，请先设置 API Key 或启动本地 Ollama')
      } else {
        showToast('error', (error as Error).message)
      }
    } finally {
      setIsGenerating(false)
    }
  }, [storyTopic, storyGenre, storyCharacterCount, storySceneCount])

  const handleApplyStory = useCallback(() => {
    if (!generatedStory) return
    const { nodes, edges, characters } = convertAiStoryToGraph(generatedStory)
    onApplyStory(nodes, edges, characters, generatedStory.title)
    showToast('success', '故事已应用到画布')
  }, [generatedStory, onApplyStory])

  const handleGenerateCharacter = useCallback(async () => {
    if (!charName.trim()) {
      showToast('error', '请输入角色名称')
      return
    }
    setIsGenerating(true)
    try {
      const result = await generateCharacterDetail(charName, charPersonality || '普通', charGenre)
      setGeneratedCharacter(result.character)
      showToast('success', `角色「${result.character.name}」生成成功！`)
    } catch (error) {
      if (error instanceof Error && 'needsConfig' in error && (error as { needsConfig: boolean }).needsConfig) {
        setShowSettings(true)
        showToast('error', '创境未配置，请先设置 API Key 或启动本地 Ollama')
      } else {
        showToast('error', (error as Error).message)
      }
    } finally {
      setIsGenerating(false)
    }
  }, [charName, charPersonality, charGenre])

  const handleAddCharacter = useCallback(() => {
    if (!generatedCharacter) return
    const storyChar = convertAiCharacterToStoryCharacter(generatedCharacter)
    onAddCharacters([storyChar])
    showToast('success', `角色「${generatedCharacter.name}」已添加`)
  }, [generatedCharacter, onAddCharacters])

  const handleGenerateDialogue = useCallback(async () => {
    if (!dialogueCharacters.trim() || !dialogueContext.trim()) {
      showToast('error', '请填写角色和上下文')
      return
    }
    setIsGenerating(true)
    try {
      const chars = dialogueCharacters.split(/[,，、]/).map((c) => c.trim()).filter(Boolean)
      const result = await generateDialogue(chars, dialogueContext, dialogueEmotion)
      setGeneratedDialogue(result.lines)
      showToast('success', '对话生成成功！')
    } catch (error) {
      if (error instanceof Error && 'needsConfig' in error && (error as { needsConfig: boolean }).needsConfig) {
        setShowSettings(true)
        showToast('error', '创境未配置，请先设置 API Key 或启动本地 Ollama')
      } else {
        showToast('error', (error as Error).message)
      }
    } finally {
      setIsGenerating(false)
    }
  }, [dialogueCharacters, dialogueContext, dialogueEmotion])

  const handleGenerateScene = useCallback(async () => {
    if (!sceneLocation.trim()) {
      showToast('error', '请输入地点')
      return
    }
    setIsGenerating(true)
    try {
      const result = await generateSceneDescription(sceneLocation, sceneTimeOfDay || '白天', sceneMood || '普通')
      setGeneratedScene({
        description: result.description,
        mood: result.mood,
        lighting: result.lighting,
      })
      showToast('success', '场景描述生成成功！')
    } catch (error) {
      if (error instanceof Error && 'needsConfig' in error && (error as { needsConfig: boolean }).needsConfig) {
        setShowSettings(true)
        showToast('error', '创境未配置，请先设置 API Key 或启动本地 Ollama')
      } else {
        showToast('error', (error as Error).message)
      }
    } finally {
      setIsGenerating(false)
    }
  }, [sceneLocation, sceneTimeOfDay, sceneMood])

  const handleCopyText = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text)
    showToast('success', '已复制到剪贴板')
  }, [])

  return (
    <div className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="w-5 h-5 text-amber-400" />
          创境叙事生成
        </CardTitle>
        <CardDescription>让创境帮你生成故事骨架，专注细节打磨</CardDescription>
      </CardHeader>

      <Tabs value={tab} onValueChange={setTab} className="flex-1 min-h-0">
        <TabsList className="grid w-full grid-cols-4 mb-4">
          <TabsTrigger value="full-story" className="text-xs">
            <BookOpen className="w-3.5 h-3.5 mr-1.5" />
            完整故事
          </TabsTrigger>
          <TabsTrigger value="character" className="text-xs">
            <Users className="w-3.5 h-3.5 mr-1.5" />
            角色生成
          </TabsTrigger>
          <TabsTrigger value="dialogue" className="text-xs">
            <Wand2 className="w-3.5 h-3.5 mr-1.5" />
            对话生成
          </TabsTrigger>
          <TabsTrigger value="scene" className="text-xs">
            <MapPin className="w-3.5 h-3.5 mr-1.5" />
            场景描述
          </TabsTrigger>
        </TabsList>

        <TabsContent value="full-story" className="flex-1 min-h-0">
          <div className="space-y-4 h-full flex flex-col">
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">故事主题</label>
                <Input
                  value={storyTopic}
                  onChange={(e) => setStoryTopic(e.target.value)}
                  placeholder="例如：在魔法学院的冒险"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">故事类型</label>
                <div className="flex flex-wrap gap-2">
                  {GENRES.map((g) => (
                    <button
                      key={g.value}
                      onClick={() => setStoryGenre(g.value)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        storyGenre === g.value
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted hover:bg-muted/80'
                      }`}
                    >
                      {g.icon} {g.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    角色数量: {storyCharacterCount}
                  </label>
                  <Slider
                    value={[storyCharacterCount]}
                    onValueChange={([v]) => setStoryCharacterCount(v)}
                    min={2}
                    max={6}
                    step={1}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    场景数量: {storySceneCount}
                  </label>
                  <Slider
                    value={[storySceneCount]}
                    onValueChange={([v]) => setStorySceneCount(v)}
                    min={3}
                    max={10}
                    step={1}
                  />
                </div>
              </div>
            </div>

            <Button
              onClick={handleGenerateFullStory}
              disabled={isGenerating || !storyTopic.trim()}
              className="w-full"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {isGenerating ? '生成中...' : '生成完整故事'}
            </Button>

            {generatedStory && (
              <ScrollArea className="flex-1 min-h-0">
                <Card className="mb-4">
                  <CardHeader>
                    <CardTitle className="text-base">{generatedStory.title}</CardTitle>
                    <CardDescription>{generatedStory.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium mb-2">角色列表</h4>
                      <div className="space-y-2">
                        {generatedStory.characters.map((char) => (
                          <div key={char.id} className="bg-muted/50 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline">{char.occupation}</Badge>
                              <span className="text-xs text-muted-foreground">{char.age}</span>
                            </div>
                            <p className="font-medium">{char.name}</p>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {char.bio}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium mb-2">场景大纲</h4>
                      <div className="space-y-3">
                        {generatedStory.scenes.map((scene, idx) => (
                          <div key={scene.id} className="bg-muted/50 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-mono bg-muted rounded px-1.5 py-0.5">
                                {scene.id}
                              </span>
                              {idx === generatedStory.scenes.length - 1 && (
                                <Badge variant="secondary">结局</Badge>
                              )}
                            </div>
                            <p className="font-medium text-sm">{scene.title}</p>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-3">
                              {scene.description}
                            </p>
                            {scene.characters.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {scene.characters.map((c) => (
                                  <span
                                    key={c}
                                    className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded"
                                  >
                                    {c}
                                  </span>
                                ))}
                              </div>
                            )}
                            {scene.choices && scene.choices.length > 0 && (
                              <div className="mt-2">
                                <p className="text-xs text-muted-foreground mb-1">选择:</p>
                                <ul className="space-y-1">
                                  {scene.choices.map((choice, cidx) => (
                                    <li key={cidx} className="text-xs flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                                      {choice.text}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <div className="flex gap-2">
                  <Button onClick={handleApplyStory} className="flex-1">
                    <Play className="w-4 h-4 mr-2" />
                    应用到画布
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleCopyText(JSON.stringify(generatedStory, null, 2))}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </ScrollArea>
            )}
          </div>
        </TabsContent>

        <TabsContent value="character" className="flex-1 min-h-0">
          <div className="space-y-4 h-full flex flex-col">
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">角色名称</label>
                <Input
                  value={charName}
                  onChange={(e) => setCharName(e.target.value)}
                  placeholder="例如：林晓月"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">性格特点</label>
                <Input
                  value={charPersonality}
                  onChange={(e) => setCharPersonality(e.target.value)}
                  placeholder="例如：温柔、勇敢、有些固执"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">故事类型</label>
                <Select value={charGenre} onValueChange={setCharGenre}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">通用</SelectItem>
                    {GENRES.map((g) => (
                      <SelectItem key={g.value} value={g.value}>
                        {g.icon} {g.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={handleGenerateCharacter}
              disabled={isGenerating || !charName.trim()}
              className="w-full"
            >
              <Users className="w-4 h-4 mr-2" />
              {isGenerating ? '生成中...' : '生成角色设定'}
            </Button>

            {generatedCharacter && (
              <ScrollArea className="flex-1 min-h-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{generatedCharacter.name}</CardTitle>
                    <div className="flex gap-2">
                      <Badge variant="outline">{generatedCharacter.gender}</Badge>
                      <Badge variant="outline">{generatedCharacter.age}</Badge>
                      <Badge variant="outline">{generatedCharacter.occupation}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium mb-1">性格特点</h4>
                      <div className="flex flex-wrap gap-1">
                        {generatedCharacter.personality.map((p) => (
                          <Badge key={p}>{p}</Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium mb-1">外貌特征</h4>
                      <div className="flex flex-wrap gap-1">
                        {generatedCharacter.appearance.map((a) => (
                          <Badge key={a} variant="secondary">
                            {a}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium mb-1">背景故事</h4>
                      <p className="text-sm text-muted-foreground">{generatedCharacter.background}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium mb-1">说话风格</h4>
                      <p className="text-sm">{generatedCharacter.speech.tone}</p>
                      {generatedCharacter.speech.catchphrases.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs text-muted-foreground mb-1">口头禅:</p>
                          <div className="flex flex-wrap gap-1">
                            {generatedCharacter.speech.catchphrases.map((cp) => (
                              <span
                                key={cp}
                                className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded"
                              >
                                {cp}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-medium mb-1">核心动机</h4>
                      <p className="text-sm">{generatedCharacter.motivation}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium mb-1">角色简介</h4>
                      <p className="text-sm text-muted-foreground">{generatedCharacter.bio}</p>
                    </div>
                  </CardContent>
                </Card>
                <div className="flex gap-2 mt-4">
                  <Button onClick={handleAddCharacter} className="flex-1">
                    <Users className="w-4 h-4 mr-2" />
                    添加到项目
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleCopyText(generatedCharacter.bio)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </ScrollArea>
            )}
          </div>
        </TabsContent>

        <TabsContent value="dialogue" className="flex-1 min-h-0">
          <div className="space-y-4 h-full flex flex-col">
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">角色名称</label>
                <Input
                  value={dialogueCharacters}
                  onChange={(e) => setDialogueCharacters(e.target.value)}
                  placeholder="多个角色用逗号分隔，如：小明, 小红"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">对话上下文</label>
                <textarea
                  value={dialogueContext}
                  onChange={(e) => setDialogueContext(e.target.value)}
                  placeholder="描述对话发生的场景和目的"
                  className="w-full px-3 py-2 rounded-lg border bg-background text-sm resize-none h-24"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">整体情绪（可选）</label>
                <div className="flex flex-wrap gap-2">
                  {EMOTIONS.map((e) => (
                    <button
                      key={e}
                      onClick={() => setDialogueEmotion(dialogueEmotion === e ? '' : e)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        dialogueEmotion === e
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted hover:bg-muted/80'
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <Button
              onClick={handleGenerateDialogue}
              disabled={isGenerating || !dialogueCharacters.trim() || !dialogueContext.trim()}
              className="w-full"
            >
              <Wand2 className="w-4 h-4 mr-2" />
              {isGenerating ? '生成中...' : '生成对话'}
            </Button>

            {generatedDialogue.length > 0 && (
              <ScrollArea className="flex-1 min-h-0">
                <Card>
                  <CardContent className="space-y-3">
                    {generatedDialogue.map((line, idx) => (
                      <div
                        key={idx}
                        className="flex gap-3 p-3 bg-muted/30 rounded-lg"
                      >
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                          <span className="text-sm font-medium">
                            {line.character.charAt(0)}
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">{line.character}</span>
                            {line.emotion && (
                              <Badge variant="outline" className="text-xs">
                                {line.emotion}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm">{line.text}</p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Button
                  variant="outline"
                  onClick={() => handleCopyText(
                    generatedDialogue
                      .map((l) => `${l.character}：${l.text}`)
                      .join('\n')
                  )}
                  className="w-full mt-4"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  复制对话文本
                </Button>
              </ScrollArea>
            )}
          </div>
        </TabsContent>

        <TabsContent value="scene" className="flex-1 min-h-0">
          <div className="space-y-4 h-full flex flex-col">
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5" />
                  地点
                </label>
                <Input
                  value={sceneLocation}
                  onChange={(e) => setSceneLocation(e.target.value)}
                  placeholder="例如：古老的森林、未来都市、神秘城堡"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" />
                  时间
                </label>
                <Select value={sceneTimeOfDay} onValueChange={setSceneTimeOfDay}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择时间" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="清晨">🌅 清晨</SelectItem>
                    <SelectItem value="上午">☀️ 上午</SelectItem>
                    <SelectItem value="中午">🌤️ 中午</SelectItem>
                    <SelectItem value="下午">⛅ 下午</SelectItem>
                    <SelectItem value="黄昏">🌇 黄昏</SelectItem>
                    <SelectItem value="夜晚">🌙 夜晚</SelectItem>
                    <SelectItem value="深夜">🌃 深夜</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block flex items-center gap-2">
                  <Smile className="w-3.5 h-3.5" />
                  氛围
                </label>
                <Select value={sceneMood} onValueChange={setSceneMood}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择氛围" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="温馨">🏠 温馨</SelectItem>
                    <SelectItem value="紧张">😰 紧张</SelectItem>
                    <SelectItem value="神秘">🔮 神秘</SelectItem>
                    <SelectItem value="浪漫">💕 浪漫</SelectItem>
                    <SelectItem value="恐怖">👻 恐怖</SelectItem>
                    <SelectItem value="宁静">🍃 宁静</SelectItem>
                    <SelectItem value="热闹">🎉 热闹</SelectItem>
                    <SelectItem value="悲伤">😢 悲伤</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={handleGenerateScene}
              disabled={isGenerating || !sceneLocation.trim()}
              className="w-full"
            >
              <MapPin className="w-4 h-4 mr-2" />
              {isGenerating ? '生成中...' : '生成场景描述'}
            </Button>

            {generatedScene && (
              <ScrollArea className="flex-1 min-h-0">
                <Card>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium mb-2">场景描述</h4>
                      <p className="text-sm leading-relaxed">{generatedScene.description}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-muted/50 rounded-lg p-3">
                        <h4 className="text-xs font-medium text-muted-foreground mb-1">氛围</h4>
                        <p className="text-sm font-medium">{generatedScene.mood}</p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-3">
                        <h4 className="text-xs font-medium text-muted-foreground mb-1">光线</h4>
                        <p className="text-sm font-medium">{generatedScene.lighting}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Button
                  variant="outline"
                  onClick={() => handleCopyText(generatedScene.description)}
                  className="w-full mt-4"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  复制描述
                </Button>
              </ScrollArea>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <AiSettingsDialog
        open={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </div>
  )
}
