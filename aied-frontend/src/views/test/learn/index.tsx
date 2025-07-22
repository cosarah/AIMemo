import { useState, useEffect, useRef } from 'react';
import { Layout, Typography, Button, Card, Input, Space, Row, Col, Spin, Avatar, Breadcrumb, Alert, message } from 'antd';
import { 
  HomeOutlined, 
  EditOutlined, 
  ReloadOutlined, 
  SettingOutlined,
  LeftOutlined,
  RightOutlined,
  SendOutlined,
  UserOutlined,
  RobotOutlined
} from '@ant-design/icons';
import { useRouter } from '@/hooks';
import { BACKEND_URL } from '@/constants';
import './index.scss';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

const { Header, Content } = Layout;
const { Title, Paragraph } = Typography;
// const { TextArea } = Input;

interface Message {
  text: string;
  from: 'user' | 'ai';
}

interface Card {
    id: string;
    title?: string;
    content: string;
    prerequisites?: string[];
    created_at?: string;
}

const welcome: Message = {
        text: 'Welcome to the learning page!',
        from: 'ai',
    };

const blank_card: Card = {
    id: '0',
    content: '# a blank card\n ## a blank card \n $x-1=0$ \n ```python\n print("hello world")\n``` \n **bold** \n *italic* \n [link](https://www.example.com) \n - list item 1 \n - list item 2 \n > blockquote \n ![image](https://www.example.com/image.jpg) \n',
};


function Learn() {
    
  const [messages, setMessages] = useState([welcome]);
  const [input, setInput] = useState('');
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isResponding, setIsResponding] = useState(false);
  const [card, setCard] = useState(blank_card);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isResponding]);

  const handleSubmit = async (e?: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLInputElement>) => {
    if (e) {
      e.preventDefault();
    }
    
    // 如果是Enter键事件，检查是否按下了Enter键
    if (e && 'key' in e && e.key !== 'Enter') {
      return;
    }
    
    // 这里需要调用AI聊天库或API，然后将响应添加到messages中
    const userMessage = { text: input, from: 'user' as const };
    setMessages(prev => [...prev, userMessage]);
    
    const currentInput = input;
    setInput('');
    
    try {
        setIsResponding(true);
        const response = await fetch(`${BACKEND_URL}/chat/`, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: currentInput,
            card_id: card.id,
            username: localStorage.getItem('username') || 'default_user'
          }),
        });

        if (!response.ok) {
        throw new Error('Network response was not ok');
        }
        
        const data = await response.json();
        setMessages(prev => [...prev, { text: data.reply, from: 'ai' }]);
    } catch (error) {
        setMessages(prev => [...prev, { text: 'An error occurred', from: 'ai' }]);
        console.error('There was a problem with the fetch operation:', error);
    } finally {
        setIsResponding(false);
    }
  };

const nextCard = async () => {
    try {
        setIsLoading(true);
        
        // 首先标记当前卡片学习完成
        await fetch(`${BACKEND_URL}/scheduler/complete-learning/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                card_id: card.id,
                username: localStorage.getItem('username') || 'default_user'
            }),
        });
        
        // 获取下一张学习卡片
        const response = await fetch(`${BACKEND_URL}/scheduler/next-card/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                type: 'learning',
                username: localStorage.getItem('username') || 'default_user'
            }),
        });
        
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        
        const data = await response.json();
        if (data.error) {
            if (data.error.includes('No cards available')) {
                message.success('恭喜！您已经完成了所有学习任务');
                router.push('/');
                return;
            }
            throw new Error(data.error);
        }
        
        setCard(data);
    } catch (error) {
        console.error('There was a problem with the fetch operation:', error);
        message.error('获取下一张卡片失败');
    } finally {
        setIsLoading(false);
    }
};

