import { useState, useEffect, useRef } from 'react';
import { Button, Input } from 'antd';
import { useRouter } from '@/hooks';
import './index.scss';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { BACKEND_URL } from '@/constants';
import { Card, LearningRecord, User, CardFormData, Question, QuestionFormData, DependencyGraph, AIGeneratedQuestion, AIGenerateResponse } from '@/types/learning';



function Admin() {
  const [cards, setCards] = useState<Card[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [formData, setFormData] = useState<CardFormData>({ 
    title: '',
    content: '',
    prerequisites: []
  });
  const [questionFormData, setQuestionFormData] = useState<QuestionFormData>({
    content: '',
    question_type: 1,
    options: ['', '', '', ''],
    correct_answer: '',
    order: 0
  });
  const [previewMode, setPreviewMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'cards' | 'questions' | 'dependencies' | 'learning_records'>('cards');
  const [dependencyGraph, setDependencyGraph] = useState<DependencyGraph | null>(null);
  const [learningRecords, setLearningRecords] = useState<LearningRecord[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsername, setSelectedUsername] = useState<string>('');
  const mermaidRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // AI生成问题相关状态
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [aiRequirements, setAIRequirements] = useState('');
  const [aiGeneratedQuestions, setAIGeneratedQuestions] = useState<AIGeneratedQuestion[]>([]);
  const [isAIGenerating, setIsAIGenerating] = useState(false);
  const [aiGenerateError, setAIGenerateError] = useState<string | null>(null);

  const questionTypes = [
    { value: 1, label: '选择题' },
    { value: 2, label: '问答题' },
    { value: 3, label: '代码题' }
  ];

  // 渲染Mermaid图表
  const renderMermaidChart = async () => {
    if (!dependencyGraph || !mermaidRef.current) return;
    
    try {
      const { default: mermaid } = await import('mermaid');
      
      // 初始化Mermaid
      mermaid.initialize({
        startOnLoad: true,
        theme: 'default',
        securityLevel: 'loose',
        flowchart: {
          useMaxWidth: true,
          htmlLabels: true,
          curve: 'basis'
        }
      });

      // 生成Mermaid图表代码
      const graphDefinition = `
graph TD
${dependencyGraph.nodes.map(node => 
  `${node.id.replace(/[^a-zA-Z0-9]/g, '_')}["${node.title}<br/>📝 ${node.questionCount} 个问题"]`
).join('\n')}
${dependencyGraph.edges.map(edge => 
  `${edge.from.replace(/[^a-zA-Z0-9]/g, '_')} --> ${edge.to.replace(/[^a-zA-Z0-9]/g, '_')}`
).join('\n')}
      `;

      // 清空容器
      mermaidRef.current.innerHTML = '';
      
      // 渲染图表
      const { svg } = await mermaid.render('mermaid-graph', graphDefinition);
      mermaidRef.current.innerHTML = svg;
    } catch (error) {
      console.error('Error rendering Mermaid chart:', error);
      if (mermaidRef.current) {
        mermaidRef.current.innerHTML = '<p>图表渲染失败，请检查数据格式</p>';
      }
    }
  };

  // 获取所有卡片
  const fetchCards = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/admin/cards/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch cards');
      }
      
      const data = await response.json();
      setCards(data);
    } catch (error) {
      console.error('Error fetching cards:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 获取卡片依赖关系图数据
  const fetchDependencyGraph = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/admin/cards/dependencies/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch dependency graph');
      }
      
      const data = await response.json();
      setDependencyGraph(data);
    } catch (error) {
      console.error('Error fetching dependency graph:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 获取指定卡片的问题
  const fetchQuestions = async (cardId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/admin/cards/${cardId}/questions/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch questions');
      }
      
      const data = await response.json();
      setQuestions(data);
    } catch (error) {
      console.error('Error fetching questions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 获取学习记录
  const fetchLearningRecords = async (username?: string) => {
    setIsLoading(true);
    try {
      const url = username 
        ? `${BACKEND_URL}/admin/learning-records/?username=${username}`
        : `${BACKEND_URL}/admin/learning-records/`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch learning records');
      }
      
      const data = await response.json();
      setLearningRecords(data);
    } catch (error) {
      console.error('Error fetching learning records:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 获取用户列表
  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/admin/users/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 更新学习记录状态
  const updateLearningRecord = async (recordId: number, status: string, queue?: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/admin/learning-records/${recordId}/`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status,
          queue
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update learning record');
      }
      
      // 刷新学习记录列表
      fetchLearningRecords(selectedUsername);
    } catch (error) {
      console.error('Error updating learning record:', error);
    }
  };

  // 删除学习记录
  const deleteLearningRecord = async (recordId: number) => {
    if (!window.confirm('确定要删除这条学习记录吗？')) return;
    
    try {
      const response = await fetch(`${BACKEND_URL}/admin/learning-records/${recordId}/`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete learning record');
      }
      
      // 刷新学习记录列表
      fetchLearningRecords(selectedUsername);
    } catch (error) {
      console.error('Error deleting learning record:', error);
    }
  };

  // AI生成问题
  const generateQuestionsWithAI = async () => {
    if (!selectedCard || !aiRequirements.trim()) return;

    setIsAIGenerating(true);
    setAIGenerateError(null);

    try {
      const response = await fetch(`${BACKEND_URL}/admin/ai/generate-questions/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          card_id: selectedCard.id,
          requirements: aiRequirements,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'AI生成问题失败');
      }

      const data: AIGenerateResponse = await response.json();
      
      if (data.success) {
        // 为每个生成的问题添加选中状态
        const questionsWithSelection = data.questions.map(q => ({
          ...q,
          selected: true // 默认全选
        }));
        setAIGeneratedQuestions(questionsWithSelection);
        setAIGenerateError(null);
      } else {
        throw new Error(data.error || '生成失败');
      }
    } catch (error) {
      console.error('Error generating questions with AI:', error);
      setAIGenerateError(error instanceof Error ? error.message : '生成失败');
    } finally {
      setIsAIGenerating(false);
    }
  };

  // 批量创建AI生成的问题
  const createAIGeneratedQuestions = async () => {
    if (!selectedCard || aiGeneratedQuestions.length === 0) return;

    // 只保存被选中的问题
    const selectedQuestions = aiGeneratedQuestions.filter(q => q.selected);
    
    if (selectedQuestions.length === 0) {
      alert('请至少选择一个问题');
      return;
    }

    setIsAIGenerating(true);

    try {
      const response = await fetch(`${BACKEND_URL}/admin/ai/batch-create-questions/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          card_id: selectedCard.id,
          questions: selectedQuestions,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'AI批量创建问题失败');
      }

      const data = await response.json();
      
      if (data.success) {
        // 刷新问题列表
        fetchQuestions(selectedCard.id);
        // 关闭对话框
        setShowAIDialog(false);
        setAIRequirements('');
        setAIGeneratedQuestions([]);
        setAIGenerateError(null);
        alert(`成功创建了 ${data.created_count} 个问题`);
      } else {
        throw new Error(data.error || '创建失败');
      }
    } catch (error) {
      console.error('Error creating AI generated questions:', error);
      setAIGenerateError(error instanceof Error ? error.message : '创建失败');
    } finally {
      setIsAIGenerating(false);
    }
  };

  // 切换问题选中状态
  const toggleQuestionSelection = (index: number) => {
    setAIGeneratedQuestions(prev => 
      prev.map((q, i) => 
        i === index ? { ...q, selected: !q.selected } : q
      )
    );
  };

  // 编辑AI生成的问题
  const editAIGeneratedQuestion = (index: number, field: keyof AIGeneratedQuestion, value: any) => {
    setAIGeneratedQuestions(prev => 
      prev.map((q, i) => 
        i === index ? { ...q, [field]: value } : q
      )
    );
  };

  // 删除AI生成的问题
  const removeAIGeneratedQuestion = (index: number) => {
    setAIGeneratedQuestions(prev => prev.filter((_, i) => i !== index));
  };

  // 添加新卡片
  const addCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.content.trim()) return;

    try {
      const response = await fetch(`${BACKEND_URL}/admin/cards/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formData.title,
          content: formData.content,
          prerequisites: formData.prerequisites,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add card');
      }

      const newCard = await response.json();
      setCards([...cards, newCard]);
      setFormData({ title: '', content: '', prerequisites: [] });
      setShowAddForm(false);
    } catch (error) {
      console.error('Error adding card:', error);
    }
  };

  // 添加新问题
  const addQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCard || !questionFormData.content.trim()) return;

    try {
      const response = await fetch(`${BACKEND_URL}/admin/cards/${selectedCard.id}/questions/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: questionFormData.content,
          question_type: questionFormData.question_type,
          options: questionFormData.question_type === 1 ? questionFormData.options.filter(o => o.trim()) : [],
          correct_answer: questionFormData.correct_answer,
          order: questionFormData.order,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add question');
      }

      const newQuestion = await response.json();
      setQuestions([...questions, newQuestion]);
      setQuestionFormData({
        content: '',
        question_type: 1,
        options: ['', '', '', ''],
        correct_answer: '',
        order: 0
      });
      setShowQuestionForm(false);
    } catch (error) {
      console.error('Error adding question:', error);
    }
  };

  // 更新卡片
  const updateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCard || !formData.content.trim()) return;

    try {
      const response = await fetch(`${BACKEND_URL}/admin/cards/${editingCard.id}/`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formData.title,
          content: formData.content,
          prerequisites: formData.prerequisites,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update card');
      }

      const updatedCard = await response.json();
      setCards(cards.map(card => 
        card.id === editingCard.id ? updatedCard : card
      ));
      setEditingCard(null);
      setFormData({ title: '', content: '', prerequisites: [] });
    } catch (error) {
      console.error('Error updating card:', error);
    }
  };

  // 更新问题
  const updateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCard || !editingQuestion || !questionFormData.content.trim()) return;

    try {
      const response = await fetch(`${BACKEND_URL}/admin/cards/${selectedCard.id}/questions/${editingQuestion.id}/`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: questionFormData.content,
          question_type: questionFormData.question_type,
          options: questionFormData.question_type === 1 ? questionFormData.options.filter(o => o.trim()) : [],
          correct_answer: questionFormData.correct_answer,
          order: questionFormData.order,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update question');
      }

      const updatedQuestion = await response.json();
      setQuestions(questions.map(q => 
        q.id === editingQuestion.id ? updatedQuestion : q
      ));
      setEditingQuestion(null);
      setQuestionFormData({
        content: '',
        question_type: 1,
        options: ['', '', '', ''],
        correct_answer: '',
        order: 0
      });
      setShowQuestionForm(false);
    } catch (error) {
      console.error('Error updating question:', error);
    }
  };

  // 删除卡片
  const deleteCard = async (cardId: string) => {
    if (!window.confirm('确定要删除这张卡片吗？')) return;

    try {
      const response = await fetch(`${BACKEND_URL}/admin/cards/${cardId}/`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete card');
      }

      setCards(cards.filter(card => card.id !== cardId));
    } catch (error) {
      console.error('Error deleting card:', error);
    }
  };

  // 删除问题
  const deleteQuestion = async (questionId: number) => {
    if (!selectedCard || !window.confirm('确定要删除这个问题吗？')) return;

    try {
      const response = await fetch(`${BACKEND_URL}/admin/cards/${selectedCard.id}/questions/${questionId}/`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete question');
      }

      setQuestions(questions.filter(q => q.id !== questionId));
    } catch (error) {
      console.error('Error deleting question:', error);
    }
  };

  // 开始编辑卡片
  const startEditing = (card: Card) => {
    setEditingCard(card);
    setFormData({ 
      title: card.title || '',
      content: card.content,
      prerequisites: card.prerequisites || []
    });
    setShowAddForm(false);
    setActiveTab('cards');
  };

  // 开始编辑问题
  const startEditingQuestion = (question: Question) => {
    setEditingQuestion(question);
    setQuestionFormData({
      content: question.content,
      question_type: question.question_type,
      options: question.options.length > 0 ? question.options : ['', '', '', ''],
      correct_answer: question.correct_answer,
      order: question.order
    });
    setShowQuestionForm(true);
  };

  // 取消编辑
  const cancelEdit = () => {
    setEditingCard(null);
    setEditingQuestion(null);
    setFormData({ title: '', content: '', prerequisites: [] });
    setQuestionFormData({
      content: '',
      question_type: 1,
      options: ['', '', '', ''],
      correct_answer: '',
      order: 0
    });
    setShowAddForm(false);
    setShowQuestionForm(false);
  };

  // 开始添加新卡片
  const startAdding = () => {
    setShowAddForm(true);
    setEditingCard(null);
    setFormData({ title: '', content: '', prerequisites: [] });
    setActiveTab('cards');
  };

  // 开始添加新问题
  const startAddingQuestion = () => {
    setShowQuestionForm(true);
    setEditingQuestion(null);
    setQuestionFormData({
      content: '',
      question_type: 1,
      options: ['', '', '', ''],
      correct_answer: '',
      order: questions.length
    });
  };

  // 打开AI生成对话框
  const openAIDialog = () => {
    setShowAIDialog(true);
    setAIRequirements('');
    setAIGeneratedQuestions([]);
    setAIGenerateError(null);
  };

  // 关闭AI生成对话框
  const closeAIDialog = () => {
    setShowAIDialog(false);
    setAIRequirements('');
    setAIGeneratedQuestions([]);
    setAIGenerateError(null);
  };

  // 选择卡片查看问题
  const selectCard = (card: Card) => {
    setSelectedCard(card);
    setActiveTab('questions');
    fetchQuestions(card.id);
  };

  // 更新问题选项
  const updateOption = (index: number, value: string) => {
    const newOptions = [...questionFormData.options];
    newOptions[index] = value;
    setQuestionFormData({ ...questionFormData, options: newOptions });
  };

  // 添加选项
  const addOption = () => {
    setQuestionFormData({ 
      ...questionFormData, 
      options: [...questionFormData.options, ''] 
    });
  };

  // 删除选项
  const removeOption = (index: number) => {
    const newOptions = questionFormData.options.filter((_, i) => i !== index);
    setQuestionFormData({ ...questionFormData, options: newOptions });
  };

  useEffect(() => {
    fetchCards();
  }, []);

  // 在依赖图数据加载后渲染图表
  useEffect(() => {
    if (dependencyGraph && activeTab === 'dependencies') {
      renderMermaidChart();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dependencyGraph, activeTab]);

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>管理控制台</h1>
        <div className="admin-nav">
          <Button onClick={() => router.push('/')}>返回首页</Button>
          <Button onClick={() => router.push('/learn')}>学习</Button>
          <Button onClick={() => router.push('/practice')}>练习</Button>
        </div>
      </div>

      <div className="admin-content">
        <div className="admin-tabs">
          <Button 
            className={activeTab === 'cards' ? 'active' : ''}
            onClick={() => setActiveTab('cards')}
          >
            卡片管理
          </Button>
          <Button 
            className={activeTab === 'questions' ? 'active' : ''}
            onClick={() => setActiveTab('questions')}
          >
            问题管理 {selectedCard && `(${selectedCard.title || '无标题'})`}
          </Button>
          <Button 
            className={activeTab === 'dependencies' ? 'active' : ''}
            onClick={() => {
              setActiveTab('dependencies');
              fetchDependencyGraph();
            }}
          >
            依赖关系图
          </Button>
          <Button 
            className={activeTab === 'learning_records' ? 'active' : ''}
            onClick={() => {
              setActiveTab('learning_records');
              fetchUsers();
              fetchLearningRecords();
            }}
          >
            学习记录
          </Button>
        </div>

        {activeTab === 'cards' && (
          <div className="cards-panel">
            <div className="admin-toolbar">
              <Button 
                className="add-btn" 
                onClick={startAdding}
                disabled={showAddForm || editingCard !== null}
              >
                添加新卡片
              </Button>
              <Button onClick={fetchCards} disabled={isLoading}>
                {isLoading ? '刷新中...' : '刷新'}
              </Button>
            </div>

            {/* 卡片添加/编辑表单 */}
            {(showAddForm || editingCard) && (
              <div className="card-form">
                <h3>{editingCard ? '编辑卡片' : '添加新卡片'}</h3>
                <form onSubmit={editingCard ? updateCard : addCard}>
                  <div className="form-group">
                    <label>标题</label>
                    <Input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="卡片标题"
                    />
                  </div>

                  <div className="form-group">
                    <label>内容</label>
                    <div className="editor-tabs">
                      <Button 
                        type="default"
                        className={!previewMode ? 'active' : ''}
                        onClick={() => setPreviewMode(false)}
                      >
                        编辑
                      </Button>
                      <Button 
                        type="default"
                        className={previewMode ? 'active' : ''}
                        onClick={() => setPreviewMode(true)}
                      >
                        预览
                      </Button>
                    </div>

                    {!previewMode ? (
                      <textarea
                        value={formData.content}
                        onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                        placeholder="支持Markdown格式..."
                        required
                      />
                    ) : (
                      <div className="preview-content">
                        <ReactMarkdown
                          remarkPlugins={[remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                        >
                          {formData.content}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label>前置卡片</label>
                    <div className="prerequisites-selector">
                      {cards.filter(card => card.id !== editingCard?.id).map(card => (
                        <div key={card.id} className="prerequisite-item">
                          <Input
                            type="checkbox"
                            id={`prereq-${card.id}`}
                            checked={formData.prerequisites.includes(card.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({ 
                                  ...formData, 
                                  prerequisites: [...formData.prerequisites, card.id] 
                                });
                              } else {
                                setFormData({ 
                                  ...formData, 
                                  prerequisites: formData.prerequisites.filter(id => id !== card.id) 
                                });
                              }
                            }}
                          />
                          <label htmlFor={`prereq-${card.id}`}>
                            {card.title || card.content.slice(0, 30) + '...'}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="form-actions">
                    <Button type="default" className="submit-btn">
                      {editingCard ? '更新卡片' : '创建卡片'}
                    </Button>
                    <Button type="default" onClick={cancelEdit}>
                      取消
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {/* 卡片列表 */}
            <div className="cards-list">
              {cards.length === 0 ? (
                <div className="empty-state">
                  <p>还没有任何卡片</p>
                  <p>点击&ldquo;添加新卡片&rdquo;来创建第一张卡片</p>
                </div>
              ) : (
                cards.map(card => (
                  <div key={card.id} className="card-item">
                    <div className="card-header">
                      <div className="card-title-section">
                        <h3 className="card-title">{card.title || '无标题'}</h3>
                        <div className="card-stats">
                          <span className="question-count">
                            <i className="icon-question">📝</i>
                            {card.question_count} 个问题
                          </span>
                          {card.prerequisites && card.prerequisites.length > 0 && (
                            <span className="prerequisites-count">
                              <i className="icon-prereq">🔗</i>
                              {card.prerequisites.length} 个前置
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="card-actions">
                        <Button onClick={() => selectCard(card)} className="manage-btn">
                          管理问题
                        </Button>
                        <Button onClick={() => startEditing(card)} className="edit-btn">
                          编辑
                        </Button>
                        <Button onClick={() => deleteCard(card.id)} className="delete-btn">
                          删除
                        </Button>
                      </div>
                    </div>
                    
                    <div className="card-content">
                      <ReactMarkdown
                        remarkPlugins={[remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                      >
                        {card.content.slice(0, 150) + (card.content.length > 150 ? '...' : '')}
                      </ReactMarkdown>
                    </div>
                    
                    <div className="card-footer">
                      <div className="card-meta">
                        <span className="card-id">ID: {card.id.slice(0, 8)}...</span>
                        <span className="card-date">
                          {new Date(card.created_at).toLocaleDateString('zh-CN')}
                        </span>
                      </div>
                      
                      {card.prerequisites && card.prerequisites.length > 0 && (
                        <div className="card-prerequisites-detail">
                          <strong>前置要求：</strong>
                          <span>{card.prerequisites.length} 张卡片需要先完成</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'questions' && (
          <div className="questions-panel">
            {selectedCard ? (
              <>
                <div className="admin-toolbar">
                  <Button 
                    className="add-btn" 
                    onClick={startAddingQuestion}
                    disabled={showQuestionForm}
                  >
                    添加新问题
                  </Button>
                  <Button 
                    className="ai-btn" 
                    onClick={openAIDialog}
                    disabled={showAIDialog || isAIGenerating}
                  >
                    🤖 AI生成问题
                  </Button>
                  <Button onClick={() => fetchQuestions(selectedCard.id)} disabled={isLoading}>
                    {isLoading ? '刷新中...' : '刷新'}
                  </Button>
                </div>

                {/* 问题添加/编辑表单 */}
                {showQuestionForm && (
                  <div className="question-form">
                    <h3>{editingQuestion ? '编辑问题' : '添加新问题'}</h3>
                    <form onSubmit={editingQuestion ? updateQuestion : addQuestion}>
                      <div className="form-group">
                        <label>问题类型</label>
                        <select
                          value={questionFormData.question_type}
                          onChange={(e) => setQuestionFormData({ 
                            ...questionFormData, 
                            question_type: parseInt(e.target.value) 
                          })}
                        >
                          {questionTypes.map(type => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label>问题内容</label>
                        <textarea
                          value={questionFormData.content}
                          onChange={(e) => setQuestionFormData({ 
                            ...questionFormData, 
                            content: e.target.value 
                          })}
                          placeholder="输入问题内容..."
                          required
                        />
                      </div>

                      {questionFormData.question_type === 1 && (
                        <div className="form-group">
                          <label>选项</label>
                          <div className="options-editor">
                            {questionFormData.options.map((option, index) => (
                              <div key={index} className="option-item">
                                <Input
                                  type="text"
                                  value={option}
                                  onChange={(e) => updateOption(index, e.target.value)}
                                  placeholder={`选项 ${index + 1}`}
                                />
                                {questionFormData.options.length > 2 && (
                                  <Button 
                                    type="default" 
                                    onClick={() => removeOption(index)}
                                    className="remove-option"
                                  >
                                    删除
                                  </Button>
                                )}
                              </div>
                            ))}
                            <Button 
                              type="default" 
                              onClick={addOption}
                              className="add-option"
                            >
                              添加选项
                            </Button>
                          </div>
                        </div>
                      )}

                      <div className="form-group">
                        <label>正确答案</label>
                        {questionFormData.question_type === 1 ? (
                          <select
                            value={questionFormData.correct_answer}
                            onChange={(e) => setQuestionFormData({ 
                              ...questionFormData, 
                              correct_answer: e.target.value 
                            })}
                            required
                          >
                            <option value="">选择正确答案</option>
                            {questionFormData.options.map((option, index) => (
                              option.trim() && (
                                <option key={index} value={index.toString()}>
                                  {option}
                                </option>
                              )
                            ))}
                          </select>
                        ) : (
                          <textarea
                            value={questionFormData.correct_answer}
                            onChange={(e) => setQuestionFormData({ 
                              ...questionFormData, 
                              correct_answer: e.target.value 
                            })}
                            placeholder="输入正确答案..."
                            required
                          />
                        )}
                      </div>

                      <div className="form-group">
                        <label>排序</label>
                        <Input
                          type="number"
                          value={questionFormData.order}
                          onChange={(e) => setQuestionFormData({ 
                            ...questionFormData, 
                            order: parseInt(e.target.value) || 0 
                          })}
                          min="0"
                        />
                      </div>

                      <div className="form-actions">
                        <Button type="default" className="submit-btn" onClick={editingQuestion ? updateQuestion : addQuestion}>
                          {editingQuestion ? '更新问题' : '创建问题'}
                        </Button>
                        <Button onClick={cancelEdit}>
                          取消
                        </Button>
                      </div>
                    </form>
                  </div>
                )}

                {/* AI生成问题对话框 */}
                {showAIDialog && (
                  <div className="ai-dialog-overlay">
                    <div className="ai-dialog">
                      <div className="ai-dialog-header">
                        <h3>🤖 AI生成问题</h3>
                        <Button className="close-btn" onClick={closeAIDialog}>×</Button>
                      </div>
                      
                      <div className="ai-dialog-content">
                        <div className="card-info">
                          <strong>当前卡片:</strong> {selectedCard?.title || '无标题'}
                        </div>
                        
                        <div className="form-group">
                          <label>生成要求:</label>
                          <textarea
                            value={aiRequirements}
                            onChange={(e) => setAIRequirements(e.target.value)}
                            placeholder="请输入生成要求，例如：&#10;生成3道题目，包括：&#10;- 1道选择题，考察基本概念&#10;- 1道简答题，考察理解能力&#10;- 1道代码题，考察实际应用&#10;难度：中等"
                            rows={6}
                            disabled={isAIGenerating}
                          />
                        </div>
                        
                        {aiGenerateError && (
                          <div className="error-message">
                            {aiGenerateError}
                          </div>
                        )}
                        
                        <div className="ai-dialog-actions">
                          <Button 
                            onClick={generateQuestionsWithAI}
                            disabled={isAIGenerating || !aiRequirements.trim()}
                            className="generate-btn"
                          >
                            {isAIGenerating ? '🔄 生成中...' : '🎯 生成问题'}
                          </Button>
                          <Button onClick={closeAIDialog} disabled={isAIGenerating}>
                            取消
                          </Button>
                        </div>
                        
                        {/* 生成的问题预览 */}
                        {aiGeneratedQuestions.length > 0 && (
                          <div className="generated-questions">
                            <div className="questions-header">
                              <h4>生成的问题预览 ({aiGeneratedQuestions.length})</h4>
                              <div className="selection-actions">
                                <Button 
                                  onClick={() => setAIGeneratedQuestions(prev => prev.map(q => ({ ...q, selected: true })))}
                                  className="select-all-btn"
                                >
                                  全选
                                </Button>
                                <Button 
                                  onClick={() => setAIGeneratedQuestions(prev => prev.map(q => ({ ...q, selected: false })))}
                                  className="deselect-all-btn"
                                >
                                  全不选
                                </Button>
                              </div>
                            </div>
                            
                            <div className="questions-preview">
                              {aiGeneratedQuestions.map((question, index) => (
                                <div key={index} className={`question-preview ${question.selected ? 'selected' : ''}`}>
                                  <div className="question-preview-header">
                                    <Input
                                      type="checkbox"
                                      checked={question.selected || false}
                                      onChange={() => toggleQuestionSelection(index)}
                                    />
                                    <span className="question-type-badge">
                                      {questionTypes.find(t => t.value === question.question_type)?.label}
                                    </span>
                                    <Button 
                                      onClick={() => removeAIGeneratedQuestion(index)}
                                      className="remove-question-btn"
                                    >
                                      删除
                                    </Button>
                                  </div>
                                  
                                  <div className="question-preview-content">
                                    <div className="form-group">
                                      <label>问题内容:</label>
                                      <textarea
                                        value={question.content}
                                        onChange={(e) => editAIGeneratedQuestion(index, 'content', e.target.value)}
                                        rows={3}
                                      />
                                    </div>
                                    
                                    {question.question_type === 1 && (
                                      <div className="form-group">
                                        <label>选项:</label>
                                        <div className="options-preview">
                                          {question.options.map((option, optIndex) => (
                                            <div key={optIndex} className="option-preview">
                                              <span>{optIndex + 1}. </span>
                                              <Input
                                                type="text"
                                                value={option}
                                                onChange={(e) => {
                                                  const newOptions = [...question.options];
                                                  newOptions[optIndex] = e.target.value;
                                                  editAIGeneratedQuestion(index, 'options', newOptions);
                                                }}
                                              />
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    
                                    <div className="form-group">
                                      <label>正确答案:</label>
                                      <Input
                                        type="text"
                                        value={question.correct_answer}
                                        onChange={(e) => editAIGeneratedQuestion(index, 'correct_answer', e.target.value)}
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                            
                            <div className="batch-actions">
                              <Button 
                                onClick={createAIGeneratedQuestions}
                                disabled={isAIGenerating || !aiGeneratedQuestions.some(q => q.selected)}
                                className="batch-create-btn"
                              >
                                {isAIGenerating ? '🔄 创建中...' : '📝 批量创建问题'}
                              </Button>
                              <span className="selected-count">
                                已选择 {aiGeneratedQuestions.filter(q => q.selected).length} 个问题
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 问题列表 */}
                <div className="questions-list">
                  {questions.map(question => (
                    <div key={question.id} className="question-item">
                      <div className="question-header">
                        <h4>
                          {questionTypes.find(t => t.value === question.question_type)?.label}
                          <span className="question-order">#{question.order}</span>
                        </h4>
                        <div className="question-actions">
                          <Button onClick={() => startEditingQuestion(question)}>编辑</Button>
                          <Button onClick={() => deleteQuestion(question.id)} className="delete-btn">
                            删除
                          </Button>
                        </div>
                      </div>
                      <div className="question-content">
                        <p>{question.content}</p>
                        {question.question_type === 1 && question.options.length > 0 && (
                          <div className="question-options">
                            {question.options.map((option, index) => (
                              <div key={index} className="option">
                                {index + 1}. {option}
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="correct-answer">
                          <strong>正确答案:</strong> {question.correct_answer}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="no-card-selected">
                <p>请先选择一张卡片来管理问题</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'dependencies' && (
          <div className="dependencies-panel">
            <div className="admin-toolbar">
              <Button onClick={fetchDependencyGraph} disabled={isLoading}>
                {isLoading ? '刷新中...' : '刷新'}
              </Button>
            </div>

            {isLoading ? (
              <div className="loading">加载中...</div>
            ) : dependencyGraph ? (
              <div className="dependency-graph">
                <h3>卡片依赖关系图</h3>
                <div className="graph-content">
                  {dependencyGraph.nodes.length === 0 ? (
                    <div className="no-data">
                      <p>暂无卡片数据</p>
                    </div>
                  ) : (
                    <div className="mermaid-container">
                      <div 
                        ref={mermaidRef}
                        className="mermaid-diagram"
                        style={{ minHeight: '400px' }}
                      >
                        加载中...
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="graph-stats">
                  <div className="stat-item">
                    <span className="stat-label">卡片总数:</span>
                    <span className="stat-value">{dependencyGraph.nodes.length}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">依赖关系:</span>
                    <span className="stat-value">{dependencyGraph.edges.length}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">问题总数:</span>
                    <span className="stat-value">
                      {dependencyGraph.nodes.reduce((sum, node) => sum + node.questionCount, 0)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="no-data">
                <p>暂无数据</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'learning_records' && (
          <div className="learning-records-panel">
            <div className="admin-toolbar">
              <div className="user-filter">
                <label>筛选用户:</label>
                <select 
                  value={selectedUsername} 
                  onChange={(e) => {
                    setSelectedUsername(e.target.value);
                    fetchLearningRecords(e.target.value || undefined);
                  }}
                >
                  <option value="">所有用户</option>
                  {users.map(user => (
                    <option key={user.id} value={user.username}>
                      {user.username} ({user.total_records} 条记录)
                    </option>
                  ))}
                </select>
              </div>
              <Button onClick={() => fetchLearningRecords(selectedUsername)} disabled={isLoading}>
                {isLoading ? '刷新中...' : '刷新'}
              </Button>
            </div>

            {/* 用户统计 */}
            {!selectedUsername && (
              <div className="users-stats">
                <h3>用户统计</h3>
                <div className="stats-grid">
                  {users.map(user => (
                    <div key={user.id} className="user-stat-card">
                      <div className="user-header">
                        <h4>{user.username}</h4>
                        <span className="join-date">
                          {user.date_joined ? new Date(user.date_joined).toLocaleDateString('zh-CN') : '未知'}
                        </span>
                      </div>
                      <div className="user-stats">
                        <div className="stat-item">
                          <span className="stat-label">总记录:</span>
                          <span className="stat-value">{user.total_records}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">已掌握:</span>
                          <span className="stat-value mastered">{user.mastered_count}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">学习中:</span>
                          <span className="stat-value learning">{user.learning_count}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">未学习:</span>
                          <span className="stat-value not-learned">{user.not_learned_count}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 学习记录列表 */}
            <div className="learning-records-list">
              <h3>学习记录 {selectedUsername && `(${selectedUsername})`}</h3>
              
              {learningRecords.length === 0 ? (
                <div className="empty-state">
                  <p>暂无学习记录</p>
                </div>
              ) : (
                <div className="records-table">
                  <table>
                    <thead>
                      <tr>
                        <th>用户名</th>
                        <th>卡片</th>
                        <th>状态</th>
                        <th>队列</th>
                        <th>学习时间</th>
                        <th>掌握时间</th>
                        <th>练习次数</th>
                        <th>正确率</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {learningRecords.map(record => (
                        <tr key={record.id}>
                          <td>{record.username}</td>
                          <td>
                            <div className="card-info">
                              <div className="card-title">{record.card_title}</div>
                              <div className="card-content">{record.card_content}</div>
                            </div>
                          </td>
                          <td>
                            <select 
                              value={record.status} 
                              onChange={(e) => updateLearningRecord(record.id, e.target.value)}
                              className={`status-select ${record.status}`}
                            >
                              <option value="not_learned">未学过</option>
                              <option value="learning">学过但未完全掌握</option>
                              <option value="mastered">完全掌握</option>
                            </select>
                          </td>
                          <td>
                            <select 
                              value={record.queue} 
                              onChange={(e) => updateLearningRecord(record.id, record.status, e.target.value)}
                              className={`queue-select ${record.queue}`}
                            >
                              <option value="learning">学习队列</option>
                              <option value="practice">练习队列</option>
                              <option value="review">复习队列</option>
                            </select>
                          </td>
                          <td>
                            {record.first_learned 
                              ? new Date(record.first_learned).toLocaleDateString('zh-CN')
                              : '未学习'
                            }
                          </td>
                          <td>
                            {record.mastered_time 
                              ? new Date(record.mastered_time).toLocaleDateString('zh-CN')
                              : '未掌握'
                            }
                          </td>
                          <td>{record.practice_attempts}</td>
                          <td>
                            {record.total_questions > 0 
                              ? `${record.correct_answers}/${record.total_questions} (${Math.round((record.correct_answers / record.total_questions) * 100)}%)`
                              : '无题目'
                            }
                          </td>
                          <td>
                            <Button 
                              className="delete-btn"
                              onClick={() => deleteLearningRecord(record.id)}
                            >
                              删除
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Admin; 