const swaggerSpec = require('./swagger');
const { aiPaths, extraSchemas, buildAiOpenApiSpec } = require('../../scripts/export-ai-api');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergePaths(basePaths = {}, extraPaths = {}) {
  const merged = { ...basePaths };

  for (const [route, operations] of Object.entries(extraPaths)) {
    merged[route] = {
      ...(merged[route] || {}),
      ...operations,
    };
  }

  return merged;
}

function mergeTags(baseTags = [], extraTags = []) {
  const tagMap = new Map();

  for (const tag of [...baseTags, ...extraTags]) {
    tagMap.set(tag.name, tag);
  }

  return Array.from(tagMap.values());
}

let openApiSpecCache;

function getOpenApiSpec() {
  if (!openApiSpecCache) {
    const spec = clone(swaggerSpec);
    spec.components = spec.components || {};
    spec.components.schemas = {
      ...(spec.components.schemas || {}),
      ...extraSchemas,
    };
    spec.paths = mergePaths(spec.paths, aiPaths);
    spec.tags = mergeTags(spec.tags, [{
      name: 'AI Bridge',
      description: 'Internal AI service endpoints and inbound provider webhooks',
    }]);
    openApiSpecCache = spec;
  }

  return clone(openApiSpecCache);
}

function getAiOpenApiSpec() {
  return buildAiOpenApiSpec();
}

function renderScalarHtml(specUrl) {
  const scalarConfig = {
    theme: 'default',
    layout: 'modern',
    showSidebar: true,
    showDeveloperTools: 'never',
    hideDownloadButton: false,
    customCss: `
      :root {
        --scalar-sidebar-width: 300px;
      }

      html, body {
        margin: 0;
        width: 100%;
        min-height: 100%;
        background: #f5f7fb;
        overflow: hidden;
      }

      body {
        min-height: 100vh;
      }

      #api-reference {
        display: block;
        width: 100%;
        min-height: 100vh;
      }

      .scalar-app,
      .layout-modern,
      .layout-classic,
      .references-layout,
      .reference-layout {
        min-height: 100vh !important;
        height: 100vh !important;
        overflow: hidden !important;
      }

      .sidebar,
      .references-sidebar,
      .reference-sidebar,
      aside {
        position: sticky !important;
        top: 0 !important;
        align-self: flex-start !important;
        height: 100vh !important;
        max-height: 100vh !important;
        overflow-y: auto !important;
        overflow-x: hidden !important;
      }

      main,
      .references-content,
      .reference-content,
      .content-wrapper {
        height: 100vh !important;
        overflow-y: auto !important;
        overflow-x: hidden !important;
      }

      pre,
      code,
      .markdown,
      .endpoint-path,
      .request-url,
      .scalar-card,
      .scalar-api-reference {
        max-width: 100%;
        overflow-wrap: anywhere;
        word-break: break-word;
      }
    `,
  };
  const serializedConfig = JSON.stringify(scalarConfig).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Ajicore API Reference</title>
    <style>
      html, body {
        margin: 0;
        width: 100%;
        min-height: 100%;
      }
    </style>
  </head>
  <body>
    <script
      id="api-reference"
      data-url="${specUrl}"
      data-configuration='${serializedConfig}'
      src="https://cdn.jsdelivr.net/npm/@scalar/api-reference">
    </script>
  </body>
</html>`;
}

module.exports = {
  getOpenApiSpec,
  getAiOpenApiSpec,
  renderScalarHtml,
};
