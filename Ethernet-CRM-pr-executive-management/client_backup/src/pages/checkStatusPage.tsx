import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Typography, Spin, message, Descriptions, Tag, Progress, Space, Divider, Row, Col, Alert } from 'antd';
import { apiClient } from '../utils/apiClient.ts';
import { CheckCircleOutlined, ClockCircleOutlined, UserOutlined, PhoneOutlined, EnvironmentOutlined, MailOutlined, ExclamationCircleOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

interface GISRecord {
  id: number;
  lead_id: string;
  status: string;
  distance?: number;
  optical_type?: string;
  remark?: string;
}

interface Lead {
  id: number;
  unique_id: string;
  name: string;
  phone_number: string;
  address: string;
  source: string;
  service_type: string;
  status: string;
  salesExecutive?: {
    id: number;
    name: string;
    employeCode: string;
    phoneNumber: string;
    email: string;
  };
  gisRecord?: GISRecord;
  createdAt: string;
  updatedAt: string;
}

interface CustomerDetails {
  first_name: string;
  last_name?: string;
  email?: string;
  alternate_phone?: string;
  date_of_birth?: string;
  gender?: string;
  contact_phone?: string;
  contact_email?: string;
}

// Define status progression order based on new flow
const statusOrder = [
  'OPEN',
  'CUSTOMER_DETAILS_CAPTURED',
  'ASSIGNED_TO_GIS',
  'QUALIFIED',
  'KYC_PENDING',
  'PENDING_PAYMENT',
  'PAYMENT_COMPLETED',
  'KYC_COMPLETED',
];

// Status labels for display
const statusLabels: Record<string, string> = {
  OPEN: 'Application Received',
  CUSTOMER_DETAILS_CAPTURED: 'Customer Details Captured',
  ASSIGNED_TO_GIS: 'Location Survey (GIS Verification)',
  QUALIFIED: 'Qualified',
  KYC_PENDING: 'KYC Verification Pending',
  PENDING_PAYMENT: 'Payment Pending',
  PAYMENT_COMPLETED: 'Payment Completed',
  KYC_COMPLETED: 'Account Created - Completed',
  UNQUALIFIED: 'Unqualified',
  CONTACTED: 'Contacted',
  SUSPEND_LEAD: 'Suspended',
  NOT_CLOSED: 'Not Closed',
  PENDING_WITH_REASON: 'Pending with Reason',
  CALL_BACK: 'Call Back',
  LINK_SHARED: 'Link Shared',
  KYC_UPDATED: 'KYC Updated',
};

// Status colors
const getStatusColor = (status: string): string => {
  const colorMap: Record<string, string> = {
    OPEN: 'blue',
    CONTACTED: 'cyan',
    QUALIFIED: 'geekblue',
    ASSIGNED_TO_GIS: 'purple',
    CUSTOMER_DETAILS_CAPTURED: 'orange',
    PENDING_PAYMENT: 'gold',
    PAYMENT_COMPLETED: 'green',
    KYC_PENDING: 'volcano',
    KYC_COMPLETED: 'success',
    UNQUALIFIED: 'red',
    SUSPEND_LEAD: 'red',
    NOT_CLOSED: 'default',
    PENDING_WITH_REASON: 'warning',
    CALL_BACK: 'processing',
  };
  return colorMap[status] || 'default';
};

const CheckStatusPage = () => {
  const { uniqueId } = useParams<{ uniqueId: string }>();
  const [loading, setLoading] = useState(true);
  const [lead, setLead] = useState<Lead | null>(null);
  const [customerDetails, setCustomerDetails] = useState<CustomerDetails | null>(null);

  useEffect(() => {
    if (uniqueId) {
      fetchLeadData();
    }
  }, [uniqueId]);

  const fetchLeadData = async () => {
    setLoading(true);
    try {
      // Fetch lead by unique_id
      const leadResponse = await apiClient(
        "GET",
        `/api/v1/leads/unique/${uniqueId}`
      );

      if (leadResponse.success && leadResponse.data) {
        setLead(leadResponse.data);

        // Check if customer details are included in the lead response
        if (leadResponse.data.customerDetails) {
          setCustomerDetails(leadResponse.data.customerDetails);
        } else {
          // Try to fetch customer details separately if not included
          try {
            const customerResponse = await apiClient(
              "GET",
              `/api/v1/leads/customer-details/${uniqueId}`
            );

            if (customerResponse.success && customerResponse.data) {
              setCustomerDetails(customerResponse.data);
            }
          } catch (error) {
            // Customer details might not exist yet, that's okay
            console.log('Customer details not found yet');
          }
        }
      } else {
        message.error('Lead not found');
      }
    } catch (error: any) {
      console.error("Error fetching lead data", error);
      message.error(error?.message || "Failed to load status information");
    } finally {
      setLoading(false);
    }
  };

  const getCurrentStatusIndex = (): number => {
    if (!lead) return 0;
    
    // Handle special statuses that might not be in the main flow
    // UNQUALIFIED is an alternative outcome after GIS verification (like QUALIFIED)
    // so we map it to the QUALIFIED position in the progress
    if (lead.status === 'UNQUALIFIED') {
      return statusOrder.indexOf('QUALIFIED');
    }
    
    const index = statusOrder.indexOf(lead.status);
    // If status is not in main flow, try to find the closest match
    if (index < 0) {
      // For statuses like CONTACTED, PENDING_WITH_REASON, etc., show at OPEN level
      return 0;
    }
    return index;
  };

  const getProgressPercentage = (): number => {
    const currentIndex = getCurrentStatusIndex();
    return ((currentIndex + 1) / statusOrder.length) * 100;
  };

  const getStatusSteps = () => {
    const currentIndex = getCurrentStatusIndex();
    const currentStatus = lead?.status || '';
    
    return statusOrder.map((status, index) => {
      const isCompleted = index < currentIndex;
      const isCurrent = index === currentIndex && statusOrder.indexOf(currentStatus) === index;
      // Also mark as current if status is UNQUALIFIED and we're at QUALIFIED position
      const isCurrentSpecial = currentStatus === 'UNQUALIFIED' && status === 'QUALIFIED' && index === currentIndex;
      
      // If status is UNQUALIFIED and we're at the QUALIFIED step, show "Unqualified" instead
      let label = statusLabels[status] || status.replace(/_/g, ' ');
      if (currentStatus === 'UNQUALIFIED' && status === 'QUALIFIED' && index === currentIndex) {
        label = statusLabels['UNQUALIFIED'] || 'Unqualified';
      }
      
      return {
        status: currentStatus === 'UNQUALIFIED' && status === 'QUALIFIED' && index === currentIndex ? 'UNQUALIFIED' : status,
        label,
        isCompleted,
        isCurrent: isCurrent || isCurrentSpecial,
      };
    });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f0f2f5' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div style={{ padding: '20px', backgroundColor: '#f0f2f5', minHeight: '100vh' }}>
        <Card>
          <Typography.Text type="danger">Application not found. Please check your link.</Typography.Text>
        </Card>
      </div>
    );
  }

  const statusSteps = getStatusSteps();
  const progressPercentage = getProgressPercentage();

  return (
    <div style={{ padding: '24px', backgroundColor: '#f0f2f5', minHeight: '100vh' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Title level={1} style={{ marginBottom: '8px', color: '#1890ff' }}>
            Application Status
          </Title>
          <Text type="secondary" style={{ fontSize: '16px' }}>
            Reference ID: <Text code style={{ fontSize: '16px', padding: '4px 12px' }}>{lead.unique_id}</Text>
          </Text>
        </div>

        {/* Customer Details Card - At Top */}
        <Card 
          style={{ 
            marginBottom: '24px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}
        >
          <Title level={3} style={{ marginBottom: '24px', color: '#262626' }}>
            <UserOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
            Application Details
          </Title>
          
          <Row gutter={[24, 24]}>
            <Col xs={24} sm={12} md={8}>
              <div style={{ marginBottom: '16px' }}>
                <Text type="secondary" style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>
                  Full Name
                </Text>
                <Text strong style={{ fontSize: '16px', display: 'flex', alignItems: 'center' }}>
                  <UserOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
                  {customerDetails ? `${customerDetails.first_name} ${customerDetails.last_name || ''}`.trim() : lead.name}
                </Text>
              </div>
            </Col>
            
            <Col xs={24} sm={12} md={8}>
              <div style={{ marginBottom: '16px' }}>
                <Text type="secondary" style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>
                  Phone Number
                </Text>
                <Text strong style={{ fontSize: '16px', display: 'flex', alignItems: 'center' }}>
                  <PhoneOutlined style={{ marginRight: '8px', color: '#52c41a' }} />
                  {lead.phone_number}
                </Text>
              </div>
            </Col>

            {customerDetails?.email && (
              <Col xs={24} sm={12} md={8}>
                <div style={{ marginBottom: '16px' }}>
                  <Text type="secondary" style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>
                    Email
                  </Text>
                  <Text strong style={{ fontSize: '16px', display: 'flex', alignItems: 'center' }}>
                    <MailOutlined style={{ marginRight: '8px', color: '#fa8c16' }} />
                    {customerDetails.email}
                  </Text>
                </div>
              </Col>
            )}

            <Col xs={24} sm={12} md={8}>
              <div style={{ marginBottom: '16px' }}>
                <Text type="secondary" style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>
                  Service Type
                </Text>
                <Tag 
                  color={lead.service_type === 'SME' ? 'blue' : lead.service_type === 'BROADBAND' ? 'green' : 'orange'}
                  style={{ fontSize: '14px', padding: '4px 12px' }}
                >
                  {lead.service_type}
                </Tag>
              </div>
            </Col>

            <Col xs={24} sm={12} md={8}>
              <div style={{ marginBottom: '16px' }}>
                <Text type="secondary" style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>
                  Source
                </Text>
                <Text strong style={{ fontSize: '16px' }}>
                  {lead.source}
                </Text>
              </div>
            </Col>

            {lead.salesExecutive && (
              <Col xs={24} sm={12} md={8}>
                <div style={{ marginBottom: '16px' }}>
                  <Text type="secondary" style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>
                    Lead Created By
                  </Text>
                  <Text strong style={{ fontSize: '16px' }}>
                    {lead.salesExecutive.name}
                    {lead.salesExecutive.employeCode && (
                      <Text type="secondary" style={{ marginLeft: '8px' }}>
                        ({lead.salesExecutive.employeCode})
                      </Text>
                    )}
                  </Text>
                </div>
              </Col>
            )}

            <Col xs={24}>
              <div style={{ marginBottom: '16px' }}>
                <Text type="secondary" style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>
                  Address
                </Text>
                <Text strong style={{ fontSize: '16px', display: 'flex', alignItems: 'flex-start' }}>
                  <EnvironmentOutlined style={{ marginRight: '8px', color: '#eb2f96', marginTop: '4px' }} />
                  {lead.address}
                </Text>
              </div>
            </Col>
          </Row>
        </Card>

        {/* Progress Bar Card */}
        <Card 
          style={{ 
            marginBottom: '24px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none'
          }}
        >
          <div style={{ color: 'white', marginBottom: '24px' }}>
            <Title level={3} style={{ color: 'white', marginBottom: '8px' }}>
              Current Status
            </Title>
            <Tag 
              color={getStatusColor(lead.status)} 
              style={{ 
                fontSize: '16px', 
                padding: '6px 16px',
                marginBottom: '16px'
              }}
            >
              {statusLabels[lead.status] || lead.status.replace(/_/g, ' ')}
            </Tag>
          </div>

          <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', padding: '24px', borderRadius: '8px' }}>
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text strong style={{ fontSize: '16px' }}>Overall Progress</Text>
              <Text strong style={{ fontSize: '20px', color: '#1890ff' }}>
                {Math.round(progressPercentage)}%
              </Text>
            </div>
            <Progress 
              percent={progressPercentage} 
              status="active"
              strokeColor={{
                '0%': '#108ee9',
                '100%': '#87d068',
              }}
              strokeWidth={12}
              style={{ marginBottom: '0' }}
            />
          </div>
        </Card>

        {/* GIS Reason Card - Show when status is UNQUALIFIED */}
        {lead.status === 'UNQUALIFIED' && lead.gisRecord && (
          <Card 
            style={{ 
              marginBottom: '24px',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              border: '1px solid #ff4d4f'
            }}
          >
            <Alert
              message="Application Not Qualified"
              description={
                <div>
                  <div style={{ marginBottom: lead.gisRecord.remark ? '12px' : '0' }}>
                    <Text strong style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>
                      GIS Status: <Tag color="red">{lead.gisRecord.status?.replace(/_/g, ' ') || 'NOT_FEASIBLE'}</Tag>
                    </Text>
                  </div>
                  {lead.gisRecord.remark && (
                    <div>
                      <Text strong style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>
                        Reason:
                      </Text>
                      <Text style={{ fontSize: '14px', color: '#595959' }}>
                        {lead.gisRecord.remark}
                      </Text>
                    </div>
                  )}
                  {!lead.gisRecord.remark && (
                    <Text type="secondary" style={{ fontSize: '14px' }}>
                      The location has been verified as not feasible for service installation.
                    </Text>
                  )}
                </div>
              }
              type="error"
              icon={<ExclamationCircleOutlined />}
              showIcon
            />
          </Card>
        )}

        {/* Status Timeline */}
        <Card 
          title={
            <span style={{ fontSize: '18px', fontWeight: 'bold' }}>
              Status Timeline
            </span>
          }
          style={{ 
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}
        >
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            {statusSteps.map((step, index) => (
              <div
                key={step.status}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '16px',
                  backgroundColor: step.isCurrent 
                    ? '#e6f7ff' 
                    : step.isCompleted 
                    ? '#f6ffed' 
                    : '#fafafa',
                  borderRadius: '8px',
                  border: step.isCurrent 
                    ? '2px solid #1890ff' 
                    : step.isCompleted
                    ? '1px solid #52c41a'
                    : '1px solid #d9d9d9',
                  transition: 'all 0.3s ease',
                }}
              >
                <div style={{ marginRight: '20px', fontSize: '24px', minWidth: '24px' }}>
                  {step.isCompleted ? (
                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  ) : step.isCurrent ? (
                    <ClockCircleOutlined style={{ color: '#1890ff' }} />
                  ) : (
                    <ClockCircleOutlined style={{ color: '#d9d9d9' }} />
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    fontWeight: step.isCurrent ? 'bold' : step.isCompleted ? '500' : 'normal',
                    fontSize: '16px',
                    marginBottom: step.isCurrent ? '4px' : '0'
                  }}>
                    {step.label}
                  </div>
                  {step.isCurrent && (
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      Currently at this stage
                    </Text>
                  )}
                </div>
                <Tag 
                  color={getStatusColor(step.status)}
                  style={{ 
                    fontSize: '12px',
                    padding: '4px 12px',
                    borderRadius: '4px'
                  }}
                >
                  {step.status.replace(/_/g, ' ')}
                </Tag>
              </div>
            ))}
          </Space>
        </Card>

        {/* Additional Customer Information (if available) */}
        {customerDetails && (customerDetails.alternate_phone || customerDetails.date_of_birth || customerDetails.gender) && (
          <Card 
            title={
              <span style={{ fontSize: '18px', fontWeight: 'bold' }}>
                Additional Information
              </span>
            }
            style={{ 
              marginTop: '24px',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}
          >
            <Row gutter={[24, 16]}>
              {customerDetails.alternate_phone && (
                <Col xs={24} sm={12}>
                  <Text type="secondary" style={{ display: 'block', marginBottom: '4px' }}>
                    Alternate Phone
                  </Text>
                  <Text strong>{customerDetails.alternate_phone}</Text>
                </Col>
              )}
              {customerDetails.date_of_birth && (
                <Col xs={24} sm={12}>
                  <Text type="secondary" style={{ display: 'block', marginBottom: '4px' }}>
                    Date of Birth
                  </Text>
                  <Text strong>
                    {new Date(customerDetails.date_of_birth).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </Text>
                </Col>
              )}
              {customerDetails.gender && (
                <Col xs={24} sm={12}>
                  <Text type="secondary" style={{ display: 'block', marginBottom: '4px' }}>
                    Gender
                  </Text>
                  <Text strong>{customerDetails.gender}</Text>
                </Col>
              )}
            </Row>
          </Card>
        )}
      </div>
    </div>
  );
};

export default CheckStatusPage;
