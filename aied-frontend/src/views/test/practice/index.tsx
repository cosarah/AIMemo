import { useState, useEffect } from 'react';
import { Layout, Typography, Button, Card, Input, Space, Row, Col, Spin, Radio, Breadcrumb, Alert, message } from 'antd';
import { 
  HomeOutlined, 
  ReloadOutlined, 
  SettingOutlined,
  LeftOutlined,
  RightOutlined,
  CheckOutlined,
  BookOutlined
} from '@ant-design/icons';
import { useRouter } from '@/hooks';
import './index.scss';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { BACKEND_URL } from '@/constants';

const { Header, Content } = Layout;
const { Title } = Typography;
const { TextArea } = Input;

interface Question {
  id: number;
  type: 'choice' | 'short_answer' | 'coding';
  content: string;
  options?: string[];
  isLast: boolean;
}

interface Response {
  is_correct: boolean;
  analysis: string;
  output?: string;
  analysis_time?: number; // 分析用时（毫秒）
}



const blank_question: Question = {
  id: 2,
  type: 'coding',
  content: 'a blank question',
  options: [],
  isLast: true,
};

function Practice() {
  const [question, setQuestion] = useState<Question>(blank_question);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isResponding, setIsResponding] = useState(false);
  const [input, setInput] = useState('');
  const [response, setResponse] = useState<Response>({ is_correct: false, analysis: '', output: '', analysis_time: 0 });
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  useEffect(() => {
    setIsLoading(true);
    
    // 使用智能调度器获取练习卡片
    fetch(`${BACKEND_URL}/scheduler/next-card/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'practice',
        username: localStorage.getItem('username') || 'default_user'
      })
    })
    .then(response => response.json())
    .then(cardData => {
      if (cardData.error && cardData.error.includes('No cards available')) {
        // 如果没有练习卡片，尝试获取学习卡片
        return fetch(`${BACKEND_URL}/scheduler/next-card/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'learning',
            username: localStorage.getItem('username') || 'default_user'
          })
        }).then(response => response.json());
      }
      return cardData;
    })
    .then(cardData => {
      if (cardData.error) {
        if (cardData.error.includes('No cards available')) {
          message.info('恭喜！您已经完成了所有练习任务');
          router.push('/');
          setIsLoading(false);
          return null; // 返回null，避免后续处理
        }
        throw new Error(cardData.error);
      }
      
      // 保存卡片ID到localStorage（向后兼容）
      localStorage.setItem('card_id', cardData.id);
      
      // 获取第一个问题
      return fetch(`${BACKEND_URL}/question/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: localStorage.getItem('username') || 'default_user',
          card_id: cardData.id,
          type: 'first'
        })
      });
    })
    .then(response => response ? response.json() : null)
    .then(questionData => {
      if (questionData) {
        setQuestion(questionData);
        setIsLoading(false);
      }
    })
    .catch(error => {
      console.error('Error fetching practice card or question:', error);
      message.error('获取练习题目失败');
      setIsLoading(false);
    });
  }, [router]);

  const submitChoice = async () => {
    if (selectedOption === null) {
      message.warning('请选择一个答案');
      return;
    }
    
    const startTime = Date.now();
    setIsResponding(true);
    message.loading('正在分析您的答案...', 0);
    
    try {
      const response = await fetch(`${BACKEND_URL}/submit/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question_id: question.id,
          answer: selectedOption.toString(),
          username: localStorage.getItem('username') || 'default_user',
          type: 'choice'
        }),
      });
      const data = await response.json();
      const endTime = Date.now();
      const analysisTime = endTime - startTime;
      
      // 添加分析用时到响应数据
      const responseWithTime = { ...data, analysis_time: analysisTime };
      setResponse(responseWithTime);
      
      message.destroy(); // 清除加载提示
      
      if (data.is_correct) {
        message.success(`回答正确！分析用时：${(analysisTime / 1000).toFixed(1)}秒`);
      } else {
        message.error(`回答错误，分析用时：${(analysisTime / 1000).toFixed(1)}秒`);
      }
    } catch (error) {
      console.error('There was a problem with the fetch operation:', error);
      message.destroy(); // 清除加载提示
      message.error('提交失败');
    } finally {
      setIsResponding(false);
    }
  };

  const submitShortAnswer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) {
      message.warning('请输入答案');
      return;
    }
    
    const startTime = Date.now();
    setIsResponding(true);
    message.loading('正在分析您的答案...', 0);
    
    try {
      const response = await fetch(`${BACKEND_URL}/submit/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question_id: question.id,
          username: localStorage.getItem('username') || 'default_user',
          answer: input,
          type: 'short_answer'
        }),
      });
      const data = await response.json();
      const endTime = Date.now();
      const analysisTime = endTime - startTime;
      
      // 添加分析用时到响应数据
      const responseWithTime = { ...data, analysis_time: analysisTime };
      setResponse(responseWithTime);
      
      message.destroy(); // 清除加载提示
      
      if (data.is_correct) {
        message.success(`回答正确！分析用时：${(analysisTime / 1000).toFixed(1)}秒`);
      } else {
        message.error(`回答错误，分析用时：${(analysisTime / 1000).toFixed(1)}秒`);
      }
    } catch (error) {
      console.error('There was a problem with the fetch operation:', error);
      message.destroy(); // 清除加载提示
      message.error('提交失败');
    } finally {
      setIsResponding(false);
    }
  };

  const submitCoding = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) {
      message.warning('请输入代码');
      return;
    }
    
    const startTime = Date.now();
    setIsResponding(true);
    message.loading('正在分析您的代码...', 0);
    
    try {
      const response = await fetch(`${BACKEND_URL}/submit/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question_id: question.id,
          username: localStorage.getItem('username') || 'default_user',
          answer: input,
          type: 'code'
        }),
      });
      const data = await response.json();
      const endTime = Date.now();
      const analysisTime = endTime - startTime;
      
      // 添加分析用时到响应数据
      const responseWithTime = { ...data, analysis_time: analysisTime };
      setResponse(responseWithTime);
      
      message.destroy(); // 清除加载提示
      
      if (data.is_correct) {
        message.success(`代码正确！分析用时：${(analysisTime / 1000).toFixed(1)}秒`);
      } else {
        message.error(`代码错误，分析用时：${(analysisTime / 1000).toFixed(1)}秒`);
      }
    } catch (error) {
      console.error('There was a problem with the fetch operation:', error);
      message.destroy(); // 清除加载提示
      message.error('提交失败');
    } finally {
      setIsResponding(false);
    }
  };

  const prevQuestion = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/question/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'prev',
          question_id: question.id,
          username: localStorage.getItem('username') || 'default_user',
        }),
      });
      const data = await response.json();
      if (data.message && data.message.includes('没有更多问题了')) {
        message.info('已经是第一题了');
        setIsLoading(false);
        return;
      }
      setQuestion(data);
      setInput('');
      setSelectedOption(null);
      setResponse({ is_correct: false, analysis: '', output: '', analysis_time: 0 });
    } catch (error) {
      console.error('There was a problem with the fetch operation:', error);
      message.error('获取上一题失败');
    } finally {
      setIsLoading(false);
    }
  };

  const nextQuestion = async () => {
    if (question.isLast) {
      // 卡片练习完成，通知智能调度器
      try {
        const cardId = localStorage.getItem('card_id');
        if (cardId) {
          await fetch(`${BACKEND_URL}/scheduler/complete-practice/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              card_id: cardId,
              username: localStorage.getItem('username') || 'default_user'
            }),
          });
        }
        message.success('练习完成！');
        router.push('/');
      } catch (error) {
        console.error('Error completing practice:', error);
        router.push('/');
      }
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/question/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question_id: question.id,
          username: localStorage.getItem('username') || 'default_user',
          type: 'next'
        }),
      });
      const data = await response.json();
      if (data.message && data.message.includes('没有更多问题了')) {
        message.info('本卡片练习完成！');
        // 练习完成，回到首页
        router.push('/');
        return;
      }
      setQuestion(data);
      setInput('');
      setSelectedOption(null);
      setResponse({ is_correct: false, analysis: '', output: '', analysis_time: 0 });
    } catch (error) {
      console.error('There was a problem with the fetch operation:', error);
      message.error('获取下一题失败');
    } finally {
      setIsLoading(false);
    }
  };

  const getQuestionTypeText = (type: string) => {
    switch (type) {
      case 'choice':
        return '选择题';
      case 'short_answer':
        return '简答题';
      case 'coding':
        return '编程题';
      default:
        return '题目';
    }
  };

  return (
    <Layout className="practice-layout">
      <Header className="practice-header">
        <div className="header-content">
          <Breadcrumb
            items={[
              { title: <HomeOutlined />, href: '/' },
              { title: '练习模式' }
            ]}
          />
          
          <Space>
            <Button 
              icon={<HomeOutlined />} 
              onClick={() => router.push('/')}
            >
              首页
            </Button>
            <Button 
              icon={<BookOutlined />} 
              onClick={() => router.push('/learn')}
            >
              学习
            </Button>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={() => router.push('/review')}
            >
              复习
            </Button>
            <Button 
              icon={<SettingOutlined />} 
              type="primary"
              onClick={() => router.push('/admin')}
            >
              管理
            </Button>
          </Space>
        </div>
      </Header>

      <Content className="practice-content">
        <Row gutter={24} style={{ height: '100%' }}>
          <Col span={24}>
            <Card 
              className="practice-card"
              title={
                <Space>
                  <Title level={3} style={{ margin: 0 }}>
                    {getQuestionTypeText(question.type)}
                  </Title>
                </Space>
              }
            >
              <Row gutter={24}>
                {/* 题目区域 */}
                <Col xs={24} lg={12}>
                  <Card 
                    title="题目内容" 
                    className="question-card"
                    size="small"
                  >
                    {isLoading ? (
                      <div style={{ textAlign: 'center', padding: '50px' }}>
                        <Spin size="large" />
                        <div style={{ marginTop: 16 }}>加载中...</div>
                      </div>
                    ) : (
                      <div className="markdown-content">
                        <ReactMarkdown
                          remarkPlugins={[remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                        >
                          {question.content}
                        </ReactMarkdown>
                      </div>
                    )}
                  </Card>
                </Col>

                {/* 答题区域 */}
                <Col xs={24} lg={12}>
                  <Card 
                    title="答题区域" 
                    className="answer-card"
                    size="small"
                  >
                    {question.type === 'choice' && (
                      <div className="choice-section">
                        <Radio.Group
                          value={selectedOption}
                          onChange={(e: any) => setSelectedOption(e.target.value)}
                          style={{ width: '100%' }}
                        >
                          <Space direction="vertical" style={{ width: '100%' }}>
                            {question.options?.map((option: string, index: number) => (
                              <Radio 
                                key={index} 
                                value={index}
                                style={{ 
                                  padding: '12px',
                                  border: '1px solid #d9d9d9',
                                  borderRadius: '6px',
                                  width: '100%',
                                  display: 'flex',
                                  alignItems: 'center'
                                }}
                              >
                                <div style={{ marginLeft: '8px' }}>
                                  {option}
                                </div>
                              </Radio>
                            ))}
                          </Space>
                        </Radio.Group>
                        
                        <div style={{ marginTop: '16px', textAlign: 'center' }}>
                          <Button 
                            type="primary" 
                            icon={<CheckOutlined />}
                            loading={isResponding}
                            onClick={submitChoice}
                            size="large"
                          >
                            提交答案
                          </Button>
                        </div>
                      </div>
                    )}

                    {question.type === 'short_answer' && (
                      <div className="short-answer-section">
                        <form onSubmit={submitShortAnswer}>
                          <TextArea
                            value={input}
                            onChange={(e: any) => setInput(e.target.value)}
                            placeholder="请输入您的答案..."
                            rows={6}
                            style={{ marginBottom: '16px' }}
                          />
                          <div style={{ textAlign: 'center' }}>
                            <Button 
                              type="primary" 
                              htmlType="submit"
                              icon={<CheckOutlined />}
                              loading={isResponding}
                              size="large"
                            >
                              提交答案
                            </Button>
                          </div>
                        </form>
                      </div>
                    )}

                    {question.type === 'coding' && (
                      <div className="coding-section">
                        <form onSubmit={submitCoding}>
                          <TextArea
                            value={input}
                            onChange={(e: any) => setInput(e.target.value)}
                            placeholder="请输入您的代码..."
                            rows={10}
                            style={{ 
                              marginBottom: '16px',
                              fontFamily: 'Monaco, Consolas, "Courier New", monospace'
                            }}
                          />
                          <div style={{ textAlign: 'center' }}>
                            <Button 
                              type="primary" 
                              htmlType="submit"
                              icon={<CheckOutlined />}
                              loading={isResponding}
                              size="large"
                            >
                              {isResponding ? '运行中...' : '提交代码'}
                            </Button>
                          </div>
                        </form>
                      </div>
                    )}
                  </Card>
                </Col>
              </Row>

              {/* 结果展示区域 */}
              {isResponding && (
                <Card 
                  title="正在分析中..."
                  className="result-card"
                  size="small"
                  style={{ marginTop: '16px' }}
                >
                  <div style={{ textAlign: 'center', padding: '20px' }}>
                    <Spin size="large" />
                    <div style={{ marginTop: '10px', color: '#666' }}>
                      AI正在分析您的答案，请稍候...
                    </div>
                  </div>
                </Card>
              )}
              
              {!isResponding && response.analysis && (
                <Card 
                  title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>答题结果</span>
                      {response.analysis_time && (
                        <span style={{ fontSize: '12px', color: '#666', fontWeight: 'normal' }}>
                          分析用时：{(response.analysis_time / 1000).toFixed(1)}秒
                        </span>
                      )}
                    </div>
                  }
                  className="result-card"
                  size="small"
                  style={{ marginTop: '16px' }}
                >
                  {response.is_correct ? (
                    <Alert
                      message="回答正确！"
                      description={response.analysis}
                      type="success"
                      showIcon
                    />
                  ) : (
                    <Alert
                      message="回答错误"
                      description={
                        <div>
                          {response.output && (
                            <div style={{ marginBottom: '8px' }}>
                              <strong>输出：</strong>
                              <pre style={{ background: '#f5f5f5', padding: '8px', borderRadius: '4px', marginTop: '4px' }}>
                                {response.output}
                              </pre>
                            </div>
                          )}
                          <div>
                            <strong>分析：</strong> {response.analysis}
                          </div>
                        </div>
                      }
                      type="error"
                      showIcon
                    />
                  )}
                </Card>
              )}

              {/* 导航按钮 */}
              <div style={{ marginTop: '24px', textAlign: 'center' }}>
                <Space size="large">
                  <Button 
                    icon={<LeftOutlined />} 
                    onClick={prevQuestion}
                    loading={isLoading}
                    size="large"
                  >
                    上一题
                  </Button>
                  <Button 
                    icon={<RightOutlined />} 
                    onClick={nextQuestion}
                    loading={isLoading}
                    type="primary"
                    size="large"
                  >
                    {question.isLast ? '完成练习' : '下一题'}
                  </Button>
                </Space>
              </div>
            </Card>
          </Col>
        </Row>
      </Content>
    </Layout>
  );
}

export default Practice;