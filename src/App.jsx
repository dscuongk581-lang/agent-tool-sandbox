import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Files, FileText, Brain, Plus, Search, Trash2,
  Sparkles, X, CheckCircle, ArrowDownToLine,
  ChevronRight, Code, Layout, Send, Cpu, Settings,
  Key, ShieldCheck, AlertCircle, Moon, Sun, RotateCcw, RotateCw, Eye, EyeOff,
  Maximize2, FileJson, GitBranch, Palette, Keyboard, HardDrive, Loader
} from 'lucide-react';

// ==================== CONSTANTS ====================
const CONSTANTS = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_PROMPT_LENGTH: 50000,
  MAX_HISTORY_SIZE: 20,
  AUTO_SAVE_DELAY: 2000,
  STORAGE_PREFIX: 'agent_pro_v3',
  MODELS: {
    'gemini-2.5-flash-preview-09-2025': { name: '⚡ Gemini 2.5 Flash (Tốc độ)', tier: 'fast' },
    'gemini-1.5-pro': { name: '🧠 Gemini 1.5 Pro (Thông minh)', tier: 'smart' },
    'gemini-2.0-flash-exp': { name: '🚀 Gemini 2.0 Flash (Thực nghiệm)', tier: 'experimental' }
  },
  FILE_TYPES: {
    'py': { icon: Code, color: 'bg-blue-50 text-blue-600', lang: 'python' },
    'js': { icon: Code, color: 'bg-yellow-50 text-yellow-600', lang: 'javascript' },
    'ts': { icon: Code, color: 'bg-blue-50 text-blue-600', lang: 'typescript' },
    'jsx': { icon: Code, color: 'bg-cyan-50 text-cyan-600', lang: 'jsx' },
    'html': { icon: Code, color: 'bg-red-50 text-red-600', lang: 'html' },
    'css': { icon: Code, color: 'bg-pink-50 text-pink-600', lang: 'css' },
    'json': { icon: FileJson, color: 'bg-purple-50 text-purple-600', lang: 'json' },
    'md': { icon: FileText, color: 'bg-slate-50 text-slate-600', lang: 'markdown' },
    'txt': { icon: FileText, color: 'bg-gray-50 text-gray-600', lang: 'plaintext' }
  },
  EXPORT_FORMATS: [
    { ext: 'txt', mime: 'text/plain', label: 'Text (.txt)' },
    { ext: 'md', mime: 'text/markdown', label: 'Markdown (.md)' },
    { ext: 'json', mime: 'application/json', label: 'JSON (.json)' }
  ]
};

const UI_TEXT = {
  vi: {
    tabs: { library: 'Thư viện', workspace: 'Workspace', settings: 'Cài đặt' },
    library: { title: 'Tệp cục bộ', search: 'Tìm tệp tin...', noFiles: 'Không có tệp nào', dragDrop: 'Kéo & thả tệp hoặc nhấp để tải' },
    workspace: { current: 'Nội dung hiện tại', new: 'Phiên bản mới', compare: 'So sánh', metrics: 'Thống kê', words: 'từ', chars: 'ký tự', lines: 'dòng' },
    ai: { title: 'AI Xử lý', instruction: 'Bạn muốn AI thay đổi gì?', send: 'GỬI YÊU CẦU', charLimit: 'Tối đa 50.000 ký tự' },
    settings: { apiKey: 'API Key', model: 'Mô hình Gemini', theme: 'Giao diện', shortcuts: 'Phím tắt', autoSave: 'Lưu tự động' },
    history: 'Lịch sử chỉnh sửa',
    export: 'Tải xuống',
    delete: 'Xóa',
    loading: 'Đang xử lý...',
    success: 'Thành công',
    error: 'Lỗi',
    warning: 'Cảnh báo'
  }
};

const KEYBOARD_SHORTCUTS = {
  'ctrl+s': 'Save',
  'ctrl+z': 'Undo',
  'ctrl+y': 'Redo',
  'ctrl+h': 'History',
  'ctrl+l': 'Library',
  'ctrl+k': 'Search',
  'ctrl+shift+d': 'Dark mode'
};

// ==================== CUSTOM HOOKS ====================
/**
 * @typedef {Object} File
 * @property {string} id
 * @property {string} name
 * @property {string} content
 * @property {string} type
 * @property {string} size
 * @property {string} date
 */

/**
 * Hook quản lý local storage với type safety
 * @param {string} key
 * @param {any} initialValue
 * @returns {[any, Function]}
 */
