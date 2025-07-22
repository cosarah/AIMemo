import { useState, useEffect, useCallback } from 'react';
import { Layout, Typography, Button, Space, Card, Row, Col, Statistic, Progress, Badge, message, Dropdown, Avatar } from 'antd';
import { BookOutlined, EditOutlined, UserOutlined, SettingOutlined, BarChartOutlined, TrophyOutlined, FireOutlined, ClockCircleOutlined, LogoutOutlined, LoginOutlined } from '@ant-design/icons';
import { useRouter } from '@/hooks';
import { BACKEND_URL } from '@/constants';
import './index.scss';

const { Content } = Layout;
const { Title, Paragraph } = Typography;

interface DashboardData {
  user_stats: {
    total_learned_cards: number;
    total_mastered_cards: number;
    daily_goal: number;
  };
  queue_stats: {
    learning_queue: number;
    practice_queue: number;
    review_queue: number;
    due_review: number;
  };
  status_stats: {
    not_learned: number;
    learning: number;
    mastered: number;
  };
}

function Home() {
  const router = useRouter();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async (username: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/scheduler/dashboard/?username=${username}`);
      if (response.ok) {
        const data = await response.json();
        setDashboardData(data);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  }, []);

  const checkLoginStatus = useCallback(() => {
    const token = localStorage.getItem('token');
    const storedUsername = localStorage.getItem('username');
    
    if (token && storedUsername) {
      setIsLoggedIn(true);
      setUsername(storedUsername);
      fetchDashboardData(storedUsername);
    } else {
      setIsLoggedIn(false);
      setUsername(null);
    }
  }, [fetchDashboardData]);

  useEffect(() => {
    checkLoginStatus();
  }, [checkLoginStatus]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setIsLoggedIn(false);
    setUsername(null);
    setDashboardData(null);
    message.success('已退出登录');
    router.push('/login');
  };

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人资料',
      onClick: () => message.info('个人资料功能即将开放'),
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '设置',
      onClick: () => router.push('/admin'),
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  const features = [
    {
      icon: <BookOutlined style={{ fontSize: '2rem', color: '#1890ff' }} />,
      title: '智能学习',
      description: '基于AI的个性化学习路径推荐',
      action: () => isLoggedIn ? router.push('/learn') : router.push('/login')
    },
    {
      icon: <EditOutlined style={{ fontSize: '2rem', color: '#52c41a' }} />,
      title: '互动练习',
      description: '多样化的练习模式，巩固学习成果',
      action: () => isLoggedIn ? router.push('/practice') : router.push('/login')
    },
    {
      icon: <BarChartOutlined style={{ fontSize: '2rem', color: '#faad14' }} />,
      title: '复习系统',
      description: '智能复习提醒，防止遗忘',
      action: () => isLoggedIn ? router.push('/review') : router.push('/login')
    },
    {
      icon: <SettingOutlined style={{ fontSize: '2rem', color: '#722ed1' }} />,
      title: '管理控制台',
      description: '内容管理和数据分析',
      action: () => isLoggedIn ? router.push('/admin') : router.push('/login')
    }
  ];

  return (
    <Layout className="pg-home">
      <Content className="home-content">
        {/* 顶部用户信息栏 */}
        <div className="user-info-bar">
          {isLoggedIn ? (
            <div className="user-welcome">
              <span className="welcome-text">欢迎回来，</span>
              <Dropdown menu={{ items: userMenuItems }} trigger={['click']}>
                <Space className="user-dropdown">
                  <Avatar icon={<UserOutlined />} />
                  <span>{username}</span>
                </Space>
              </Dropdown>
            </div>
          ) : (
            <Space>
              <Button 
                type="primary" 
                icon={<LoginOutlined />}
                onClick={() => router.push('/login')}
              >
                登录
              </Button>
              <Button 
                onClick={() => router.push('/register')}
              >
                注册
              </Button>
            </Space>
          )}
        </div>

        {/* 学习仪表板 - 仅在登录时显示 */}
        {isLoggedIn && dashboardData && (
          <div className="dashboard-section">
            <Title level={2} style={{ textAlign: 'center', marginBottom: '2rem' }}>
              学习概览
            </Title>
            
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} md={6}>
                <Card className="stat-card">
                  <Statistic
                    title="已学习卡片"
                    value={dashboardData.user_stats.total_learned_cards}
                    prefix={<BookOutlined />}
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Card className="stat-card">
                  <Statistic
                    title="已掌握卡片"
                    value={dashboardData.user_stats.total_mastered_cards}
                    prefix={<TrophyOutlined />}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Card className="stat-card">
                  <Statistic
                    title="待练习"
                    value={dashboardData.queue_stats.practice_queue}
                    prefix={<EditOutlined />}
                    valueStyle={{ color: '#faad14' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Card className="stat-card">
                  <Badge count={dashboardData.queue_stats.due_review} offset={[10, 0]}>
                    <Statistic
                      title="待复习"
                      value={dashboardData.queue_stats.review_queue}
                      prefix={<ClockCircleOutlined />}
                      valueStyle={{ color: '#722ed1' }}
                    />
                  </Badge>
                </Card>
              </Col>
            </Row>
            
            <Row gutter={[16, 16]} style={{ marginTop: '1rem' }}>
              <Col xs={24} md={12}>
                <Card title="学习进度" className="progress-card">
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div>
                      <span>掌握进度</span>
                      <Progress
                        percent={Math.round((dashboardData.user_stats.total_mastered_cards / Math.max(dashboardData.user_stats.total_learned_cards, 1)) * 100)}
                        status="active"
                        strokeColor="#52c41a"
                      />
                    </div>
                    <div>
                      <span>每日目标</span>
                      <Progress
                        percent={Math.round((dashboardData.user_stats.total_learned_cards / dashboardData.user_stats.daily_goal) * 100)}
                        status="active"
                        strokeColor="#1890ff"
                      />
                    </div>
                  </Space>
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card title="快捷操作" className="quick-actions-card">
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Button
                      type="primary"
                      icon={<BookOutlined />}
                      block
                      onClick={() => router.push('/learn')}
                    >
                      继续学习 ({dashboardData.queue_stats.learning_queue})
                    </Button>
                    <Button
                      type="default"
                      icon={<EditOutlined />}
                      block
                      onClick={() => router.push('/practice')}
                    >
                      开始练习 ({dashboardData.queue_stats.practice_queue})
                    </Button>
                    <Button
                      type="default"
                      icon={<FireOutlined />}
                      block
                      onClick={() => router.push('/review')}
                      danger={dashboardData.queue_stats.due_review > 0}
                    >
                      复习卡片 ({dashboardData.queue_stats.due_review})
                    </Button>
                  </Space>
                </Card>
              </Col>
            </Row>
          </div>
        )}
        
        <div className="hero-section">
          <Space direction="vertical" size="large" align="center">
            <Title level={1} className="hero-title">
              🧠 AIMemo
            </Title>
            <Paragraph className="hero-subtitle">
              个性化自适应学习系统，让学习变得简单高效
            </Paragraph>
            <Paragraph className="hero-description">
              基于人工智能的智能学习平台，为您提供个性化的学习体验
            </Paragraph>
            
            <Space size="large">
              <Button 
                type="primary" 
                size="large" 
                icon={<BookOutlined />}
                onClick={() => isLoggedIn ? router.push('/learn') : router.push('/login')}
                className="primary-btn"
              >
                {isLoggedIn ? '开始学习' : '登录后开始学习'}
              </Button>
              {!isLoggedIn && (
                <Button 
                  size="large" 
                  icon={<UserOutlined />}
                  onClick={() => router.push('/login')}
                >
                  登录账户
                </Button>
              )}
            </Space>
          </Space>
        </div>

        <div className="features-section">
          <Title level={2} style={{ textAlign: 'center', marginBottom: '3rem' }}>
            核心功能
          </Title>
          
          <Row gutter={[24, 24]} justify="center">
            {features.map((feature, index) => (
              <Col xs={24} sm={12} lg={6} key={index}>
                <Card
                  hoverable
                  className="feature-card"
                  bodyStyle={{ padding: '2rem', textAlign: 'center' }}
                  onClick={feature.action}
                >
                  <Space direction="vertical" size="middle" align="center">
                    {feature.icon}
                    <Title level={4} style={{ margin: 0 }}>
                      {feature.title}
                    </Title>
                    <Paragraph style={{ margin: 0, color: '#666' }}>
                      {feature.description}
                    </Paragraph>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      </Content>
    </Layout>
  );
}

export default Home;