const prevCard = async () => {
    try {
        setIsLoading(true);
        const response = await fetch(`${BACKEND_URL}/card/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              card_id: card.id,
              type: 'prev',
              username: localStorage.getItem('username') || 'default_user'
            }),
        });
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();
        setCard(data);
    } catch (error) {
        console.error('There was a problem with the fetch operation:', error);
    } finally {
        setIsLoading(false);
    }
};

  useEffect(() => {
    setIsLoading(true);
    // 使用智能调度器获取下一张学习卡片
    fetch(`${BACKEND_URL}/scheduler/next-card/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'learning',
          username: localStorage.getItem('username') || 'default_user'
        })
      })
      .then((response) => response.json())
      .then((data) => {
        if (data.error) {
          if (data.error.includes('No cards available')) {
            message.info('恭喜！您已经完成了所有学习任务');
            router.push('/');
            return;
          }
          throw new Error(data.error);
        }
        setCard(data);
      })
      .catch ((error) => {
        console.log("There is a problem with getting learning card", error);
        message.error('获取学习卡片失败');
        setIsLoading(false);
      })
      .finally(() => {
        setIsLoading(false);
      });
    }, [router]);

  // console.log(process.memoryUsage());

  return (
    <Layout className="learn-layout">
      <Header className="learn-header">
        <div className="header-content">
          <Breadcrumb
            items={[
              { title: <HomeOutlined />, href: '/' },
              { title: '学习模式' }
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
              icon={<EditOutlined />} 
              onClick={() => router.push('/practice')}
            >
              练习
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

      <Layout>
        <Content className="learn-content">
          <Row gutter={24} style={{ height: '100%' }}>
            {/* 学习内容区域 */}
            <Col xs={24} lg={14} className="content-col">
              <Card 
                className="learning-card"
                title={
                  <Space>
                    <Title level={3} style={{ margin: 0 }}>
                      {card.title || '学习内容'}
                    </Title>
                  </Space>
                }
                extra={
                  <Space>
                    <Button 
                      icon={<LeftOutlined />} 
                      onClick={prevCard}
                      loading={isLoading}
                    >
                      上一张
                    </Button>
                    <Button 
                      icon={<RightOutlined />} 
                      onClick={nextCard}
                      loading={isLoading}
                      type="primary"
                    >
                      下一张
                    </Button>
                  </Space>
                }
              >
                {card.prerequisites && card.prerequisites.length > 0 && (
                  <Alert
                    message="前置要求"
                    description={
                      <div>
                        <Paragraph>需要先学习以下卡片：</Paragraph>
                        <ul>
                          {card.prerequisites.map((prereqId, index) => (
                            <li key={prereqId}>前置卡片 {index + 1}</li>
                          ))}
                        </ul>
                      </div>
                    }
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                  />
                )}
                
                <div className="markdown-content">
                  {isLoading ? (
                    <div style={{ textAlign: 'center', padding: '50px' }}>
                      <Spin size="large" />
                      <div style={{ marginTop: 16 }}>加载中...</div>
                    </div>
                  ) : (
                    <ReactMarkdown
                      remarkPlugins={[remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                    >
                      {card.content}
                    </ReactMarkdown>
                  )}
                </div>
              </Card>
            </Col>

            {/* AI聊天区域 */}
            <Col xs={24} lg={10} className="chat-col">
              <Card 
                className="chat-card"
                title={
                  <Space>
                    <RobotOutlined />
                    <span>AI学习助手</span>
                  </Space>
                }
                bodyStyle={{ padding: 0, height: 'calc(100vh - 200px)' }}
              >
                <div className="chat-messages">
                  {messages.map((message, index) => (
                    <div key={index} className={`message-item ${message.from}`}>
                      <div className="message-avatar">
                        <Avatar 
                          icon={message.from === 'user' ? <UserOutlined /> : <RobotOutlined />}
                          style={{ 
                            backgroundColor: message.from === 'user' ? '#1890ff' : '#52c41a' 
                          }}
                        />
                      </div>
                      <div className="message-bubble">
                        {message.text}
                      </div>
                    </div>
                  ))}
                  
                  {isResponding && (
                    <div className="message-item ai">
                      <div className="message-avatar">
                        <Avatar icon={<RobotOutlined />} style={{ backgroundColor: '#52c41a' }} />
                      </div>
                      <div className="message-bubble thinking">
                        <Spin size="small" /> 思考中...
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
                
                <div className="chat-input">
                  <form onSubmit={handleSubmit}>
                    <Input.Group compact>
                      <Input
                        style={{ width: 'calc(100% - 50px)' }}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="随时向我提问..."
                        disabled={isResponding}
                        onPressEnter={handleSubmit}
                      />
                      <Button 
                        type="primary" 
                        icon={<SendOutlined />}
                        disabled={isResponding || !input.trim()}
                        onClick={handleSubmit}
                        style={{ width: '50px' }}
                      />
                    </Input.Group>
                  </form>
                </div>
              </Card>
            </Col>
          </Row>
        </Content>
      </Layout>
    </Layout>
  );
}

export default Learn;
