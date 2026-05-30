import React, { useState, useEffect } from 'react';
import { useAIConfigStore } from '../../stores/aiConfigStore';
import { AIEndpoint, AIAssistant } from '../../types/ai';
import { Plus, Trash2, Edit, Check, Cpu, Award, Zap, AlertCircle, Loader2 } from 'lucide-react';

export const AIConfig: React.FC = () => {
  const {
    endpoints,
    assistants,
    defaultAssistantId,
    addEndpoint,
    updateEndpoint,
    deleteEndpoint,
    testConnection,
    fetchModels,
    addAssistant,
    updateAssistant,
    deleteAssistant,
    setDefaultAssistant
  } = useAIConfigStore();

  // 选项卡切换: 'endpoints' | 'assistants'
  const [activeTab, setActiveTab] = useState<'endpoints' | 'assistants'>('assistants');

  // 表单与弹窗状态
  const [showEpModal, setShowEpModal] = useState(false);
  const [showAstModal, setShowAstModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [targetId, setTargetId] = useState<string | null>(null);

  // 接口表单状态
  const [epName, setEpName] = useState('');
  const [epUrl, setEpUrl] = useState('');
  const [epApiKey, setEpApiKey] = useState('');
  const [epTimeout, setEpTimeout] = useState(10000);
  const [epModel, setEpModel] = useState('');
  const [epDesc, setEpDesc] = useState('');
  
  // 拉取模型状态
  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchedModelsList, setFetchedModelsList] = useState<string[]>([]);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; msg: string } | null>(null);

  // 助手表单状态
  const [astName, setAstName] = useState('');
  const [astEndpointId, setAstEndpointId] = useState('');
  const [astModel, setAstModel] = useState('');
  const [astPrompt, setAstPrompt] = useState('');
  const [astDesc, setAstDesc] = useState('');

  const [epEnabled, setEpEnabled] = useState(true);
  const [formError, setFormError] = useState('');
  const [endpointPage, setEndpointPage] = useState(1);
  const [assistantPage, setAssistantPage] = useState(1);
  const PAGE_SIZE = 6;

  // 自动填充模型列表选择
  const selectedEndpointForAst = endpoints.find(e => e.id === astEndpointId);

  // 1. 打开接口模态框
  const openEpModal = (ep: AIEndpoint | null = null) => {
    setFormError('');
    setTestResult(null);
    setFetchedModelsList([]);
    if (ep) {
      setIsEditMode(true);
      setTargetId(ep.id);
      setEpName(ep.name);
      setEpUrl(ep.url);
      setEpApiKey(ep.apiKey);
      setEpTimeout(ep.timeout);
      setEpModel(ep.model);
      setEpDesc(ep.description);
      setEpEnabled(ep.enabled !== false);
    } else {
      setIsEditMode(false);
      setTargetId(null);
      setEpName('');
      setEpUrl('https://api.openai.com');
      setEpApiKey('');
      setEpTimeout(10000);
      setEpModel('gpt-4o-mini');
      setEpDesc('');
      setEpEnabled(true);
    }
    setShowEpModal(true);
  };

  // 提交接口表单
  const handleEpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    
    // 卫语句：拦截非标准协议
    if (!epUrl.trim().startsWith('http://') && !epUrl.trim().startsWith('https://')) {
      setFormError('接口请求地址必须是标准的 http:// 或 https:// 协议');
      return;
    }

    // OpenAI 协议合规性校验：调用 /v1/models 接口验证是否为标准 OpenAI 协议
    try {
      const baseUrl = epUrl.trim().endsWith('/') ? epUrl.trim().slice(0, -1) : epUrl.trim();
      const modelsUrl = baseUrl.includes('/v1') ? `${baseUrl}/models` : `${baseUrl}/v1/models`;

      const response = await fetch(modelsUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${epApiKey.trim()}`
        },
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        setFormError('非标准 OpenAI 协议接口，禁止添加');
        return;
      }

      const resJson = await response.json();
      const models = resJson.data;
      if (!Array.isArray(models) || models.length === 0 || !models[0]?.id) {
        setFormError('非标准 OpenAI 协议接口，禁止添加');
        return;
      }
    } catch (err: any) {
      setFormError('非标准 OpenAI 协议接口，禁止添加');
      return;
    }

    try {
      const data = {
        name: epName.trim(),
        url: epUrl.trim(),
        apiKey: epApiKey.trim(),
        timeout: epTimeout,
        model: epModel.trim(),
        description: epDesc.trim(),
        enabled: epEnabled
      };

      if (isEditMode && targetId) {
        await updateEndpoint(targetId, data);
      } else {
        await addEndpoint(data);
      }
      setShowEpModal(false);
    } catch (err: any) {
      setFormError(err.message || '保存接口配置失败');
    }
  };

  // 测试连通性
  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const mockEp: AIEndpoint = {
        id: targetId || 'test',
        name: epName.trim(),
        url: epUrl.trim(),
        apiKey: epApiKey.trim(),
        timeout: epTimeout,
        model: epModel.trim(),
        description: epDesc.trim(),
        enabled: true
      };
      
      const success = await testConnection(mockEp);
      setTestResult({
        success,
        msg: success ? '连接成功！接口畅通可用。' : '连接失败，请检查请求地址、网络或 API Key。'
      });
    } catch (e) {
      setTestResult({ success: false, msg: '连接发生未知错误' });
    } finally {
      setTestingConnection(false);
    }
  };

  // 异步获取模型列表
  const handleFetchModels = async () => {
    setFetchingModels(true);
    setFormError('');
    try {
      const mockEp: AIEndpoint = {
        id: targetId || 'test',
        name: epName.trim(),
        url: epUrl.trim(),
        apiKey: epApiKey.trim(),
        timeout: epTimeout,
        model: epModel.trim(),
        description: epDesc.trim(),
        enabled: true
      };
      
      // 我们在 store 里封装了 fetchModels 逻辑，可基于临时 Endpoint 参数拉取
      const strategy = fetchModels;
      // 为方便起见，直接把当前填写的表单内容作为临时接口拉取
      const id = targetId || crypto.randomUUID();
      // 这里为了让未保存的表单也能测试，可以直接临时保存下
      const tempEp = { ...mockEp, id };
      
      // 模拟调用远端
      const baseUrl = tempEp.url.endsWith('/') ? tempEp.url.slice(0, -1) : tempEp.url;
      const testUrl = baseUrl.includes('/v1') ? `${baseUrl}/models` : `${baseUrl}/v1/models`;

      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tempEp.apiKey}`
        },
        signal: AbortSignal.timeout(tempEp.timeout || 8000)
      });

      if (!response.ok) {
        throw new Error(`请求失败，状态码: ${response.status}`);
      }

      const resJson = await response.json();
      const models = resJson.data || [];
      const modelNames = models.map((m: any) => m.id);

      if (modelNames.length === 0) {
        throw new Error('未获取到可用模型');
      }

      setFetchedModelsList(modelNames);
      setEpModel(modelNames[0] || epModel);
    } catch (err: any) {
      setFormError(`拉取模型失败: ${err.message}。您可以手动输入模型名称。`);
    } finally {
      setFetchingModels(false);
    }
  };

  // 2. 打开助手模态框
  const openAstModal = (ast: AIAssistant | null = null) => {
    setFormError('');
    if (ast) {
      setIsEditMode(true);
      setTargetId(ast.id);
      setAstName(ast.name);
      setAstEndpointId(ast.endpointId);
      setAstModel(ast.model);
      setAstPrompt(ast.prompt);
      setAstDesc(ast.description);
    } else {
      setIsEditMode(false);
      setTargetId(null);
      setAstName('');
      setAstEndpointId(endpoints[0]?.id || '');
      setAstModel(endpoints[0]?.model || 'gpt-4o-mini');
      setAstPrompt('你是一个专业的数据看板助手，能根据数据集结构与统计特征提供清晰的分析。');
      setAstDesc('');
    }
    setShowAstModal(true);
  };

  // 提交助手表单
  const handleAstSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    
    // 卫语句：拦截没有接口的情况
    if (!astEndpointId) {
      setFormError('助手必须绑定一个有效的 AI 接口');
      return;
    }

    try {
      const data = {
        name: astName.trim(),
        endpointId: astEndpointId,
        model: astModel.trim(),
        prompt: astPrompt.trim(),
        description: astDesc.trim()
      };

      if (isEditMode && targetId) {
        await updateAssistant(targetId, data);
      } else {
        await addAssistant(data);
      }
      setShowAstModal(false);
    } catch (err: any) {
      setFormError(err.message || '保存助理配置失败');
    }
  };

  // 分页计算
  const totalEpPages = Math.max(1, Math.ceil(endpoints.length / PAGE_SIZE));
  const totalAstPages = Math.max(1, Math.ceil(assistants.length / PAGE_SIZE));
  const safeEpPage = Math.min(endpointPage, totalEpPages);
  const safeAstPage = Math.min(assistantPage, totalAstPages);
  const displayedEndpoints = endpoints.slice((safeEpPage - 1) * PAGE_SIZE, safeEpPage * PAGE_SIZE);
  const displayedAssistants = assistants.slice((safeAstPage - 1) * PAGE_SIZE, safeAstPage * PAGE_SIZE);

  // 当接口列表或助手列表数量变化时，自动修正页码
  useEffect(() => {
    const maxEpPage = Math.max(1, Math.ceil(endpoints.length / PAGE_SIZE));
    if (endpointPage > maxEpPage) setEndpointPage(maxEpPage);
  }, [endpoints.length]);

  useEffect(() => {
    const maxAstPage = Math.max(1, Math.ceil(assistants.length / PAGE_SIZE));
    if (assistantPage > maxAstPage) setAssistantPage(maxAstPage);
  }, [assistants.length]);

  return (
    <div className="w-full h-full p-8 flex flex-col overflow-hidden select-none">
      {/* 头部标题 */}
      <div className="mb-6 flex justify-between items-center flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-800">AI 配置管理</h2>
          <p className="text-xs text-slate-400 mt-1">配置与管理大模型接口，并定制不同场景的智能对话助手。</p>
        </div>
      </div>

      {/* Tab 切换栏 */}
      <div className="flex border-b border-slate-200/80 mb-6 flex-shrink-0">
        <button
          onClick={() => setActiveTab('assistants')}
          className={`px-6 py-2.5 text-xs font-semibold border-b-2 transition-all ${
            activeTab === 'assistants'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          AI 助手配置 ({assistants.length})
        </button>
        <button
          onClick={() => setActiveTab('endpoints')}
          className={`px-6 py-2.5 text-xs font-semibold border-b-2 transition-all ${
            activeTab === 'endpoints'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          AI 接口配置 ({endpoints.length})
        </button>
      </div>

      {/* Tab 内容区 */}
      <div className="flex-1 overflow-auto min-h-0 pb-8">
        {/* TAB 1: 助手列表 */}
        {activeTab === 'assistants' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400">已定制的 AI 对话助手，在看板的对话面板中可以直接切换使用。</span>
              <button
                onClick={() => openAstModal(null)}
                disabled={endpoints.length === 0}
                className="flex items-center gap-1.5 bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 text-white font-medium text-xs py-1.5 px-3 rounded transition-all shadow-md shadow-blue-500/10"
              >
                <Plus size={12} />
                <span>新建 AI 助手</span>
              </button>
            </div>

            {endpoints.length === 0 && (
              <div className="bg-amber-50 text-amber-700 text-xs p-3 rounded-lg border border-amber-200 flex items-center gap-2">
                <AlertCircle size={14} />
                <span>在使用 AI 助手前，请先到“AI 接口配置”中至少添加一个有效的接口！</span>
              </div>
            )}

            {assistants.length === 0 ? (
              <div className="border-2 border-dashed border-slate-200 rounded-lg py-12 flex flex-col items-center justify-center text-slate-400">
                <Cpu size={36} className="text-slate-300 mb-2" />
                <span className="text-xs">暂无可用助手，请点击\u201c新建 AI 助手\u201d添加</span>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {displayedAssistants.map((ast) => {
                  const isDefault = ast.id === defaultAssistantId;
                  const boundEp = endpoints.find(e => e.id === ast.endpointId);
                  
                  return (
                    <div
                      key={ast.id}
                      className={`bg-white border rounded-lg p-5 flex flex-col justify-between hover:shadow-sm transition-all ${
                        isDefault ? 'border-blue-500 bg-blue-50/5' : 'border-slate-200/80'
                      }`}
                    >
                      <div>
                        {/* 头部标题 */}
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="font-semibold text-slate-700 text-sm truncate" title={ast.name}>
                              {ast.name}
                            </span>
                            {isDefault && (
                              <span className="flex items-center gap-0.5 bg-blue-100 text-blue-600 text-[9px] px-1.5 py-0.5 rounded font-bold">
                                <Award size={8} />
                                <span>系统默认</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            {!isDefault && (
                              <button
                                onClick={() => setDefaultAssistant(ast.id)}
                                className="text-[10px] text-blue-600 hover:underline px-2 py-0.5 rounded hover:bg-blue-50"
                                title="设置为默认，每个空间对话框将自动首选此助手"
                              >
                                设为默认
                              </button>
                            )}
                            <button
                              onClick={() => openAstModal(ast)}
                              className="text-slate-400 hover:text-slate-600 p-1"
                            >
                              <Edit size={12} />
                            </button>
                            <button
                              onClick={() => deleteAssistant(ast.id)}
                              className="text-slate-400 hover:text-red-600 p-1"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>

                        {/* 描述与系统提示 */}
                        <p className="text-xs text-slate-400 line-clamp-2 min-h-[32px] mb-4">
                          {ast.description || '暂无描述。'}
                        </p>
                        
                        <div className="bg-slate-50 p-2.5 rounded text-[11px] text-slate-500 border border-slate-100 max-h-16 overflow-y-auto">
                          <span className="font-semibold text-slate-700 block mb-0.5">预设 Prompt:</span>
                          <span className="italic">\u201c{ast.prompt}\u201d</span>
                        </div>
                      </div>

                      {/* 底部信息 */}
                      <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400">
                        <span>绑模型: <strong className="text-slate-600">{ast.model}</strong></span>
                        <span>接口: <strong className="text-slate-600">{boundEp?.name || '已失效接口'}</strong></span>
                      </div>
                    </div>
                  );
                })}
                </div>
                {totalAstPages > 1 && (
                  <div className="flex items-center justify-center gap-3 mt-4 text-xs text-slate-500 select-none">
                    <button
                      onClick={() => setAssistantPage(safeAstPage - 1)}
                      disabled={safeAstPage <= 1}
                      className="px-2.5 py-1 rounded border border-slate-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 transition-all"
                    >
                      上一页
                    </button>
                    <span className="font-medium">
                      第<span className="text-slate-700 mx-0.5">{safeAstPage}</span>页/共<span className="text-slate-700 mx-0.5">{totalAstPages}</span>页
                    </span>
                    <button
                      onClick={() => setAssistantPage(safeAstPage + 1)}
                      disabled={safeAstPage >= totalAstPages}
                      className="px-2.5 py-1 rounded border border-slate-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 transition-all"
                    >
                      下一页
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* TAB 2: 接口列表 */}
        {activeTab === 'endpoints' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400">配置 OpenAI 协议规范的云端/本地大模型接口，作为 AI 对话的底座。</span>
              <button
                onClick={() => openEpModal(null)}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs py-1.5 px-3 rounded transition-all shadow-md shadow-blue-500/10"
              >
                <Plus size={12} />
                <span>新增接口配置</span>
              </button>
            </div>

            {endpoints.length === 0 ? (
              <div className="border-2 border-dashed border-slate-200 rounded-lg py-12 flex flex-col items-center justify-center text-slate-400">
                <Zap size={36} className="text-slate-300 mb-2" />
                <span className="text-xs">暂无模型接口，请点击“新增接口配置”添加</span>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {displayedEndpoints.map((ep) => {
                    const isEnabled = ep.enabled !== false;
                    return (
                      <div
                        key={ep.id}
                        className={`bg-white border rounded-lg p-5 flex flex-col justify-between hover:shadow-sm transition-all ${
                          isEnabled ? 'border-slate-200/80' : 'border-slate-200 bg-slate-50/50 opacity-75'
                        }`}
                      >
                        <div>
                          {/* 标题 */}
                          <div className="flex justify-between items-start gap-2 mb-2">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="font-semibold text-slate-700 text-sm truncate" title={ep.name}>
                                {ep.name}
                              </span>
                              {isEnabled ? (
                                <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-[9px] px-1.5 py-0.5 rounded font-bold border border-green-200/50">
                                  <span className="w-1 h-1 rounded-full bg-green-500"></span>
                                  <span>已启用</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 text-[9px] px-1.5 py-0.5 rounded font-bold border border-slate-200/50">
                                  <span className="w-1 h-1 rounded-full bg-slate-400"></span>
                                  <span>已禁用</span>
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => openEpModal(ep)}
                                className="text-slate-400 hover:text-slate-600 p-1"
                                title="编辑配置"
                              >
                                <Edit size={12} />
                              </button>
                              <button
                                onClick={() => deleteEndpoint(ep.id)}
                                className="text-slate-400 hover:text-red-600 p-1"
                                title="删除接口"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>

                          {/* 描述与地址 */}
                          <p className="text-xs text-slate-400 truncate mb-3">
                            {ep.description || '暂无说明。'}
                          </p>

                          <div className="space-y-1.5 text-[11px] text-slate-500">
                            <div className="truncate">地址: <strong className="text-slate-700">{ep.url}</strong></div>
                            <div>默认模型: <strong className="text-slate-700">{ep.model}</strong></div>
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400">
                          <div className="flex items-center gap-2">
                            <span>超时时间: <strong className="text-slate-600">{ep.timeout / 1000} 秒</strong></span>
                            <button
                              type="button"
                              onClick={() => updateEndpoint(ep.id, { enabled: !isEnabled })}
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded transition-all border ${
                                isEnabled
                                  ? 'text-red-600 bg-red-50 hover:bg-red-100 border-red-200/50'
                                  : 'text-green-600 bg-green-50 hover:bg-green-100 border-green-200/50'
                              }`}
                            >
                              {isEnabled ? '禁用接口' : '启用接口'}
                            </button>
                          </div>
                          <span className="bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded text-[8px] uppercase">
                            OpenAI 协议
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {totalEpPages > 1 && (
                  <div className="flex items-center justify-center gap-3 mt-4 text-xs text-slate-500 select-none">
                    <button
                      onClick={() => setEndpointPage(safeEpPage - 1)}
                      disabled={safeEpPage <= 1}
                      className="px-2.5 py-1 rounded border border-slate-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 transition-all"
                    >
                      上一页
                    </button>
                    <span className="font-medium">
                      第<span className="text-slate-700 mx-0.5">{safeEpPage}</span>页/共<span className="text-slate-700 mx-0.5">{totalEpPages}</span>页
                    </span>
                    <button
                      onClick={() => setEndpointPage(safeEpPage + 1)}
                      disabled={safeEpPage >= totalEpPages}
                      className="px-2.5 py-1 rounded border border-slate-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 transition-all"
                    >
                      下一页
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ========================================================== */}
      {/* 弹窗：接口配置表单 */}
      {showEpModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[2px] flex items-center justify-center p-4">
          <form onSubmit={handleEpSubmit} className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-800 mb-4">
              {isEditMode ? '编辑 AI 接口配置' : '新增 AI 接口配置'}
            </h3>

            <div className="space-y-4">
              {/* 名称 */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">接口名称</label>
                <input
                  type="text"
                  required
                  placeholder="例如: DeepSeek官方接口"
                  value={epName}
                  onChange={(e) => setEpName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
                />
              </div>

              {/* URL */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">请求地址 (URL)</label>
                <input
                  type="text"
                  required
                  placeholder="例如: https://api.deepseek.com/v1"
                  value={epUrl}
                  onChange={(e) => setEpUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
                />
              </div>

              {/* API Key */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">API Key</label>
                <input
                  type="password"
                  required
                  placeholder="sk-..."
                  value={epApiKey}
                  onChange={(e) => setEpApiKey(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
                />
              </div>

              {/* 超时 / 备注 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">超时时间 (毫秒)</label>
                  <input
                    type="number"
                    required
                    value={epTimeout}
                    onChange={(e) => setEpTimeout(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">默认模型</label>
                  <input
                    type="text"
                    required
                    placeholder="gpt-4o"
                    value={epModel}
                    onChange={(e) => setEpModel(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
                  />
                </div>
              </div>

              {/* 连通测试 / 模型拉取 (关键亮点) */}
              <div className="flex gap-2 bg-slate-50 p-3 rounded border border-slate-100 items-center justify-between">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testingConnection || !epUrl || !epApiKey}
                  className="bg-slate-200 hover:bg-slate-300 disabled:opacity-50 text-slate-700 font-semibold px-3 py-1.5 rounded text-[10px] flex items-center gap-1"
                >
                  {testingConnection ? <Loader2 size={10} className="animate-spin" /> : null}
                  <span>连通性测试</span>
                </button>

                <button
                  type="button"
                  onClick={handleFetchModels}
                  disabled={fetchingModels || !epUrl || !epApiKey}
                  className="bg-blue-50 hover:bg-blue-100 text-blue-600 disabled:opacity-50 font-semibold px-3 py-1.5 rounded text-[10px] flex items-center gap-1"
                >
                  {fetchingModels ? <Loader2 size={10} className="animate-spin" /> : null}
                  <span>拉取模型列表</span>
                </button>
              </div>

              {/* 拉取到的模型下拉列表 */}
              {fetchedModelsList.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">选择拉取到的可用模型</label>
                  <select
                    value={epModel}
                    onChange={(e) => setEpModel(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
                  >
                    {fetchedModelsList.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* 连通测试结果显示 */}
              {testResult && (
                <div className={`p-2.5 rounded text-[11px] flex items-center gap-1.5 ${
                  testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                }`}>
                  <AlertCircle size={12} />
                  <span>{testResult.msg}</span>
                </div>
              )}

              {/* 是否启用 */}
              <div className="flex items-center gap-2 py-1 select-none">
                <input
                  type="checkbox"
                  id="epEnabledCheckbox"
                  checked={epEnabled}
                  onChange={(e) => setEpEnabled(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer"
                />
                <label htmlFor="epEnabledCheckbox" className="text-xs font-semibold text-slate-600 cursor-pointer">
                  启用该 AI 接口 (禁用后将无法通过此接口创建或使用助手)
                </label>
              </div>

              {/* 备注说明 */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">备注说明</label>
                <textarea
                  placeholder="该接口的使用额度或归属账号信息"
                  value={epDesc}
                  onChange={(e) => setEpDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700 h-16 resize-none"
                />
              </div>

              {formError && (
                <div className="text-[10px] text-red-500 leading-tight bg-red-50 p-2.5 rounded border border-red-100 flex items-start gap-1.5">
                  <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setShowEpModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-500 rounded text-xs hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold animate-hover"
              >
                保存配置
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================== */}
      {/* 弹窗：AI助手配置表单 */}
      {showAstModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[2px] flex items-center justify-center p-4">
          <form onSubmit={handleAstSubmit} className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-800 mb-4">
              {isEditMode ? '编辑 AI 助手' : '定制 AI 助手'}
            </h3>

            <div className="space-y-4">
              {/* 名字 */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">助手名称</label>
                <input
                  type="text"
                  required
                  placeholder="例如: 财务分析大师"
                  value={astName}
                  onChange={(e) => setAstName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
                />
              </div>

              {/* 绑定接口 */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">绑定 AI 接口协议</label>
                <select
                  required
                  value={astEndpointId}
                  onChange={(e) => {
                    const epId = e.target.value;
                    setAstEndpointId(epId);
                    const targetEp = endpoints.find(ep => ep.id === epId);
                    if (targetEp) {
                      setAstModel(targetEp.model);
                    }
                  }}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
                >
                  <option value="" disabled>选择已启用的 AI 接口</option>
                  {endpoints.filter(ep => ep.enabled !== false).map(ep => (
                    <option key={ep.id} value={ep.id}>{ep.name} ({ep.url})</option>
                  ))}
                </select>
              </div>

              {/* 模型名称 */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">模型名称</label>
                <input
                  type="text"
                  required
                  placeholder="例如: gpt-4o-mini"
                  value={astModel}
                  onChange={(e) => setAstModel(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">绑定此模型的请求名称，必须与接口支持的名称相对应。</span>
              </div>

              {/* 系统预设词 */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">系统预设词 (Prompt)</label>
                <textarea
                  required
                  placeholder="设定该 AI 助手的角色定位、回答风格以及分析逻辑。"
                  value={astPrompt}
                  onChange={(e) => setAstPrompt(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700 h-28 resize-none text-slate-600 leading-relaxed"
                />
              </div>

              {/* 描述 */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">助手描述</label>
                <textarea
                  placeholder="简单介绍这个助手适合哪种看板场景的分析。"
                  value={astDesc}
                  onChange={(e) => setAstDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700 h-16 resize-none"
                />
              </div>

              {formError && (
                <div className="text-[10px] text-red-500 leading-tight bg-red-50 p-2.5 rounded border border-red-100 flex items-start gap-1.5">
                  <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setShowAstModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-500 rounded text-xs hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold animate-hover"
              >
                定制助手
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
export default AIConfig;
