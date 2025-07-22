import { useState } from 'react';
import { Form, Input, Button, Checkbox, message, Typography } from 'antd';
import { 
  UserOutlined, 
  LockOutlined, 
  EyeInvisibleOutlined, 
  EyeTwoTone,
  LoginOutlined,
  ExclamationCircleOutlined,
  GithubOutlined,
  GoogleOutlined
} from '@ant-design/icons';
import { useRouter } from '@/hooks';
import { BACKEND_URL } from '@/constants';
import './index.scss';

const { Title, Text } = Typography;

interface LoginFormData {
  username: string;
  password: string;
  remember: boolean;
}

function Login() {
  const [form] = Form.useForm();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (values: LoginFormData) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${BACKEND_URL}/login/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: values.username,
          password: values.password,
        }),
      });

      const data = await response.json();

      if (response.ok && data.token) {
        // 保存token到localStorage
        localStorage.setItem('token', data.token);
        localStorage.setItem('username', values.username);
        
        // 如果选择了记住我，保存用户名
        if (values.remember) {
          localStorage.setItem('rememberedUsername', values.username);
        } else {
          localStorage.removeItem('rememberedUsername');
        }
        
        message.success('登录成功！');
        
        // 跳转到首页
        setTimeout(() => {
          router.push('/');
        }, 1000);
      } else {
        throw new Error(data.error || '登录失败');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      setError(error.message || '网络错误，请稍后重试');
      message.error(error.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = (provider: 'github' | 'google') => {
    message.info(`${provider === 'github' ? 'GitHub' : 'Google'} 登录功能即将开放`);
  };

  // 初始化表单数据（记住用户名功能）
  const initialValues = {
    username: localStorage.getItem('rememberedUsername') || '',
    password: '',
    remember: false,
  };

  return (
    <div className="login-container">
      <div className="login-card fade-in">
        {loading && (
          <div className="loading-overlay">
            <div className="loading-spinner">
              <div className="spinner"></div>
              <div className="loading-text">正在登录...</div>
            </div>
          </div>
        )}
        
        {/* 登录头部 */}
        <div className="login-header">
          <div className="logo">AI</div>
          <Title level={2} className="title">
            欢迎回来
          </Title>
          <Text className="subtitle">
            请登录您的账户以继续学习
          </Text>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="error-message">
            <ExclamationCircleOutlined className="error-icon" />
            {error}
          </div>
        )}

        {/* 登录表单 */}
        <Form
          form={form}
          name="loginForm"
          initialValues={initialValues}
          onFinish={handleLogin}
          autoComplete="off"
          className="login-form"
          layout="vertical"
        >
          <Form.Item
            name="username"
            label="用户名"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 3, message: '用户名至少3个字符' },
              { max: 20, message: '用户名最多20个字符' },
            ]}
            className="form-group"
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="请输入您的用户名"
              size="large"
              disabled={loading}
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="密码"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 6, message: '密码至少6个字符' },
            ]}
            className="form-group"
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请输入您的密码"
              size="large"
              disabled={loading}
              iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
            />
          </Form.Item>

          <div className="remember-forgot">
            <Form.Item
              name="remember"
              valuePropName="checked"
              style={{ margin: 0 }}
            >
              <Checkbox disabled={loading}>
                记住我
              </Checkbox>
            </Form.Item>
            <a href="#" className="forgot-password">
              忘记密码？
            </a>
          </div>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              disabled={loading}
              className="login-button"
              icon={<LoginOutlined />}
            >
              {loading ? '登录中...' : '登录'}
            </Button>
          </Form.Item>
        </Form>

        {/* 分割线 */}
        <div className="login-divider">
          <span className="divider-text">或者使用</span>
        </div>

        {/* 社交登录 */}
        <div className="social-login">
          <div 
            className="social-btn github"
            onClick={() => handleSocialLogin('github')}
          >
            <GithubOutlined />
          </div>
          <div 
            className="social-btn google"
            onClick={() => handleSocialLogin('google')}
          >
            <GoogleOutlined />
          </div>
        </div>

        {/* 注册链接 */}
        <div className="signup-link">
          还没有账户？
          <a href="#" onClick={() => router.push('/register')}>
            立即注册
          </a>
        </div>
      </div>
    </div>
  );
}

export default Login;
