/**
 * File size limits for uploads and compression API.
 *
 * POST /api/compress: uploads and compresses a file.
 * - Images: quality/resolution reduced so output is under 10MB.
 * - Other files: Gzip (best effort). Response: original_size, compressed_size, url, message.
 *
 * MAX_FILE_SIZE: Max size for final project file upload (10MB).
 * MAX_COMPRESSION_API_SIZE: Max size we send to /api/compress; reduce if server returns 413.
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB - max for project file upload
export const MAX_COMPRESSION_API_SIZE = 50 * 1024 * 1024; // 50MB - max request size for compression API
