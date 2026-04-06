/**
 * Cloudflare Worker to serve demo-ui.html
 * This worker reads the HTML file and serves it as a static asset
 */

import html from './demo-ui.html';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Serve the HTML file for all requests
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  },
};
