const fs = require('fs/promises');
const os = require('os');
const path = require('path');

jest.mock('../../src/utils/logger', () => ({
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
}));

function makeReq() {
  return {
    protocol: 'http',
    get: jest.fn().mockReturnValue('localhost:3000'),
  };
}

function loadUploadService(envOverrides = {}) {
  jest.resetModules();
  jest.doMock('../../src/config/env', () => ({
    BACKEND_URL: undefined,
    CLOUDINARY_CLOUD_NAME: undefined,
    CLOUDINARY_API_KEY: undefined,
    CLOUDINARY_API_SECRET: undefined,
    CLOUDINARY_FOLDER: 'ajicore/uploads',
    UPLOAD_RETURN_CLOUDINARY_URL: false,
    ...envOverrides,
  }));
  return require('../../src/domains/upload/upload.service');
}

describe('upload service contract', () => {
  const originalFetch = global.fetch;
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ajicore-upload-'));
    global.fetch = jest.fn();
  });

  afterEach(async () => {
    global.fetch = originalFetch;
    await fs.rm(tempDir, { recursive: true, force: true });
    jest.dontMock('../../src/config/env');
  });

  test('returns the local upload URL when Cloudinary is not configured', async () => {
    const uploadService = loadUploadService();
    const url = await uploadService.resolveUploadUrl(makeReq(), {
      filename: 'photo.jpg',
      path: path.join(tempDir, 'photo.jpg'),
      mimetype: 'image/jpeg',
    });

    expect(url).toBe('http://localhost:3000/uploads/photo.jpg');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('mirrors to Cloudinary when configured but keeps local URL by default', async () => {
    const filePath = path.join(tempDir, 'photo.jpg');
    await fs.writeFile(filePath, 'image');
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ secure_url: 'https://res.cloudinary.com/demo/image/upload/photo.jpg' }),
    });

    const uploadService = loadUploadService({
      CLOUDINARY_CLOUD_NAME: 'demo',
      CLOUDINARY_API_KEY: 'key',
      CLOUDINARY_API_SECRET: 'secret',
    });

    const url = await uploadService.resolveUploadUrl(makeReq(), {
      filename: 'photo.jpg',
      path: filePath,
      mimetype: 'image/jpeg',
    });

    expect(url).toBe('http://localhost:3000/uploads/photo.jpg');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('can return Cloudinary URL when explicitly configured to do so', async () => {
    const filePath = path.join(tempDir, 'photo.jpg');
    await fs.writeFile(filePath, 'image');
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ secure_url: 'https://res.cloudinary.com/demo/image/upload/photo.jpg' }),
    });

    const uploadService = loadUploadService({
      CLOUDINARY_CLOUD_NAME: 'demo',
      CLOUDINARY_API_KEY: 'key',
      CLOUDINARY_API_SECRET: 'secret',
      UPLOAD_RETURN_CLOUDINARY_URL: true,
    });

    const url = await uploadService.resolveUploadUrl(makeReq(), {
      filename: 'photo.jpg',
      path: filePath,
      mimetype: 'image/jpeg',
    });

    expect(url).toBe('https://res.cloudinary.com/demo/image/upload/photo.jpg');
  });

  test('falls back to local URL if Cloudinary upload fails', async () => {
    const filePath = path.join(tempDir, 'photo.jpg');
    await fs.writeFile(filePath, 'image');
    global.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: 'temporary failure' } }),
    });

    const uploadService = loadUploadService({
      CLOUDINARY_CLOUD_NAME: 'demo',
      CLOUDINARY_API_KEY: 'key',
      CLOUDINARY_API_SECRET: 'secret',
      UPLOAD_RETURN_CLOUDINARY_URL: true,
    });

    const url = await uploadService.resolveUploadUrl(makeReq(), {
      filename: 'photo.jpg',
      path: filePath,
      mimetype: 'image/jpeg',
    });

    expect(url).toBe('http://localhost:3000/uploads/photo.jpg');
  });
});
