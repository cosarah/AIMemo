import { useState, useEffect } from 'react';
import { Form, Input, Button, message, Typography, Progress } from 'antd';
import { 
  UserOutlined, 
  LockOutlined, 
  EyeInvisibleOutlined, 
  EyeTwoTone,
  ExclamationCircleOutlined,
  UserAddOutlined
} from '@ant-design/icons';
import { useRouter } from '@/hooks';
import { BACKEND_URL } from '@/constants';
import './index.scss';

const { Title, Text } = Typography;

interface RegisterFormData {
  username: string;
  password: string;
  confirm_password: string;
}

function Register() {
  const [form] = Form.useForm();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usernameStatus, setUsernameStatus] = useState<'checking' | 'available' | 'unavailable' | 'idle'>('idle');
  const [usernameMessage, setUsernameMessage] = useState<string>('');

  // 密码强度检查
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [passwordStrengthText, setPasswordStrengthText] = useState('');

  const checkUsernameAvailability = async (username: string) => {
    if (!username || username.length < 3) {
      setUsernameStatus('idle');
      setUsernameMessage('');
      return;
    }

    setUsernameStatus('checking');
    try {
      const response = await fetch(`${BACKEND_URL}/check-username/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username }),
      });

      const data = await response.json();

      if (response.ok) {
        setUsernameStatus(data.available ? 'available' : 'unavailable');
        setUsernameMessage(data.message);
      } else {
        setUsernameStatus('idle');
        setUsernameMessage('');
      }
    } catch (error) {
      console.error('Username check error:', error);
      setUsernameStatus('idle');
      setUsernameMessage('');
    }
  };

  const calculatePasswordStrength = (password: string) => {
    let strength = 0;
    let text = '';

    if (password.length >= 6) strength += 25;
    if (password.length >= 8) strength += 25;
    if (/[A-Z]/.test(password)) strength += 25;
    if (/[0-9]/.test(password)) strength += 25;

    if (strength <= 25) {
      text = '弱';
    } else if (strength <= 50) {
      text = '中等';
    } else if (strength <= 75) {
      text = '强';
    } else {
      text = '很强';
    }

    setPasswordStrength(strength);
    setPasswordStrengthText(text);
  };

  const handleRegister = async (values: RegisterFormData) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${BACKEND_URL}/register/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      const data = await response.json();

      if (response.ok && data.token) {
        // 保存token到localStorage
        localStorage.setItem('token', data.token);
        localStorage.setItem('username', data.username);
        
        message.success('注册成功！欢迎加入AIMemo！');
        
        // 跳转到首页
        setTimeout(() => {
          router.push('/');
        }, 1500);
      } else {
        throw new Error(data.error || '注册失败');
      }
    } catch (error: any) {
      console.error('Register error:', error);
      setError(error.message || '网络错误，请稍后重试');
      message.error(error.message || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  // 实时用户名检查
  useEffect(() => {
    const username = form.getFieldValue('username');
    const timeoutId = setTimeout(() => {
      checkUsernameAvailability(username);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [form]);

  return (
    <div className="register-container">
      <div className="register-card fade-in">
        {loading && (
          <div className="loading-overlay">
            <div className="loading-spinner">
              <div className="spinner"></div>
              <div className="loading-text">注册中...</div>
            </div>
          </div>
        )}
        
        {/* 注册头部 */}
        <div className="register-header">
          <div className="logo">AI</div>
          <Title level={2} className="title">
            加入AIMemo
          </Title>
          <Text className="subtitle">
            创建您的学习账户，开启智能学习之旅
          </Text>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="error-message">
            <ExclamationCircleOutlined className="error-icon" />
            {error}
          </div>
        )}

        {/* 注册表单 */}
        <Form
          form={form}
          name="registerForm"
          onFinish={handleRegister}
          autoComplete="off"
          className="register-form"
          layout="vertical"
        >
          <Form.Item
            name="username"
            label="用户名"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 3, message: '用户名至少3个字符' },
              { max: 20, message: '用户名最多20个字符' },
              { pattern: /^[a-zA-Z0-9_]+$/, message: '用户名只能包含字母、数字和下划线' },
            ]}
            className="form-group"
            validateStatus={
              usernameStatus === 'checking' ? 'validating' :
              usernameStatus === 'available' ? 'success' :
              usernameStatus === 'unavailable' ? 'error' : ''
            }
            help={usernameMessage}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="请输入3-20个字符的用户名"
              size="large"
              disabled={loading}
              onChange={(e) => {
                const value = e.target.value;
                form.setFieldsValue({ username: value });
                if (value.length >= 3) {
                  checkUsernameAvailability(value);
                }
              }}
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="密码"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 6, message: '密码至少6个字符' },
              { max: 50, message: '密码最多50个字符' },
            ]}
            className="form-group"
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请输入6-50个字符的密码"
              size="large"
              disabled={loading}
                             onChange={(e) => calculatePasswordStrength(e.target.value)}
               iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
             />
             {passwordStrength > 0 && (
               <div className="password-strength">
                 <Progress
                   percent={passwordStrength}
                   size="small"
                   strokeColor={
                     passwordStrength <= 25 ? '#ff4d4f' :
                     passwordStrength <= 50 ? '#faad14' :
                     passwordStrength <= 75 ? '#1890ff' : '#52c41a'
                   }
                   showInfo={false}
                 />
                 <span className="strength-text">密码强度：{passwordStrengthText}</span>
               </div>
             )}
          </Form.Item>

          <Form.Item
            name="confirm_password"
            label="确认密码"
            dependencies={['password']}
            rules={[
              { required: true, message: '请确认您的密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
            className="form-group"
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请再次输入密码"
              size="large"
              disabled={loading}
              iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              disabled={loading || usernameStatus === 'unavailable'}
              className="register-button"
              icon={<UserAddOutlined />}
            >
              {loading ? '注册中...' : '立即注册'}
            </Button>
          </Form.Item>
        </Form>

        {/* 登录链接 */}
        <div className="login-link">
          已有账户？
          <a href="#" onClick={() => router.push('/login')}>
            立即登录
          </a>
        </div>
      </div>
    </div>
  );
}

export default Register; 