import { useState, useEffect, useCallback } from 'react';
import { Layout, Typography, Button, Card, Input, Space, Row, Col, Spin, Breadcrumb, Alert, message, Radio } from 'antd';
import { 
  HomeOutlined, 
  EditOutlined, 
  BookOutlined, 
  SettingOutlined,
  RightOutlined,
  CheckOutlined,
  ReloadOutlined,
  QuestionCircleOutlined
} from '@ant-design/icons';
import { useRouter } from '@/hooks';
import './index.scss';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { BACKEND_URL } from '@/constants';
import { ReviewQuestion, ReviewAnswerResponse } from '@/types/learning';

const { Header, Content } = Layout;
const { Title, Text } = Typography;
const { TextArea } = Input;

function Review() {
  const [currentQuestion, setCurrentQuestion] = useState<ReviewQuestion | null>(null);
  const [currentCardId, setCurrentCardId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userAnswer, setUserAnswer] = useState<string>('');
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [answerResult, setAnswerResult] = useState<ReviewAnswerResponse | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [attemptedQuestions, setAttemptedQuestions] = useState<number[]>([]);
  const [isCardMastered, setIsCardMastered] = useState(false);
  const router = useRouter();

  // 获取指定卡片的随机问题
  const getRandomQuestionForCard = useCallback(async (cardId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/review/random-question/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          card_id: cardId,
          username: localStorage.getItem('username') || 'default_user'
        })
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setCurrentQuestion(data);
      setCurrentCardId(cardId);
      setUserAnswer('');
      setSelectedOption('');
      setAnswerResult(null);
      setHasSubmitted(false);
      setIsCardMastered(false);
      
      if (data.auto_generated) {
        message.info('该卡片没有问题，已自动生成复习问题');
      }
      
    } catch (error) {
      console.error('获取问题失败:', error);
      message.error('获取问题失败');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 获取下一张需要复习的卡片
  const getNextReviewCard = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/scheduler/next-card/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'review',
          username: localStorage.getItem('username') || 'default_user'
        })
      });

      const data = await response.json();
      
      if (data.error && data.error.includes('No cards available')) {
        message.success('复习完成！暂无更多需要复习的卡片');
        router.push('/');
        return;
      }
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      // 获取卡片的随机问题
      await getRandomQuestionForCard(data.id);
      
    } catch (error) {
      console.error('获取复习卡片失败:', error);
      message.error('获取复习卡片失败');
    } finally {
      setIsLoading(false);
    }
  }, [router, getRandomQuestionForCard]);

  // 提交答案
  const submitAnswer = async () => {
    if (!currentQuestion || !currentCardId) return;
    
    const answer = currentQuestion.type === 'choice' ? selectedOption : userAnswer;
    
    if (!answer.trim()) {
      message.warning('请输入答案');
      return;
    }
    
    setIsSubmitting(true);
    setHasSubmitted(true);
    
    try {
      const response = await fetch(`${BACKEND_URL}/review/submit-answer/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question_id: currentQuestion.id,
          card_id: currentCardId,
          answer: answer,
          username: localStorage.getItem('username') || 'default_user'
        })
      });

      const data: ReviewAnswerResponse = await response.json();
      
      if (response.ok) {
        setAnswerResult(data);
        setAttemptedQuestions(prev => [...prev, currentQuestion.id]);
        
        if (data.is_correct) {
          message.success('回答正确！');
          setIsCardMastered(true);
          
          // 通知智能调度器复习成功
          await fetch(`${BACKEND_URL}/scheduler/complete-review/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              card_id: currentCardId,
              username: localStorage.getItem('username') || 'default_user',
              is_correct: true
            })
          });
        } else {
          message.error('回答错误');
          
          // 通知智能调度器复习失败
          await fetch(`${BACKEND_URL}/scheduler/complete-review/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              card_id: currentCardId,
              username: localStorage.getItem('username') || 'default_user',
              is_correct: false
            })
          });
        }
      } else {
        throw new Error('提交失败');
      }
      
    } catch (error) {
      console.error('提交答案失败:', error);
      message.error('提交答案失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 尝试其他问题
  const tryOtherQuestion = async () => {
    if (!currentCardId) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/review/next-question/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          card_id: currentCardId,
          username: localStorage.getItem('username') || 'default_user',
          exclude_question_ids: attemptedQuestions
        })
      });

      const data = await response.json();
      
      if (data.error) {
        if (data.error.includes('没有更多问题了')) {
          message.info('该卡片没有更多问题了，请继续下一张卡片');
        } else {
          throw new Error(data.error);
        }
      } else {
        setCurrentQuestion(data);
        setUserAnswer('');
        setSelectedOption('');
        setAnswerResult(null);
        setHasSubmitted(false);
        message.info('已切换到该卡片的其他问题');
      }
      
    } catch (error) {
      console.error('获取其他问题失败:', error);
      message.error('获取其他问题失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 下一张卡片
  const nextCard = async () => {
    setAttemptedQuestions([]);
    await getNextReviewCard();
  };

  // 初始化
  useEffect(() => {
    getNextReviewCard();
  }, [getNextReviewCard]);

  // 获取问题类型标签
  const getQuestionTypeLabel = (type: string) => {
    switch (type) {
      case 'choice':
        return '选择题';
      case 'short_answer':
        return '简答题';
      case 'code':
        return '代码题';
      default:
        return '问题';
    }
  };

  // 渲染问题内容
  const renderQuestion = () => {
    if (!currentQuestion) return null;

    return (
      <div className="question-content">
        <div className="question-header">
          <Title level={4}>
            <QuestionCircleOutlined /> {getQuestionTypeLabel(currentQuestion.type)}
          </Title>
          <Text type="secondary">
            卡片：{currentQuestion.card_title || '无标题'}
          </Text>
        </div>
        
        <div className="question-body">
          <div className="question-text">
            <ReactMarkdown
              remarkPlugins={[remarkMath]}
              rehypePlugins={[rehypeKatex]}
            >
              {currentQuestion.content}
            </ReactMarkdown>
          </div>
          
          {currentQuestion.type === 'choice' && (
            <div className="question-options">
              <Radio.Group
                value={selectedOption}
                onChange={(e) => setSelectedOption(e.target.value)}
                disabled={hasSubmitted}
              >
                <Space direction="vertical">
                  {currentQuestion.options.map((option, index) => (
                    <Radio key={index} value={option}>
                      {option}
                    </Radio>
                  ))}
                </Space>
              </Radio.Group>
            </div>
          )}
          
          {currentQuestion.type === 'short_answer' && (
            <div className="question-input">
              <TextArea
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                placeholder="请输入您的答案..."
                rows={4}
                disabled={hasSubmitted}
              />
            </div>
          )}
          
          {currentQuestion.type === 'code' && (
            <div className="question-code">
              <TextArea
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                placeholder="请输入您的代码..."
                rows={8}
                disabled={hasSubmitted}
                style={{ fontFamily: 'monospace' }}
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  // 渲染答案结果
  const renderResult = () => {
    if (!answerResult) return null;

    return (
      <div className="result-section">
        <Alert
          message={answerResult.is_correct ? '回答正确！' : '回答错误'}
          description={answerResult.explanation}
          type={answerResult.is_correct ? 'success' : 'error'}
          showIcon
        />
        
        {answerResult.code_output && (
          <div className="code-output">
            <Title level={5}>代码执行结果：</Title>
            <pre style={{ background: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
              {answerResult.code_output}
            </pre>
          </div>
        )}
      </div>
    );
  };

  return (
    <Layout className="review-layout">
      <Header className="review-header">
        <div className="header-content">
          <Breadcrumb
            items={[
              { title: <HomeOutlined />, href: '/' },
              { title: '复习模式' }
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
              icon={<EditOutlined />} 
              onClick={() => router.push('/practice')}
            >
              练习
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

      <Content className="review-content">
        <Row gutter={24} style={{ height: '100%' }}>
          <Col span={24}>
            <Card 
              className="review-card"
              title={
                <Space>
                  <Title level={3} style={{ margin: 0 }}>
                    <ReloadOutlined /> 复习问题
                  </Title>
                  {currentQuestion && (
                    <Text type="secondary">
                      ({currentQuestion.total_questions || 0} 个问题)
                    </Text>
                  )}
                </Space>
              }
            >
              {isLoading ? (
                <div style={{ textAlign: 'center', padding: '100px' }}>
                  <Spin size="large" />
                  <div style={{ marginTop: 16 }}>加载中...</div>
                </div>
              ) : (
                <>
                  {renderQuestion()}
                  
                  {!hasSubmitted && (
                    <div style={{ textAlign: 'center', marginTop: '24px' }}>
                      <Button
                        type="primary"
                        size="large"
                        icon={<CheckOutlined />}
                        onClick={submitAnswer}
                        loading={isSubmitting}
                        disabled={!currentQuestion || 
                          (currentQuestion.type === 'choice' && !selectedOption) ||
                          (currentQuestion.type !== 'choice' && !userAnswer.trim())
                        }
                      >
                        提交答案
                      </Button>
                    </div>
                  )}
                  
                  {renderResult()}
                  
                  {hasSubmitted && (
                    <div style={{ textAlign: 'center', marginTop: '24px' }}>
                      <Space size="large">
                        {!answerResult?.is_correct && answerResult?.can_try_other && (
                          <Button
                            type="default"
                            size="large"
                            onClick={tryOtherQuestion}
                            loading={isLoading}
                          >
                            尝试其他问题
                          </Button>
                        )}
                        
                        <Button
                          type="primary"
                          size="large"
                          icon={<RightOutlined />}
                          onClick={nextCard}
                          loading={isLoading}
                        >
                          {isCardMastered ? '下一张卡片' : '继续复习'}
                        </Button>
                      </Space>
                    </div>
                  )}
                </>
              )}
            </Card>
          </Col>
        </Row>
      </Content>
    </Layout>
  );
}

export default Review;