const useLocalStorage = (key, initialValue) => {
  const storageKey = `${CONSTANTS.STORAGE_PREFIX}_${key}`;
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(storageKey);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback(value => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(storageKey, JSON.stringify(valueToStore));
    } catch (err) {
      console.error(`Error saving to localStorage[${storageKey}]:`, err);
    }
  }, [storedValue, storageKey]);

  return [storedValue, setValue];
};

/**
 * Hook quản lý file với history
 * @param {File[]} initialFiles
 * @returns {Object}
 */
const useFileManager = (initialFiles = []) => {
  const [files, setFiles] = useState(initialFiles);
  const [history, setHistory] = useState({});
  const [currentHistory, setCurrentHistory] = useState({});

  useEffect(() => {
    if (!initialFiles.length) return;

    const baseHistory = initialFiles.reduce((acc, file) => ({
      ...acc,
      [file.id]: [{ content: file.content, timestamp: Date.now() }]
    }), {});

    const baseIdx = initialFiles.reduce((acc, file) => ({ ...acc, [file.id]: 0 }), {});

    setHistory(baseHistory);
    setCurrentHistory(baseIdx);
  }, [initialFiles]);

  const addFile = useCallback(file => {
    setFiles(prev => [file, ...prev]);
    setHistory(prev => ({ ...prev, [file.id]: [{ content: file.content, timestamp: Date.now() }] }));
    setCurrentHistory(prev => ({ ...prev, [file.id]: 0 }));
  }, []);

  const updateFile = useCallback((fileId, newContent) => {
    setFiles(prev => prev.map(f => f.id === fileId ? { ...f, content: newContent } : f));
    setHistory(prev => {
      const fileHistory = prev[fileId] || [];
      if (fileHistory.length >= CONSTANTS.MAX_HISTORY_SIZE) fileHistory.shift();
      const updatedHistory = [...fileHistory, { content: newContent, timestamp: Date.now() }];
      setCurrentHistory(historyState => ({ ...historyState, [fileId]: updatedHistory.length - 1 }));
      return { ...prev, [fileId]: updatedHistory };
    });
  }, []);

  const undo = useCallback(fileId => {
    const idx = currentHistory[fileId] || 0;
    if (idx > 0) {
      const newIdx = idx - 1;
      const content = history[fileId]?.[newIdx]?.content;
      if (content) {
        setFiles(prev => prev.map(f => f.id === fileId ? { ...f, content } : f));
        setCurrentHistory(prev => ({ ...prev, [fileId]: newIdx }));
        return true;
      }
    }
    return false;
  }, [history, currentHistory]);

  const redo = useCallback(fileId => {
    const idx = currentHistory[fileId] || 0;
    const maxIdx = (history[fileId]?.length || 1) - 1;
    if (idx < maxIdx) {
      const newIdx = idx + 1;
      const content = history[fileId]?.[newIdx]?.content;
      if (content) {
        setFiles(prev => prev.map(f => f.id === fileId ? { ...f, content } : f));
        setCurrentHistory(prev => ({ ...prev, [fileId]: newIdx }));
        return true;
      }
    }
    return false;
  }, [history, currentHistory]);

  const restoreHistoryEntry = useCallback((fileId, historyIdx) => {
    const entry = history[fileId]?.[historyIdx];
    if (!entry) return;
    setFiles(prev => prev.map(f => f.id === fileId ? { ...f, content: entry.content } : f));
    setCurrentHistory(prev => ({ ...prev, [fileId]: historyIdx }));
  }, [history]);

  const deleteFile = useCallback(fileId => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
    setHistory(prev => { const copy = { ...prev }; delete copy[fileId]; return copy; });
    setCurrentHistory(prev => { const copy = { ...prev }; delete copy[fileId]; return copy; });
  }, []);

  return {
    files,
    addFile,
    updateFile,
    deleteFile,
    undo,
    redo,
    history,
    currentHistory,
    restoreHistoryEntry,
    canUndo: (id) => (currentHistory[id] || 0) > 0,
    canRedo: (id) => (currentHistory[id] || 0) < ((history[id]?.length || 1) - 1)
  };
};

/**
 * Hook quản lý AI interaction
 * @param {string} apiKey
 * @param {string} model
 * @returns {Object}
 */
