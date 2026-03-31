export default defineNuxtRouteMiddleware(async (to) => {
  const { loggedIn, user } = useUserSession()

  const isAdminPage = to.path.startsWith('/admin') && to.path !== '/admin/admin-login'
  const isRefPage = to.path.startsWith('/ref') && to.path !== '/ref/login'

  if (isAdminPage) {
    if (!loggedIn.value || user.value?.role !== 'ADMIN') {
      return abortNavigation({ statusCode: 401, message: 'Unauthorized' })
    }
  } else if (isRefPage) {
    if (!loggedIn.value || !['ADMIN', 'REFEREE'].includes(user.value?.role ?? '')) {
      return navigateTo('/ref/login')
    }
  }
})
