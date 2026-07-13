import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Typography, Button, Spin, message, Row, Col, Tag } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { apiClient } from '../utils/apiClient.ts';

const { Title } = Typography;

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
    salesExecutive?: {
      id: number;
      name: string;
      employeCode: string;
      phoneNumber: string;
      email: string;
    };
  };
  createdAt?: string;
  updatedAt?: string;
}

const CustomerDetailsPage = () => {
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
        setCustomerDetails(response.data);
      }
    } catch (error: any) {
      console.error("Error fetching customer details", error);
      message.error(error?.message || "Failed to load customer details");
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
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/leads-master')} style={{ marginBottom: '20px' }}>
          Back to Leads
        </Button>
        <Card>
          <Typography.Text>Customer details not found</Typography.Text>
        </Card>
      </div>
    );
  }

  const lead = customerDetails.lead;

  return (
    <div style={{ padding: '20px', backgroundColor: '#f0f2f5', minHeight: '100vh' }}>
      <Button 
        icon={<ArrowLeftOutlined />} 
        onClick={() => navigate('/leads-master')} 
        style={{ marginBottom: '20px' }}
      >
        Back to Leads
      </Button>

      <Title level={2} style={{ marginBottom: '24px' }}>
        Customer Details
      </Title>

      <Row gutter={[16, 16]}>
        {/* Lead Information */}
        <Col span={24}>
          <Card title="Lead Information" style={{ marginBottom: '16px' }}>
            <Descriptions column={2} bordered>
              <Descriptions.Item label="Unique ID">
                <Typography.Text code>{lead?.unique_id}</Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="Name">{lead?.name}</Descriptions.Item>
              <Descriptions.Item label="Phone Number">{lead?.phone_number}</Descriptions.Item>
              <Descriptions.Item label="Address">{lead?.address}</Descriptions.Item>
              <Descriptions.Item label="Source">{lead?.source}</Descriptions.Item>
              <Descriptions.Item label="Service Type">
                <Tag color={lead?.service_type === 'SME' ? 'blue' : lead?.service_type === 'BROADBAND' ? 'green' : 'orange'}>
                  {lead?.service_type}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Status">{lead?.status}</Descriptions.Item>
              <Descriptions.Item label="Sales Executive">
                {lead?.salesExecutive?.name || 'N/A'}
                {lead?.salesExecutive?.employeCode && (
                  <Typography.Text type="secondary" style={{ marginLeft: '8px' }}>
                    ({lead.salesExecutive.employeCode})
                  </Typography.Text>
                )}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        {/* Basic Details */}
        <Col span={24}>
          <Card title="Basic Details" style={{ marginBottom: '16px' }}>
            <Descriptions column={2} bordered>
              <Descriptions.Item label="First Name">{customerDetails.first_name}</Descriptions.Item>
              <Descriptions.Item label="Last Name">{customerDetails.last_name || 'N/A'}</Descriptions.Item>
              <Descriptions.Item label="Email">{customerDetails.email || 'N/A'}</Descriptions.Item>
              <Descriptions.Item label="Alternate Phone">{customerDetails.alternate_phone || 'N/A'}</Descriptions.Item>
              <Descriptions.Item label="Date of Birth">
                {customerDetails.date_of_birth 
                  ? new Date(customerDetails.date_of_birth).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })
                  : 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Gender">{customerDetails.gender || 'N/A'}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        {/* Contact Details */}
        <Col span={24}>
          <Card title="Contact Details" style={{ marginBottom: '16px' }}>
            <Descriptions column={2} bordered>
              <Descriptions.Item label="Contact Phone">{customerDetails.contact_phone || 'N/A'}</Descriptions.Item>
              <Descriptions.Item label="Contact Email">{customerDetails.contact_email || 'N/A'}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        {/* Present Address */}
        <Col span={24}>
          <Card title="Present Address" style={{ marginBottom: '16px' }}>
            <Descriptions column={2} bordered>
              <Descriptions.Item label="Address Line 1" span={2}>
                {customerDetails.present_address_line1 || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Address Line 2" span={2}>
                {customerDetails.present_address_line2 || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="City">{customerDetails.present_city || 'N/A'}</Descriptions.Item>
              <Descriptions.Item label="State">{customerDetails.present_state || 'N/A'}</Descriptions.Item>
              <Descriptions.Item label="Pincode">{customerDetails.present_pincode || 'N/A'}</Descriptions.Item>
              <Descriptions.Item label="Country">{customerDetails.present_country || 'N/A'}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        {/* Payment Address */}
        <Col span={24}>
          <Card title="Payment Address" style={{ marginBottom: '16px' }}>
            <Descriptions column={2} bordered>
              <Descriptions.Item label="Same as Present Address" span={2}>
                <Tag color={customerDetails.payment_address_same_as_present ? 'green' : 'default'}>
                  {customerDetails.payment_address_same_as_present ? 'Yes' : 'No'}
                </Tag>
              </Descriptions.Item>
              {!customerDetails.payment_address_same_as_present && (
                <>
                  <Descriptions.Item label="Address Line 1" span={2}>
                    {customerDetails.payment_address_line1 || 'N/A'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Address Line 2" span={2}>
                    {customerDetails.payment_address_line2 || 'N/A'}
                  </Descriptions.Item>
                  <Descriptions.Item label="City">{customerDetails.payment_city || 'N/A'}</Descriptions.Item>
                  <Descriptions.Item label="State">{customerDetails.payment_state || 'N/A'}</Descriptions.Item>
                  <Descriptions.Item label="Pincode">{customerDetails.payment_pincode || 'N/A'}</Descriptions.Item>
                  <Descriptions.Item label="Country">{customerDetails.payment_country || 'N/A'}</Descriptions.Item>
                </>
              )}
            </Descriptions>
          </Card>
        </Col>

        {/* Location & Plan Details */}
        <Col span={24}>
          <Card title="Location & Plan Details" style={{ marginBottom: '16px' }}>
            <Descriptions column={2} bordered>
              <Descriptions.Item label="Latitude">
                {customerDetails.latitude ? Number(customerDetails.latitude).toFixed(6) : 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Longitude">
                {customerDetails.longitude ? Number(customerDetails.longitude).toFixed(6) : 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Plan ID">{customerDetails.plan_id || 'N/A'}</Descriptions.Item>
              <Descriptions.Item label="Static IP Required">
                <Tag color={customerDetails.static_ip_required ? 'green' : 'default'}>
                  {customerDetails.static_ip_required ? 'Yes' : 'No'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Telephone Line Required">
                <Tag color={customerDetails.telephone_line_required ? 'green' : 'default'}>
                  {customerDetails.telephone_line_required ? 'Yes' : 'No'}
                </Tag>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default CustomerDetailsPage;