const useAiProcessor = (apiKey, model) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  const process = useCallback(async (content, instruction) => {
    if (!apiKey) {
      setError('API Key không được cấu hình');
      return null;
    }
    if (!instruction || instruction.trim().length === 0) {
      setError('Vui lòng nhập yêu cầu');
      return null;
    }
    if (instruction.length > CONSTANTS.MAX_PROMPT_LENGTH) {
      setError(`Yêu cầu quá dài (tối đa ${CONSTANTS.MAX_PROMPT_LENGTH} ký tự)`);
      return null;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const prompt = `Bạn là một trợ lý chỉnh sửa tệp chuyên nghiệp.\n\nNội dung hiện tại:\n\`\`\`\n${content}\n\`\`\`\n\nYêu cầu: ${instruction}\n\nHãy trả về TOÀN BỘ nội dung tệp đã chỉnh sửa. CHỈ TRẢ VỀ NỘI DUNG, KHÔNG GIẢI THÍCH.`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 8000, temperature: 0.7 }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error?.message || `Lỗi API (${response.status})`;
        setError(errorMsg);
        return null;
      }

      const result = data.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
      if (!result) {
        setError('Không nhận được phản hồi từ AI');
        return null;
      }

      return result;
    } catch (err) {
      setError(err.message || 'Lỗi kết nối');
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [apiKey, model]);

  return { process, isProcessing, error, setError };
};

// ==================== COMPONENTS ====================

const Toast = ({ message, type = 'success', onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const icons = { success: CheckCircle, error: AlertCircle, warning: AlertCircle };
  const colors = { success: 'bg-emerald-600', error: 'bg-red-600', warning: 'bg-orange-600' };
  const Icon = icons[type] || CheckCircle;

  return (
    <div className={`fixed top-12 left-1/2 -translate-x-1/2 ${colors[type]} text-white px-6 py-3 rounded-full flex items-center gap-2 z-[110] shadow-2xl animate-in fade-in slide-in-from-top-4`}>
      <Icon size={18} />
      <span className="text-xs font-bold uppercase tracking-widest">{message}</span>
    </div>
  );
};

const FileLibraryTab = ({ files, searchQuery, onSearchChange, onFileSelect, onDelete, onUpload, fileInputRef, darkMode }) => {
  const filtered = files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const bgClass = darkMode ? 'bg-slate-800' : 'bg-slate-50';
  const cardClass = darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-100';
  const textClass = darkMode ? 'text-slate-300' : 'text-slate-400';

  return (
    <div className={`h-full overflow-y-auto p-6 space-y-4 ${bgClass}`}>
      <div className="relative mb-6">
        <Search className={`absolute left-4 top-1/2 -translate-y-1/2 ${darkMode ? 'text-slate-500' : 'text-slate-300'}`} size={18} />
        <input
          type="text" placeholder="Tìm tệp tin..."
          className={`w-full pl-12 pr-4 py-4 rounded-2xl border-none shadow-sm text-sm outline-none focus:ring-1 focus:ring-indigo-300 ${darkMode ? 'bg-slate-700 text-white placeholder-slate-500' : 'bg-white'}`}
          value={searchQuery} onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <h3 className={`text-[10px] font-black uppercase tracking-widest px-2 ${textClass}`}>Tệp cục bộ ({filtered.length})</h3>

      {filtered.length === 0 ? (
        <div className="text-center py-12 opacity-50">
          <Files size={48} className="mx-auto mb-4" strokeWidth={1} />
          <p className={`font-bold ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Chưa có tệp nào</p>
          <p className={`text-xs mt-2 ${textClass}`}>Kéo & thả hoặc nhấp vào nút + để tải</p>
        </div>
      ) : (
        filtered.map(file => {
          const FileIcon = CONSTANTS.FILE_TYPES[file.type]?.icon || FileText;
          const typeConfig = CONSTANTS.FILE_TYPES[file.type] || { color: 'bg-slate-50 text-slate-400' };

          return (
            <div key={file.id} className={`${cardClass} p-4 rounded-3xl border shadow-sm flex items-center justify-between active:bg-slate-50 transition-all group`}>
              <div className="flex items-center gap-4 overflow-hidden flex-1">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${typeConfig.color}`}>
                  <FileIcon size={20} />
                </div>
                <div className="overflow-hidden flex-1">
                  <h4 className="font-bold text-sm truncate">{file.name}</h4>
                  <p className={`text-[10px] font-bold uppercase ${textClass}`}>{file.size} • {file.date}</p>
                </div>
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => onFileSelect(file)} className="p-2 hover:bg-slate-600 rounded-lg" title="Mở">
                  <ChevronRight size={16} />
                </button>
                <button onClick={() => onDelete(file.id)} className="p-2 hover:bg-red-600 rounded-lg" title="Xóa">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })
      )}

      <input type="file" ref={fileInputRef} className="hidden" onChange={onUpload} multiple accept=".txt,.md,.py,.js,.ts,.jsx,.html,.css,.json" />
    </div>
  );
};

