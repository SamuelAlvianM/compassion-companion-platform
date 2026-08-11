export default defineNuxtRouteMiddleware((to) => {
  // Admin remains a separate demo area. All public pages always use /id or /en.
  if (to.path.startsWith('/admin') || to.path.startsWith('/id') || to.path.startsWith('/en')) return
  return navigateTo(`/id${to.path === '/' ? '' : to.path}`)
})
