export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname
  // Public legacy links are redirected before Nuxt tries to match a page route.
  if (path === '/' || path === '/events' || path.startsWith('/events/')) {
    return sendRedirect(event, `/id${path === '/' ? '' : path}`, 302)
  }
})