const FileMetrics = ({ content }) => {
  const words = content.trim().split(/\s+/).length;
  const chars = content.length;
  const lines = content.split('\n').length;

  return (
    <div className="grid grid-cols-3 gap-3 bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-2xl border border-indigo-100">
      <div className="text-center">
        <p className="text-[10px] font-bold text-indigo-600 uppercase">Từ</p>
        <p className="text-xl font-black text-indigo-700">{words}</p>
      </div>
      <div className="text-center">
        <p className="text-[10px] font-bold text-purple-600 uppercase">Ký tự</p>
        <p className="text-xl font-black text-purple-700">{chars}</p>
      </div>
      <div className="text-center">
        <p className="text-[10px] font-bold text-pink-600 uppercase">Dòng</p>
        <p className="text-xl font-black text-pink-700">{lines}</p>
      </div>
    </div>
  );
};

const ComparisonView = ({ original, modified, darkMode }) => {
  const [showDiff, setShowDiff] = useState(false);
  const bgClass = darkMode ? 'bg-slate-700' : 'bg-white';
  const textClass = darkMode ? 'text-slate-300' : 'text-slate-700';

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => setShowDiff(false)}
          className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${!showDiff ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'}`}
        >
          Xem riêng
        </button>
        <button
          onClick={() => setShowDiff(true)}
          className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${showDiff ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'}`}
        >
          So sánh
        </button>
      </div>

      {!showDiff ? (
        <div className="grid grid-cols-2 gap-4">
          <div className={`${bgClass} p-4 rounded-2xl border`}>
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-3">Gốc</p>
            <pre className={`text-xs font-mono ${textClass} whitespace-pre-wrap h-48 overflow-y-auto`}>{original}</pre>
          </div>
          <div className={`${bgClass} p-4 rounded-2xl border bg-gradient-to-br from-emerald-50 to-emerald-50`}>
            <p className="text-[10px] font-bold text-emerald-600 uppercase mb-3">Mới</p>
            <pre className="text-xs font-mono text-emerald-900 whitespace-pre-wrap h-48 overflow-y-auto">{modified}</pre>
          </div>
        </div>
      ) : (
        <div className={`${bgClass} p-6 rounded-2xl border ${textClass} text-xs font-mono overflow-y-auto max-h-96`}>
          <p className="opacity-60 mb-4">Phiên bản đơn giản: dòng xanh = thêm, dòng đỏ = xóa</p>
          {original.split('\n').map((line, i) => (
            <div key={i} className={modified.includes(line) ? '' : 'bg-red-200 text-red-900'}>
              {line}
            </div>
          ))}
          {modified.split('\n').filter(l => !original.includes(l)).map((line, i) => (
            <div key={i} className="bg-green-200 text-green-900">{line}</div>
          ))}
        </div>
      )}
    </div>
  );
};

const HistoryPanel = ({ history, currentIdx, onRestore, fileId, darkMode }) => {
  if (!history || history.length === 0) {
    return <p className={`text-center py-8 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Không có lịch sử</p>;
  }

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {history.map((h, idx) => (
        <div
          key={idx}
          onClick={() => onRestore(fileId, idx)}
          className={`p-3 rounded-lg cursor-pointer transition-all ${idx === currentIdx ? 'bg-indigo-600 text-white' : darkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-100 hover:bg-slate-200'}`}
        >
          <p className="text-xs font-bold">#{history.length - idx}</p>
          <p className="text-[10px] opacity-70">{new Date(h.timestamp).toLocaleTimeString('vi-VN')}</p>
        </div>
      ))}
    </div>
  );
};

