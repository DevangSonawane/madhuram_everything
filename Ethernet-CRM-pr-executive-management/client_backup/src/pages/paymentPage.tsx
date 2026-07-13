import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Typography, Button, Spin, message, Divider, Space, Tag } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { apiClient } from '../utils/apiClient.ts';

const { Title, Text } = Typography;

interface CustomerDetails {
  id: number;
  lead_id: number;
  first_name: string;
  last_name?: string;
  email?: string;
  alternate_phone?: string;
  date_of_birth?: string;
  gender?: string;
  contact_phone?: string;
  contact_email?: string;
  present_address_line1?: string;
  present_address_line2?: string;
  present_city?: string;
  present_state?: string;
  present_pincode?: string;
  present_country?: string;
  payment_address_same_as_present: boolean;
  payment_address_line1?: string;
  payment_address_line2?: string;
  payment_city?: string;
  payment_state?: string;
  payment_pincode?: string;
  payment_country?: string;
  latitude?: number;
  longitude?: number;
  plan_id?: number;
  plan_name?: string;
  total_amount?: number;
  amount_to_pay?: number;
  static_ip_required: boolean;
  telephone_line_required: boolean;
  lead?: {
    id: number;
    unique_id: string;
    name: string;
    phone_number: string;
    address: string;
    source: string;
    service_type: string;
    status: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

const PaymentPage = () => {
  const { uniqueId } = useParams<{ uniqueId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [customerDetails, setCustomerDetails] = useState<CustomerDetails | null>(null);

  useEffect(() => {
    if (uniqueId) {
      fetchCustomerDetails();
    }
  }, [uniqueId]);

  const fetchCustomerDetails = async () => {
    setLoading(true);
    try {
      const response = await apiClient(
        "GET",
        `/api/v1/leads/customer-details/${uniqueId}`
      );

      if (response.success && response.data) {
        // Map the response to include plan and payment details
        const mappedData: CustomerDetails = {
          ...response.data,
          plan_name: response.data.plan_name || `Plan ${response.data.plan_id || 'N/A'}`,
          total_amount: response.data.total_amount || response.data.charge || 0,
          amount_to_pay: response.data.amount_to_pay || response.data.total_amount || response.data.charge || 0,
        };
        setCustomerDetails(mappedData);
      }
    } catch (error: any) {
      console.error("Error fetching customer details", error);
      message.error(error?.message || "Failed to load payment details");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!customerDetails) {
    return (
      <div style={{ padding: '20px' }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ marginBottom: '20px' }}>
          Back
        </Button>
        <Card>
          <Typography.Text>Payment details not found</Typography.Text>
        </Card>
      </div>
    );
  }

  const lead = customerDetails.lead;
  const fullAddress = [
    customerDetails.present_address_line1,
    customerDetails.present_address_line2,
    customerDetails.present_city,
    customerDetails.present_state,
    customerDetails.present_pincode,
    customerDetails.present_country
  ].filter(Boolean).join(', ');

  return (
    <div style={{ padding: '20px', backgroundColor: '#f0f2f5', minHeight: '100vh' }}>
      <Button 
        icon={<ArrowLeftOutlined />} 
        onClick={() => navigate(-1)} 
        style={{ marginBottom: '20px' }}
      >
        Back
      </Button>

      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <Title level={2} style={{ marginBottom: '8px', textAlign: 'center' }}>
          Payment Details
        </Title>
        <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginBottom: '24px' }}>
          Lead ID: <Text code>{lead?.unique_id}</Text>
        </Text>

        {/* Customer Information */}
        <Card title="Customer Information" style={{ marginBottom: '16px' }}>
          <Descriptions column={1} bordered>
            <Descriptions.Item label="Name">
              <Text strong>{customerDetails.first_name} {customerDetails.last_name}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Phone Number">
              {lead?.phone_number || customerDetails.contact_phone || 'N/A'}
            </Descriptions.Item>
            <Descriptions.Item label="Email">
              {customerDetails.email || customerDetails.contact_email || 'N/A'}
            </Descriptions.Item>
            <Descriptions.Item label="Address">
              {fullAddress || lead?.address || 'N/A'}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        {/* Plan and Payment Details */}
        <Card title="Plan & Payment Information" style={{ marginBottom: '16px' }}>
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Descriptions column={1} bordered>
              <Descriptions.Item label="Plan Name">
                <Tag color="blue" style={{ fontSize: '14px', padding: '4px 12px' }}>
                  {customerDetails.plan_name || 'N/A'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Service Type">
                <Tag color={lead?.service_type === 'SME' ? 'blue' : lead?.service_type === 'BROADBAND' ? 'green' : 'orange'}>
                  {lead?.service_type || 'N/A'}
                </Tag>
              </Descriptions.Item>
              {customerDetails.static_ip_required && (
                <Descriptions.Item label="Additional Services">
                  <Tag color="purple">Static IP Required</Tag>
                </Descriptions.Item>
              )}
              {customerDetails.telephone_line_required && (
                <Descriptions.Item label="">
                  <Tag color="purple">Telephone Line Required</Tag>
                </Descriptions.Item>
              )}
            </Descriptions>

            <Divider />

            <div style={{ 
              backgroundColor: '#fafafa', 
              padding: '20px', 
              borderRadius: '8px',
              border: '1px solid #e8e8e8'
            }}>
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: '16px' }}>Total Amount:</Text>
                  <Text strong style={{ fontSize: '18px', color: '#1890ff' }}>
                    ₹{customerDetails.total_amount?.toLocaleString('en-IN') || '0.00'}
                  </Text>
                </div>
                <Divider style={{ margin: '12px 0' }} />
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: '12px',
                  backgroundColor: '#e6f7ff',
                  borderRadius: '4px',
                  border: '2px solid #1890ff'
                }}>
                  <Text strong style={{ fontSize: '18px' }}>Amount to Pay:</Text>
                  <Text strong style={{ fontSize: '24px', color: '#1890ff' }}>
                    ₹{customerDetails.amount_to_pay?.toLocaleString('en-IN') || customerDetails.total_amount?.toLocaleString('en-IN') || '0.00'}
                  </Text>
                </div>
              </Space>
            </div>
          </Space>
        </Card>

        {/* Payment Actions */}
        <Card>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Text strong style={{ fontSize: '16px', display: 'block', marginBottom: '8px' }}>
              Proceed with Payment
            </Text>
            <Button 
              type="primary" 
              size="large" 
              block
              style={{ height: '50px', fontSize: '16px' }}
            >
              Pay Now
            </Button>
            <Text type="secondary" style={{ textAlign: 'center', display: 'block', fontSize: '12px' }}>
              Secure payment gateway will be integrated here
            </Text>
          </Space>
        </Card>
      </div>
    </div>
  );
};

export default PaymentPage;

