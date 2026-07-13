import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Form, Select, Input, Button, Checkbox, Typography, Spin, message, Space, Divider, Upload } from 'antd';
import { ArrowLeftOutlined, UploadOutlined } from '@ant-design/icons';
import { apiClient, api } from '../utils/apiClient.ts';

const { Title, Text, Link } = Typography;
const { TextArea } = Input;

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
  };
  createdAt?: string;
  updatedAt?: string;
}

const CustomerKycPage = () => {
  const { uniqueId } = useParams<{ uniqueId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [customerDetails, setCustomerDetails] = useState<CustomerDetails | null>(null);
  const [form] = Form.useForm();

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
        // Pre-fill form with existing data if available
        form.setFieldsValue({
          id_type: response.data.id_type || undefined,
          address_proof_type: response.data.address_proof_type || undefined,
          signature: response.data.signature || undefined,
          terms_accepted: response.data.terms_accepted || false,
        });
      }
    } catch (error: any) {
      console.error("Error fetching customer details", error);
      message.error(error?.message || "Failed to load customer details");
    } finally {
      setLoading(false);
    }
  };


  // Helper function to extract file from Upload component fileList
  const extractFile = (fileList: any): File | null => {
    if (!fileList || !Array.isArray(fileList) || fileList.length === 0) {
      return null;
    }
    const fileItem = fileList[0];
    return fileItem?.originFileObj || fileItem?.file || (fileItem instanceof File ? fileItem : null);
  };

  const handleSubmit = async (values: any) => {
    setSubmitting(true);
    try {
      if (!uniqueId) {
        message.error('Lead ID is missing');
        return;
      }

      // Extract files from form
      const idFile = extractFile(values.id_document);
      const addressFile = extractFile(values.address_proof_document);
      const signatureFile = extractFile(values.signature_file);

      // Validate files
      if (!idFile) {
        throw new Error('ID document is required');
      }
      if (!addressFile) {
        throw new Error('Address proof document is required');
      }
      if (!signatureFile) {
        throw new Error('Signature is required. Please upload a signature image.');
      }

      // Create FormData for multipart/form-data upload
      const formData = new FormData();
      formData.append('id_type', values.id_type);
      formData.append('id_number', values.id_number);
      formData.append('address_proof_type', values.address_proof_type);
      if (values.address_proof_number) {
        formData.append('address_proof_number', values.address_proof_number);
      }
      formData.append('terms_accepted', values.terms_accepted ? 'true' : 'false');
      
      // Append files
      formData.append('id_document', idFile);
      formData.append('address_proof_document', addressFile);
      formData.append('signature', signatureFile);

      // Use axios instance from apiClient for FormData upload (axios handles multipart/form-data automatically)
      const response = await api.post(
        `/api/v1/leads/${uniqueId}/kyc`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      const data = response.data;

      if (data.success) {
        message.success('KYC information submitted successfully');
        setTimeout(() => {
          navigate(-1);
        }, 2000);
      } else {
        throw new Error(data.message || 'Failed to submit KYC information');
      }
    } catch (error: any) {
      console.error("Error submitting KYC", error);
      message.error(error?.message || "Failed to submit KYC information");
    } finally {
      setSubmitting(false);
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
        onClick={() => navigate(-1)} 
        style={{ marginBottom: '20px' }}
      >
        Back
      </Button>

      <Card style={{ maxWidth: '800px', margin: '0 auto' }}>
        <Title level={2} style={{ marginBottom: '8px', textAlign: 'center' }}>
          KYC Verification
        </Title>
        <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginBottom: '24px' }}>
          Lead ID: <Text code>{lead?.unique_id}</Text>
        </Text>

        <Divider />

        {/* Customer Information Display */}
        <Card type="inner" title="Customer Information" style={{ marginBottom: '24px' }}>
          <Space direction="vertical" style={{ width: '100%' }} size="small">
            <div><Text strong>Name:</Text> {customerDetails.first_name} {customerDetails.last_name}</div>
            <div><Text strong>Phone:</Text> {lead?.phone_number}</div>
            <div><Text strong>Email:</Text> {customerDetails.email || 'N/A'}</div>
            <div><Text strong>Address:</Text> {lead?.address}</div>
          </Space>
        </Card>

        {/* KYC Form */}
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          autoComplete="off"
        >
          <Form.Item
            name="id_type"
            label="ID Proof"
            rules={[{ required: true, message: 'Please select an ID proof type' }]}
          >
            <Select placeholder="Select ID Proof Type">
              <Select.Option value="PAN Card">PAN Card</Select.Option>
              <Select.Option value="Aadhar Card">Aadhar Card</Select.Option>
              <Select.Option value="Passport">Passport</Select.Option>
              <Select.Option value="Driving License">Driving License</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="id_number"
            label="ID Number"
            rules={[{ required: true, message: 'Please enter ID number' }]}
          >
            <Input placeholder="Enter ID number" />
          </Form.Item>

          <Form.Item
            name="id_document"
            label="Upload ID Document"
            rules={[{ required: true, message: 'Please upload ID document' }]}
            valuePropName="fileList"
            getValueFromEvent={(e) => {
              if (Array.isArray(e)) {
                return e;
              }
              return e?.fileList;
            }}
          >
            <Upload
              beforeUpload={() => false}
              accept="image/*,.pdf"
              maxCount={1}
            >
              <Button icon={<UploadOutlined />}>Click to Upload</Button>
            </Upload>
          </Form.Item>

          <Divider />

          <Form.Item
            name="address_proof_type"
            label="Address Proof"
            rules={[{ required: true, message: 'Please select an address proof type' }]}
          >
            <Select placeholder="Select Address Proof Type">
              <Select.Option value="Aadhar Card">Aadhar Card</Select.Option>
              <Select.Option value="Driving License">Driving License</Select.Option>
              <Select.Option value="Passport">Passport</Select.Option>
              <Select.Option value="Electricity Bill">Electricity Bill</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="address_proof_number"
            label="Address Proof Number (if applicable)"
          >
            <Input placeholder="Enter address proof number" />
          </Form.Item>

          <Form.Item
            name="address_proof_document"
            label="Upload Address Proof Document"
            rules={[{ required: true, message: 'Please upload address proof document' }]}
            valuePropName="fileList"
            getValueFromEvent={(e) => {
              if (Array.isArray(e)) {
                return e;
              }
              return e?.fileList;
            }}
          >
            <Upload
              beforeUpload={() => false}
              accept="image/*,.pdf"
              maxCount={1}
            >
              <Button icon={<UploadOutlined />}>Click to Upload</Button>
            </Upload>
          </Form.Item>

          <Divider />

          <Form.Item
            name="signature_file"
            label="Signature"
            valuePropName="fileList"
            getValueFromEvent={(e) => {
              if (Array.isArray(e)) {
                return e;
              }
              return e?.fileList || [];
            }}
          >
            <Upload
              beforeUpload={() => false}
              accept="image/*"
              maxCount={1}
            >
              <Button icon={<UploadOutlined />}>Upload Signature Image</Button>
            </Upload>
          </Form.Item>

          <Divider />

          <Form.Item
            name="terms_accepted"
            valuePropName="checked"
            rules={[
              {
                validator: (_, value) =>
                  value ? Promise.resolve() : Promise.reject(new Error('You must accept the terms and conditions')),
              },
            ]}
          >
            <Checkbox>
              I accept the{' '}
              <Link href="https://expl.in/terms-conditions/" target="_blank" rel="noopener noreferrer">
                Terms and Conditions
              </Link>
            </Checkbox>
          </Form.Item>

          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              size="large" 
              block
              loading={submitting}
            >
              Submit KYC
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default CustomerKycPage;