const WorkspaceTab = ({ file, onUpdate, onExport, aiDrafts, onAiDraftUpdate, history, currentHistory, onRestore, onUndo, onRedo, canUndo, canRedo, darkMode }) => {
  const bgClass = darkMode ? 'bg-slate-800' : 'bg-slate-50';
  const cardClass = darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-100';

  if (!file) {
    return (
      <div className={`h-full flex items-center justify-center ${bgClass} opacity-30`}>
        <div className="text-center">
          <Layout size={64} strokeWidth={1} className="mx-auto mb-4" />
          <p className="font-bold">Chọn tệp từ thư viện để xem</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full overflow-y-auto p-6 space-y-6 pb-40 ${bgClass}`}>
      {/* AI Draft */}
      {aiDrafts[file.id] && (
        <div className={`${cardClass} rounded-[2.5rem] p-7 shadow-xl border bg-gradient-to-br from-emerald-50 to-emerald-50 border-emerald-200 animate-in zoom-in-95`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-700"><Sparkles size={16} /> Phiên bản mới</div>
            <button onClick={() => onAiDraftUpdate(file.id, null)} className="p-1 bg-white/50 rounded-full hover:bg-white"><X size={16} /></button>
          </div>
          <div className={`${cardClass} p-5 rounded-2xl mb-6 max-h-64 overflow-y-auto border shadow-inner`}>
            <pre className="text-xs font-mono whitespace-pre-wrap leading-relaxed">{aiDrafts[file.id]}</pre>
          </div>
          <button
            onClick={() => onExport(file, aiDrafts[file.id])}
            className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-3 hover:bg-emerald-700 active:scale-95 transition-all shadow-xl"
          >
            <ArrowDownToLine size={24} /> TẢI FILE VỀ
          </button>
        </div>
      )}

      {/* Nội dung gốc */}
      <div className={`${cardClass} rounded-[2.5rem] border p-8 shadow-sm ${aiDrafts[file.id] ? 'opacity-30 grayscale' : 'opacity-100'} transition-all duration-500`}>
        <div className="text-[10px] font-black text-slate-400 uppercase mb-4 border-b pb-3 tracking-widest flex justify-between">
          <span>Nội dung hiện tại</span>
          <span className="font-bold">{file.type}</span>
        </div>
        <pre className="text-[12px] font-mono leading-relaxed whitespace-pre-wrap text-slate-600">{file.content}</pre>
      </div>

      {/* Metrics */}
      <FileMetrics content={file.content} />

      {/* Undo/Redo + History */}
      <div className={`${cardClass} rounded-2xl border p-4`}>
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-bold flex items-center gap-2"><GitBranch size={16} /> Lịch sử</h4>
          <div className="flex gap-2">
            <button
              onClick={() => onUndo(file.id)}
              disabled={!canUndo(file.id)}
              className="p-2 rounded-lg bg-slate-600 text-white hover:bg-slate-700 disabled:opacity-30" title="Undo (Ctrl+Z)"
            >
              <RotateCcw size={16} />
            </button>
            <button
              onClick={() => onRedo(file.id)}
              disabled={!canRedo(file.id)}
              className="p-2 rounded-lg bg-slate-600 text-white hover:bg-slate-700 disabled:opacity-30" title="Redo (Ctrl+Y)"
            >
              <RotateCw size={16} />
            </button>
          </div>
        </div>
        <HistoryPanel history={history[file.id]} currentIdx={currentHistory[file.id]} onRestore={onRestore} fileId={file.id} darkMode={darkMode} />
      </div>

      {/* So sánh */}
      {aiDrafts[file.id] && (
        <div className={`${cardClass} rounded-2xl border p-4`}>
          <h4 className="text-sm font-bold mb-4 flex items-center gap-2"><Maximize2 size={16} /> So sánh</h4>
          <ComparisonView original={file.content} modified={aiDrafts[file.id]} darkMode={darkMode} />
        </div>
      )}
    </div>
  );
};

const SettingsPanel = ({ apiKey, onApiKeyChange, model, onModelChange, darkMode, onThemeChange, fileInputRef, onUpload, showShortcuts, onToggleShortcuts }) => {
  const [showKey, setShowKey] = useState(false);
  const bgClass = darkMode ? 'bg-slate-800' : 'bg-slate-50';
  const cardClass = darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-100';

  return (
    <div className={`h-full overflow-y-auto p-8 space-y-8 ${bgClass}`}>
      {/* API Config */}
      <div className={`${cardClass} rounded-[2.5rem] p-10 shadow-xl relative overflow-hidden border`}>
        <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-400 opacity-10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
        <div className="flex items-center gap-4 mb-4 relative z-10">
          <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl"><Key size={24} /></div>
          <h2 className="text-xl font-black tracking-tight uppercase">Cấu hình API</h2>
        </div>
        <p className="text-xs opacity-80 leading-relaxed relative z-10">
          Từ aistudio.google.com. Lưu cục bộ trên trình duyệt.
        </p>
      </div>

      {/* API Key Input */}
      <div className="space-y-3">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-2">
          <ShieldCheck size={14} className="text-indigo-600" /> API Key
        </label>
        <div className="relative">
          <input
            type={showKey ? "text" : "password"}
            placeholder="Dán Key tại đây..."
            className={`w-full p-5 rounded-[1.5rem] text-sm shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono ${cardClass} border`}
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
          />
          <button
            onClick={() => setShowKey(!showKey)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <div className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-[10px] font-black ${apiKey ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
          <div className={`w-2 h-2 rounded-full ${apiKey ? 'bg-emerald-500 animate-pulse' : 'bg-orange-500'}`}></div>
          {apiKey ? 'KẾT NỐI OK' : 'CHƯA CÓ KEY'}
        </div>
      </div>

      {/* Model Selection */}
      <div className="space-y-3">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-2">
          <Cpu size={14} className="text-indigo-600" /> Mô hình AI
        </label>
        <select
          className={`w-full p-5 rounded-[1.5rem] text-sm font-bold shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none appearance-none border ${cardClass}`}
          value={model}
          onChange={(e) => onModelChange(e.target.value)}
        >
          {Object.entries(CONSTANTS.MODELS).map(([key, value]) => (
            <option key={key} value={key}>{value.name}</option>
          ))}
        </select>
      </div>

      {/* Theme */}
      <div className="space-y-3">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-2">
          <Palette size={14} className="text-indigo-600" /> Giao diện
        </label>
        <button
          onClick={() => onThemeChange(!darkMode)}
          className={`w-full p-5 rounded-[1.5rem] font-bold text-sm flex items-center justify-center gap-3 transition-all shadow-sm border ${darkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-100 border-slate-200'}`}
        >
          {darkMode ? <Moon size={18} className="text-yellow-400" /> : <Sun size={18} className="text-orange-400" />}
          {darkMode ? 'Dark Mode' : 'Light Mode'}
        </button>
      </div>

      {/* Keyboard Shortcuts */}
      <div className={`${cardClass} rounded-2xl border p-6`}>
        <button
          onClick={() => onToggleShortcuts(!showShortcuts)}
          className="w-full flex items-center justify-between mb-4 font-bold"
        >
          <span className="flex items-center gap-2"><Keyboard size={18} /> Phím tắt</span>
          <ChevronRight size={18} className={`transition-transform ${showShortcuts ? 'rotate-90' : ''}`} />
        </button>
        {showShortcuts && (
          <div className="grid grid-cols-1 gap-2 text-xs">
            {Object.entries(KEYBOARD_SHORTCUTS).map(([key, action]) => (
              <div key={key} className="flex justify-between p-2 bg-slate-600 rounded">
                <span className="font-mono font-bold">{key}</span>
                <span className="opacity-70">{action}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Storage Info */}
      <div className={`${cardClass} rounded-2xl border p-4 flex items-center gap-3`}>
        <HardDrive size={18} className="text-indigo-600" />
        <div className="text-xs">
          <p className="font-bold">Lưu trữ cục bộ</p>
          <p className="opacity-70">Tất cả dữ liệu được lưu trên trình duyệt</p>
        </div>
      </div>
    </div>
  );
};

const AiPanelModal = ({ file, onProcess, isProcessing, error, onError, darkMode }) => {
  const [instruction, setInstruction] = useState('');
  const bgClass = darkMode ? 'bg-slate-700' : 'bg-white';

  const handleSend = async () => {
    await onProcess(file.content, instruction);
    setInstruction('');
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-end animate-in fade-in duration-200">
      <div className={`w-full ${bgClass} rounded-t-[3rem] p-8 shadow-2xl animate-in slide-in-from-bottom duration-300 border-t`}>
        <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-8"></div>

        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-indigo-100 text-indigo-600 rounded-2xl"><Brain size={28} /></div>
            <div>
              <h4 className="font-black text-lg leading-tight">AI Xử lý</h4>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate max-w-[200px]">{file.name}</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-100 border border-red-300 text-red-700 text-xs rounded-lg mb-4 flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-bold">Lỗi</p>
              <p>{error}</p>
            </div>
          </div>
        )}

        <div className="space-y-3 mb-6">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold">Yêu cầu</label>
            <span className={`text-[10px] ${instruction.length > CONSTANTS.MAX_PROMPT_LENGTH ? 'text-red-600 font-bold' : 'text-slate-400'}`}>
              {instruction.length} / {CONSTANTS.MAX_PROMPT_LENGTH}
            </span>
          </div>
          <textarea
            placeholder="Bạn muốn AI thay đổi gì?"
            className={`w-full p-6 rounded-[2rem] text-sm min-h-[140px] focus:ring-2 focus:ring-indigo-500 outline-none border-none ${darkMode ? 'bg-slate-600' : 'bg-slate-50'}`}
            value={instruction}
            onChange={(e) => {
              setInstruction(e.target.value);
              onError(null);
            }}
            maxLength={CONSTANTS.MAX_PROMPT_LENGTH}
          />
        </div>

        <button
          onClick={handleSend}
          disabled={isProcessing || !instruction || instruction.length > CONSTANTS.MAX_PROMPT_LENGTH}
          className="w-full py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black text-sm flex items-center justify-center gap-3 hover:bg-indigo-700 active:scale-95 disabled:opacity-30 transition-all shadow-xl"
        >
          {isProcessing ? <Loader className="animate-spin" size={20} /> : <Send size={20} />}
          {isProcessing ? 'ĐANG XỬ LÝ...' : 'GỬI YÊU CẦU'}
        </button>
      </div>
    </div>
  );
};

// ==================== MAIN APP ====================

const App = () => {
  const [activeTab, setActiveTab] = useState('library');
  const [darkMode, setDarkMode] = useLocalStorage('darkMode', false);
  const [userApiKey, setUserApiKey] = useLocalStorage('apiKey', '');
  const [selectedModel, setSelectedModel] = useLocalStorage('model', 'gemini-2.5-flash-preview-09-2025');

  const fileManager = useFileManager([
    {
      id: 'welcome',
      name: 'huong_dan.md',
      content: '# File Agent Pro v3\n\n## Tính năng mới\n- ✨ Dark mode\n- 🔄 Undo/Redo & lịch sử\n- 📊 So sánh file\n- 🎨 Giao diện cải thiện\n- ⌨️ Phím tắt\n\n## Bắt đầu\n1. Cài đặt → Dán API Key\n2. Tải tệp hoặc tạo mới\n3. Nhấn 🧠 để xử lý AI',
      size: '1.2 KB',
      date: new Date().toLocaleDateString('vi-VN'),
      type: 'md'
    }
  ]);

  const [openFileIds, setOpenFileIds] = useState([]);
  const [focusedFileId, setFocusedFileId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [aiDrafts, setAiDrafts] = useState({});
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const fileInputRef = useRef(null);

  const { process, isProcessing, error: aiError, setError: setAiError } = useAiProcessor(userApiKey, selectedModel);

  const showToast = useCallback((msg, type = 'success') => {
    setToastMessage(msg);
    setToastType(type);
  }, []);

  const handleUpload = useCallback(e => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      if (file.size > CONSTANTS.MAX_FILE_SIZE) {
        showToast(`Tệp "${file.name}" quá lớn (tối đa 5MB)`, 'error');
        return;
      }

      const reader = new FileReader();
      reader.onload = event => {
        const ext = file.name.split('.').pop() || 'txt';
        const newFile = {
          id: Math.random().toString(36).substr(2, 9),
          name: file.name,
          content: event.target.result || '',
          size: (file.size / 1024).toFixed(1) + ' KB',
          date: new Date().toLocaleDateString('vi-VN'),
          type: ext
        };
        fileManager.addFile(newFile);
        showToast(`Đã thêm "${file.name}"`);
      };
      reader.readAsText(file);
    });
  }, [fileManager, showToast]);

  const handleAiProcess = useCallback(async (content, instruction) => {
    const result = await process(content, instruction);
    if (result) {
      setAiDrafts(prev => ({ ...prev, [focusedFileId]: result }));
      setShowAiPanel(false);
      showToast('AI đã xử lý thành công');
    } else {
      showToast(aiError || 'Lỗi xử lý', 'error');
    }
  }, [focusedFileId, process, aiError, showToast]);

  const currentFile = useMemo(() =>
    fileManager.files.find(f => f.id === focusedFileId) || null,
    [fileManager.files, focusedFileId]
  );

  const handleExport = useCallback((file, content) => {
    if (!content) return;

    const ext = 'txt';
    const fileName = `AI_Fixed_${file.name.split('.')[0]}.${ext}`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }, 100);

    navigator.clipboard?.writeText(content).catch(() => {
      const area = document.createElement('textarea');
      area.value = content;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      document.body.removeChild(area);
    });

    showToast('Đã tải & copy vào bộ nhớ tạm');
  }, [showToast]);

  const rootClass = darkMode ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-900';

  return (
    <div className={`flex flex-col h-screen font-sans overflow-hidden ${rootClass}`}>
      {/* HEADER */}
      <header className={`px-6 pt-12 pb-4 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} border-b flex justify-between items-center z-30 shrink-0 shadow-sm`}>
        <div>
          <h1 className="text-2xl font-black text-indigo-600 tracking-tighter italic">FILE AGENT PRO</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">v3 • Workspace</p>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl active:scale-90 transition-all border border-indigo-100 hover:bg-indigo-100" title="Tải tệp (Ctrl+O)"
        >
          <Plus size={20} />
        </button>
      </header>

      {/* MAIN */}
      <main className="flex-1 overflow-hidden">
        {activeTab === 'library' && (
          <FileLibraryTab
            files={fileManager.files}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onFileSelect={(f) => {
              if (!openFileIds.includes(f.id)) setOpenFileIds([...openFileIds, f.id]);
              setFocusedFileId(f.id);
              setActiveTab('workspace');
            }}
            onDelete={(id) => {
              fileManager.deleteFile(id);
              setAiDrafts(prev => {
                const copy = { ...prev };
                delete copy[id];
                return copy;
              });
              setOpenFileIds(prev => prev.filter(fid => fid !== id));
              if (focusedFileId === id) setFocusedFileId(null);
              showToast('Đã xóa tệp');
            }}
            onUpload={handleUpload}
            fileInputRef={fileInputRef}
            darkMode={darkMode}
          />
        )}

        {activeTab === 'workspace' && (
          <div className={`h-full flex flex-col ${darkMode ? 'bg-slate-800' : 'bg-white'}`}>
            {/* File Tabs */}
            <div className={`flex overflow-x-auto ${darkMode ? 'bg-slate-700' : 'bg-white'} p-2 gap-2 border-b ${darkMode ? 'border-slate-700' : 'border-slate-100'} no-scrollbar`}>
              {openFileIds.map(fid => {
                const f = fileManager.files.find(file => file.id === fid);
                if (!f) return null;
                return (
                  <div
                    key={fid}
                    onClick={() => setFocusedFileId(fid)}
                    className={`shrink-0 px-4 py-2.5 rounded-xl flex items-center gap-2 text-xs font-bold transition-all border cursor-pointer ${focusedFileId === fid ? 'bg-indigo-600 text-white border-indigo-600' : darkMode ? 'bg-slate-600 text-slate-200 border-slate-600' : 'bg-slate-100 text-slate-600 border-slate-200'}`}
                  >
                    <span className="truncate max-w-[100px]">{f.name}</span>
                    <button onClick={(e) => {
                      e.stopPropagation();
                      const next = openFileIds.filter(i => i !== fid);
                      setOpenFileIds(next);
                      if (focusedFileId === fid) setFocusedFileId(next[0] || null);
                    }}><X size={14} /></button>
                  </div>
                );
              })}
            </div>

            <WorkspaceTab
              file={currentFile}
              onUpdate={(content) => fileManager.updateFile(focusedFileId, content)}
              onExport={handleExport}
              aiDrafts={aiDrafts}
              onAiDraftUpdate={(id, draft) => setAiDrafts(prev => ({...prev, [id]: draft}))}
              history={fileManager.history}
              currentHistory={fileManager.currentHistory}
              onRestore={(id, idx) => fileManager.restoreHistoryEntry(id, idx)}
              onUndo={(id) => fileManager.undo(id) && setAiDrafts(prev => ({...prev, [id]: null}))}
              onRedo={(id) => fileManager.redo(id)}
              canUndo={fileManager.canUndo}
              canRedo={fileManager.canRedo}
              darkMode={darkMode}
            />

            {/* AI FAB */}
            {focusedFileId && !showAiPanel && !aiDrafts[focusedFileId] && (
              <button
                onClick={() => setShowAiPanel(true)}
                className="fixed bottom-28 right-6 w-16 h-16 bg-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center animate-bounce z-40 active:scale-90 transition-all border-4 border-white hover:bg-indigo-700" title="AI xử lý (Ctrl+A)"
              >
                <Brain size={28} />
              </button>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <SettingsPanel
            apiKey={userApiKey}
            onApiKeyChange={setUserApiKey}
            model={selectedModel}
            onModelChange={setSelectedModel}
            darkMode={darkMode}
            onThemeChange={setDarkMode}
            fileInputRef={fileInputRef}
            onUpload={handleUpload}
            showShortcuts={showShortcuts}
            onToggleShortcuts={setShowShortcuts}
          />
        )}
      </main>

      {/* BOTTOM NAV */}
      <nav className={`h-24 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} border-t flex items-center justify-around px-8 shrink-0 z-50`}>
        {[
          { id: 'library', icon: Files, label: 'Thư viện' },
          { id: 'workspace', icon: Layout, label: 'Workspace', badge: openFileIds.length > 0 },
          { id: 'settings', icon: Settings, label: 'Cài đặt' }
        ].map(({ id, icon: Icon, label, badge }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === id ? 'text-indigo-600 scale-110' : 'text-slate-300'}`}
            title={label}
          >
            <div className="relative">
              <Icon size={24} strokeWidth={activeTab === id ? 3 : 2} />
              {badge && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-indigo-600 rounded-full border-2 border-white"></div>}
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
          </button>
        ))}
      </nav>

      {/* AI MODAL */}
      {showAiPanel && currentFile && (
        <AiPanelModal
          file={currentFile}
          onProcess={handleAiProcess}
          isProcessing={isProcessing}
          error={aiError}
          onError={setAiError}
          darkMode={darkMode}
        />
      )}

      {/* TOAST */}
      {toastMessage && (
        <Toast
          message={toastMessage}
          type={toastType}
          onClose={() => setToastMessage('')}
        />
      )}

      <input type="file" ref={fileInputRef} className="hidden" onChange={handleUpload} multiple />
    </div>
  );
};

export default App;
