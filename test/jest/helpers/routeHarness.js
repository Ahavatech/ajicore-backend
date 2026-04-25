const path = require('path');
const express = require('express');

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';
const BUSINESS_ID = 'business-123';

function abs(relativePath) {
  return path.join(process.cwd(), relativePath);
}

function buildHandlerModule(handlerNames, label) {
  const moduleMock = {};
  const handlers = {};

  handlerNames.forEach((handlerName) => {
    const fn = jest.fn((req, res) => {
      res.status(200).json({
        ok: true,
        label,
        handler: handlerName,
        method: req.method,
        path: req.path,
      });
    });

    moduleMock[handlerName] = fn;
    handlers[handlerName] = fn;
  });

  return { moduleMock, handlers };
}

function createAuthModuleMock(state) {
  const shouldFail = (name) => state.fail === name || state.fail === '*';

  const fail = (res, name) =>
    res.status(state.status || 403).json({
      error: 'Auth Failed',
      message: state.message || `${name} rejected the request`,
      middleware: name,
    });

  const direct = (name, assign) => (req, res, next) => {
    if (shouldFail(name)) return fail(res, name);
    if (assign) assign(req);
    next();
  };

  const factory = (name, assign) => (..._args) => (req, res, next) => {
    if (shouldFail(name)) return fail(res, name);
    if (assign) assign(req);
    next();
  };

  return {
    requireAuth: direct('requireAuth', (req) => {
      req.user = { id: 'user-123', email: 'test@example.com' };
    }),
    requireInternalApiKey: direct('requireInternalApiKey', (req) => {
      req.headers['x-api-key'] = req.headers['x-api-key'] || 'internal-key';
    }),
    requireAiServiceApiKey: direct('requireAiServiceApiKey', (req) => {
      req.headers['x-api-key'] = req.headers['x-api-key'] || 'ai-service-key';
    }),
    requireBusinessAccess: factory('requireBusinessAccess', (req) => {
      req.business = { id: BUSINESS_ID };
    }),
    requireResourceAccess: factory('requireResourceAccess', (req) => {
      req.business = { id: BUSINESS_ID };
    }),
    requireInternalBusinessAccess: factory('requireInternalBusinessAccess', (req) => {
      req.internalBusinessId = req.internalBusinessId || BUSINESS_ID;
    }),
    requireInternalResourceAccess: factory('requireInternalResourceAccess', (req) => {
      req.internalBusinessId = req.internalBusinessId || BUSINESS_ID;
    }),
  };
}

function createRouteHarness({
  routeModulePath,
  basePath,
  controllerModules = [],
  extraMocks = [],
}) {
  jest.resetModules();

  const authState = { fail: null, status: 403, message: '' };
  const controllerHandlers = {};

  jest.doMock(abs('src/api/middlewares/auth.middleware.js'), () => createAuthModuleMock(authState));

  controllerModules.forEach(({ modulePath, handlers, label }) => {
    const built = buildHandlerModule(handlers, label || path.basename(modulePath));
    controllerHandlers[modulePath] = built.handlers;
    jest.doMock(abs(modulePath), () => built.moduleMock);
  });

  extraMocks.forEach(({ modulePath, factory }) => {
    const targetPath = modulePath.startsWith('src/') ? abs(modulePath) : modulePath;
    jest.doMock(targetPath, factory);
  });

  const router = require(abs(routeModulePath));
  const app = express();
  app.use(express.json());
  app.use(basePath, router);
  app.use((req, res) => {
    res.status(404).json({ error: 'Not Found', path: req.path });
  });
  app.use((err, req, res, _next) => {
    res.status(err.statusCode || 500).json({
      error: err.name || 'Error',
      message: err.message,
      path: req.path,
    });
  });

  let server;
  let baseUrl;

  const start = async () => {
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
  };

  const stop = async () => {
    if (!server) return;
    await new Promise((resolve) => server.close(resolve));
    server = null;
  };

  const request = async ({
    method = 'GET',
    path: requestPath,
    query,
    body,
    headers = {},
  }) => {
    const url = new URL(`${baseUrl}${requestPath}`);
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      });
    }

    const response = await fetch(url, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    return { status: response.status, body: payload };
  };

  return {
    authState,
    controllerHandlers,
    request,
    start,
    stop,
  };
}

module.exports = {
  BUSINESS_ID,
  VALID_UUID,
  abs,
  createRouteHarness,
};
