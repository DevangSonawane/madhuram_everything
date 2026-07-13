import React, { useState } from 'react';
import { Form, Input, Button, Card, message, Typography } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';
import './loginPage.css';

const { Title } = Typography;

const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const onFinish = async (values: { employeeCode: string; password: string }) => {
    setLoading(true);
    try {
      await login(values.employeeCode, values.password);
      message.success('Login successful!');
      navigate('/activity');
    } catch (error: any) {
      console.error('Login error:', error);
      const errorMessage = error?.message || error?.data?.message || 'Invalid employee code or password';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const onFinishFailed = (errorInfo: any) => {
    console.log('Form validation failed:', errorInfo);
  };

  return (
    <div className="login-container">
      <Card className="login-card">
        <div className="login-header">
          <Title level={2}>Ethernet CRM</Title>
          <p className="login-subtitle">Sign in to your account</p>
        </div>
        
        <Form
          name="login"
          onFinish={onFinish}
          onFinishFailed={onFinishFailed}
          autoComplete="off"
          layout="vertical"
          size="large"
          preserve={false}
        >
          <Form.Item
            name="employeeCode"
            label="Employee Code"
            rules={[
              { required: true, message: 'Please input your employee code!' },
              { min: 3, message: 'Employee code must be at least 3 characters' }
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="Enter your employee code"
              autoComplete="username"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="Password"
            rules={[
              { required: true, message: 'Please input your password!' },
              { min: 6, message: 'Password must be at least 6 characters' }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Enter your password"
              autoComplete="current-password"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              className="login-button"
            >
              Sign In
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default LoginPage;

