import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Card, 
  Form, 
  Input, 
  InputNumber,
  Button, 
  Select, 
  DatePicker, 
  Checkbox, 
  Typography, 
  Spin, 
  message, 
  Space, 
  Divider,
  Row,
  Col
} from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { apiClient } from '../utils/apiClient.ts';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface CustomerDetails {
  id?: number;
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
}

// Mock plans data
const MOCK_PLANS = [
  { id: 1, name: 'Basic Plan - 50 Mbps' },
  { id: 2, name: 'Standard Plan - 100 Mbps' },
  { id: 3, name: 'Premium Plan - 200 Mbps' },
  { id: 4, name: 'Ultra Plan - 500 Mbps' },
  { id: 5, name: 'Enterprise Plan - 1 Gbps' },
];

const CustomerDetailPage = () => {
  const { lead_id } = useParams<{ lead_id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [accessMessage, setAccessMessage] = useState('');
  const [form] = Form.useForm();
  const uniqueId = lead_id;

  useEffect(() => {
    if (lead_id) {
      checkLeadStatusAndFetchDetails();
    }
  }, [lead_id]);

  const checkLeadStatusAndFetchDetails = async () => {
    setFetching(true);
    setAccessDenied(false);
    
    try {
      if (!uniqueId) {
        setAccessDenied(true);
        setAccessMessage('Lead ID is required');
        setFetching(false);
        return;
      }

      // First, fetch lead details to check status
      const leadResponse = await apiClient(
        "GET",
        `/api/v1/leads/unique/${uniqueId}`
      );

      if (!leadResponse.success || !leadResponse.data) {
        setAccessDenied(true);
        setAccessMessage('Lead not found');
        setFetching(false);
        return;
      }

      const lead = leadResponse.data;
      const leadStatus = lead.status;

      // Check if status is OPEN
      if (leadStatus !== 'OPEN' && leadStatus !== "LINK_SHARED") {
        setAccessDenied(true);
        setAccessMessage('You do not have access to this page. The customer details have already been filled or the lead status is not OPEN.');
        setFetching(false);
        return;
      }

      // Prefill form with lead data first
      prefillFromLead(lead);

      // Then fetch customer details (if they exist) to merge/override
      await fetchExistingCustomerDetails();
    } catch (error: any) {
      console.error("Error checking lead status:", error);
      setAccessDenied(true);
      setAccessMessage('Error loading lead information. Please try again later.');
      setFetching(false);
    }
  };

  const prefillFromLead = (lead: any) => {
    if (!lead) return;

    // Split lead name into first_name and last_name (if space exists)
    const nameParts = lead.name ? lead.name.trim().split(/\s+/) : [];
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Prefill form with lead data
    const leadData: any = {};

    // Name mapping - split name into first and last
    if (firstName) {
      leadData.first_name = firstName;
    }
    if (lastName) {
      leadData.last_name = lastName;
    }

    // Phone number mapping - use as contact_phone
    if (lead.phone_number) {
      leadData.contact_phone = lead.phone_number;
      // Also set as alternate_phone
      leadData.alternate_phone = lead.phone_number;
    }

    // Address mapping - use as present_address_line1
    if (lead.address) {
      leadData.present_address_line1 = lead.address;
    }

    // Set form values from lead data
    // Customer details will override these if they exist
    form.setFieldsValue({
      ...leadData,
      // Merge with existing form values to preserve defaults
      ...form.getFieldsValue(),
      // Override with lead data
      ...leadData,
    });
  };

  const fetchExistingCustomerDetails = async () => {
    try {
      if (uniqueId) {
        // Fetch customer details using unique_id
        const response = await apiClient(
          "GET",
          `/api/v1/leads/customer-details/${uniqueId}`
        );

        if (response.success && response.data) {
          const data = response.data;
          // Pre-fill form with existing customer details (will override lead data)
          form.setFieldsValue({
            first_name: data.first_name,
            last_name: data.last_name,
            email: data.email,
            alternate_phone: data.alternate_phone,
            date_of_birth: data.date_of_birth ? dayjs(data.date_of_birth) : undefined,
            gender: data.gender,
            contact_phone: data.contact_phone,
            contact_email: data.contact_email,
            present_address_line1: data.present_address_line1,
            present_address_line2: data.present_address_line2,
            present_city: data.present_city,
            present_state: data.present_state,
            present_pincode: data.present_pincode,
            present_country: data.present_country,
            payment_address_same_as_present: data.payment_address_same_as_present || false,
            payment_address_line1: data.payment_address_line1,
            payment_address_line2: data.payment_address_line2,
            payment_city: data.payment_city,
            payment_state: data.payment_state,
            payment_pincode: data.payment_pincode,
            payment_country: data.payment_country,
            latitude: data.latitude,
            longitude: data.longitude,
            plan_id: data.plan_id,
            static_ip_required: data.static_ip_required || false,
            telephone_line_required: data.telephone_line_required || false,
          });
        }
      }
    } catch (error: any) {
      // It's okay if customer details don't exist yet - this is a create/update form
      console.log("No existing customer details found or error fetching:", error);
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async (values: any) => {
    if (!uniqueId) {
      message.error('Unique ID is required');
      return;
    }

    // Validate form before submission
    try {
      await form.validateFields();
    } catch (error) {
      // Validation failed, don't submit
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...values,
        date_of_birth: values.date_of_birth ? values.date_of_birth.format('YYYY-MM-DD') : undefined,
        plan_id: values.plan_id ? parseInt(values.plan_id) : undefined,
      };

      const response = await apiClient(
        "POST",
        `/api/v1/leads/${uniqueId}/customer-details`,
        payload
      );

      if (response.success) {
        message.success(response.message || 'Customer details saved successfully');
        // Refresh the page to show updated data
        window.location.reload();
      } else {
        message.error(response.message || 'Failed to save customer details');
      }
    } catch (error: any) {
      console.error("Error submitting customer details", error);
      message.error(error?.message || error?.error || "Failed to save customer details");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePaymentAddressChange = (checked: boolean) => {
    if (checked) {
      // Copy present address to payment address
      const presentAddress = form.getFieldsValue([
        'present_address_line1',
        'present_address_line2',
        'present_city',
        'present_state',
        'present_pincode',
        'present_country'
      ]);
      form.setFieldsValue({
        payment_address_line1: presentAddress.present_address_line1,
        payment_address_line2: presentAddress.present_address_line2,
        payment_city: presentAddress.present_city,
        payment_state: presentAddress.present_state,
        payment_pincode: presentAddress.present_pincode,
        payment_country: presentAddress.present_country,
      });
    }
  };

  if (fetching) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div style={{ padding: '20px', backgroundColor: '#f0f2f5', minHeight: '100vh' }}>
        <Button 
          icon={<ArrowLeftOutlined />} 
          onClick={() => navigate(-1)} 
          style={{ marginBottom: '20px' }}
        >
          Back
        </Button>
        <Card style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <Title level={2} style={{ color: '#ff4d4f', marginBottom: '16px' }}>
              Access Denied
            </Title>
            <Text type="secondary" style={{ fontSize: '16px', display: 'block', marginBottom: '24px' }}>
              {accessMessage || 'You do not have access to this page.'}
            </Text>
            <Button type="primary" onClick={() => navigate(-1)}>
              Go Back
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', backgroundColor: '#f0f2f5', minHeight: '100vh' }}>
      <Button 
        icon={<ArrowLeftOutlined />} 
        onClick={() => navigate(-1)} 
        style={{ marginBottom: '20px' }}
      >
        Back
      </Button>

      <Card style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <Title level={2} style={{ marginBottom: '8px', textAlign: 'center' }}>
          Customer Details
        </Title>
        <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginBottom: '24px' }}>
          Lead ID: <Text code>{lead_id}</Text>
        </Text>

        <Divider />

        <Form
          form={form}
          layout="vertical"
          autoComplete="off"
          validateTrigger={['onBlur', 'onChange']}
          initialValues={{
            payment_address_same_as_present: false,
            static_ip_required: false,
            telephone_line_required: false,
            present_country: 'India',
            payment_country: 'India',
          }}
        >
          {/* Basic Details */}
          <Card type="inner" title="Basic Details" style={{ marginBottom: '24px' }}>
            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="first_name"
                  label="First Name"
                  rules={[
                    { required: true, message: 'First name is required' },
                    { min: 2, message: 'First name must be at least 2 characters' },
                    { max: 100, message: 'First name must not exceed 100 characters' },
                    { pattern: /^[a-zA-Z\s\-']+$/, message: 'First name should contain only letters, spaces, hyphens, and apostrophes' }
                  ]}
                >
                  <Input 
                    placeholder="Enter first name" 
                    maxLength={100}
                    onPressEnter={(e) => {
                      e.preventDefault();
                      // Just validate, don't submit
                      form.validateFields(['first_name']).catch(() => {});
                    }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="last_name"
                  label="Last Name"
                  rules={[
                    { required: true, message: 'Last name is required' },
                    { max: 100, message: 'Last name must not exceed 100 characters' },
                    { pattern: /^[a-zA-Z\s\-']+$/, message: 'Last name should contain only letters, spaces, hyphens, and apostrophes' }
                  ]}
                >
                  <Input placeholder="Enter last name" maxLength={100} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="email"
                  label="Email"
                  rules={[
                    { required: true, message: 'Email is required' },
                    { type: 'email', message: 'Please enter a valid email address' },
                    { max: 255, message: 'Email must not exceed 255 characters' }
                  ]}
                >
                  <Input placeholder="Enter email address" maxLength={255} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="alternate_phone"
                  label="Alternate Phone"
                  rules={[
                    { required: true, message: 'Alternate phone is required' },
                    { pattern: /^[0-9]{10,15}$/, message: 'Phone number must be 10-15 digits' }
                  ]}
                >
                  <Input placeholder="Enter alternate phone number" maxLength={15} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="date_of_birth"
                  label="Date of Birth"
                  rules={[
                    { required: true, message: 'Date of birth is required' },
                    {
                      validator: (_, value) => {
                        if (!value) {
                          return Promise.reject(new Error('Date of birth is required'));
                        }
                        const selectedDate = dayjs(value);
                        const today = dayjs();
                        const minDate = dayjs().subtract(120, 'year'); // Max age 120 years
                        
                        if (selectedDate.isAfter(today)) {
                          return Promise.reject(new Error('Date of birth cannot be in the future'));
                        }
                        if (selectedDate.isBefore(minDate)) {
                          return Promise.reject(new Error('Date of birth is too far in the past'));
                        }
                        return Promise.resolve();
                      }
                    }
                  ]}
                >
                  <DatePicker 
                    style={{ width: '100%' }} 
                    format="YYYY-MM-DD"
                    placeholder="Select date of birth"
                    disabledDate={(current) => {
                      // Disable future dates and dates more than 120 years ago
                      return current && (current > dayjs().endOf('day') || current < dayjs().subtract(120, 'year'));
                    }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="gender"
                  label="Gender"
                  rules={[
                    { required: true, message: 'Gender is required' },
                    {
                      validator: (_, value) => {
                        if (!value) {
                          return Promise.reject(new Error('Gender is required'));
                        }
                        const validGenders = ['Male', 'Female', 'Other'];
                        if (!validGenders.includes(value)) {
                          return Promise.reject(new Error('Please select a valid gender'));
                        }
                        return Promise.resolve();
                      }
                    }
                  ]}
                >
                  <Select placeholder="Select gender">
                    <Select.Option value="Male">Male</Select.Option>
                    <Select.Option value="Female">Female</Select.Option>
                    <Select.Option value="Other">Other</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
          </Card>

          {/* Contact Details */}
          <Card type="inner" title="Contact Details" style={{ marginBottom: '24px' }}>
            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="contact_phone"
                  label="Contact Phone"
                  rules={[
                    { required: true, message: 'Contact phone is required' },
                    { pattern: /^[0-9]{10,15}$/, message: 'Phone number must be 10-15 digits' }
                  ]}
                >
                  <Input placeholder="Enter contact phone number" maxLength={15} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="contact_email"
                  label="Contact Email"
                  rules={[
                    { required: true, message: 'Contact email is required' },
                    { type: 'email', message: 'Please enter a valid email address' },
                    { max: 255, message: 'Email must not exceed 255 characters' }
                  ]}
                >
                  <Input placeholder="Enter contact email address" maxLength={255} />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          {/* Present Address */}
          <Card type="inner" title="Present Address" style={{ marginBottom: '24px' }}>
            <Row gutter={16}>
              <Col xs={24}>
                <Form.Item
                  name="present_address_line1"
                  label="Address Line 1"
                  rules={[
                    { required: true, message: 'Address line 1 is required' },
                    { max: 255, message: 'Address line 1 must not exceed 255 characters' }
                  ]}
                >
                  <Input placeholder="Enter address line 1" maxLength={255} />
                </Form.Item>
              </Col>
              <Col xs={24}>
                <Form.Item
                  name="present_address_line2"
                  label="Address Line 2"
                  rules={[
                    { max: 255, message: 'Address line 2 must not exceed 255 characters' }
                  ]}
                >
                  <Input placeholder="Enter address line 2 (optional)" maxLength={255} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="present_city"
                  label="City"
                  rules={[
                    { required: true, message: 'City is required' },
                    { max: 100, message: 'City must not exceed 100 characters' },
                    { pattern: /^[a-zA-Z\s\-']+$/, message: 'City should contain only letters, spaces, hyphens, and apostrophes' }
                  ]}
                >
                  <Input placeholder="Enter city" maxLength={100} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="present_state"
                  label="State"
                  rules={[
                    { required: true, message: 'State is required' },
                    { max: 100, message: 'State must not exceed 100 characters' },
                    { pattern: /^[a-zA-Z\s\-']+$/, message: 'State should contain only letters, spaces, hyphens, and apostrophes' }
                  ]}
                >
                  <Input placeholder="Enter state" maxLength={100} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="present_pincode"
                  label="Pincode"
                  rules={[
                    { required: true, message: 'Pincode is required' },
                    { pattern: /^[0-9]{6}$/, message: 'Pincode must be exactly 6 digits' }
                  ]}
                >
                  <Input placeholder="Enter pincode (6 digits)" maxLength={6} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="present_country"
                  label="Country"
                  rules={[
                    { required: true, message: 'Country is required' },
                    { max: 100, message: 'Country must not exceed 100 characters' },
                    { pattern: /^[a-zA-Z\s\-']+$/, message: 'Country should contain only letters, spaces, hyphens, and apostrophes' }
                  ]}
                >
                  <Input placeholder="Enter country" maxLength={100} />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          {/* Payment Address */}
          <Card type="inner" title="Payment Address" style={{ marginBottom: '24px' }}>
            <Form.Item
              name="payment_address_same_as_present"
              valuePropName="checked"
            >
              <Checkbox onChange={(e) => handlePaymentAddressChange(e.target.checked)}>
                Same as present address
              </Checkbox>
            </Form.Item>

            <Row gutter={16}>
              <Col xs={24}>
                <Form.Item
                  name="payment_address_line1"
                  label="Address Line 1"
                  rules={[
                    { required: true, message: 'Address line 1 is required' },
                    { max: 255, message: 'Address line 1 must not exceed 255 characters' }
                  ]}
                >
                  <Input placeholder="Enter address line 1" maxLength={255} />
                </Form.Item>
              </Col>
              <Col xs={24}>
                <Form.Item
                  name="payment_address_line2"
                  label="Address Line 2"
                  rules={[
                    { max: 255, message: 'Address line 2 must not exceed 255 characters' }
                  ]}
                >
                  <Input placeholder="Enter address line 2 (optional)" maxLength={255} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="payment_city"
                  label="City"
                  rules={[
                    { required: true, message: 'City is required' },
                    { max: 100, message: 'City must not exceed 100 characters' },
                    { pattern: /^[a-zA-Z\s\-']+$/, message: 'City should contain only letters, spaces, hyphens, and apostrophes' }
                  ]}
                >
                  <Input placeholder="Enter city" maxLength={100} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="payment_state"
                  label="State"
                  rules={[
                    { required: true, message: 'State is required' },
                    { max: 100, message: 'State must not exceed 100 characters' },
                    { pattern: /^[a-zA-Z\s\-']+$/, message: 'State should contain only letters, spaces, hyphens, and apostrophes' }
                  ]}
                >
                  <Input placeholder="Enter state" maxLength={100} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="payment_pincode"
                  label="Pincode"
                  rules={[
                    { required: true, message: 'Pincode is required' },
                    { pattern: /^[0-9]{6}$/, message: 'Pincode must be exactly 6 digits' }
                  ]}
                >
                  <Input placeholder="Enter pincode (6 digits)" maxLength={6} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="payment_country"
                  label="Country"
                  rules={[
                    { required: true, message: 'Country is required' },
                    { max: 100, message: 'Country must not exceed 100 characters' },
                    { pattern: /^[a-zA-Z\s\-']+$/, message: 'Country should contain only letters, spaces, hyphens, and apostrophes' }
                  ]}
                >
                  <Input placeholder="Enter country" maxLength={100} />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          {/* Location & Plan Details */}
          <Card type="inner" title="Location & Plan Details" style={{ marginBottom: '24px' }}>
            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="latitude"
                  label="Latitude"
                  rules={[
                    { required: true, message: 'Latitude is required' },
                    { 
                      type: 'number', 
                      min: -90, 
                      max: 90, 
                      message: 'Latitude must be between -90 and 90' 
                    }
                  ]}
                >
                  <InputNumber 
                    style={{ width: '100%' }}
                    step={0.000001}
                    placeholder="Enter latitude" 
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="longitude"
                  label="Longitude"
                  rules={[
                    { required: true, message: 'Longitude is required' },
                    { 
                      type: 'number', 
                      min: -180, 
                      max: 180, 
                      message: 'Longitude must be between -180 and 180' 
                    }
                  ]}
                >
                  <InputNumber 
                    style={{ width: '100%' }}
                    step={0.000001}
                    placeholder="Enter longitude" 
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="plan_id"
                  label="Plan"
                  rules={[
                    { required: true, message: 'Plan is required' },
                    {
                      validator: (_, value) => {
                        if (!value) {
                          return Promise.reject(new Error('Plan is required'));
                        }
                        const validPlanIds = MOCK_PLANS.map(plan => plan.id);
                        if (!validPlanIds.includes(value)) {
                          return Promise.reject(new Error('Please select a valid plan'));
                        }
                        return Promise.resolve();
                      }
                    }
                  ]}
                >
                  <Select 
                    placeholder="Select a plan"
                  >
                    {MOCK_PLANS.map((plan) => (
                      <Select.Option key={plan.id} value={plan.id}>
                        {plan.name}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Form.Item
                    name="static_ip_required"
                    valuePropName="checked"
                  >
                    <Checkbox>Static IP Required</Checkbox>
                  </Form.Item>
                  <Form.Item
                    name="telephone_line_required"
                    valuePropName="checked"
                  >
                    <Checkbox>Telephone Line Required</Checkbox>
                  </Form.Item>
                </Space>
              </Col>
            </Row>
          </Card>

          <Form.Item>
            <Button 
              type="primary" 
              htmlType="button"
              size="large" 
              block
              loading={submitting}
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                  // Validate all fields first
                  const values = await form.validateFields();
                  // If validation passes, call handleSubmit
                  await handleSubmit(values);
                } catch (error) {
                  // Validation failed, show error messages
                  console.log('Validation failed:', error);
                  message.error('Please fix the validation errors before submitting');
                }
              }}
            >
              {submitting ? 'Saving...' : 'Save Customer Details'}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default CustomerDetailPage;

